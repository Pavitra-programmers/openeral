import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_WSL = join(__dirname, "mock-wsl.sh");

let workDir;
let logPath;

test.beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "openrind-fuse-test-"));
  logPath = join(workDir, "wsl-args.log");
  process.env.OPENRIND_DESKTOP_WSL_EXE = MOCK_WSL;
  process.env.MOCK_WSL_LOG = logPath;
  process.env.OPENRIND_DESKTOP_TEST_CREDENTIALS_DIR = join(workDir, "creds");
  process.env.OPENSHELL_BIN = "/workspace/vendor/openshell/target/debug/openshell";
  process.env.OPENSHELL_GATEWAY_ENDPOINT = "http://127.0.0.1:18770";
  process.env.MOCK_WSL_EXIT = "0";
  process.env.MOCK_WSL_STDOUT = '{"state":"writable"}';
});

test.afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  for (const key of [
    "OPENRIND_DESKTOP_WSL_EXE",
    "MOCK_WSL_LOG",
    "OPENRIND_DESKTOP_TEST_CREDENTIALS_DIR",
    "OPENSHELL_BIN",
    "OPENSHELL_GATEWAY_ENDPOINT",
    "MOCK_WSL_EXIT",
    "MOCK_WSL_STDOUT",
  ]) {
    delete process.env[key];
  }
});

function readLog() {
  try {
    return readFileSync(logPath, "utf8");
  } catch {
    return "";
  }
}

const credentials = await import("../../electron/openshell/openrind-shell-credentials.mjs");
const runtime = await import("../../electron/openshell/fuse-runtime.mjs");
const sandbox = await import("../../electron/openshell/fuse-sandbox.mjs");

test("patched FUSE CLI command always carries the configured gateway", () => {
  assert.equal(
    runtime.buildFuseCliCommand(["sandbox", "connect", "workspace-a"]),
    "'/workspace/vendor/openshell/target/debug/openshell' --gateway-endpoint 'http://127.0.0.1:18770' 'sandbox' 'connect' 'workspace-a'",
  );
  const env = runtime.buildFuseWslEnv({ COLUMNS: "120" });
  assert.match(env.WSLENV, /OPENSHELL_BIN/);
  assert.match(env.WSLENV, /OPENSHELL_GATEWAY_ENDPOINT/);
  assert.match(env.WSLENV, /COLUMNS/);
});

test("primary FUSE creation uses the README contract and waits for writable health", { skip: process.platform === "win32" }, async () => {
  await credentials.setCredential("databaseUrl", "postgresql://user:secret@example.test/db?sslmode=require");
  await credentials.setCredential("openrouterApiKey", "sk-or-test-provider-key");
  const result = await sandbox.createPrimaryFuseSandbox({
    name: "workspace-a",
    profile: "openrind-shell-claude",
    skipImageCheck: true,
  });

  assert.deepEqual(result, {
    name: "workspace-a",
    profile: "openrind-shell-claude",
    imageRef: "openrind-shell-fuse:local",
    existed: false,
  });
  const log = readLog();
  assert.match(log, /--gateway-endpoint 'http:\/\/127\.0\.0\.1:18770'/);
  assert.match(log, /sandbox' 'create'/);
  assert.match(log, /'--fuse'/);
  assert.match(log, /'--from' 'openrind-shell-fuse:local'/);
  assert.match(log, /'--env' 'OPENRIND_SHELL_WORKSPACE_ID=workspace-a'/);
  assert.match(log, /'--no-tty' '--' 'openrind-shell-init'/);
  assert.match(log, /sandbox' 'exec' '-n' 'workspace-a' '--' 'openrind-shell-fused' 'health'/);
  assert.doesNotMatch(log, /\/bin\/true/);
  assert.match(log, /'--provider' 'openrouter'/);
  assert.match(log, /'OPENRIND_SHELL_OPENROUTER=1'/);
  assert.doesNotMatch(log, /'--auto-providers'/);
  assert.doesNotMatch(log, /sk-or-test-provider-key/);
  assert.doesNotMatch(log, /postgres(?:ql)?:\/\/user:secret/i);
});

test("primary FUSE creation rejects unsupported profiles before provisioning", async () => {
  await assert.rejects(
    () => sandbox.createPrimaryFuseSandbox({ name: "workspace-a", profile: "openrind-shell-openclaw" }),
    /Claude only/,
  );
});