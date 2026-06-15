// Unit tests for apps/desktop/electron/openshell/openeral.mjs.
//
// Uses the same mock-wsl.sh as wsl.test.mjs / doctor.test.mjs to record
// argv and emit canned stdout. Credentials are stubbed via the
// OPENWORK_TEST_CREDENTIALS_DIR env seam baked into
// openeral-credentials.mjs (plain-file storage; no Electron required).
//
// The actual docker pull + openshell sandbox create round-trip lives in
// the Phase 10 E2E spec — these unit tests verify only the argv shape,
// the validation logic, and the orchestration between sub-steps.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_WSL = join(__dirname, "mock-wsl.sh");

let workDir;
let logPath;
let credsDir;

test.beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "openeral-test-"));
  logPath = join(workDir, "wsl-args.log");
  credsDir = join(workDir, "creds");
  process.env.OPENWORK_WSL_EXE = MOCK_WSL;
  process.env.MOCK_WSL_LOG = logPath;
  process.env.OPENWORK_TEST_CREDENTIALS_DIR = credsDir;
  process.env.OPENWORK_CREDENTIALS_FILE = join(workDir, "creds-prod-fallback.json");
  for (const key of [
    "MOCK_WSL_STDOUT",
    "MOCK_WSL_STDOUT_FILE",
    "MOCK_WSL_STDERR",
    "MOCK_WSL_EXIT",
    "MOCK_WSL_DELAY_MS",
    "MOCK_WSL_DELAY_BEFORE_MS",
  ]) {
    delete process.env[key];
  }
});

test.afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  delete process.env.OPENWORK_WSL_EXE;
  delete process.env.MOCK_WSL_LOG;
  delete process.env.OPENWORK_TEST_CREDENTIALS_DIR;
  delete process.env.OPENWORK_CREDENTIALS_FILE;
});

function readArgsLog() {
  try {
    return readFileSync(logPath, "utf8")
      .split("\n")
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

const openeral = await import("../../electron/openshell/openeral.mjs");
const credentials = await import("../../electron/openshell/openeral-credentials.mjs");

// ── Pure helpers ───────────────────────────────────────────────────────

test("imageForProfile: maps claude profile to sandys image", () => {
  assert.equal(
    openeral.imageForProfile("openeral-claude"),
    "ghcr.io/sandys/openeral/sandbox:just-bash",
  );
});

test("imageForProfile: maps openclaw profile to sandys image (same as claude)", () => {
  // openeral README: same image, only --provider differs.
  assert.equal(
    openeral.imageForProfile("openeral-openclaw"),
    "ghcr.io/sandys/openeral/sandbox:just-bash",
  );
});

test("imageForProfile: throws on unknown profile", () => {
  assert.throws(() => openeral.imageForProfile("openeral-unknown"), /Unknown OpenEral profile/);
});

// ── buildWslEnvForwarding ──────────────────────────────────────────────

test("buildWslEnvForwarding: extends WSLENV with forwarded names", () => {
  const env = openeral.__testing.buildWslEnvForwarding({
    ANTHROPIC_API_KEY: "sk-ant-test",
    OPENERAL_AGENT: "openclaw",
  });
  assert.equal(env.ANTHROPIC_API_KEY, "sk-ant-test");
  assert.equal(env.OPENERAL_AGENT, "openclaw");
  const names = env.WSLENV.split(":").filter(Boolean);
  assert.ok(names.includes("ANTHROPIC_API_KEY"));
  assert.ok(names.includes("OPENERAL_AGENT"));
});

test("buildWslEnvForwarding: preserves existing WSLENV entries", () => {
  const prev = process.env.WSLENV;
  process.env.WSLENV = "EXISTING_VAR";
  try {
    const env = openeral.__testing.buildWslEnvForwarding({ FOO: "bar" });
    const names = env.WSLENV.split(":").filter(Boolean);
    assert.ok(names.includes("EXISTING_VAR"), `expected EXISTING_VAR in ${env.WSLENV}`);
    assert.ok(names.includes("FOO"), `expected FOO in ${env.WSLENV}`);
  } finally {
    if (prev === undefined) delete process.env.WSLENV;
    else process.env.WSLENV = prev;
  }
});

// ── createStringcostPresign ────────────────────────────────────────────

test("createStringcostPresign: posts the canonical body and returns the url", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      async json() {
        return { url: "https://proxy.stringcost.com/stringcost-proxy/t/abc123/v1/messages" };
      },
      async text() {
        return "";
      },
    };
  };
  try {
    const url = await openeral.__testing.createStringcostPresign({
      anthropicApiKey: "sk-ant-test",
      stringcostApiKey: "sk-st-test",
      agentLabel: "claude-code",
    });
    assert.equal(url, "https://proxy.stringcost.com/stringcost-proxy/t/abc123/v1/messages");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/v1\/presign$/);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers.Authorization, "Bearer sk-st-test");
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.provider, "anthropic");
    assert.equal(body.client_api_key, "sk-ant-test");
    assert.deepEqual(body.path, ["/v1/messages"]);
    // metadata.labels is what StringCost's vendor-portfolio classifier reads.
    assert.deepEqual(body.metadata.labels, ["openeral", "claude-code"]);
    assert.equal(body.metadata.client, "claude-code");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createStringcostPresign: labels openclaw spend distinctly", async () => {
  const realFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return { ok: true, status: 200, async json() { return { url: "https://x/stringcost-proxy/t/z" }; }, async text() { return ""; } };
  };
  try {
    await openeral.__testing.createStringcostPresign({
      anthropicApiKey: "sk-ant-test",
      stringcostApiKey: "sk-st-test",
      agentLabel: "openclaw",
    });
    assert.deepEqual(captured.metadata.labels, ["openeral", "openclaw"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createStringcostPresign: returns null on a non-2xx response", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    async text() {
      return "unauthorized";
    },
    async json() {
      return {};
    },
  });
  try {
    const url = await openeral.__testing.createStringcostPresign({
      anthropicApiKey: "sk-ant-test",
      stringcostApiKey: "bad-key",
      agentLabel: "claude-code",
    });
    assert.equal(url, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createStringcostPresign: returns null when the response carries no url", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { not_a_url: true };
    },
    async text() {
      return "";
    },
  });
  try {
    const url = await openeral.__testing.createStringcostPresign({
      anthropicApiKey: "sk-ant-test",
      stringcostApiKey: "sk-st-test",
      agentLabel: "claude-code",
    });
    assert.equal(url, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createStringcostPresign: returns null (does not throw) when fetch rejects", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const url = await openeral.__testing.createStringcostPresign({
      anthropicApiKey: "sk-ant-test",
      stringcostApiKey: "sk-st-test",
      agentLabel: "claude-code",
    });
    assert.equal(url, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ── stringcostBaseUrlForAgent ──────────────────────────────────────────

test("stringcostBaseUrlForAgent: strips the /v1/messages the agent re-appends", () => {
  // The control plane mints a single-path presign URL ending in /v1/messages.
  // Claude Code / OpenClaw append /v1/messages themselves, so the base URL we
  // hand them must NOT include it (else the proxy sees /v1/messages/v1/messages
  // and returns "Path not authorized").
  assert.equal(
    openeral.__testing.stringcostBaseUrlForAgent(
      "https://proxy.stringcost.com/stringcost-proxy/t/TOK123/v1/messages",
    ),
    "https://proxy.stringcost.com/stringcost-proxy/t/TOK123",
  );
});

test("stringcostBaseUrlForAgent: drops a trailing slash (adapter-token shape)", () => {
  assert.equal(
    openeral.__testing.stringcostBaseUrlForAgent(
      "https://proxy.stringcost.com/stringcost-proxy/t/TOK123/",
    ),
    "https://proxy.stringcost.com/stringcost-proxy/t/TOK123",
  );
});

test("stringcostBaseUrlForAgent: leaves an already-bare base URL untouched", () => {
  assert.equal(
    openeral.__testing.stringcostBaseUrlForAgent(
      "https://proxy.stringcost.com/stringcost-proxy/t/TOK123",
    ),
    "https://proxy.stringcost.com/stringcost-proxy/t/TOK123",
  );
});

test("stringcostBaseUrlForAgent: accepts a self-hosted host:port shape", () => {
  assert.equal(
    openeral.__testing.stringcostBaseUrlForAgent(
      "http://10.0.0.5:8787/stringcost-proxy/t/TOK/v1/messages",
    ),
    "http://10.0.0.5:8787/stringcost-proxy/t/TOK",
  );
});

test("stringcostBaseUrlForAgent: returns null for non-StringCost / empty input", () => {
  assert.equal(
    openeral.__testing.stringcostBaseUrlForAgent("https://api.anthropic.com/v1/messages"),
    null,
  );
  assert.equal(openeral.__testing.stringcostBaseUrlForAgent(""), null);
  assert.equal(openeral.__testing.stringcostBaseUrlForAgent(null), null);
});

// ── sandboxRunScriptCmd ────────────────────────────────────────────────

test("sandboxRunScriptCmd: base64-encodes the script so it round-trips in the sandbox", () => {
  const script = "echo hi\nexport FOO=\"a b\"\nunset BAR";
  const cmd = openeral.__testing.sandboxRunScriptCmd("openeral-ws1", script);
  // Targets the named sandbox via exec.
  assert.match(cmd, /openshell sandbox exec --name 'openeral-ws1' --/);
  // Decodes through base64 -d | sh — no raw script chars on the command line.
  assert.match(cmd, /base64 -d \| sh/);
  // The embedded blob decodes back to exactly the input script. shellQuote is
  // applied twice (once for the blob, once for the `sh -c` arg) so the base64
  // rides inside `'\''…'\''` — just grab the longest base64 run and decode it.
  const runs = cmd.match(new RegExp("[A-Za-z0-9+/=]{12,}", "g")) || [];
  const b64 = runs.sort((a, b) => b.length - a.length)[0];
  assert.equal(Buffer.from(b64, "base64").toString("utf8"), script);
});

// ── sandboxExists ──────────────────────────────────────────────────────

test("sandboxExists: returns true when the sandbox is in the list", async () => {
  process.env.MOCK_WSL_STDOUT = JSON.stringify([
    { name: "openeral-foo" },
    { name: "openeral-bar" },
  ]);
  assert.equal(await openeral.sandboxExists("openeral-foo"), true);
});

test("sandboxExists: returns false when not present", async () => {
  process.env.MOCK_WSL_STDOUT = JSON.stringify([{ name: "something-else" }]);
  assert.equal(await openeral.sandboxExists("openeral-foo"), false);
});

test("sandboxExists: accepts plain-string list entries", async () => {
  process.env.MOCK_WSL_STDOUT = JSON.stringify(["openeral-foo"]);
  assert.equal(await openeral.sandboxExists("openeral-foo"), true);
});

test("sandboxExists: returns false when list command fails", async () => {
  process.env.MOCK_WSL_EXIT = "1";
  assert.equal(await openeral.sandboxExists("openeral-foo"), false);
});

test("sandboxExists: returns false on empty input", async () => {
  assert.equal(await openeral.sandboxExists(""), false);
});

// ── createOpenEralSandbox ──────────────────────────────────────────────

test("createOpenEralSandbox: throws when DATABASE_URL is unconfigured", async () => {
  await assert.rejects(
    () =>
      openeral.createOpenEralSandbox({
        name: "openeral-test",
        profile: "openeral-claude",
        skipImagePull: true,
      }),
    /DATABASE_URL is not configured/,
  );
});

test("createOpenEralSandbox: throws when ANTHROPIC_API_KEY missing (any profile)", async () => {
  await credentials.setCredential("databaseUrl", "postgresql://test/db");
  await assert.rejects(
    () =>
      openeral.createOpenEralSandbox({
        name: "openeral-test",
        profile: "openeral-claude",
        skipImagePull: true,
      }),
    /ANTHROPIC_API_KEY is not configured/,
  );
});

test("createOpenEralSandbox: short-circuits when sandbox already exists", async () => {
  // listSandboxes returns our target name → existed=true, no create call.
  await credentials.setCredential("databaseUrl", "postgresql://test/db");
  process.env.MOCK_WSL_STDOUT = JSON.stringify([{ name: "openeral-resume" }]);
  const result = await openeral.createOpenEralSandbox({
    name: "openeral-resume",
    profile: "openeral-claude",
    skipImagePull: true,
  });
  assert.equal(result.existed, true);
  // Only one wsl call: the list probe.
  const lines = readArgsLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /openshell sandbox list --json/);
});

test("createOpenEralSandbox: claude profile builds canonical openeral argv", async () => {
  await credentials.setCredential("databaseUrl", "postgresql://test/db");
  await credentials.setCredential("anthropicApiKey", "sk-ant-test");
  // Mock always emits "[]" so sandbox list parses to empty.
  process.env.MOCK_WSL_STDOUT = "[]";
  const result = await openeral.createOpenEralSandbox({
    name: "openeral-new",
    profile: "openeral-claude",
    skipImagePull: true,
  });
  assert.equal(result.existed, false);
  assert.equal(result.imageRef, "ghcr.io/sandys/openeral/sandbox:just-bash");

  const lines = readArgsLog();

  // No `provider create` calls — the canonical flow uses --auto-providers
  // to pick up ANTHROPIC_API_KEY from the env at sandbox-create time.
  assert.equal(
    lines.filter((l) => /openshell provider create/.test(l)).length,
    0,
    "canonical openeral flow does not call `provider create` ahead of time",
  );

  // The whole flow runs inside ONE bash -c invocation. The bash script
  // is multi-line, so the mock log splits it into separate lines —
  // assert on each line of the script independently.
  assert.ok(
    lines.some((l) => /cat > \/tmp\/openeral-db-url-[\w-]+/.test(l)),
    "expected DATABASE_URL staging via `cat > /tmp/openeral-db-url-<uuid>`",
  );
  assert.ok(
    lines.some((l) => /chmod 600 \/tmp\/openeral-db-url-[\w-]+/.test(l)),
    "expected chmod 600 on the staging file",
  );
  assert.ok(
    lines.some((l) => /trap 'rm -f \/tmp\/openeral-db-url-[\w-]+' EXIT/.test(l)),
    "expected EXIT trap to clean up staging file",
  );
  // Should not regress to the mktemp+command-substitution shape.
  assert.ok(
    !lines.some((l) => /mktemp .*\$\(/.test(l)),
    "should not use mktemp command-substitution (empty-variable trap)",
  );

  // Sandbox create matches the openeral README exactly. The args we
  // splice via shellQuote (name, imageRef) appear single-quoted.
  const createLine = lines.find((l) => /openshell sandbox create/.test(l));
  assert.ok(createLine, `no create line. lines=${JSON.stringify(lines)}`);
  assert.match(createLine, /sandbox create --tty/);
  assert.match(createLine, /--name 'openeral-new'/);
  assert.match(createLine, /--from 'ghcr\.io\/sandys\/openeral\/sandbox:just-bash'/);
  assert.match(createLine, /--upload \/tmp\/openeral-db-url-[\w-]+:\/sandbox\/db-url/);
  assert.match(createLine, /--provider claude --auto-providers/);
  assert.match(createLine, /-- openeral$/);
  // Things that should NOT be there.
  assert.doesNotMatch(createLine, /--gateway/, "no --gateway flag in canonical flow");
  assert.doesNotMatch(createLine, /--no-tty/, "canonical flow uses --tty, not --no-tty");
  assert.doesNotMatch(createLine, /--provider db/, "no explicit db provider");
});

test("createOpenEralSandbox: openclaw profile sets OPENERAL_AGENT env via WSLENV", async () => {
  await credentials.setCredential("databaseUrl", "postgresql://test/db");
  await credentials.setCredential("anthropicApiKey", "sk-ant-xxx");
  process.env.MOCK_WSL_STDOUT = "[]";
  await openeral.createOpenEralSandbox({
    name: "openeral-claws",
    profile: "openeral-openclaw",
    skipImagePull: true,
  });
  // We can't directly observe WSLENV from the mock log (it sets env
  // for wsl.exe, not in argv). buildWslEnvForwarding is exercised in
  // its own test above. Here just confirm the openclaw create line is
  // structurally identical to the claude path.
  const lines = readArgsLog();
  const createLine = lines.find((l) => /openshell sandbox create/.test(l));
  assert.ok(createLine);
  assert.match(createLine, /--name 'openeral-claws'/);
  assert.match(createLine, /--provider claude --auto-providers/);
  assert.match(createLine, /-- openeral$/);
});

test("createOpenEralSandbox: requires name and profile", async () => {
  await assert.rejects(
    () => openeral.createOpenEralSandbox({ profile: "openeral-claude" }),
    /name is required/,
  );
  await assert.rejects(
    () => openeral.createOpenEralSandbox({ name: "x" }),
    /profile is required/,
  );
});

// ── deleteOpenEralSandbox ──────────────────────────────────────────────

test("deleteOpenEralSandbox: passes --force and name through", async () => {
  process.env.MOCK_WSL_STDOUT = "";
  await openeral.deleteOpenEralSandbox("openeral-foo");
  const lines = readArgsLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /openshell sandbox delete openeral-foo --force/);
});

test("deleteOpenEralSandbox: rejects empty name", async () => {
  await assert.rejects(() => openeral.deleteOpenEralSandbox(""), /name is required/);
});

// ── probeDatabaseUrl ───────────────────────────────────────────────────

test("probeDatabaseUrl: throws when DATABASE_URL unset", async () => {
  await assert.rejects(() => openeral.probeDatabaseUrl(), /not configured/);
});

test("probeDatabaseUrl: runs psql in postgres:16-alpine and returns reachable", async () => {
  await credentials.setCredential("databaseUrl", "postgresql://test/db");
  process.env.MOCK_WSL_STDOUT = "1";
  const r = await openeral.probeDatabaseUrl();
  assert.equal(r.ok, true);
  assert.equal(r.reachable, true);
  const lines = readArgsLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /docker run --rm -i -e PGCONNECT_TIMEOUT=10 postgres:16-alpine psql/);
  assert.match(lines[0], /postgresql:\/\/test\/db/);
  assert.match(lines[0], /-tAc select 1/);
});

test("probeDatabaseUrl: surfaces psql error stderr", async () => {
  await credentials.setCredential("databaseUrl", "postgresql://bad/host");
  process.env.MOCK_WSL_EXIT = "2";
  process.env.MOCK_WSL_STDERR = "psql: connection refused";
  await assert.rejects(
    () => openeral.probeDatabaseUrl(),
    /Could not reach PostgreSQL.*connection refused/s,
  );
});
