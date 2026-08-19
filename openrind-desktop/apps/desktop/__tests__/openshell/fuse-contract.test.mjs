import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sandboxSource = readFileSync(
  new URL("../../electron/openshell/fuse-sandbox.mjs", import.meta.url),
  "utf8",
);
const ptySource = readFileSync(
  new URL("../../electron/openshell/openrind-shell-pty.mjs", import.meta.url),
  "utf8",
);
const externalTerminalSource = readFileSync(
  new URL("../../electron/openshell/openrind-shell-terminal.mjs", import.meta.url),
  "utf8",
);

const claudeWrapperSource = readFileSync(
  new URL("../../../../../sandboxes/openeral/openeral-claude-fuse.sh", import.meta.url),
  "utf8",
);
test("FUSE provisioning follows the README create and validation sequence", () => {
  assert.match(sandboxSource, /"--fuse"/);
  assert.match(sandboxSource, /`OPENRIND_SHELL_WORKSPACE_ID=\$\{name\}`/);
  assert.match(sandboxSource, /"--tty"[\s\S]*"openrind-shell-init"/);
  assert.match(sandboxSource, /"openrind-shell-fused", "health"/);
  assert.match(sandboxSource, /health\?\.state === "writable"/);
  assert.doesNotMatch(sandboxSource, /\/bin\/true/);
  assert.doesNotMatch(sandboxSource, /"--auto-providers"/);
  assert.doesNotMatch(sandboxSource, /"ANTHROPIC_API_KEY="/);
  assert.match(sandboxSource, /OPENROUTER_PROVIDER_TYPE = "openrouter-claude"/);
  assert.match(sandboxSource, /env: buildFuseWslEnv\(\{ \[envKey\]: apiKey \}\)/);
  assert.match(sandboxSource, /env: buildFuseWslEnv\(\),[\s\S]*stdin: databaseUrl/);
});

test("desktop Claude uses the streaming exec bridge while manual terminals keep sandbox connect", () => {
  assert.match(
    ptySource,
    /"sandbox",\s*"exec",\s*"-n",\s*sandboxName,\s*"--tty",\s*"--",\s*"\/usr\/local\/bin\/openrind-desktop-claude-launch"/,
  );
  assert.match(ptySource, /buildFuseWslEnv/);
  assert.match(externalTerminalSource, /buildFuseCliCommand\(\["sandbox", "connect", sandboxName\]\)/);
  assert.match(externalTerminalSource, /buildFuseWslEnv/);
  assert.doesNotMatch(ptySource, /`exec openshell sandbox connect/);
  assert.doesNotMatch(externalTerminalSource, /`exec openshell sandbox connect/);
});

test("the OpenRouter wrapper passes only its gateway placeholder to Claude Code", () => {
  assert.match(claudeWrapperSource, /OPENRIND_SHELL_OPENROUTER/);
  assert.match(claudeWrapperSource, /export ANTHROPIC_AUTH_TOKEN=/);
  assert.match(claudeWrapperSource, /OPENROUTER_API_KEY:-/);
  assert.match(claudeWrapperSource, /ANTHROPIC_BASE_URL="https:\/\/openrouter\.ai\/api"/);
  assert.match(claudeWrapperSource, /ANTHROPIC_API_KEY=""/);
});
