#!/bin/sh
set -eu

RUNTIME_DIR="${OPENRIND_SHELL_RUNTIME_DIR:-${OPENERAL_RUNTIME_DIR:-/var/lib/openrind-shell/runtime}}"
if [ -f "$RUNTIME_DIR/session.env" ]; then
  # shellcheck disable=SC1090
  . "$RUNTIME_DIR/session.env"
fi

export HOME=/sandbox/work
export OPENRIND_SHELL_HOME=/sandbox/work
export OPENRIND_SHELL_PROJECT_DIR="${OPENRIND_SHELL_PROJECT_DIR:-/sandbox/work/workspace}"
export OPENRIND_SHELL_RUNTIME_DIR="$RUNTIME_DIR"
export OPENRIND_SHELL_STATE_DIR="$RUNTIME_DIR"
export OPENRIND_SHELL_DB_URL_FILE="$RUNTIME_DIR/database-url"
export OPENRIND_SHELL_INIT_MARKER="$RUNTIME_DIR/init.done"
export OPENRIND_SHELL_REQUIRE_POSTGRES_TLS=1
export OPENERAL_HOME=/sandbox/work
export OPENERAL_RUNTIME_DIR="$RUNTIME_DIR"
export OPENERAL_STATE_DIR="$RUNTIME_DIR"
export OPENERAL_DB_URL_FILE="$RUNTIME_DIR/database-url"
export OPENERAL_INIT_MARKER="$RUNTIME_DIR/init.done"
export OPENERAL_REQUIRE_POSTGRES_TLS=1
export SHELL="${SHELL:-/bin/bash}"
export NODE_NO_WARNINGS="${NODE_NO_WARNINGS:-1}"

unset STRINGCOST_API_KEY
unset OPENRIND_GATEWAY_API_KEY

# The OpenShell provider supplies OPENROUTER_API_KEY as a gateway-resolved
# placeholder. Claude Code reads ANTHROPIC_AUTH_TOKEN, so copy only that
# placeholder; the proxy swaps it for the host secret while forwarding to
# OpenRouter. The real token never enters this sandbox process or environment.
if [ "${OPENRIND_SHELL_OPENROUTER:-}" = "1" ]; then
  export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
  export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-${OPENROUTER_API_KEY:-}}"
  export ANTHROPIC_API_KEY=""
  export ANTHROPIC_DEFAULT_FABLE_MODEL="openrouter/free"
  export ANTHROPIC_DEFAULT_OPUS_MODEL="openrouter/free"
  export ANTHROPIC_DEFAULT_SONNET_MODEL="openrouter/free"
  export ANTHROPIC_DEFAULT_HAIKU_MODEL="openrouter/free"
  export CLAUDE_CODE_SUBAGENT_MODEL="openrouter/free"
fi

if [ ! -x /usr/local/bin/claude-real ]; then
  echo "openrind-shell: claude-real is missing from the sandbox image" >&2
  exit 127
fi

# Sandbox creation completes initialization and writes this marker. Avoid a
# full Node/FUSE initialization pass on every interactive Claude reconnect.
if [ ! -f "$OPENRIND_SHELL_INIT_MARKER" ]; then
  echo "Openrind Shell: completing interrupted workspace initialization..." >&2
  openrind-shell init --ensure
fi

# A wedged management socket must never leave users staring at a blank terminal.
# Provisioning already established writability; this is only a bounded launch
# guard, not another initialization pass.
HEALTH="$(timeout 3s openrind-shell-fused health 2>/dev/null || true)"
STATE="$(node -e 'try { process.stdout.write(JSON.parse(process.argv[1]).state || "") } catch {}' "$HEALTH")"
if [ "$STATE" != writable ]; then
  echo "openrind-shell: FUSE storage is not writable (state: ${STATE:-unavailable})" >&2
  exit 1
fi

mkdir -p "$OPENRIND_SHELL_PROJECT_DIR"
cd "$OPENRIND_SHELL_PROJECT_DIR"

# A desktop disconnect can interrupt Claude's first-run flow after it has
# created its configuration and native timestamped backups. Moving the active
# config away makes Claude refuse to start: it sees a backup but no active
# configuration to recover. For desktop launches only, retain every existing
# field and mark onboarding complete. If the active file is missing, restore
# Claude's newest native backup first. Settings, credentials, conversations,
# and project state remain on the README-required FUSE home.
if [ "${OPENRIND_DESKTOP_CLAUDE_LAUNCH:-}" = "1" ] && [ "${OPENRIND_SHELL_SKIP_CLAUDE_REPAIR:-}" != "1" ]; then
  node - "$HOME" <<'NODE'
const fs = require("fs");
const path = require("path");

const home = process.argv[2];
const configPath = path.join(home, ".claude.json");
const backupsPath = path.join(home, ".claude", "backups");
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

let state = readJson(configPath);
let recoveredFromBackup = false;
if (!state && fs.existsSync(backupsPath)) {
  const newestNativeBackup = fs
    .readdirSync(backupsPath)
    .filter((name) => /^\.claude\.json\.backup\.\d+$/.test(name))
    .sort()
    .at(-1);
  if (newestNativeBackup) {
    state = readJson(path.join(backupsPath, newestNativeBackup));
    recoveredFromBackup = Boolean(state);
  }
}

if (!state) state = {};
let needsWrite = recoveredFromBackup || state.hasCompletedOnboarding !== true;
if (needsWrite) {
  state.hasCompletedOnboarding = true;
  try {
    const version = String(require("child_process").execFileSync(
      "/usr/local/bin/claude-real",
      ["--version"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 },
    )).match(/^(\d+\.\d+\.\d+)/m)?.[1];
    if (version) state.lastOnboardingVersion = version;
  } catch {}
}
if (!state.projects || typeof state.projects !== 'object' || Array.isArray(state.projects)) {
  state.projects = {};
  needsWrite = true;
}
const projectDir = process.env.OPENRIND_SHELL_PROJECT_DIR || '/sandbox/work/workspace';
const project = state.projects[projectDir];
if (!project || typeof project !== 'object' || Array.isArray(project)) {
  state.projects[projectDir] = { hasTrustDialogAccepted: true };
  needsWrite = true;
} else if (project.hasTrustDialogAccepted !== true) {
  project.hasTrustDialogAccepted = true;
  needsWrite = true;
}
if (needsWrite) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${configPath}.openrind-repair-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, configPath);
  process.stderr.write(
    "Openrind Shell: repaired interrupted Claude onboarding; settings and conversations were preserved.\n",
  );
}
NODE
fi
unset OPENRIND_DESKTOP_CLAUDE_LAUNCH
unset OPENRIND_SHELL_SKIP_CLAUDE_REPAIR

# Claude's supported trust model requires a project distinct from $HOME. Keep
# the full durable FUSE home available as an additional working directory so
# files created by older images at /sandbox/work remain accessible.
set -- --add-dir "$HOME" "$@"

# Desktop sessions receive a deterministic UUID through the one-shot launch
# marker. Resume only when that transcript already exists; otherwise create it.
# Ordinary CLI `claude` runs have no value and preserve Claude Code defaults.
_openrind_session="${OPENRIND_DESKTOP_CLAUDE_SESSION:-}"
case "$_openrind_session" in
  [0-9a-fA-F][0-9a-fA-F-]*) ;;
  *) _openrind_session="" ;;
esac
if [ -n "$_openrind_session" ]; then
  # Claude stores this fixed working directory under a deterministic project
  # slug. A single stat is constant-time; recursively scanning every persisted
  # project delayed launch as the workspace accumulated conversations.
  _openrind_transcript="$HOME/.claude/projects/-sandbox-work-workspace/$_openrind_session.jsonl"
  if [ -f "$_openrind_transcript" ]; then
    set -- --resume "$_openrind_session" "$@"
  else
    set -- --session-id "$_openrind_session" "$@"
  fi
  unset _openrind_transcript
fi
unset _openrind_session

# Claude must remain the foreground process attached to the bridge-owned PTY.
# Starting it with `&` makes it a background job; an interactive read can then
# stop it with SIGTTIN. That presents as a rendered-but-unresponsive prompt, or
# as a completely blank terminal when the stop happens before the first paint.
set +e
/usr/local/bin/claude-real "$@"
STATUS=$?
set -e

if ! openrind-shell-fused flush-all >/dev/null 2>&1; then
  echo "openrind-shell: final FUSE flush failed; check 'openrind-shell-fused health' before deleting the sandbox" >&2
  [ "$STATUS" -ne 0 ] || STATUS=1
fi
exit "$STATUS"
