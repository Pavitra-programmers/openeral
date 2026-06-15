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

// ── sandboxExists ──────────────────────────────────────────────────────

test("sandboxExists: returns true when the sandbox is in the list", async () => {
  // --names outputs one name per line (plain text, not JSON).
  process.env.MOCK_WSL_STDOUT = "openeral-foo\nopeneral-bar";
  assert.equal(await openeral.sandboxExists("openeral-foo"), true);
});

test("sandboxExists: returns false when not present", async () => {
  process.env.MOCK_WSL_STDOUT = "something-else";
  assert.equal(await openeral.sandboxExists("openeral-foo"), false);
});

test("sandboxExists: accepts plain-string list entries", async () => {
  process.env.MOCK_WSL_STDOUT = "openeral-foo";
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
  // listSandboxes (--names) returns our target name → existed=true, no create call.
  await credentials.setCredential("databaseUrl", "postgresql://test/db");
  // --names format: one name per line.
  process.env.MOCK_WSL_STDOUT = "openeral-resume";
  const result = await openeral.createOpenEralSandbox({
    name: "openeral-resume",
    profile: "openeral-claude",
    skipImagePull: true,
    // Short polling timeouts so waitForSandboxReady exits quickly in tests.
    _testWaitTimeoutMs: 100,
    _testPollMs: 10,
  });
  assert.equal(result.existed, true);
  const lines = readArgsLog();
  // At least one list call; crucially, no create call.
  assert.ok(lines.length >= 1, `expected at least 1 wsl call, got ${lines.length}`);
  assert.ok(
    lines.some((l) => /openshell sandbox list/.test(l)),
    "expected a sandbox list call",
  );
  assert.ok(
    !lines.some((l) => /openshell sandbox create/.test(l)),
    "no create call expected when sandbox already exists",
  );
});

test("createOpenEralSandbox: claude profile builds canonical openeral argv", async () => {
  await credentials.setCredential("databaseUrl", "postgresql://test/db");
  await credentials.setCredential("anthropicApiKey", "sk-ant-test");
  // Mock always emits "[]" so sandbox list parses to empty (no pre-existing sandbox).
  process.env.MOCK_WSL_STDOUT = "[]";
  const result = await openeral.createOpenEralSandbox({
    name: "openeral-new",
    profile: "openeral-claude",
    skipImagePull: true,
    // Short polling timeouts so waitForSandboxReady exits quickly in tests.
    _testWaitTimeoutMs: 100,
    _testPollMs: 10,
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
    "expected chmod 600 on the db-url staging file",
  );
  assert.ok(
    lines.some((l) => /printf %s '.*' > \/tmp\/openeral-api-key-[\w-]+/.test(l)),
    "expected ANTHROPIC_API_KEY staging via printf to /tmp/openeral-api-key-<uuid>",
  );
  assert.ok(
    lines.some((l) => /trap 'rm -f \/tmp\/openeral-db-url-[\w-]+ \/tmp\/openeral-api-key-[\w-]+'/.test(l)),
    "expected EXIT trap to clean up both staging files",
  );
  // Should not regress to the mktemp+command-substitution shape.
  assert.ok(
    !lines.some((l) => /mktemp .*\$\(/.test(l)),
    "should not use mktemp command-substitution (empty-variable trap)",
  );

  // Sandbox create uses --no-tty + -- /bin/true (two-step: provision then exec).
  // The args we splice via shellQuote (name, imageRef) appear single-quoted.
  const createLine = lines.find((l) => /openshell sandbox create/.test(l));
  assert.ok(createLine, `no create line. lines=${JSON.stringify(lines)}`);
  assert.match(createLine, /sandbox create --no-tty/);
  assert.match(createLine, /--name 'openeral-new'/);
  assert.match(createLine, /--from 'ghcr\.io\/sandys\/openeral\/sandbox:just-bash'/);
  assert.match(createLine, /--upload \/tmp\/openeral-db-url-[\w-]+:\/sandbox\/db-url/);
  assert.match(createLine, /--upload \/tmp\/openeral-api-key-[\w-]+:\/sandbox\/anthropic-api-key/);
  // claude profile: explicit provider (no --auto-providers which would contaminate
  // claude sandboxes with OPENERAL_AGENT=openclaw from a globally-registered provider).
  assert.match(createLine, /--provider claude/);
  assert.doesNotMatch(createLine, /--auto-providers/, "no --auto-providers in claude flow");
  assert.match(createLine, /-- \/bin\/true$/);
  // Things that should NOT be there.
  assert.doesNotMatch(createLine, /--gateway/, "no --gateway flag in canonical flow");
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
    _testWaitTimeoutMs: 100,
    _testPollMs: 10,
  });
  // openclaw profile: uses --provider openclaw (delivers OPENERAL_AGENT=openclaw to the
  // sandbox via openshell's provider system) instead of --auto-providers (which would
  // activate every registered provider, not just openclaw).
  const lines = readArgsLog();
  const createLine = lines.find((l) => /openshell sandbox create/.test(l));
  assert.ok(createLine);
  assert.match(createLine, /--name 'openeral-claws'/);
  assert.match(createLine, /--provider openclaw/);
  assert.doesNotMatch(createLine, /--auto-providers/, "no --auto-providers in openclaw flow");
  assert.doesNotMatch(createLine, /--provider claude/, "openclaw flow does not use claude provider");
  assert.match(createLine, /-- \/bin\/true$/);
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

test("deleteOpenEralSandbox: passes name through (no --force)", async () => {
  // openshell sandbox delete does NOT support --force (exits 1 if passed).
  process.env.MOCK_WSL_STDOUT = "";
  await openeral.deleteOpenEralSandbox("openeral-foo");
  const lines = readArgsLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /openshell sandbox delete 'openeral-foo'/);
  assert.doesNotMatch(lines[0], /--force/);
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
  // The command uses `docker --config <dir> run ...` to bypass credential helpers.
  assert.match(lines[0], /docker .* run --rm -i -e PGCONNECT_TIMEOUT=10 postgres:16-alpine psql/);
  assert.match(lines[0], /postgresql:\/\/test\/db/);
  assert.match(lines[0], /-tAc/);
  assert.match(lines[0], /select 1/);
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
