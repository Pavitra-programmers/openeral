// Primary Openrind Shell FUSE sandbox lifecycle.
//
// This module deliberately mirrors README.md instead of adapting the former
// just-bash workflow. In particular, initialization is the one-shot trailing
// command of `sandbox create`; the desktop never injects shell startup code,
// credentials, or a Node-based persistence process after the sandbox is Ready.

import { randomUUID } from "node:crypto";

import { getCredential } from "./openrind-shell-credentials.mjs";
import { ensureManagedFuseGateway } from "./fuse-gateway.mjs";
import {
  buildFuseCliCommand,
  buildFuseWslEnv,
  resolveFuseRuntimeConfig,
  shellQuote,
} from "./fuse-runtime.mjs";
import { DISTRO_NAME, ensureWslKeepalive, wslRun } from "./wsl.mjs";

const FUSE_IMAGE = "openrind-shell-fuse:local";
const DEFAULT_CREATE_TIMEOUT_MS = 5 * 60_000;
const DESKTOP_DB_CONNECT_RETRY_MS = 1_000;
const DESKTOP_DB_CONNECT_DEADLINE_MS = 30_000;

const OPENROUTER_PROVIDER_NAME = "openrouter";
const OPENROUTER_PROVIDER_TYPE = "openrouter-claude";
const OPENROUTER_PROFILE_MARKER = "OpenRouter Anthropic-compatible Claude Code gateway";
const OPENROUTER_PROFILE_YAML = `id: openrouter-claude
display_name: OpenRouter Claude Code
description: OpenRouter Anthropic-compatible Claude Code gateway
category: agent
inference_capable: true
credentials:
  - name: api_key
    description: OpenRouter API key used by Claude Code
    env_vars: [OPENROUTER_API_KEY, ANTHROPIC_AUTH_TOKEN]
    required: true
    auth_style: bearer
    header_name: authorization
discovery:
  credentials: [api_key]
endpoints:
  - host: openrouter.ai
    port: 443
    protocol: rest
    access: read-write
    enforcement: enforce
binaries:
  - /usr/local/bin/claude
  - /usr/local/bin/claude-real
  - /usr/bin/node
`;

function assertSandboxName(name) {
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(name ?? "") || String(name).length > 19) {
    throw new Error(`Invalid OpenShell sandbox name: ${JSON.stringify(name)}`);
  }
}

function redactDatabaseUrl(text) {
  return String(text ?? "").replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[redacted]");
}

function redactSensitiveOutput(text) {
  return redactDatabaseUrl(text)
    .replace(/\bsk-(?:or|ant)-[A-Za-z0-9_-]+\b/gi, "sk-[redacted]")
    .replace(/\b(OPENROUTER_API_KEY|ANTHROPIC_API_KEY)=\S+/g, "$1=[redacted]");
}

function commandError(label, result) {
  const detail = redactSensitiveOutput((result.stderr || result.stdout || "").trim());
  return new Error(`${label} failed (exit ${result.exitCode}): ${detail || "(no output)"}`);
}

function formatProvisioningOutput(text) {
  const clean = redactSensitiveOutput(String(text ?? ""))
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return clean.at(-1)?.slice(0, 400) ?? "";
}
async function runFuseCli(args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1_000));
  const command = buildFuseCliCommand(args);
  return wslRun(
    [
      "-d",
      DISTRO_NAME,
      "--",
      "bash",
      "-lc",
      `timeout ${timeoutSeconds} ${command}`,
    ],
    {
      env: buildFuseWslEnv(),
      timeout: timeoutMs + 5_000,
      stdin: options.stdin,
      onOutput: options.onOutput,
    },
  );
}

async function requireReachableFuseGateway() {
  const { gatewayEndpoint } = resolveFuseRuntimeConfig();
  const result = await runFuseCli(["gateway", "info"], { timeoutMs: 15_000 });
  if (result.exitCode === 0) return;

  const detail = redactSensitiveOutput((result.stderr || result.stdout || "").trim());
  throw new Error(
    `The patched OpenShell FUSE gateway at ${gatewayEndpoint} is not reachable. ` +
      "Openrind Desktop manages this paired local service automatically; retry to restart it. " +
      `Details: ${detail || `exit ${result.exitCode}`}`,
  );
}
async function ensureManagedProvider({ apiKey, envKey, name, type, profileYaml = null }) {
  const providerGet = buildFuseCliCommand(["provider", "get", name]);
  const providerCreate = buildFuseCliCommand([
    "provider",
    "create",
    "--name",
    name,
    "--type",
    type,
    "--credential",
    envKey,
  ]);
  const providerUpdate = buildFuseCliCommand([
    "provider",
    "update",
    name,
    "--credential",
    envKey,
  ]);
  const lines = ["set -euo pipefail", "umask 077"];

  if (profileYaml) {
    const profilePath = `/tmp/openrind-openrouter-profile-${randomUUID()}.yaml`;
    const profileImport = buildFuseCliCommand([
      "provider",
      "profile",
      "import",
      "--file",
      profilePath,
    ]);
    const profileExport = buildFuseCliCommand([
      "provider",
      "profile",
      "export",
      type,
      "--output",
      "yaml",
    ]);
    lines.push(
      `trap ${shellQuote(`rm -f ${profilePath}`)} EXIT`,
      `printf '%s' ${shellQuote(profileYaml)} > ${shellQuote(profilePath)}`,
      `if ! ${profileImport} >/dev/null 2>&1; then`,
      `  if ! ${profileExport} | grep -Fq -- ${shellQuote(OPENROUTER_PROFILE_MARKER)}; then`,
      "    echo 'OpenRouter provider profile conflicts with the desktop profile.' >&2",
      "    exit 1",
      "  fi",
      "fi",
    );
  }

  lines.push(
    `if ${providerGet} >/dev/null 2>&1; then`,
    `  if ! ${providerGet} | grep -Fq -- ${shellQuote(type)}; then`,
    "    echo 'Existing OpenShell provider has an unexpected type.' >&2",
    "    exit 1",
    "  fi",
    `  ${providerUpdate}`,
    "else",
    `  ${providerCreate}`,
    "fi",
  );

  const result = await wslRun(
    ["-d", DISTRO_NAME, "--", "bash", "-lc", lines.join("\n")],
    {
      // This environment is used only by the host-side CLI. The subsequent
      // sandbox create invocation has no raw provider secret; the gateway
      // supplies an endpoint-scoped placeholder to the sandbox instead.
      env: buildFuseWslEnv({ [envKey]: apiKey }),
      timeout: 60_000,
    },
  );
  if (result.exitCode !== 0) throw commandError(`OpenShell provider ${name} setup`, result);
}

async function resolvePrimaryProvider(onProgress) {
  const [openrouterApiKey, anthropicApiKey] = await Promise.all([
    getCredential("openrouterApiKey"),
    getCredential("anthropicApiKey"),
  ]);

  if (openrouterApiKey) {
    onProgress?.({ phase: "provider", message: "Configuring gateway-managed OpenRouter test provider..." });
    await ensureManagedProvider({
      apiKey: openrouterApiKey,
      envKey: "OPENROUTER_API_KEY",
      name: OPENROUTER_PROVIDER_NAME,
      type: OPENROUTER_PROVIDER_TYPE,
      profileYaml: OPENROUTER_PROFILE_YAML,
    });
    return {
      name: OPENROUTER_PROVIDER_NAME,
      environment: [
        "OPENRIND_SHELL_OPENROUTER=1",
        "ANTHROPIC_BASE_URL=https://openrouter.ai/api",
        "ANTHROPIC_DEFAULT_FABLE_MODEL=openrouter/free",
        "ANTHROPIC_DEFAULT_OPUS_MODEL=openrouter/free",
        "ANTHROPIC_DEFAULT_SONNET_MODEL=openrouter/free",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL=openrouter/free",
        "CLAUDE_CODE_SUBAGENT_MODEL=openrouter/free",
      ],
    };
  }

  if (anthropicApiKey) {
    onProgress?.({ phase: "provider", message: "Configuring gateway-managed Anthropic provider..." });
    await ensureManagedProvider({
      apiKey: anthropicApiKey,
      envKey: "ANTHROPIC_API_KEY",
      name: "claude",
      type: "claude-code",
    });
    return { name: "claude", environment: [] };
  }

  throw new Error(
    "A provider credential is required. Configure OPENROUTER_API_KEY for the OpenRouter smoke test or ANTHROPIC_API_KEY for the README production path in Settings -> Environment.",
  );
}

async function fuseSandboxExists(name) {
  const result = await runFuseCli(["sandbox", "list", "--names"]);
  if (result.exitCode !== 0) throw commandError("OpenShell sandbox list", result);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(name);
}

async function removeIncompleteFuseSandbox(name) {
  const result = await runFuseCli(["sandbox", "delete", name], { timeoutMs: 30_000 }).catch((error) => ({
    exitCode: 1,
    stdout: "",
    stderr: error instanceof Error ? error.message : String(error),
  }));
  if (result.exitCode === 0) return null;
  return redactSensitiveOutput((result.stderr || result.stdout || "").trim()) || "sandbox delete failed";
}

async function requireLocalFuseImage(imageRef) {
  const result = await wslRun(
    [
      "-d",
      DISTRO_NAME,
      "--",
      "bash",
      "-lc",
      `docker image inspect ${shellQuote(imageRef)} >/dev/null 2>&1`,
    ],
    { env: buildFuseWslEnv(), timeout: 30_000 },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `The required FUSE image ${imageRef} is not available locally. Build it with ` +
        "`docker build --pull=false -f Dockerfile.openrind-shell -t openrind-shell-fuse:local .` before creating a sandbox.",
    );
  }
}

function parseHealth(output) {
  try {
    const parsed = JSON.parse(output);
    return typeof parsed?.state === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function describeFuseHealth(health) {
  if (!health) return "health command did not return JSON";
  const initializationError = typeof health.lastInitializationError === "string"
    ? redactSensitiveOutput(health.lastInitializationError.trim())
    : "";
  return initializationError
    ? `daemon state is ${health.state}: ${initializationError}`
    : `daemon state is ${health.state}`;
}

async function readFuseHealth(name) {
  const result = await runFuseCli(
    ["sandbox", "exec", "-n", name, "--", "openrind-shell-fused", "health"],
    { timeoutMs: 20_000 },
  ).catch((error) => ({
    exitCode: 1,
    stdout: "",
    stderr: error instanceof Error ? error.message : String(error),
  }));
  if (result.exitCode !== 0) {
    return {
      health: null,
      detail: redactSensitiveOutput((result.stderr || result.stdout || "").trim()) || "health command failed",
    };
  }
  const health = parseHealth(result.stdout.trim());
  return { health, detail: describeFuseHealth(health) };
}
/**
 * Create or reopen the README's primary FUSE sandbox. A Ready phase is not
 * sufficient: this resolves only after the daemon reports `state: writable`.
 */
export async function createPrimaryFuseSandbox(opts) {
  const { name, profile, onProgress } = opts ?? {};
  assertSandboxName(name);
  if (profile !== "openrind-shell-claude") {
    throw new Error(
      "The primary FUSE runtime currently supports Claude only. Select the compatibility runtime for another agent.",
    );
  }

  // Start or reuse the app-owned paired CLI/gateway/supervisor control plane
  // before touching Docker or PostgreSQL. This sets the documented runtime
  // variables for all later WSL invocations.
  onProgress?.({
    phase: "gateway",
    message: "Starting the app-managed OpenShell FUSE gateway...",
  });
  await ensureManagedFuseGateway({ onProgress });
  onProgress?.({ phase: "gateway", message: "OpenShell gateway is ready." });
  buildFuseWslEnv();
  await ensureWslKeepalive();

  onProgress?.({
    phase: "database",
    message: "Checking the secure PostgreSQL workspace configuration...",
  });
  const databaseUrl = await getCredential("databaseUrl");
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for the primary FUSE runtime. Set it in Settings → Sandbox → Openrind Shell configuration.",
    );
  }
  if (opts.skipImageCheck !== true) {
    onProgress?.({ phase: "image", message: "Checking the local Openrind Shell FUSE image..." });
    await requireLocalFuseImage(FUSE_IMAGE);
    onProgress?.({ phase: "image", message: "Local FUSE image is available." });
  }
  onProgress?.({ phase: "gateway", message: "Checking the patched OpenShell FUSE gateway..." });
  await requireReachableFuseGateway();

  const provider = await resolvePrimaryProvider(onProgress);

  if (await fuseSandboxExists(name)) {
    onProgress?.({ phase: "health", message: `Checking FUSE volume for existing sandbox ${name}…` });
    const existing = await readFuseHealth(name);
    if (existing.health?.state === "writable") {
      return { name, profile, imageRef: FUSE_IMAGE, existed: true };
    }

    // An interrupted trailing command leaves a Ready container whose one-shot
    // initialization never completed. Resume that idempotent README step using
    // the protected database URL already stored in the sandbox runtime.
    onProgress?.({
      phase: "health",
      message: `Resuming incomplete sandbox initialization (${existing.detail})…`,
    });
    const resumed = await runFuseCli(
      [
        "sandbox",
        "exec",
        "-n",
        name,
        "--env",
        "OPENRIND_SHELL_FAST_START=1",
        "--",
        "openrind-shell-init",
      ],
      {
        timeoutMs: opts.createTimeoutMs ?? DEFAULT_CREATE_TIMEOUT_MS,
        onOutput: ({ stream, text }) => {
          const message = formatProvisioningOutput(text);
          if (message) onProgress?.({ phase: "create", stream, message });
        },
      },
    );
    if (resumed.exitCode !== 0) {
      throw commandError("OpenShell FUSE sandbox initialization resume", resumed);
    }
    const recovered = await readFuseHealth(name);
    if (recovered.health?.state !== "writable") {
      throw new Error(`FUSE initialization completed but the daemon is not writable: ${recovered.detail}`);
    }
    return { name, profile, imageRef: FUSE_IMAGE, existed: true };
  }

  const dbPath = `/tmp/openrind-shell-db-url-${randomUUID()}`;
  const createCommand = buildFuseCliCommand([
    "sandbox",
    "create",
    "--name",
    name,
    "--from",
    FUSE_IMAGE,
    "--fuse",
    "--upload",
    `${dbPath}:/sandbox/db-url`,
    "--provider",
    provider.name,
    ...provider.environment.flatMap((value) => ["--env", value]),
    "--env",
    `OPENRIND_SHELL_WORKSPACE_ID=${name}`,
    "--env",
    `OPENRIND_SHELL_DB_CONNECT_RETRY_MS=${DESKTOP_DB_CONNECT_RETRY_MS}`,
    "--env",
    `OPENRIND_SHELL_DB_CONNECT_DEADLINE_MS=${DESKTOP_DB_CONNECT_DEADLINE_MS}`,
    "--env",
    "OPENRIND_SHELL_FAST_START=1",
    "--no-tty",
    "--",
    "openrind-shell-init",
  ]);
  const script = [
    "set -euo pipefail",
    "umask 077",
    `cat > ${shellQuote(dbPath)}`,
    `chmod 600 ${shellQuote(dbPath)}`,
    `trap 'rm -f ${dbPath}' EXIT`,
    createCommand,
  ].join("\n");

  onProgress?.({ phase: "create", message: `Creating FUSE sandbox ${name}; OpenShell is allocating the container, mounting FUSE, and running one-time workspace initialization…` });
  const result = await wslRun(
    ["-d", DISTRO_NAME, "--", "bash", "-lc", script],
    {
      env: buildFuseWslEnv(),
      stdin: databaseUrl,
      onOutput: ({ text }) => {
        const detail = formatProvisioningOutput(text);
        if (detail) {
          onProgress?.({ phase: "create", message: `OpenShell: ${detail}` });
        }
      },
      timeout: opts.createTimeoutMs ?? DEFAULT_CREATE_TIMEOUT_MS,
    },
  );
  if (result.exitCode !== 0) {
    // The trailing initializer is part of sandbox creation. If it fails before
    // the FUSE volume becomes writable, retain no half-created sandbox that
    // would make the user's Retry action loop forever on the same name.
    const cleanupDetail = await removeIncompleteFuseSandbox(name);
    const error = commandError("OpenShell FUSE sandbox create", result);
    if (cleanupDetail) error.message += ` (also could not remove incomplete sandbox: ${cleanupDetail})`;
    throw error;
  }

  // `openrind-shell-init` returns only after the required schema/volume prepare
  // and the daemon's writable-state transition. The daemon owns and continuously
  // renews the writer lease; Desktop does not repeat slow mounted-I/O probes here.
  onProgress?.({ phase: "ready", message: `FUSE workspace for ${name} is durable and ready. Launching the desktop Claude session.` });
  return { name, profile, imageRef: FUSE_IMAGE, existed: false };
}

export const __testing = {
  FUSE_IMAGE,
  parseHealth,
  redactDatabaseUrl,
};
