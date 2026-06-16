// OpenEral sandbox lifecycle. The upstream openeral maintainers'
// recipe runs everything (provision + Claude Code REPL) in one
// `openshell sandbox create --tty -- openeral` from an interactive
// shell. We can't do that headlessly: createOpenEralSandbox runs via
// wslRun (piped stdio, no TTY), so passing `-- openeral` as the
// trailing command would deadlock — Claude Code's first-run "Use this
// API key?" prompt has no terminal to read from, ssh eventually
// times out, sandbox create returns exit 1.
//
// Two-step shape we use instead:
//
//   1. `openshell sandbox create --no-tty ... -- /bin/true`
//      Provisions the container, uploads /sandbox/db-url, returns as
//      soon as /bin/true exits (≈ container-ready time).
//
//   2. `openshell sandbox exec <name> --tty -- openeral`
//      Spawned by openeral-pty.mjs (node-pty) or openeral-terminal.mjs
//      (external terminal emulator). Both give the wsl.exe child a
//      real PTY, so Claude Code's prompt is answerable on first run
//      and /home/agent persists the answer for re-connects.
//
// Other invariants:
//   - DATABASE_URL is staged as a FILE (one file, not a directory) in
//     the distro at /tmp/openeral-db-url-<uuid> and uploaded to
//     /sandbox/db-url. The openeral image's setup.sh reads it from
//     there at first `openeral` exec.
//   - ANTHROPIC_API_KEY rides in via env + WSLENV; --auto-providers
//     auto-creates the `claude` provider from it at create time.
//   - No --gateway flag: relies on the active selected gateway, which
//     the installer registers via `gateway add --local --name openshell`
//     and selects via `gateway select`.
//   - The rootfs MUST include openssh-client — openshell shells out
//     to ssh/scp for upload, connect, exec, download.

import { randomUUID } from "node:crypto";

import { getCliInfo } from "./cli.mjs";
import { getCredential } from "./openeral-credentials.mjs";
import { DISTRO_NAME, wslRun, wslSpawn } from "./wsl.mjs";

const SANDBOX_IMAGE = "ghcr.io/sandys/openeral/sandbox:just-bash";
const IMAGE_BY_PROFILE = {
  "openeral-claude": SANDBOX_IMAGE,
  "openeral-openclaw": SANDBOX_IMAGE,
};

const DEFAULT_PULL_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_CREATE_TIMEOUT_MS = 3 * 60_000;
const DEFAULT_PROBE_TIMEOUT_MS = 15_000;

// StringCost cost-tracking control plane. Defaults to the hosted service;
// override with STRINGCOST_API_BASE=http://<host>:8080 to point at a
// self-hosted stack for local end-to-end testing. Mirrors the same default
// and override the sandbox's setup.sh uses internally.
const STRINGCOST_API_BASE = (process.env.STRINGCOST_API_BASE || "https://app.stringcost.com").replace(
  /\/+$/,
  "",
);
const STRINGCOST_PRESIGN_TIMEOUT_MS = 30_000;

// Docker pulls happen under user `banker` inside the distro. If Docker
// Desktop's WSL integration ever ran for this distro (or runs again on
// a future boot) it can write a `credsStore: "desktop"` line into
// ~/.docker/config.json that points at /mnt/c/.../docker-credential-desktop.exe.
// Linux docker can't exec a Windows binary — pulls then fail with
// `exec format error`. We route our docker invocations through an empty
// managed config dir so the credential helper is never invoked. The
// images we pull (openeral sandbox, postgres:16-alpine) are public, so
// skipping credentials is correct, not a workaround.
const DOCKER_CONFIG_DIR = "/tmp/openwork-docker-config";

export function imageForProfile(profile) {
  const img = IMAGE_BY_PROFILE[profile];
  if (!img) throw new Error(`Unknown OpenEral profile: ${profile}`);
  return img;
}

/**
 * Pull the OpenEral image into the distro's Docker. Streamed via
 * wslSpawn so a long-running pull shows incremental progress.
 *
 * @param {string} imageRef
 * @param {{ onProgress?: (text: string) => void, timeoutMs?: number }} [options]
 */
export async function pullImage(imageRef, options = {}) {
  const { onProgress, timeoutMs = DEFAULT_PULL_TIMEOUT_MS } = options;
  return new Promise((resolve, reject) => {
    const child = wslSpawn([
      "-d",
      DISTRO_NAME,
      "--",
      "bash",
      "-c",
      `mkdir -p ${DOCKER_CONFIG_DIR} && exec docker --config ${DOCKER_CONFIG_DIR} pull ${shellQuote(imageRef)}`,
    ]);
    let lastStderr = "";
    const tail = (chunk) => {
      const text = chunk.toString("utf8");
      lastStderr = text;
      onProgress?.(text);
    };
    child.stdout.on("data", tail);
    child.stderr.on("data", tail);
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      reject(new Error(`docker pull ${imageRef} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true });
      else reject(new Error(`docker pull ${imageRef} failed (exit ${code}): ${lastStderr.trim()}`));
    });
  });
}

/**
 * Parse the raw openshell sandbox list output into a normalised array.
 * Returns null only when the raw text cannot yield any sandbox list at all.
 *
 * The openshell CLI has emitted several JSON shapes across releases:
 *   - Flat array:                  [...sandbox objects...]
 *   - {sandboxes: [...]}           early releases
 *   - {items: [...]}               v0.0.3x
 *   - {data: [...]}                v0.0.4x
 *   - {results: [...]}             some builds
 *   - {page: ..., items: [...]}    paginated response
 *
 * If none of the known envelope keys match, we fall back to the FIRST
 * Array-valued key found in the object, so future CLI versions with a
 * new envelope key still work without a code change.
 *
 * Each item is either a plain string (name only) or an object that may
 * carry phase/status fields depending on the CLI version.
 */
function parseSandboxList(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    // Not valid JSON at all — caller falls back to text search.
    return null;
  }

  // Flat array
  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    // Known envelope keys (add new ones here as the CLI evolves)
    for (const key of ["sandboxes", "items", "data", "results", "namespaces"]) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    // Generic fallback: return the first array value found
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key])) {
        console.warn(`[parseSandboxList] using unknown envelope key "${key}"`);
        return parsed[key];
      }
    }
  }

  return null;
}

/**
 * Parse `openshell sandbox list` (plain-text table, no --json flag) to
 * find the PHASE of a specific sandbox. Returns null when the sandbox is
 * absent from the output or the phase column cannot be located.
 *
 * CLI 0.0.42 does NOT support `--json` for `sandbox list` — it exits 0
 * but writes "unexpected argument '--json' found" to stdout. This helper
 * uses the ANSI text table that plain `sandbox list` emits instead.
 *
 * Typical table format (with optional ANSI colour codes):
 *   NAME                               CREATED        PHASE
 *   openeral-test-workspace23edf4545   2 minutes ago  Provisioning
 */
function parseListTextPhase(stdout, sandboxName) {
  // Strip ANSI escape sequences (colour, bold, cursor-movement codes).
  const clean = stdout.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const lines = clean.split(/\r?\n/);

  // Locate the header row to find the column offset of PHASE.
  let phaseOffset = -1;
  for (const line of lines) {
    const up = line.toUpperCase();
    if (up.includes("NAME") && up.includes("PHASE")) {
      phaseOffset = up.indexOf("PHASE");
      break;
    }
  }

  // Scan every row for the sandbox name.
  for (const line of lines) {
    if (!line.includes(sandboxName)) continue;

    // Use the column offset when the header was found.
    if (phaseOffset >= 0 && line.length > phaseOffset) {
      const phase = line.slice(phaseOffset).trim().split(/\s+/)[0];
      if (phase) return phase;
    }

    // Fallback: split on 2+ consecutive spaces and take the last token
    // (works for table formats where there is no fixed column alignment).
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].trim();
      if (last) return last;
    }
  }

  return null;
}

/**
 * List all sandboxes by parsing the plain `openshell sandbox list` ANSI text
 * table into structured rows `{ name, created, phase }`.
 *
 * CLI 0.0.45 does NOT support `--json` for `sandbox list` (it errors with
 * "unexpected argument '--json' found"), so the JSON path in client.mjs throws
 * and the OpenEral session list comes back empty. This text parser is the
 * reliable source for the Sandboxes manager. Best-effort: returns [] when the
 * gateway is unreachable or no rows parse.
 *
 * @returns {Promise<Array<{ name: string, created: string, phase: string }>>}
 */
export async function listSandboxes() {
  let r;
  try {
    r = await wslRun(
      ["-d", DISTRO_NAME, "--", "bash", "-c", "timeout 15 openshell sandbox list"],
      { timeout: 25_000 },
    );
  } catch {
    return [];
  }
  if (r.exitCode !== 0) return [];
  // Strip ANSI colour/style codes, then parse by the header's column offsets.
  const clean = r.stdout.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const lines = clean.split(/\r?\n/);
  let headerLine = null;
  let nameOff = -1;
  let createdOff = -1;
  let phaseOff = -1;
  for (const line of lines) {
    const up = line.toUpperCase();
    if (up.includes("NAME") && up.includes("PHASE")) {
      headerLine = line;
      nameOff = up.indexOf("NAME");
      createdOff = up.indexOf("CREATED");
      phaseOff = up.indexOf("PHASE");
      break;
    }
  }
  const rows = [];
  let pastHeader = false;
  for (const line of lines) {
    if (!pastHeader) {
      if (line === headerLine) pastHeader = true;
      continue;
    }
    if (!line.trim()) continue;
    let name;
    let created;
    let phase;
    if (nameOff >= 0 && phaseOff > nameOff) {
      const nameEnd = createdOff > nameOff ? createdOff : phaseOff;
      name = line.slice(nameOff, nameEnd).trim();
      created = createdOff >= 0 ? line.slice(createdOff, phaseOff).trim() : "";
      phase = (line.slice(phaseOff).trim().split(/\s+/)[0] ?? "").trim();
    } else {
      // Fallback: split on runs of 2+ spaces.
      const parts = line.trim().split(/\s{2,}/);
      name = (parts[0] ?? "").trim();
      created = parts.length >= 3 ? parts[1].trim() : "";
      phase = (parts[parts.length - 1] ?? "").trim();
    }
    if (name) rows.push({ name, created, phase });
  }
  return rows;
}

/**
 * Poll `openshell sandbox list` until the named sandbox reports a
 * Ready/running phase, or until the timeout elapses.
 *
 * @param {string} name
 * @param {{ timeoutMs?: number, pollMs?: number, onProgress?: Function }} [opts]
 */
async function waitForSandboxReady(name, opts = {}) {
  const { timeoutMs = 120_000, pollMs = 4_000, onProgress } = opts;
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  // Track the first time we see a "Provisioning" phase so we can detect
  // sandboxes that are stuck (never transition to Ready).
  let firstProvisioningAt = null;
  const STUCK_PROVISIONING_THRESHOLD_MS = 90_000; // 90 s in Provisioning → stuck
  // Track whether we've seen the sandbox in a "Deleting" phase so we can
  // detect when it disappears and signal the caller to create a fresh one.
  let sawDeleting = false;

  while (Date.now() < deadline) {
    attempt += 1;
    // 20 s outer timeout gives 10 s slack after bash's inner 10 s timer
    // fires, so wsl.exe has time to exit before wslRun's own timer does.
    let r;
    try {
      // Use plain `sandbox list` (no --json). CLI 0.0.42 does not support
      // --json for this subcommand — it exits 0 but writes an error string
      // to stdout, causing parseSandboxList to return null every time.
      // parseListTextPhase reads the phase directly from the ANSI text table.
      r = await wslRun(
        ["-d", DISTRO_NAME, "--", "bash", "-c", "timeout 10 openshell sandbox list"],
        { timeout: 20_000 },
      );
    } catch {
      // Gateway unreachable during polling — report progress and keep
      // waiting; the sandbox may still transition to Ready.
      onProgress?.({ phase: "waiting", message: `Gateway unresponsive (attempt ${attempt}), retrying…` });
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    if (r.exitCode === 0) {
      const phase = parseListTextPhase(r.stdout, name)?.toLowerCase() ?? null;
      if (phase !== null) {
        // Sandbox is visible in the list — check its phase.
        if (!phase || /ready|running/i.test(phase)) return;
        if (/error|failed/i.test(phase)) {
          throw new Error(`Sandbox ${name} is in error state (${phase}). Delete it and reconnect.`);
        }
        // Sandbox is being deleted — record that we saw it deleting so when
        // it disappears from the list we know to create fresh rather than
        // treating the absence as "still provisioning".
        if (/delet/i.test(phase)) {
          sawDeleting = true;
          onProgress?.({ phase: "waiting", message: `Sandbox is deleting; waiting for deletion to complete…` });
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          continue;
        }
        // Detect sandboxes stuck in Provisioning. If the sandbox has been
        // in a provisioning-like state for longer than the threshold, bail
        // out early with a clear error so the renderer can offer a
        // "Delete and start fresh" action rather than spinning forever.
        if (/provision/i.test(phase)) {
          if (!firstProvisioningAt) firstProvisioningAt = Date.now();
          const stuckMs = Date.now() - firstProvisioningAt;
          if (stuckMs > STUCK_PROVISIONING_THRESHOLD_MS) {
            throw new Error(
              `STUCK_PROVISIONING: Sandbox "${name}" has been in "${phase}" state for ` +
                `over ${Math.round(stuckMs / 1000)}s and appears stuck. ` +
                `Delete the sandbox and reconnect to create a fresh one. ` +
                `If the error persists, restart the OpenShell gateway from Settings \u2192 Sandbox \u2192 OpenShell health.`,
            );
          }
        } else {
          // Phase changed away from Provisioning — reset the timer.
          firstProvisioningAt = null;
        }
        onProgress?.({ phase: "waiting", message: `Sandbox is ${phase} (attempt ${attempt}), waiting…` });
      } else if (sawDeleting) {
        // phase === null and we previously saw "Deleting" → sandbox is gone.
        // Signal the caller to create a fresh sandbox instead of proceeding
        // optimistically (finalizeSandboxLaunch would fail on a deleted sandbox).
        throw new Error(
          `SANDBOX_DELETED: Sandbox "${name}" has finished deleting. ` +
            `A fresh sandbox will be created automatically.`,
        );
      }
      // phase === null and no prior "Deleting" → sandbox not yet visible in
      // the list (still provisioning). Keep polling.
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  // Timed out without confirming Ready — if we last saw a provisioning phase
  // treat it as stuck rather than proceeding optimistically (the exec would
  // fail anyway with "phase: Provisioning").
  if (firstProvisioningAt) {
    throw new Error(
      `STUCK_PROVISIONING: Sandbox "${name}" did not reach Ready state within ${Math.round(timeoutMs / 1000)}s ` +
        `(last observed phase: Provisioning). ` +
        `Delete the sandbox and reconnect to create a fresh one. ` +
        `If the error persists, restart the OpenShell gateway from Settings \u2192 Sandbox \u2192 OpenShell health.`,
    );
  }
  // Non-provisioning timeout — proceed; exec may succeed if setup.sh just finished.
  onProgress?.({ phase: "timeout", message: "Sandbox did not confirm Ready state; attempting to connect anyway." });
}

/**
 * True if a sandbox with this name is registered. Used to short-circuit
 * createOpenEralSandbox when re-opening a workspace.
 *
 * Tolerates the flat-array (`[...]`) and envelope (`{sandboxes:[...]}`,
 * `{items:[...]}`) JSON shapes the upstream CLI has emitted across releases.
 */
export async function sandboxExists(name) {
  if (!name) return false;
  // Wrap with bash timeout so the openshell CLI is force-killed after
  // 15 s if the gateway is unreachable. Without this wrapper the
  // process hangs until wslRun's full timeout fires — making the UI
  // appear frozen. bash exits 124 when it kills the child.
  //
  // wslRun timeout is set to 25 s (10 s slack after bash's 15 s fires).
  // Without the extra slack wsl.exe can outlive the bash timeout and
  // trigger wslRun's own timer — throwing a raw "wsl.exe timed out"
  // error before the exitCode === 124 check below is ever reached.
  // CLI 0.0.42 does NOT support `--json` for `sandbox list` — it exits 0
  // but writes "unexpected argument '--json' found" to stdout, which causes
  // parseSandboxList to return null and the fallback text-includes check to
  // miss the sandbox name (the error message doesn't contain it).
  // `--names` outputs one sandbox name per line and is supported in 0.0.42.
  let r;
  try {
    r = await wslRun(
      ["-d", DISTRO_NAME, "--", "bash", "-c", "timeout 15 openshell sandbox list --names"],
      { timeout: 25_000 },
    );
  } catch (err) {
    // wslRun throws (never returns r) when its own timer fires.
    // Map any timeout to the user-friendly gateway message so the
    // renderer can show a clear call-to-action instead of a raw stack.
    throw new Error(
      "OpenShell gateway is not responding (sandbox list timed out). " +
        "Restart the gateway from Settings \u2192 Sandbox \u2192 OpenShell health \u2192 Restart Gateway, " +
        "then try again.",
    );
  }
  if (r.exitCode === 124) {
    throw new Error(
      "OpenShell gateway is not responding (openshell sandbox list timed out). " +
        "Restart the gateway from Settings \u2192 Sandbox \u2192 OpenShell health \u2192 Restart Gateway, " +
        "then try again.",
    );
  }
  if (r.exitCode !== 0) return false;
  // --names outputs one sandbox name per line (no JSON).
  const names = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (names.includes(name)) return true;
  // Fallback: if --names flag is not supported by a future CLI version and the
  // output falls back to a text/JSON format, check whether the raw output
  // contains the sandbox name anywhere (conservative — avoids a spurious create).
  if (names.length === 0 && r.stdout.includes(name)) {
    console.warn(`[sandboxExists] --names may be unsupported; found "${name}" via text search.`);
    return true;
  }
  return false;
}

/**
 * Build the wsl.exe env that forwards ANTHROPIC_API_KEY (and, for the
 * openclaw profile, OPENERAL_AGENT) into the Linux side. WSL only
 * forwards env vars whose names appear in WSLENV.
 */
function buildWslEnvForwarding(extra) {
  const forwardedNames = Object.keys(extra);
  const existingWslEnv = process.env.WSLENV ? [process.env.WSLENV] : [];
  return {
    ...process.env,
    ...extra,
    WSLENV: [...existingWslEnv, ...forwardedNames].join(":"),
  };
}

/**
 * Single-quote a string for safe embedding in a bash command.
 * Replaces any embedded ' with the standard `'\''` escape so the value
 * always rides as a single bash token even if it contains spaces or
 * shell metachars.
 */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

/**
 * Derive the `ANTHROPIC_BASE_URL` an agent should use from a StringCost
 * presign URL.
 *
 * The control plane mints a single-path presign whose URL already ends in
 * `/v1/messages` (e.g. `https://proxy.stringcost.com/stringcost-proxy/t/<token>/v1/messages`).
 * Claude Code / OpenClaw append `/v1/messages` themselves, so the base URL
 * we hand them must NOT include it — otherwise the proxy sees
 * `/v1/messages/v1/messages` and rejects it with "Path not authorized".
 *
 * Accepts the hosted shape (proxy.stringcost.com) and any self-hosted
 * `http(s)://<host>/stringcost-proxy/t/<token>` shape. Returns null when the
 * URL doesn't look like a StringCost proxy URL so callers can skip the
 * injection rather than write a garbage base URL.
 *
 * @param {string} presignUrl
 * @returns {string | null}
 */
function stringcostBaseUrlForAgent(presignUrl) {
  if (typeof presignUrl !== "string") return null;
  let url = presignUrl.trim().replace(/\/+$/, ""); // drop trailing slash(es)
  url = url.replace(/\/v1\/messages$/, "").replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+\/stringcost-proxy\/t\/[^/]+$/.test(url)) return null;
  return url;
}

/**
 * Build an `openshell sandbox exec` command that runs an arbitrary multi-line
 * shell script inside the container without nested-quoting hell: the script is
 * base64-encoded on the host and decoded + piped to `sh` in the sandbox. Only
 * the base64 blob (A–Z a–z 0–9 + / =) crosses the command line, so embedded
 * quotes, newlines, and `$` in the script never need escaping.
 *
 * @param {string} name  Sandbox name
 * @param {string} script  POSIX sh script to run in the container
 * @returns {string}  A `bash -c`-ready command string
 */
function sandboxRunScriptCmd(name, script) {
  const b64 = Buffer.from(script, "utf8").toString("base64");
  return (
    `openshell sandbox exec --name ${shellQuote(name)} -- ` +
    `sh -c ${shellQuote(`printf %s ${shellQuote(b64)} | base64 -d | sh`)}`
  );
}

/**
 * Ensure the distro has `scp`/`ssh` (openssh-client) before any sandbox op.
 *
 * `openshell sandbox create --upload`, `exec`, `connect`, and `download` all
 * shell out to the local scp/ssh binaries. On a distro imported from a rootfs
 * that predates the openssh-client requirement — or where the docker install
 * phase ran before this dependency was added — those binaries are missing and
 * EVERY sandbox operation dies with a cryptic
 * `Error: × No such file or directory (os error 2)` (Rust's Command::spawn
 * failing to find the binary, not a missing upload source).
 *
 * The installer's docker phase now bakes openssh-client in, but that phase is
 * marked complete on already-provisioned distros and won't re-run — so this
 * guard self-heals existing installs. It's a fast `command -v` check that only
 * apt-installs (root, ~5s) when scp/ssh are actually absent.
 *
 * @param {(evt: {phase: string, message: string}) => void} [onProgress]
 */
async function ensureOpensshClient(onProgress) {
  const present = await wslRun(
    ["-d", DISTRO_NAME, "--", "bash", "-c", "command -v scp >/dev/null && command -v ssh >/dev/null"],
    { timeout: 15_000 },
  ).catch(() => ({ exitCode: 1 }));
  if (present.exitCode === 0) return;

  onProgress?.({
    phase: "deps",
    message: "Installing openssh-client (required for sandbox file transfer)…",
  });
  const script = [
    "set -e",
    "export DEBIAN_FRONTEND=noninteractive",
    "apt-get update -qq",
    "apt-get install -y openssh-client",
  ].join("\n");
  const r = await wslRun(
    ["-d", DISTRO_NAME, "--user", "root", "--", "bash", "-c", script],
    { timeout: 5 * 60_000 },
  ).catch((err) => ({ exitCode: -1, stdout: "", stderr: err?.message ?? String(err) }));
  if (r.exitCode !== 0) {
    throw new Error(
      `openssh-client is missing from the "${DISTRO_NAME}" distro and could not be ` +
        `installed automatically — openshell needs scp/ssh to provision sandboxes. ` +
        `Install it manually with: wsl -d ${DISTRO_NAME} --user root -- ` +
        `apt-get install -y openssh-client  ` +
        `(apt error: ${(r.stderr || r.stdout || "unknown").trim().slice(0, 200)})`,
    );
  }
}

/**
 * Configure how the agent starts inside the sandbox: export the StringCost
 * proxy env (when a presign was minted) and auto-launch the agent so the user
 * never has to type `claude`.
 *
 * Why this is needed: the published image's entrypoint is /bin/bash and
 * OpenShell's supervisor starts the agent as an interactive `bash -i`. That
 * sources /sandbox/.bashrc but never runs the image's /opt/openeral/setup.sh,
 * so (a) the uploaded StringCost presign is ignored — the agent talks to
 * Anthropic directly and nothing is metered — and (b) the session drops to a
 * shell prompt instead of launching the agent. We fix both by writing a single
 * managed block to /sandbox/.bashrc:
 *   - export ANTHROPIC_BASE_URL (proxy) + a throwaway ANTHROPIC_AUTH_TOKEN and
 *     unset the OpenShell placeholder ANTHROPIC_API_KEY (StringCost auths via
 *     the token embedded in the proxy URL and bills the real key stored with
 *     the presign);
 *   - `exec <agent>` so Claude Code / OpenClaw starts directly. The guard
 *     (OPENWORK_AGENT_LAUNCHED + a tty check) makes sure only the top-level
 *     interactive shell auto-launches — nested shells the agent itself spawns
 *     inherit OPENWORK_AGENT_LAUNCHED=1 and fall through to a normal shell.
 * For Claude Code we also merge ANTHROPIC_BASE_URL into ~/.claude/settings.json
 * so it applies even if a launch isn't an interactive bash.
 *
 * Idempotent (drops any prior block first) and best-effort (a failure leaves
 * the sandbox usable, just without auto-launch / metering).
 *
 * @param {{ name: string, profile: string, proxyBase: string | null,
 *           env: NodeJS.ProcessEnv, onProgress?: Function }} args
 */

/**
 * Pure helper: build the .bashrc block lines for a given agent launch config.
 * Exported via __testing so the block content can be verified without calling
 * wslRun. configureAgentLaunch delegates to this.
 *
 * For openclaw, the block follows the same flow as setup.sh:
 *   1. Load API key + set runtime env (OPENCLAW_NO_RESPAWN, compile cache, etc.)
 *   2. Write minimal openclaw.json (gateway.mode=local, handshakeTimeoutMs=30000)
 *   3. Run `openclaw onboard` once (creates auth-profiles.json; does NOT need
 *      the gateway to be running — setup.sh also runs onboard before starting
 *      the gateway)
 *   4. Start gateway with `setsid` so it survives after `exec openclaw` replaces
 *      bash. Without setsid the gateway is in the same session and receives SIGHUP
 *      when the terminal disconnects, killing it between reconnects.
 *   5. Wait up to 600 s for /readyz with visible progress messages so the user
 *      doesn't see a black screen.
 *   6. exec env -u OPENCLAW_PLUGIN_STAGE_DIR ... openclaw
 *      OPENCLAW_PLUGIN_STAGE_DIR must NOT reach the TUI process: forwarding it
 *      causes openclaw to run its own concurrent staging loop that saturates the
 *      event loop and makes the terminal unresponsive.
 *
 * @param {string} profile
 * @param {string | null} proxyBase  StringCost proxy base URL, or null
 * @returns {string}  The bash block content (lines joined by \n)
 */
function buildLaunchBlock(profile, proxyBase, apiKey = null) {
  const isClaude = profile !== "openeral-openclaw";
  const block = ["# >>> openwork launch >>>"];

  if (proxyBase) {
    block.push(
      `export ANTHROPIC_BASE_URL="${proxyBase}"`,
      'export ANTHROPIC_AUTH_TOKEN="openwork-stringcost"',
    );
    if (isClaude) {
      // Claude Code auths via the proxy URL token — the real key is not needed.
      block.push("unset ANTHROPIC_API_KEY");
    }
    // OpenClaw keeps ANTHROPIC_API_KEY: it needs the real key for `openclaw onboard`.
  }

  if (!isClaude) {
    block.push(
      // ── Step 1: load real API key and runtime env ──────────────────────
      // Embed key directly as primary source so the key is always available
      // even if the file upload timed out at launch time.
      ...(apiKey ? [`export ANTHROPIC_API_KEY="${apiKey}"`] : []),
      // Override from file if a newer key was uploaded to the sandbox.
      "if [ -f /sandbox/anthropic-api-key ]; then",
      "  _fk=\"$(tr -d '[:space:]' < /sandbox/anthropic-api-key)\"",
      "  [ -n \"$_fk\" ] && export ANTHROPIC_API_KEY=\"$_fk\"",
      "fi",
      "export HOME=/home/agent",
      "export OPENCLAW_NO_RESPAWN=1",
      "export NODE_COMPILE_CACHE=/tmp/openclaw-compile-cache",
      // OPENCLAW_PLUGIN_STAGE_DIR is for the gateway + onboard ONLY.
      // Must be unset before exec'ing the TUI (see exec block below).
      "export OPENCLAW_PLUGIN_STAGE_DIR=/tmp/openclaw-plugin-runtime-deps",
      "export GIT_SSL_NO_VERIFY=true",
      "export npm_config_strict_ssl=false",
      "mkdir -p /tmp/openclaw-compile-cache /tmp/openclaw-plugin-runtime-deps",
      // Seed V8 bytecode cache from image-baked copy (drastically reduces cold start).
      "[ -d /opt/openclaw-compile-cache ] && cp -rn /opt/openclaw-compile-cache/. /tmp/openclaw-compile-cache/ 2>/dev/null || true",
      // Seed plugin stage dir from image-baked cache BEFORE onboard runs.
      // Without this, openclaw onboard tries to stage plugins via npm-via-git
      // (git+ssh:// URLs) which is blocked by the sandbox's port-22 policy — even
      // with git URL rewrites the native-binary packages can stall for the full
      // timeout. Pre-seeding from /opt/openclaw-plugin-cache (the Dockerfile-baked
      // copy) means onboard finds everything already staged and completes in seconds.
      "[ -d /opt/openclaw-plugin-cache ] && cp -rn /opt/openclaw-plugin-cache/. /tmp/openclaw-plugin-runtime-deps/ 2>/dev/null || true",
      // Git URL rewrites: npm-via-git uses ssh:// URLs that are blocked in the
      // sandbox (port 22). Rewrite to https:// so OpenShell's TLS proxy handles them.
      "HOME=/home/agent git config --global --unset-all 'url.https://github.com/.insteadOf' 2>/dev/null || true",
      "HOME=/home/agent git config --global --add 'url.https://github.com/.insteadOf' 'ssh://git@github.com/' 2>/dev/null || true",
      "HOME=/home/agent git config --global --add 'url.https://github.com/.insteadOf' 'git@github.com:' 2>/dev/null || true",
      "HOME=/home/agent git config --global --add 'url.https://github.com/.insteadOf' 'git+ssh://git@github.com/' 2>/dev/null || true",
      "HOME=/home/agent git config --global http.sslVerify false 2>/dev/null || true",
      // ── Step 2: write auth-profiles.json directly (no openclaw onboard) ─────
      // openclaw onboard --non-interactive blocks for 10–30 min because it
      // triggers openclaw's plugin staging machinery which tries to npm-install
      // native packages via git+ssh:// URLs (e.g. libsignal-node). Port 22 is
      // blocked by the sandbox network policy; git URL rewrites help for some
      // deps but not all, so the install stalls until the 600 s timeout fires.
      //
      // auth-profiles.json is the ONLY file the agent runtime needs from onboard.
      // We write it directly in the exact same JSON shape openclaw onboard
      // produces, as documented in openclaw's auth profile schema. The gateway,
      // provider config, and model settings are all handled in openclaw.json
      // (Step 3 below), which openclaw onboard would have clobbered anyway.
      "_auth=/home/agent/.openclaw/agents/main/agent/auth-profiles.json",
      "if [ ! -s \"$_auth\" ] && [ -n \"${ANTHROPIC_API_KEY:-}\" ]; then",
      "  printf '\\r\\033[K\\033[33m[OpenWork] Writing OpenClaw auth profile...\\033[0m\\n'",
      "  node -e \"",
      "const fs = require('fs'), path = require('path');",
      "const f = process.argv[1];",
      "const k = process.env.ANTHROPIC_API_KEY || '';",
      "if (!k || k.startsWith('openshell:')) process.exit(0);",
      "const p = {version:1,profiles:{anthropic:{provider:'anthropic',authType:'apiKey',apiKey:k,createdAt:new Date().toISOString(),source:'openwork-direct'}},defaultProfile:'anthropic'};",
      "fs.mkdirSync(path.dirname(f), {recursive:true, mode:0o700});",
      "fs.writeFileSync(f, JSON.stringify(p,null,2), {mode:0o600});",
      "\" \"$_auth\" 2>/dev/null || true",
      "fi",
      // ── Steps 3–5c: run ONLY when gateway is not already running ─────────────
      // CRITICAL architectural fix (mirrors setup.sh exactly):
      //   openclaw.json is written INSIDE this block so it is never touched while
      //   the gateway is live. Writing the file while the gateway runs triggers
      //   its inotify watcher → live config reload → gateway crash. By gating on
      //   /readyz first, config is always written to a stopped gateway.
      //   On reconnect (gateway already running) this entire block is skipped →
      //   exec openclaw is reached immediately, making reconnect near-instant.
      "if ! curl -fsS http://127.0.0.1:18789/readyz >/dev/null 2>&1; then",
      // ── Step 3: write openclaw.json (gateway not running — inotify-safe) ────
      // MUST be after onboard: openclaw onboard overwrites openclaw.json with its
      // own defaults. We write gateway.mode=local, handshakeTimeoutMs=30000, and
      // the StringCost provider AFTER onboard and BEFORE starting the gateway,
      // matching setup.sh's lines 803–908 exactly.
      "  node -e \"",
      "const fs = require('fs');",
      "const dir = '/home/agent/.openclaw';",
      "const file = dir + '/openclaw.json';",
      "let c = {};",
      "try { c = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) {}",
      "if (!c.env) c.env = {};",
      "if (!c.gateway) c.gateway = {};",
      // Delete any stale auth token from a previous gateway run. The gateway
      // writes gateway.auth.token to openclaw.json when it starts. If a new
      // gateway sees an old token it didn't generate, it rejects it and crashes,
      // causing /readyz to never respond. Clearing it gives the new gateway a
      // clean slate — it will write a fresh token on startup.
      "delete c.gateway.auth;",
      "if (!c.gateway.mode) c.gateway.mode = 'local';",
      "if (!c.gateway.handshakeTimeoutMs) c.gateway.handshakeTimeoutMs = 30000;",
      "if (!c.agents) c.agents = {};",
      "if (!c.agents.defaults) c.agents.defaults = {};",
      "if (!c.agents.defaults.model) c.agents.defaults.model = {};",
      "if (!c.agents.defaults.model.primary) c.agents.defaults.model.primary = 'anthropic/claude-sonnet-4-6';",
      "const k = process.env.ANTHROPIC_API_KEY || '';",
      "if (k && !k.startsWith('openshell:')) c.env.ANTHROPIC_API_KEY = k; else delete c.env.ANTHROPIC_API_KEY;",
      // StringCost integration: route Anthropic traffic through the proxy.
      // openclaw's built-in 'anthropic' provider hardcodes api.anthropic.com and
      // ignores ANTHROPIC_BASE_URL for routing (openclaw issue #56679). The reliable
      // path is to register a new provider with api:'anthropic-messages' and remap
      // anthropic/* model refs to stringcost/*. env.ANTHROPIC_BASE_URL is still
      // written so child processes using the bare @anthropic-ai/sdk inherit it.
      "const _baseUrl = process.env.ANTHROPIC_BASE_URL || '';",
      "if (_baseUrl) { c.env.ANTHROPIC_BASE_URL = _baseUrl; } else { delete c.env.ANTHROPIC_BASE_URL; }",
      "delete c.env.ANTHROPIC_AUTH_TOKEN;",
      "if (_baseUrl) {",
      "  if (!c.models) c.models = {};",
      "  if (!c.models.mode) c.models.mode = 'merge';",
      "  if (!c.models.providers) c.models.providers = {};",
      "  const _apiKey = (k && !k.startsWith('openshell:')) ? k : 'stringcost-presign-auth';",
      "  c.models.providers.stringcost = {",
      "    baseUrl: _baseUrl, api: 'anthropic-messages', apiKey: _apiKey,",
      "    models: [",
      "      {id:'claude-sonnet-4-6',name:'Claude Sonnet 4.6',contextWindow:1000000,maxTokens:64000},",
      "      {id:'claude-opus-4-7',name:'Claude Opus 4.7',contextWindow:1000000,maxTokens:32000},",
      "      {id:'claude-haiku-4-5',name:'Claude Haiku 4.5',contextWindow:200000,maxTokens:8192},",
      "    ],",
      "  };",
      "  const _remap = id => (typeof id === 'string' && id.startsWith('anthropic/')) ? 'stringcost/' + id.slice('anthropic/'.length) : id;",
      "  if (c.agents.defaults.model.primary) c.agents.defaults.model.primary = _remap(c.agents.defaults.model.primary);",
      "  if (Array.isArray(c.agents.defaults.model.fallbacks)) c.agents.defaults.model.fallbacks = c.agents.defaults.model.fallbacks.map(_remap);",
      "  if (c.models.providers.anthropic) { delete c.models.providers.anthropic.baseUrl; delete c.models.providers.anthropic.apiKey; delete c.models.providers.anthropic.api; }",
      "} else {",
      "  if (c.models && c.models.providers) { delete c.models.providers.stringcost; if (c.models.providers.anthropic) { delete c.models.providers.anthropic.baseUrl; delete c.models.providers.anthropic.apiKey; delete c.models.providers.anthropic.api; } }",
      "  const _restore = id => (typeof id === 'string' && id.startsWith('stringcost/')) ? 'anthropic/' + id.slice('stringcost/'.length) : id;",
      "  if (c.agents.defaults.model.primary) c.agents.defaults.model.primary = _restore(c.agents.defaults.model.primary);",
      "  if (Array.isArray(c.agents.defaults.model.fallbacks)) c.agents.defaults.model.fallbacks = c.agents.defaults.model.fallbacks.map(_restore);",
      "}",
      "fs.mkdirSync(dir, { recursive: true, mode: 0o700 });",
      "fs.writeFileSync(file, JSON.stringify(c, null, 2), { mode: 0o600 });",
      "  \" 2>/dev/null || true",
      // ── Step 4: start gateway with setsid ────────────────────────────────────
      // setsid puts the gateway in a new session so it is NOT in the same
      // process group as bash. When bash execs openclaw and the user later
      // quits, SIGHUP goes to the terminal's foreground pgroup — not the
      // gateway's session. Without setsid the gateway dies on disconnect.
      //
      // Kill any zombie/unhealthy gateway process first. If a previous gateway
      // crashed but left a process still holding port 18789, the new gateway
      // would fail to bind immediately and exit. The readyz check above only
      // detects "no response" — it can't tell the difference between "gateway
      // not running" and "gateway running but unhealthy". Killing all openclaw
      // gateway processes here ensures the port is free before we start fresh.
      "  pkill -f 'openclaw gateway' 2>/dev/null || true",
      "  sleep 1",
      "  printf '\\r\\033[K\\033[33m[OpenWork] Starting OpenClaw gateway...\\033[0m\\n'",
      "  setsid env OPENCLAW_SKIP_ONBOARDING=1 OPENCLAW_HANDSHAKE_TIMEOUT_MS=30000 \\",
      "    OPENCLAW_NO_RESPAWN=1 NODE_COMPILE_CACHE=/tmp/openclaw-compile-cache \\",
      "    OPENCLAW_PLUGIN_STAGE_DIR=/tmp/openclaw-plugin-runtime-deps \\",
      "    GIT_SSL_NO_VERIFY=true npm_config_strict_ssl=false \\",
      "    HOME=/home/agent openclaw gateway --port 18789 --allow-unconfigured \\",
      "    </dev/null >/tmp/openclaw-gateway.log 2>&1 &",
      // ── Step 5: wait for /readyz with progress messages ───────────────
      // First run stages 35 bundled npm packages; can take several minutes.
      // 600 s matches setup.sh's gateway wait.
      "  _gw=0",
      "  while [ \"$_gw\" -lt 600 ]; do",
      "    curl -fsS http://127.0.0.1:18789/readyz >/dev/null 2>&1 && break",
      "    [ \"$_gw\" -eq 15 ] && printf '\\r\\033[K\\033[33m[OpenWork] Gateway staging deps (15s)...\\033[0m\\n'",
      "    [ \"$_gw\" -eq 60 ] && printf '\\r\\033[K\\033[33m[OpenWork] Gateway staging deps (1m)...\\033[0m\\n'",
      "    [ \"$_gw\" -eq 120 ] && printf '\\r\\033[K\\033[33m[OpenWork] Gateway still starting (2m)...\\033[0m\\n'",
      "    [ \"$_gw\" -eq 300 ] && printf '\\r\\033[K\\033[33m[OpenWork] Gateway still starting (5m)...\\033[0m\\n'",
      "    sleep 1",
      "    _gw=$((_gw+1))",
      "  done",
      "  if curl -fsS http://127.0.0.1:18789/readyz >/dev/null 2>&1; then",
      "    printf '\\r\\033[K\\033[32m[OpenWork] Gateway ready.\\033[0m\\n'",
      "  else",
      "    printf '\\r\\033[K\\033[31m[OpenWork] Gateway not ready — last 20 lines of /tmp/openclaw-gateway.log:\\033[0m\\n'",
      "    tail -20 /tmp/openclaw-gateway.log 2>/dev/null || echo '(log empty)'",
      "  fi",
      // ── Step 5b: pre-stage TUI plugin deps ────────────────────────────────────
      // NOTE: Step 5b previously re-applied openclaw.json while the gateway was
      // running. This was REMOVED because the openclaw gateway watches openclaw.json
      // via inotify and tries a live config reload on any write. The reload crashes
      // the gateway, causing the TUI to open in Crestodian's "Gateway not reachable"
      // fallback mode. Since Step 3 already writes the full correct config (with
      // StringCost provider and gateway.mode=local) BEFORE the gateway starts, the
      // re-apply is redundant AND dangerous. Step 3's config survives the gateway's
      // own startup writes (it only ADDS gateway.auth.token, never clobbers models
      // or env). The recovery restart below handles any remaining crash scenarios.
      // Without this ENTIRE step, every TUI launch re-runs plugin discovery and
      // the first user prompt hangs for ~10 min while plugins are staged from
      // scratch (npm-via-git deps blocked by SSH). Match setup.sh exactly:
      //   1. Seed /opt/openclaw-plugin-cache → ~/.openclaw/plugin-runtime-deps
      //   2. `openclaw status --deep` (300 s) — forces plugin discovery + npm-via-git
      //      dep resolution against the running gateway; this is what pre-stages
      //      ALL TUI plugin deps so the first prompt is instant.
      //   3. `openclaw doctor --fix` (60 s) — consolidates the plugin registry.
      //
      // setup.sh comments (lines 1097-1124): "pre-staging TUI plugin deps so
      // the first user prompt doesn't pay the full plugin-install latency
      // (~10 min in practice without this step)."
      "  if [ -d /opt/openclaw-plugin-cache ] && [ -n \"$(ls -A /opt/openclaw-plugin-cache 2>/dev/null)\" ]; then",
      "    printf '\\r\\033[K\\033[33m[OpenWork] Seeding plugin cache from image...\\033[0m\\n'",
      "    mkdir -p /home/agent/.openclaw/plugin-runtime-deps",
      "    cp -rn /opt/openclaw-plugin-cache/. /home/agent/.openclaw/plugin-runtime-deps/ 2>/dev/null || true",
      "  fi",
      "  printf '\\r\\033[K\\033[33m[OpenWork] Pre-staging plugins (first run, may take 2-5 min)...\\033[0m\\n'",
      // status --deep exercises the full gateway→plugin-registry path and
      // completes npm-via-git staging. Without it every first "hi" hangs.
      "  HOME=/home/agent timeout 300 openclaw status --deep </dev/null >/tmp/openclaw-bootstrap.log 2>&1 \\",
      "    && printf '\\r\\033[K\\033[32m[OpenWork] Plugin pre-stage complete.\\033[0m\\n' \\",
      "    || printf '\\r\\033[K\\033[33m[OpenWork] Plugin pre-stage warning (see /tmp/openclaw-bootstrap.log).\\033[0m\\n'",
      "  printf '\\r\\033[K\\033[33m[OpenWork] Consolidating plugin registry...\\033[0m\\n'",
      "  HOME=/home/agent timeout 60 openclaw doctor --fix </dev/null >>/tmp/openclaw-bootstrap.log 2>&1 || true",
      "fi",
      // ── Recovery restart: gateway may crash during plugin pre-stage ────────────
      // openclaw status --deep connects to the gateway's WebSocket and initiates
      // plugin npm-via-git staging. Under memory pressure, or if the gateway detects
      // a leftover inotify change from the bootstrap period, it can crash mid-stage.
      // This check runs OUTSIDE the "if ! curl readyz" block so it fires on every
      // connect — not just first-run. If the gateway is dead, restart it and wait up
      // to 120 s before exec'ing the TUI, preventing a Crestodian fallback landing.
      "if ! curl -fsS http://127.0.0.1:18789/readyz >/dev/null 2>&1; then",
      "  printf '\\r\\033[K\\033[33m[OpenWork] Restarting gateway (crashed during setup)...\\033[0m\\n'",
      "  pkill -f 'openclaw gateway' 2>/dev/null || true",
      "  sleep 1",
      "  setsid env OPENCLAW_SKIP_ONBOARDING=1 OPENCLAW_HANDSHAKE_TIMEOUT_MS=30000 \\",
      "    OPENCLAW_NO_RESPAWN=1 NODE_COMPILE_CACHE=/tmp/openclaw-compile-cache \\",
      "    GIT_SSL_NO_VERIFY=true npm_config_strict_ssl=false \\",
      "    HOME=/home/agent openclaw gateway --port 18789 --allow-unconfigured \\",
      "    </dev/null >>/tmp/openclaw-gateway.log 2>&1 &",
      "  _gw_final=0",
      "  while [ \"$_gw_final\" -lt 120 ]; do",
      "    curl -fsS http://127.0.0.1:18789/readyz >/dev/null 2>&1 && break",
      "    sleep 1",
      "    _gw_final=$((_gw_final+1))",
      "  done",
      "  curl -fsS http://127.0.0.1:18789/readyz >/dev/null 2>&1 \\",
      "    && printf '\\r\\033[K\\033[32m[OpenWork] Gateway ready.\\033[0m\\n' \\",
      "    || printf '\\r\\033[K\\033[31m[OpenWork] Warning: Gateway not reachable.\\033[0m\\n'",
      "fi",
    );
  }

  // ── Step 6 / Claude: auto-launch guard ─────────────────────────────────
  block.push(
    'if [ -z "${OPENWORK_AGENT_LAUNCHED:-}" ] && [ -t 0 ]; then',
    "  export OPENWORK_AGENT_LAUNCHED=1",
    // Wipe the terminal (screen + scrollback) so the OpenShell connect
    // handshake / shell-init escape noise is gone before the TUI paints.
    "  printf '\\033[2J\\033[3J\\033[H'",
  );
  if (isClaude) {
    block.push("  exec claude");
  } else {
    // -u OPENCLAW_PLUGIN_STAGE_DIR: must NOT reach the TUI process. Forwarding
    // it causes openclaw to run its own concurrent staging loop that saturates
    // the event loop and makes the terminal unresponsive (setup.sh line 1135).
    // SHELL=/usr/local/bin/openeral-bash: ensures agent tool shell invocations
    // go through openeral's workspace filesystem layer (PostgreSQL-backed).
    // Without SHELL set, openclaw uses /bin/bash which bypasses the workspace.
    block.push(
      "  exec env -u OPENCLAW_PLUGIN_STAGE_DIR \\",
      "    HOME=/home/agent \\",
      "    SHELL=/usr/local/bin/openeral-bash \\",
      "    OPENCLAW_NO_RESPAWN=1 \\",
      "    NODE_COMPILE_CACHE=/tmp/openclaw-compile-cache \\",
      "    GIT_SSL_NO_VERIFY=true npm_config_strict_ssl=false \\",
      "    OPENCLAW_HANDSHAKE_TIMEOUT_MS=30000 \\",
      "    openclaw",
    );
  }
  block.push(
    "fi",
    "# <<< openwork launch <<<",
  );
  return block.join("\n");
}

async function configureAgentLaunch({ name, profile, proxyBase, env, onProgress, apiKey, presignUrl }) {
  const isClaude = profile !== "openeral-openclaw";

  // Built literally into /sandbox/.bashrc via a quoted heredoc — `$` stays
  // literal so bash expands OPENWORK_AGENT_LAUNCHED/`$-` at source time, not now.
  const blockContent = buildLaunchBlock(profile, proxyBase, apiKey ?? null);

  // All sandbox writes are combined into ONE exec call to avoid the 30 s
  // timeout cascade that occurs when three separate wslRun calls each race
  // against the per-call timeout. A single call with 180 s is far more
  // reliable for a cold container that is still settling after provisioning.
  const lines = [
    "set -e",
    // Write API key file if provided (ensures setup.sh and .bashrc can read it).
    ...(apiKey
      ? [
          "mkdir -p /sandbox",
          `printf %s ${shellQuote(apiKey)} > /sandbox/anthropic-api-key`,
          "chmod 600 /sandbox/anthropic-api-key",
        ]
      : []),
    // Write presign file if a new presign was minted this session.
    ...(presignUrl
      ? [
          "mkdir -p /sandbox/openeral-input",
          `printf %s ${shellQuote(JSON.stringify({ url: presignUrl }))} > /sandbox/openeral-input/presign.json`,
          "chmod 600 /sandbox/openeral-input/presign.json",
        ]
      : []),
    "RC=/sandbox/.bashrc",
    '[ -f "$RC" ] || : > "$RC"',
    // Idempotent: drop any prior managed block so re-creates update cleanly.
    "sed -i '/# >>> openwork launch >>>/,/# <<< openwork launch <<</d' \"$RC\" 2>/dev/null || true",
    'cat >> "$RC" <<\'OPENWORK_LAUNCH_EOF\'',
    blockContent,
    "OPENWORK_LAUNCH_EOF",
  ];
  if (isClaude && proxyBase) {
    lines.push(
      "mkdir -p /sandbox/.claude",
      `node -e 'const fs=require("fs");const f="/sandbox/.claude/settings.json";let s={};try{s=JSON.parse(fs.readFileSync(f,"utf8")||"{}")}catch(e){}s.env=Object.assign({},s.env,{ANTHROPIC_BASE_URL:"${proxyBase}",ANTHROPIC_AUTH_TOKEN:"openwork-stringcost"});fs.writeFileSync(f,JSON.stringify(s,null,2))' 2>/dev/null || true`,
    );
  }

  await wslRun(
    ["-d", DISTRO_NAME, "--", "bash", "-c", sandboxRunScriptCmd(name, lines.join("\n"))],
    { timeout: 180_000, env },
  )
    .then(() =>
      onProgress?.({
        phase: "launch",
        message: proxyBase
          ? "StringCost cost tracking enabled; agent will auto-launch."
          : "Agent will auto-launch on connect.",
      }),
    )
    .catch((e) => {
      // Non-fatal — sandbox still works; user can launch the agent manually.
      console.warn(
        "[createOpenEralSandbox] agent launch configuration failed (non-fatal):",
        e.message,
      );
    });
}

/**
 * Read an already-uploaded StringCost presign URL back out of a sandbox, so a
 * reconnect reuses it instead of minting a fresh presign every launch. Returns
 * null when none is present.
 *
 * @param {string} name
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<string | null>}
 */
async function readSandboxPresignUrl(name, env) {
  const cmd =
    `openshell sandbox exec --name ${shellQuote(name)} -- ` +
    `sh -c ${shellQuote("cat /sandbox/openeral-input/presign.json 2>/dev/null || true")}`;
  const r = await wslRun(["-d", DISTRO_NAME, "--", "bash", "-c", cmd], {
    timeout: 60_000,
    env,
  }).catch(() => null);
  if (!r || r.exitCode !== 0) return null;
  const m = r.stdout.match(/https:\/\/[^"\s]+/);
  return m ? m[0] : null;
}

/**
 * Finalize a Ready sandbox for launch: write the real ANTHROPIC_API_KEY file,
 * resolve the StringCost proxy base (reuse an uploaded presign, else mint one),
 * and configure the auto-launch + proxy env. Runs on BOTH fresh-create and
 * reconnect so reopening an existing workspace also gets auto-launch + metering.
 *
 * MUST be called only after the sandbox is Ready — every step shells out via
 * `openshell sandbox exec`, which refuses while the sandbox is Provisioning.
 * All steps are best-effort: failures degrade gracefully (no metering /
 * manual agent launch) rather than failing the session.
 *
 * @param {{ name: string, profile: string, env: NodeJS.ProcessEnv,
 *           onProgress?: Function }} args
 */
async function finalizeSandboxLaunch({ name, profile, env, onProgress }) {
  const anthropicApiKey = await getCredential("anthropicApiKey").catch(() => null);

  // Resolve the StringCost presign before calling configureAgentLaunch so we
  // can pass both the API key and the presign URL into the single combined
  // exec that writes all files + the .bashrc block.
  let proxyBase = null;
  let mintedPresignUrl = null; // only set when we mint a new presign this session
  const stringcostApiKey = await getCredential("stringcostApiKey").catch(() => null);
  if (stringcostApiKey) {
    // Reuse a presign already uploaded on a prior launch before minting anew.
    const existingUrl = await readSandboxPresignUrl(name, env);
    if (existingUrl) {
      proxyBase = stringcostBaseUrlForAgent(existingUrl);
    } else if (anthropicApiKey) {
      const agentLabel = profile === "openeral-openclaw" ? "openclaw" : "claude-code";
      const presignUrl = await createStringcostPresign({
        anthropicApiKey,
        stringcostApiKey,
        agentLabel,
      });
      if (presignUrl) {
        mintedPresignUrl = presignUrl;
        proxyBase = stringcostBaseUrlForAgent(presignUrl);
      }
    }
  }

  // Single combined exec: writes API key file, presign file (if newly minted),
  // and .bashrc block — all in one 180 s wslRun call, eliminating the 3×30 s
  // timeout cascade that previously caused all three writes to silently fail.
  await configureAgentLaunch({
    name,
    profile,
    proxyBase,
    env,
    onProgress,
    apiKey: anthropicApiKey ?? undefined,
    presignUrl: mintedPresignUrl ?? undefined,
  });
}

/**
 * Mint a permanent StringCost presign on the HOST, mirroring the request
 * `setup.sh` makes from inside the sandbox.
 *
 * Why on the host and not in the sandbox: setup.sh can only mint its own
 * presign when both STRINGCOST_API_KEY and a *real* ANTHROPIC_API_KEY are
 * present in the container env. Under OpenShell, provider-delivered keys
 * arrive as `openshell:resolve:env:*` placeholders that setup.sh cannot use
 * for an outbound presign call — so setup.sh explicitly expects a
 * host-created `presign.json` to be uploaded instead (it reads
 * `/sandbox/openeral-input/presign.json`). Host env vars forwarded via
 * WSLENV never reach the sandbox container, so the uploaded file is the
 * only reliable delivery channel.
 *
 * The presign routes the agent's `/v1/messages` calls through the StringCost
 * proxy for token + cost metering. `metadata.labels` is what StringCost's
 * vendor-portfolio classifier reads, so spend is attributed to the right
 * agent (`claude-code` or `openclaw`).
 *
 * Entirely best-effort: returns the presign URL string, or `null` on any
 * failure (network, non-2xx, malformed response, missing fetch). Callers
 * treat a null as "launch the sandbox without StringCost".
 *
 * @param {{ anthropicApiKey: string, stringcostApiKey: string, agentLabel: "claude-code" | "openclaw" }} args
 * @returns {Promise<string | null>}
 */
async function createStringcostPresign({ anthropicApiKey, stringcostApiKey, agentLabel }) {
  if (typeof fetch !== "function") {
    console.warn("[createOpenEralSandbox] global fetch unavailable — skipping StringCost presign");
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STRINGCOST_PRESIGN_TIMEOUT_MS);
  try {
    const res = await fetch(`${STRINGCOST_API_BASE}/v1/presign`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stringcostApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "anthropic",
        client_api_key: anthropicApiKey,
        path: ["/v1/messages"],
        // Permanent, unmetered presign — the StringCost proxy enforces the
        // cost_limit, and the sandbox reuses this presign across sessions.
        expires_in: -1,
        max_uses: -1,
        cost_limit: 10000000,
        metadata: {
          source: "openwork-desktop",
          client: agentLabel,
          labels: ["openeral", agentLabel],
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[createOpenEralSandbox] StringCost presign failed (${res.status}): ${detail.slice(0, 300)}`,
      );
      return null;
    }
    const data = await res.json().catch(() => null);
    const url = data && typeof data.url === "string" ? data.url : null;
    if (!url) {
      console.warn("[createOpenEralSandbox] StringCost presign returned no URL");
      return null;
    }
    return url;
  } catch (err) {
    console.warn(
      `[createOpenEralSandbox] StringCost presign error: ${err?.message || String(err)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create (or resume into) an OpenEral sandbox. Sandbox naming is stable
 * per-workspace — re-running with the same name on the same Postgres
 * is OpenEral's whole portability story.
 *
 * @param {Object} opts
 * @param {string} opts.name
 * @param {"openeral-claude"|"openeral-openclaw"} opts.profile
 * @param {(evt: {phase: string, message: string}) => void} [opts.onProgress]
 * @param {boolean} [opts.skipImagePull]  Skip the docker pull (testing)
 * @param {number} [opts.createTimeoutMs]
 */
export async function createOpenEralSandbox(opts) {
  const { name, profile, onProgress, skipImagePull = false } = opts;
  if (!name) throw new Error("createOpenEralSandbox: name is required");
  if (!profile) throw new Error("createOpenEralSandbox: profile is required");

  const imageRef = imageForProfile(profile);

  // openshell shells out to scp/ssh for create --upload AND for exec/connect.
  // Make sure they exist before any sandbox op so we never dead-end at the
  // opaque "No such file or directory (os error 2)" — this also covers the
  // reconnect path below, which connects/execs into the existing sandbox.
  await ensureOpensshClient(onProgress);

  // Short-circuit if the sandbox already exists (workspace reopen).
  // Wait for it to reach Ready state before returning so the subsequent
  // PTY exec doesn't fail with "phase: Provisioning".
  //
  // If the existing sandbox is in an error or stuck-provisioning state,
  // auto-delete it and fall through to fresh creation below — this means
  // the user never has to manually click "Delete & start fresh" just to
  // recover from a broken container.  /home/agent data is in PostgreSQL
  // and survives the container deletion.
  if (await sandboxExists(name)) {
    onProgress?.({ phase: "exists", message: `Sandbox ${name} already exists; checking state…` });
    let existingReady = false;
    try {
      await waitForSandboxReady(name, {
        onProgress: (evt) => onProgress?.({ phase: evt.phase, message: evt.message }),
      });
      existingReady = true;
    } catch (waitErr) {
      const waitMsg = waitErr?.message ?? "";
      if (/SANDBOX_DELETED:/i.test(waitMsg)) {
        // Sandbox finished deleting while we were polling — create fresh below.
        // No delete call needed (it's already gone).
        onProgress?.({
          phase: "auto-recreate",
          message: `Previous sandbox was deleted; creating a fresh one…`,
        });
        // existingReady stays false → fall through to full creation below.
      } else if (/is in error state|STUCK_PROVISIONING:/i.test(waitMsg)) {
        // Broken container — silently delete so we can create a fresh one.
        onProgress?.({
          phase: "auto-recreate",
          message: `Sandbox ${name} is broken (${/STUCK/.test(waitMsg) ? "stuck in Provisioning" : "error state"}); auto-deleting for fresh creation…`,
        });
        await deleteOpenEralSandbox(name).catch((e) =>
          console.warn("[createOpenEralSandbox] auto-delete (broken existing):", e.message),
        );
        // existingReady stays false → fall through to full creation below.
      } else {
        throw waitErr;
      }
    }
    if (existingReady) {
      // Reopening an existing sandbox: (re)apply auto-launch + StringCost env so
      // the agent starts directly and meters even on reconnect. env isn't built
      // until after credential validation below, so use process.env here — the
      // exec just writes files with values baked into the script (no WSLENV).
      await finalizeSandboxLaunch({ name, profile, env: process.env, onProgress });
      return { name, profile, imageRef, existed: true };
    }
    // Fall through to create a fresh sandbox.
  }

  // Validate credentials.
  const databaseUrl = await getCredential("databaseUrl");
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Set it in Settings → Sandbox → OpenEral configuration.",
    );
  }
  const anthropicApiKey = await getCredential("anthropicApiKey");
  if (!anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Set it in Settings → Sandbox → OpenEral configuration.",
    );
  }

  // Image pull (~1.5 GB on first run for :just-bash).
  if (!skipImagePull) {
    onProgress?.({ phase: "pull", message: `Pulling ${imageRef}...` });
    await pullImage(imageRef, {
      onProgress: (text) => onProgress?.({ phase: "pull", message: text.trimEnd() }),
    });
  }

  // Forward credentials into the Linux side of WSL via WSLENV.
  // ANTHROPIC_API_KEY is always forwarded so --auto-providers can
  // auto-create the `claude` provider. For openclaw, also forward
  // OPENERAL_AGENT=openclaw so the openeral wrapper picks the right
  // agent at runtime.
  //
  // NOTE: STRINGCOST_API_KEY is deliberately NOT forwarded here. WSLENV only
  // makes a value visible to the openshell CLI in the WSL distro — it never
  // reaches the sandbox container. StringCost is delivered the way the agent
  // actually consumes it: finalizeSandboxLaunch (post-Ready) mints a presign
  // and writes ANTHROPIC_BASE_URL into the agent's launch env.
  const forwarded = { ANTHROPIC_API_KEY: anthropicApiKey };
  if (profile === "openeral-openclaw") {
    forwarded.OPENERAL_AGENT = "openclaw";
  }
  const env = buildWslEnvForwarding(forwarded);

  // Staging the DATABASE_URL file AND running `openshell sandbox
  // create` happen in ONE bash session — two separate wsl.exe calls
  // can land in different /tmp namespaces on some banker distros, so
  // openshell would see ENOENT trying to upload a file that "existed"
  // from our staging call's perspective. One bash subshell keeps /tmp
  // consistent for both the cat write and the --upload read.
  //
  // We deliberately do NOT pass `-- openeral` as the trailing command:
  // `openshell sandbox create` BLOCKS until the trailing command exits,
  // but `openeral` launches Claude Code (an interactive REPL that
  // never exits), and we have no TTY here (wslRun is piped). That used
  // to deadlock until ssh timed out with `exit status 1`. Instead we
  // run `-- /bin/true` to provision the sandbox, return immediately,
  // and rely on `sandbox exec --tty -- openeral` from openeral-pty.mjs
  // / openeral-terminal.mjs to launch the REPL inside a real PTY.
  //
  // Note: openshell's --upload (and connect/exec/download) shells out
  // to `ssh`/`scp` locally. The rootfs Dockerfile MUST include
  // openssh-client or every sandbox operation fails with a cryptic
  // "Error: × No such file or directory (os error 2)" from the failed
  // exec.
  const dbPath = `/tmp/openeral-db-url-${randomUUID()}`;
  // Keep the create command simple — use `-- /bin/true` so openshell
  // returns as soon as provisioning is done (no trailing command to race
  // against the --auto-providers setup).
  //
  // openshell CLI 0.0.42 has a race: when --auto-providers is combined
  // with a non-trivial `-- CMD`, the provider finalisation and the CMD
  // exec both touch the gateway concurrently and one of them returns
  // gRPC NotFound, aborting the create with exit 1.  Using `-- /bin/true`
  // (exits in ~0 ms) avoids the window where the race can manifest.
  //
  // ANTHROPIC_API_KEY delivery for setup.sh's StringCost presign step:
  // we write /sandbox/anthropic-api-key via a separate `sandbox exec`
  // call AFTER create, so there is no quoting complexity inside the
  // create command.  setup.sh falls back gracefully if the exec fails
  // (it skips the presign step when ANTHROPIC_API_KEY is a placeholder).
  // NOTE: do NOT use `exec openshell sandbox create ...` here.
  // `exec` replaces the bash process, which means the EXIT trap set
  // below never fires and the temp DB-URL file leaks in /tmp forever.
  // Running openshell as a regular child (no exec) lets bash honour
  // the trap on exit — whether the create succeeds or fails.
  const script = [
    "set -e",
    "umask 077",
    // DATABASE_URL is piped via stdin — never touches the command line.
    `cat > ${dbPath}`,
    `chmod 600 ${dbPath}`,
    // Staging file is removed on exit whether create succeeds or fails.
    `trap 'rm -f ${dbPath}' EXIT`,
    `openshell sandbox create --no-tty ` +
      `--name ${shellQuote(name)} ` +
      `--from ${shellQuote(imageRef)} ` +
      `--upload ${dbPath}:/sandbox/db-url ` +
      `--provider claude --auto-providers ` +
      `-- /bin/true`,
  ].join("\n");

  onProgress?.({ phase: "create", message: `Creating sandbox ${name}…` });
  let r;
  try {
    r = await wslRun(
      ["-d", DISTRO_NAME, "--", "bash", "-c", script],
      {
        timeout: opts.createTimeoutMs ?? DEFAULT_CREATE_TIMEOUT_MS,
        env,
        stdin: databaseUrl,
      },
    );
  } catch (err) {
    if (/wsl\.exe timed out/i.test(err?.message ?? "")) {
      throw new Error(
        `openshell sandbox create timed out after 3 minutes. ` +
          `The OpenShell gateway or Docker daemon is not responding. ` +
          `Open Settings \u2192 Sandbox \u2192 OpenShell health and click Restart Gateway, then retry.`,
      );
    }
    throw err;
  }
  if (r.exitCode !== 0) {
    const output = (r.stderr || r.stdout).trim();
    // openshell exits 1 with "already exists" when sandboxExists() returned
    // a false-negative (e.g. unexpected JSON shape from sandbox list). Treat
    // this as a successful reconnect instead of a hard failure.
    if (/already exists/i.test(output)) {
      onProgress?.({ phase: "exists", message: `Sandbox ${name} already exists; reconnecting.` });
      return { name, profile, imageRef, existed: true };
    }
    // openshell CLI 0.0.42 race: the gRPC stream sometimes closes with
    // "NotFound: sandbox not found" even though the gateway already registered
    // the sandbox and started provisioning. Check the list before treating
    // this as a hard failure — if the sandbox is there, wait for Ready.
    if (/not.?found|sandbox not found/i.test(output)) {
      const checkExists = await sandboxExists(name).catch(() => false);
      if (checkExists) {
        console.warn(
          `[createOpenEralSandbox] create exited 1 with NotFound but ${name} found in list; treating as provisioning.`,
        );
        onProgress?.({ phase: "waiting", message: `Sandbox ${name} is provisioning; waiting for Ready state…` });
        try {
          await waitForSandboxReady(name, {
            timeoutMs: 5 * 60_000,
            onProgress: (evt) => onProgress?.({ phase: evt.phase, message: evt.message }),
          });
          await finalizeSandboxLaunch({ name, profile, env, onProgress });
          return { name, profile, imageRef, existed: false };
        } catch (waitErr) {
          const waitMsg = waitErr?.message ?? "";
          if (/is in error state|STUCK_PROVISIONING:/i.test(waitMsg)) {
            // The post-create provisioning failed — auto-delete so the next
            // "Launch session" click starts from a clean slate.
            onProgress?.({
              phase: "auto-recreate",
              message: `Sandbox ${name} failed to provision; auto-deleting for next attempt…`,
            });
            await deleteOpenEralSandbox(name).catch((e) =>
              console.warn("[createOpenEralSandbox] auto-delete (NotFound path, broken):", e.message),
            );
            throw new Error(
              `Sandbox ${name} failed to provision and was automatically deleted. ` +
                `Click "Launch session" to create a fresh sandbox.`,
            );
          }
          throw waitErr;
        }
      }
    }
    const cli = await getCliInfo().catch(() => null);
    const versionTag = cli?.version ? ` [CLI ${cli.version}]` : "";
    throw new Error(
      `openshell sandbox create failed (exit ${r.exitCode})${versionTag}: ` +
        `${output || "(no output)"}`,
    );
  }
  // `sandbox create -- /bin/true` exits 0 as soon as the gateway REGISTERS
  // the sandbox, but setup.sh inside the container may still be running.
  // Wait for Ready before returning so the PTY never connects to a
  // still-Provisioning sandbox.
  onProgress?.({ phase: "waiting", message: `Sandbox ${name} created; waiting for Ready state…` });
  try {
    await waitForSandboxReady(name, {
      timeoutMs: 5 * 60_000,
      onProgress: (evt) => onProgress?.({ phase: evt.phase, message: evt.message }),
    });
  } catch (waitErr) {
    const waitMsg = waitErr?.message ?? "";
    if (/is in error state|STUCK_PROVISIONING:/i.test(waitMsg)) {
      // The freshly-created sandbox failed during setup — auto-delete so the
      // next "Launch session" click gets a clean start. If Docker or the image
      // is the root cause, the user will see this error repeatedly and should
      // restart the gateway from Settings → Sandbox → OpenShell health.
      onProgress?.({
        phase: "auto-recreate",
        message: `New sandbox ${name} failed to reach Ready state; auto-deleting…`,
      });
      await deleteOpenEralSandbox(name).catch((e) =>
        console.warn("[createOpenEralSandbox] auto-delete (fresh create broken):", e.message),
      );
      throw new Error(
        `New sandbox ${name} failed to reach Ready state and was automatically deleted. ` +
          `Click "Launch session" to try again. ` +
          `If this keeps happening, restart the OpenShell gateway from Settings \u2192 Sandbox \u2192 OpenShell health.`,
      );
    }
    throw waitErr;
  }
  // Now that the sandbox is Ready, write the API key, resolve the StringCost
  // presign, and configure auto-launch + proxy env. Doing this AFTER Ready is
  // essential — `openshell sandbox exec` refuses while the sandbox is still
  // Provisioning, which silently skipped these steps when they ran pre-Ready.
  await finalizeSandboxLaunch({ name, profile, env, onProgress });
  onProgress?.({ phase: "ready", message: `Sandbox ${name} ready.` });
  return { name, profile, imageRef, existed: false };
}

export async function deleteOpenEralSandbox(name) {
  if (!name) throw new Error("deleteOpenEralSandbox: name is required");
  // `openshell sandbox delete` does NOT support --force; passing it causes
  // "unexpected argument '--force' found" and exit 1. Use bash timeout for
  // the same inner-timeout safety net we apply to list/create calls.
  let r;
  try {
    r = await wslRun(
      ["-d", DISTRO_NAME, "--", "bash", "-c", `timeout 20 openshell sandbox delete ${shellQuote(name)}`],
      { timeout: 30_000 },
    );
  } catch (err) {
    if (/wsl\.exe timed out/i.test(err?.message ?? "")) {
      throw new Error(
        "openshell sandbox delete timed out. The OpenShell gateway may be unresponsive. " +
          "Restart the gateway from Settings \u2192 Sandbox \u2192 OpenShell health \u2192 Restart Gateway, " +
          "then try again.",
      );
    }
    throw err;
  }
  if (r.exitCode !== 0) {
    const output = (r.stderr || r.stdout).trim();
    // 124 = bash timeout(1) hit the inner timer — gateway is unresponsive.
    if (r.exitCode === 124) {
      throw new Error(
        "openshell sandbox delete timed out (gateway unresponsive). " +
          "Restart the gateway from Settings \u2192 Sandbox \u2192 OpenShell health \u2192 Restart Gateway, " +
          "then try again.",
      );
    }
    throw new Error(`openshell sandbox delete failed: ${output || "(no output)"}`);
  }
  return r;
}

/**
 * Live database-reachability probe. Runs psql via a transient
 * `postgres:16-alpine` container inside the distro. Pulls lazily on
 * first call (~6 MB). Returns `{ ok: true, reachable: true }` on
 * successful `SELECT 1`, throws otherwise.
 */
export async function probeDatabaseUrl({ timeoutMs = DEFAULT_PROBE_TIMEOUT_MS } = {}) {
  const url = await getCredential("databaseUrl");
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  // Same DOCKER_CONFIG sidestep as pullImage — postgres:16-alpine is
  // public and we don't want Docker Desktop's credential helper in the
  // path here either.
  const r = await wslRun(
    [
      "-d",
      DISTRO_NAME,
      "--",
      "bash",
      "-c",
      `mkdir -p ${DOCKER_CONFIG_DIR} && exec docker --config ${DOCKER_CONFIG_DIR} run --rm -i -e PGCONNECT_TIMEOUT=10 postgres:16-alpine psql ${shellQuote(url)} -tAc 'select 1'`,
    ],
    { timeout: timeoutMs },
  );
  if (r.exitCode !== 0) {
    throw new Error(
      `Could not reach PostgreSQL: ${(r.stderr || r.stdout).trim() || "unknown error"}`,
    );
  }
  return { ok: true, reachable: true };
}

export const __testing = {
  IMAGE_BY_PROFILE,
  buildWslEnvForwarding,
  shellQuote,
  createStringcostPresign,
  stringcostBaseUrlForAgent,
  sandboxRunScriptCmd,
  buildLaunchBlock,
  configureAgentLaunch,
};
