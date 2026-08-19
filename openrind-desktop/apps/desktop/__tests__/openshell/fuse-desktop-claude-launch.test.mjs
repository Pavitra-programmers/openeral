import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const facadeSource = readFileSync(
  new URL("../../electron/openshell/openrind-shell.mjs", import.meta.url),
  "utf8",
);
const mainSource = readFileSync(
  new URL("../../electron/main.mjs", import.meta.url),
  "utf8",
);
const setupSource = readFileSync(
  new URL("../../../../../sandboxes/openeral/setup-fuse.sh", import.meta.url),
  "utf8",
);
const wrapperSource = readFileSync(
  new URL("../../../../../sandboxes/openeral/openeral-claude-fuse.sh", import.meta.url),
  "utf8",
);
const bridgeSource = readFileSync(
  new URL("../../../../../sandboxes/openeral/openrind-pty-bridge.py", import.meta.url),
  "utf8",
);
const desktopLauncherSource = readFileSync(
  new URL("../../../../../sandboxes/openeral/openrind-desktop-claude-launch.sh", import.meta.url),
  "utf8",
);
const dockerSource = readFileSync(
  new URL("../../../../../Dockerfile.openrind-shell", import.meta.url),
  "utf8",
);
const policySource = readFileSync(
  new URL("../../../../../sandboxes/openeral/policy.yaml", import.meta.url),
  "utf8",
);

const desktop = await import("../../electron/openshell/openrind-shell.mjs");

test("desktop Claude selection writes a one-shot auto-launch marker", () => {
  assert.equal(
    desktop.resolveAgentSessionValue("openrind-shell-claude", null),
    "auto",
  );
  assert.match(
    desktop.resolveAgentSessionValue("openrind-shell-claude", "ses_example"),
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.throws(
    () => desktop.resolveAgentSessionValue("openrind-shell-openclaw", "ses_example"),
    /Claude profile only/,
  );
  const oldBin = process.env.OPENSHELL_BIN;
  const oldGateway = process.env.OPENSHELL_GATEWAY_ENDPOINT;
  process.env.OPENSHELL_BIN = "/workspace/vendor/openshell/target/debug/openshell";
  process.env.OPENSHELL_GATEWAY_ENDPOINT = "http://127.0.0.1:18770";
  try {
    assert.match(
      desktop.__testing.markerCommand("desktop-a", "printf marker"),
      /'sandbox' 'exec' '-n' 'desktop-a' '--' 'sh' '-c' 'printf marker'/,
    );
  } finally {
    if (oldBin === undefined) delete process.env.OPENSHELL_BIN;
    else process.env.OPENSHELL_BIN = oldBin;
    if (oldGateway === undefined) delete process.env.OPENSHELL_GATEWAY_ENDPOINT;
    else process.env.OPENSHELL_GATEWAY_ENDPOINT = oldGateway;
  }
  assert.match(facadeSource, /desktop-claude-launch/);
  assert.match(facadeSource, /"sandbox",\s*"exec",\s*"-n",\s*sandboxName,\s*"--tty"/);
  assert.match(mainSource, /await writeOpenrindShellSessionMarker\(sandboxName, profile, agentSessionId\)/);
  assert.match(mainSource, /openrindMarkerPending\.add\(sandboxName\)/);
  assert.doesNotMatch(mainSource, /return openrindPty\.openSession\(\{\s*sandboxName,\s*cols,\s*rows,\s*extraEnv,\s*agentSessionId,\s*\}\);\s*const live/s);
});

test("FUSE image starts selected Claude through the framed Linux PTY bridge", () => {
  assert.match(setupSource, /desktop-claude-launch/);
  assert.match(setupSource, /exec \/usr\/local\/bin\/openrind-desktop-claude-launch/);
  assert.match(desktopLauncherSource, /desktop-claude-launch/);
  assert.match(desktopLauncherSource, /exec \/usr\/local\/bin\/openrind-pty-bridge\.py --framed \/usr\/local\/bin\/claude/);
  assert.match(wrapperSource, /OPENRIND_DESKTOP_CLAUDE_SESSION/);
  assert.match(wrapperSource, /--session-id/);
  assert.match(wrapperSource, /--resume/);
  assert.match(wrapperSource, /if \[ ! -f "\$OPENRIND_SHELL_INIT_MARKER" \]/);
  assert.match(desktopLauncherSource, /OPENRIND_DESKTOP_CLAUDE_LAUNCH=1/);
  assert.match(setupSource, /Claude first-run state initialized/);
  assert.match(setupSource, /config\.lastOnboardingVersion = version/);
  assert.match(wrapperSource, /state\.hasCompletedOnboarding = true/);
  assert.match(wrapperSource, /state\.lastOnboardingVersion = version/);
  assert.match(wrapperSource, /newestNativeBackup/);
  assert.doesNotMatch(wrapperSource, /mv "\$HOME\/\.claude\.json"/);
  assert.match(bridgeSource, /OPENRINDPTY1/);
  assert.match(bridgeSource, /OPENRINDPTYREADY1/);
  assert.match(bridgeSource, /os\.openpty\(\)/);
  assert.match(dockerSource, /gnupg python3/);
  assert.match(dockerSource, /openrind-pty-bridge\.py/);
  assert.match(dockerSource, /openrind-desktop-claude-launch/);
  assert.match(policySource, /^    - \/dev\/pts$/m);
});
