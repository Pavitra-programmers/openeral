// Unit tests for apps/desktop/electron/openshell/openrind-shell-terminal.mjs.
// Only the pure-function helpers (deriveOpenrindShellSandboxName) are tested
// here. The actual terminal launchers (launchExternalTerminalToSandbox)
// are OS-spawn glue with platform branches — they're covered by manual
// testing on each platform and by the Phase 10 E2E spec on Windows.

import test from "node:test";
import assert from "node:assert/strict";

const { deriveOpenrindShellSandboxName } = await import(
  "../../electron/openshell/openrind-shell-terminal.mjs"
);

test("deriveOpenrindShellSandboxName: uses a short stable gateway-safe name", () => {
  assert.equal(deriveOpenrindShellSandboxName("myworkspace"), "or-myworks-edf8f80b");
});

test("deriveOpenrindShellSandboxName: lowercases the id", () => {
  assert.equal(deriveOpenrindShellSandboxName("MyWorkspace"), "or-myworks-edf8f80b");
});

test("deriveOpenrindShellSandboxName: replaces punctuation with dashes", () => {
  assert.equal(
    deriveOpenrindShellSandboxName("My Workspace / Q3 + analysis"),
    "or-my-work-2be63419",
  );
});

test("deriveOpenrindShellSandboxName: collapses repeated and trims edge dashes", () => {
  assert.equal(deriveOpenrindShellSandboxName("---abc---"), "or-abc-ba7816bf");
});

test("deriveOpenrindShellSandboxName: normalizes dots and underscores", () => {
  assert.equal(
    deriveOpenrindShellSandboxName("foo_bar.v1-q3"),
    "or-foo-bar-3f5b9c49",
  );
});

test("deriveOpenrindShellSandboxName: never exceeds the gateway's 19 character maximum", () => {
  const long = "x".repeat(80);
  const out = deriveOpenrindShellSandboxName(long);
  assert.equal(out, "or-xxxxxxx-d929cdee");
  assert.ok(out.length <= 19);
});

test("deriveOpenrindShellSandboxName: throws on empty input", () => {
  assert.throws(() => deriveOpenrindShellSandboxName(""), /empty workspace id/i);
});

test("deriveOpenrindShellSandboxName: throws on whitespace-only input after sanitization", () => {
  assert.throws(() => deriveOpenrindShellSandboxName("   "), /empty workspace id/i);
});

test("deriveOpenrindShellSandboxName: throws on punctuation-only input", () => {
  assert.throws(() => deriveOpenrindShellSandboxName("///"), /empty workspace id/i);
});

test("deriveOpenrindShellSandboxName: same input always produces same output (portability story)", () => {
  // Openrind Shell's cross-machine restore relies on this being deterministic
  // and stable across runs — the sandbox name is the workspace identity.
  const a = deriveOpenrindShellSandboxName("Q3 Earnings");
  const b = deriveOpenrindShellSandboxName("Q3 Earnings");
  assert.equal(a, b);
  assert.equal(a, "or-q3-earn-7d9efc57");
});
