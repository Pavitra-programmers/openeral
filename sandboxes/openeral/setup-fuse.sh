#!/bin/bash
set -euo pipefail

export NODE_NO_WARNINGS="${NODE_NO_WARNINGS:-1}"
export OPENRIND_SHELL_WORKSPACE_ID="${OPENRIND_SHELL_WORKSPACE_ID:-${OPENERAL_WORKSPACE_ID:-${WORKSPACE_ID:-${OPENSHELL_SANDBOX_ID:-default}}}}"
export OPENERAL_WORKSPACE_ID="$OPENRIND_SHELL_WORKSPACE_ID"
export WORKSPACE_ID="$OPENRIND_SHELL_WORKSPACE_ID"
export OPENRIND_SHELL_RUNTIME_DIR="${OPENRIND_SHELL_RUNTIME_DIR:-${OPENERAL_RUNTIME_DIR:-/var/lib/openrind-shell/runtime}}"
export OPENRIND_SHELL_STATE_DIR="$OPENRIND_SHELL_RUNTIME_DIR"
export OPENRIND_SHELL_DB_URL_FILE="$OPENRIND_SHELL_RUNTIME_DIR/database-url"
export OPENRIND_SHELL_INIT_MARKER="$OPENRIND_SHELL_RUNTIME_DIR/init.done"
export OPENRIND_SHELL_HOME=/sandbox/work
export OPENRIND_SHELL_PROJECT_DIR=/sandbox/work/workspace
export OPENRIND_SHELL_REQUIRE_POSTGRES_TLS=1
# Legacy aliases are exported for user scripts and older library builds.
export OPENERAL_RUNTIME_DIR="$OPENRIND_SHELL_RUNTIME_DIR"
export OPENERAL_STATE_DIR="$OPENRIND_SHELL_STATE_DIR"
export OPENERAL_DB_URL_FILE="$OPENRIND_SHELL_DB_URL_FILE"
export OPENERAL_INIT_MARKER="$OPENRIND_SHELL_INIT_MARKER"
export OPENERAL_HOME="$OPENRIND_SHELL_HOME"
export OPENERAL_REQUIRE_POSTGRES_TLS=1
# OpenShell supplies its trust bundle through SSL_CERT_FILE. It must supplement
# Node's bundled public roots, not replace them: the FUSE database connection
# uses end-to-end TLS to the public Supabase pooler while OpenShell endpoints may
# use a local CA. NODE_EXTRA_CA_CERTS preserves both trust sets.
if [ -n "${SSL_CERT_FILE:-}" ] && [ -z "${NODE_EXTRA_CA_CERTS:-}" ]; then
  export NODE_EXTRA_CA_CERTS="$SSL_CERT_FILE"
fi
OPENRIND_SHELL_DIR=/opt/openrind-shell
OPENERAL_DIR="$OPENRIND_SHELL_DIR"
mkdir -p "$OPENRIND_SHELL_RUNTIME_DIR"
chmod 700 "$OPENRIND_SHELL_RUNTIME_DIR"

read_database_url() {
  tr -d '\r' < "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

load_stored_database_url() {
  if [ -z "${DATABASE_URL:-}" ] && [ -f "$OPENERAL_DB_URL_FILE" ]; then
    DATABASE_URL="$(read_database_url "$OPENERAL_DB_URL_FILE")"
    export DATABASE_URL
  fi
}

load_stored_database_url

case "${1:-}" in
  init|stats|analyze|apply|optimize|presign)
    exec env HOME="$OPENRIND_SHELL_HOME" node "$OPENRIND_SHELL_DIR/dist/bin/openrind-shell.js" "$@"
    ;;
  memory)
    set +e
    env HOME="$OPENRIND_SHELL_HOME" node "$OPENRIND_SHELL_DIR/dist/bin/openrind-shell.js" "$@"
    status=$?
    set -e
    openrind-shell-fused flush-all >/dev/null 2>&1 || true
    exit "$status"
    ;;
  "")
    ;;
  -h|--help|help)
    cat <<'USAGE'
Usage:
  openrind-shell-init                 one-shot sandbox initialization (run by sandbox create)
  openrind-shell init [--ensure|--check-marker|--write-marker]
  openrind-shell memory refresh [--query TEXT]
  openrind-shell stats|analyze|apply|optimize ...
  openrind-shell presign [renew]
USAGE
    exit 0
    ;;
  *)
    echo "openrind-shell: unknown command '$1' (see 'openrind-shell --help')" >&2
    exit 2
    ;;
esac

DATABASE_URL="${DATABASE_URL:-${OPENRIND_SHELL_DATABASE_URL:-${OPENERAL_DATABASE_URL:-${POSTGRES_URL:-}}}}"
case "$DATABASE_URL" in openshell:resolve:env:*) DATABASE_URL="" ;; esac
DB_URL_FILE=""
if [ -z "$DATABASE_URL" ]; then
  if [ -f /sandbox/db-url ]; then
    DB_URL_FILE=/sandbox/db-url
  elif [ -d /sandbox/db-url ]; then
    DB_URL_FILE="$(find /sandbox/db-url -maxdepth 2 -type f -name db-url | head -1)"
    [ -n "$DB_URL_FILE" ] || DB_URL_FILE="$(find /sandbox/db-url -maxdepth 1 -type f | head -1)"
  elif [ -f /sandbox/openeral-input/db-url ]; then
    DB_URL_FILE=/sandbox/openeral-input/db-url
  elif [ -d /sandbox/openeral-input ]; then
    DB_URL_FILE="$(find /sandbox/openeral-input -type f -name db-url | head -1)"
  elif [ -f /sandbox/openrind-shell-input/db-url ]; then
    DB_URL_FILE=/sandbox/openrind-shell-input/db-url
  elif [ -d /sandbox/openrind-shell-input ]; then
    DB_URL_FILE="$(find /sandbox/openrind-shell-input -type f -name db-url | head -1)"
  fi
  [ -z "$DB_URL_FILE" ] || DATABASE_URL="$(read_database_url "$DB_URL_FILE")"
fi

case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  '')
    echo "setup-fuse.sh: DATABASE_URL is required; the FUSE image does not fall back to PGlite" >&2
    exit 1
    ;;
  *)
    echo "setup-fuse.sh: DATABASE_URL must use postgres:// or postgresql://" >&2
    exit 1
    ;;
esac
if [[ "$DATABASE_URL" =~ [\?\&]sslmode=(disable|allow)($|\&) ]]; then
  echo "setup-fuse.sh: PostgreSQL TLS cannot be disabled in the FUSE runtime" >&2
  exit 1
fi
# The writer lease is a session-level advisory lock plus per-session settings.
# Supabase port 6543 is transaction pooling, which detaches sessions from
# backends and silently breaks fencing; the FUSE runtime requires session mode.
if [[ "$DATABASE_URL" =~ ^postgres(ql)?://[^/@]*@[^/:]*\.pooler\.supabase\.com:6543(/|\?|$) ]]; then
  echo "setup-fuse.sh: Supabase port 6543 (transaction pooling) breaks the writer lease; use the session-mode pooler on port 5432" >&2
  exit 1
fi
export DATABASE_URL

if [ -f "$OPENERAL_DB_URL_FILE" ]; then
  STORED_DATABASE_URL="$(read_database_url "$OPENERAL_DB_URL_FILE")"
  if [ "$STORED_DATABASE_URL" != "$DATABASE_URL" ] && [ -f "$OPENERAL_RUNTIME_DIR/database.ready" ]; then
    echo "openrind-shell: datasource changed in a live sandbox; delete and recreate it" >&2
    exit 1
  fi
fi
DB_URL_TMP="$OPENRIND_SHELL_RUNTIME_DIR/database-url.tmp-$$"
printf '%s' "$DATABASE_URL" > "$DB_URL_TMP"
chmod 600 "$DB_URL_TMP"
mv -f "$DB_URL_TMP" "$OPENERAL_DB_URL_FILE"

DB_HOST="$(node -e 'const u = new URL(process.env.DATABASE_URL); process.stdout.write(u.hostname + ":" + (u.port || "5432"))')"
echo "setup-fuse.sh: migrating and preparing $WORKSPACE_ID on $DB_HOST..."
PREPARED="$(node "$OPENRIND_SHELL_DIR/dist/bin/openrind-shell-fuse-init.js" prepare)"
IMPORTED="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).importedItems || 0))' "$PREPARED")"
echo "setup-fuse.sh: normalized volume ready; imported $IMPORTED legacy item(s)"

FUSE_WRITABLE_TIMEOUT_SECONDS="${OPENRIND_SHELL_FUSE_WRITABLE_TIMEOUT_SECONDS:-60}"
case "$FUSE_WRITABLE_TIMEOUT_SECONDS" in
  ''|*[!0-9]*)
    echo "setup-fuse.sh: OPENRIND_SHELL_FUSE_WRITABLE_TIMEOUT_SECONDS must be a positive integer" >&2
    exit 2
    ;;
esac

if [ "$FUSE_WRITABLE_TIMEOUT_SECONDS" -lt 1 ]; then
  echo "setup-fuse.sh: OPENRIND_SHELL_FUSE_WRITABLE_TIMEOUT_SECONDS must be a positive integer" >&2
  exit 2
fi

echo "setup-fuse.sh: waiting up to ${FUSE_WRITABLE_TIMEOUT_SECONDS}s for the mounted filesystem writer lease..."
HEALTH=""
LAST_INIT_ERROR=""
REPEATED_INIT_ERRORS=0
for attempt in $(seq 1 "$FUSE_WRITABLE_TIMEOUT_SECONDS"); do
  HEALTH="$(openrind-shell-fused health 2>/dev/null || true)"
  STATE="$(node -e 'try { process.stdout.write(JSON.parse(process.argv[1]).state || "") } catch {}' "$HEALTH")"
  INIT_ERROR="$(node -e 'try { const value = JSON.parse(process.argv[1]).lastInitializationError; if (typeof value === "string") process.stdout.write(value) } catch {}' "$HEALTH")"
  [ "$STATE" != writable ] || break
  if [ -n "$INIT_ERROR" ]; then
    if [ "$INIT_ERROR" = "$LAST_INIT_ERROR" ]; then
      REPEATED_INIT_ERRORS=$((REPEATED_INIT_ERRORS + 1))
    else
      LAST_INIT_ERROR="$INIT_ERROR"
      REPEATED_INIT_ERRORS=1
      echo "setup-fuse.sh: daemon initialization: $INIT_ERROR" >&2
    fi
    # One error can be a transient PostgreSQL/proxy race. Three identical
    # completed attempts indicate a stable configuration or connectivity
    # failure; waiting out the full timeout cannot change it.
    if [ "$REPEATED_INIT_ERRORS" -ge 3 ]; then
      echo "setup-fuse.sh: FUSE daemon initialization failed repeatedly: $INIT_ERROR" >&2
      exit 1
    fi
  fi
  if [ $((attempt % 10)) -eq 0 ]; then
    echo "setup-fuse.sh: still waiting (${STATE:-management socket unavailable}, ${attempt}s)"
  fi
  sleep 1
done
if [ "${STATE:-}" != writable ]; then
  echo "setup-fuse.sh: FUSE daemon did not become writable within ${FUSE_WRITABLE_TIMEOUT_SECONDS} seconds" >&2
  [ -z "$LAST_INIT_ERROR" ] || echo "setup-fuse.sh: daemon initialization: $LAST_INIT_ERROR" >&2
  [ -z "$HEALTH" ] || echo "setup-fuse.sh: health: $HEALTH" >&2
  exit 1
fi
# These are the README-required acceptance checks. `state=writable` proves that
# the daemon acquired a lease, while verify-lease independently confirms the
# exact owner/epoch in PostgreSQL and the canary proves the mounted VFS path.
# Desktop fast-start skips only optional mounted-home seeding below.
LEASE_OWNER="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).leaseOwner)' "$HEALTH")"
LEASE_EPOCH="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).leaseEpoch))' "$HEALTH")"
OPENRIND_SHELL_LEASE_OWNER="$LEASE_OWNER" OPENRIND_SHELL_LEASE_EPOCH="$LEASE_EPOCH" \
OPENERAL_LEASE_OWNER="$LEASE_OWNER" OPENERAL_LEASE_EPOCH="$LEASE_EPOCH" \
  node "$OPENRIND_SHELL_DIR/dist/bin/openrind-shell-fuse-init.js" verify-lease

echo "setup-fuse.sh: verifying mounted write, fsync, and read-back..."
HOME="$OPENRIND_SHELL_HOME" node --input-type=module - <<'NODE'
import { closeSync, constants, fsyncSync, openSync, readSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// This is intentionally one mounted-file canary. The daemon is already known
// writable and its PostgreSQL writer lease has just been verified above. Extra
// directory creation, directory fsync, close/reopen, and cleanup scans turn a
// small proof into many serial remote database round trips on a cold volume.
// Keep one hidden canary instead of creating and garbage-collecting a new inode.
// This removes the remote unlink/collection transaction while still proving a
// mounted write, durability barrier, and post-commit read-back.
const path = '/sandbox/work/.openrind-shell-durability-canary';
const expected = randomBytes(4096);
const fd = openSync(path, constants.O_CREAT | constants.O_TRUNC | constants.O_RDWR, 0o600);
try {
  writeFileSync(fd, expected);
  fsyncSync(fd);
  const actual = Buffer.allocUnsafe(expected.length);
  const read = readSync(fd, actual, 0, actual.length, 0);
  if (read !== expected.length || !actual.equals(expected)) {
    throw new Error('FUSE canary read-back mismatch');
  }
} finally {
  closeSync(fd);
}
NODE
if [ "${OPENRIND_SHELL_FAST_START:-}" = "1" ]; then
  # Provider configuration is already injected by OpenShell and the Claude
  # wrapper supplies the documented OpenRouter environment. Bundled skills and
  # optional default settings must not delay the first interactive session.
  echo "setup-fuse.sh: skipping optional mounted-home bootstrap on the first Desktop launch"
  : > "$OPENRIND_SHELL_RUNTIME_DIR/desktop-fast-first-launch"
  chmod 600 "$OPENRIND_SHELL_RUNTIME_DIR/desktop-fast-first-launch"
else
mkdir -p "$OPENRIND_SHELL_HOME/.claude/skills" "$OPENRIND_SHELL_HOME/.openrind-shell"
if [ -d /opt/openrind-shell/skills ]; then
  cp -a --update=none /opt/openrind-shell/skills/. "$OPENRIND_SHELL_HOME/.claude/skills/"
fi

HOME="$OPENRIND_SHELL_HOME" node --input-type=module - <<'NODE'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const home = '/sandbox/work';
const settings = `${home}/.claude/settings.json`;
mkdirSync(`${home}/.claude`, { recursive: true });
if (!existsSync(settings)) {
  writeFileSync(settings, `${JSON.stringify({
    permissions: {
      allow: ['Bash(npm run *)', 'Bash(npm test *)', 'Bash(git status)', 'Bash(git diff *)', 'Bash(git log *)', 'Bash(git commit *)', 'Bash(ls *)', 'Bash(cat *)', 'Bash(grep *)'],
      deny: ['Read(~/.ssh/**)', 'Read(~/.aws/**)', 'Read(~/.azure/**)', 'Read(~/.npmrc)', 'Read(~/.git-credentials)', 'Edit(~/.bashrc)', 'Edit(~/.zshrc)', 'Bash(curl *)', 'Bash(wget *)', 'Bash(nc *)', 'Bash(ssh *)', 'Bash(git push *)', 'Read(*.env)', 'Read(.env.*)'],
    },
    enableAllProjectMcpServers: false,
  }, null, 2)}\n`);
}
NODE

HOME="$OPENRIND_SHELL_HOME" node /opt/openrind-shell/configure-openrind-gateway.mjs
fi

# Claude Code's first-run wizard writes several state files. Do that work as
# part of the documented one-shot initializer, before a Desktop PTY connects,
# so a selected Claude session opens its prompt instead of spending its first
# interactive minute mutating the remote FUSE home. The state stays entirely
# below HOME=/sandbox/work and existing user configuration is kept intact.
HOME="$OPENRIND_SHELL_HOME" node --input-type=module - <<'NODE'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const home = '/sandbox/work';
const projectDir = '/sandbox/work/workspace';
const configPath = `${home}/.claude.json`;
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};
const configExisted = existsSync(configPath);
const config = readJson(configPath) || {};
let needsWrite = false;
mkdirSync(projectDir, { recursive: true });
if (config.hasCompletedOnboarding !== true) {
  let version = '';
  try {
    version = String(execFileSync('/usr/local/bin/claude-real', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    })).match(/^(\d+\.\d+\.\d+)/m)?.[1] || '';
  } catch {}
  config.hasCompletedOnboarding = true;
  if (version) config.lastOnboardingVersion = version;
  needsWrite = true;
}
// Claude Code stores trust as per-project state in ~/.claude.json. The Desktop
// sandbox creation action explicitly authorizes this policy-isolated workspace.
if (!config.projects || typeof config.projects !== 'object' || Array.isArray(config.projects)) {
  config.projects = {};
  needsWrite = true;
}
const project = config.projects[projectDir];
if (!project || typeof project !== 'object' || Array.isArray(project)) {
  config.projects[projectDir] = { hasTrustDialogAccepted: true };
  needsWrite = true;
} else if (project.hasTrustDialogAccepted !== true) {
  project.hasTrustDialogAccepted = true;
  needsWrite = true;
}
if (needsWrite) {
  const contents = `${JSON.stringify(config, null, 2)}\n`;
  if (configExisted) {
    const temporaryPath = `${configPath}.openrind-init-${process.pid}`;
    writeFileSync(temporaryPath, contents, { mode: 0o600 });
    renameSync(temporaryPath, configPath);
    chmodSync(configPath, 0o600);
  } else {
    // Direct first-create avoids extra remote inode, rename, and chmod transactions.
    // Existing user configuration still uses atomic replacement above.
    writeFileSync(configPath, contents, { mode: 0o600 });
  }
  process.stdout.write('setup-fuse.sh: Claude first-run state initialized\n');
}
NODE
OPENRIND_SHELL_NPMRC="$OPENRIND_SHELL_RUNTIME_DIR/npmrc"
rm -f "$OPENRIND_SHELL_NPMRC"
if [ -n "${SOCKET_TOKEN:-}" ]; then
  cat > "$OPENRIND_SHELL_NPMRC" <<NPMRC
registry=https://registry.socket.dev/npm/
//registry.socket.dev/npm/:_authToken=${SOCKET_TOKEN}
NPMRC
  chmod 600 "$OPENRIND_SHELL_NPMRC"
fi

# OpenShell may enter the image through either a login shell or an interactive
# shell, depending on the paired supervisor version. Install the one-shot hook
# in both paths. Keep its sentinel separate from the general environment block:
# older sandboxes can already contain that block without the Desktop hook, and
# using the old sentinel caused upgrades to silently skip launcher installation.
for SHELL_PROFILE in "/sandbox/.bash_profile" "/sandbox/.profile"; do
  [ -d "$(dirname "$SHELL_PROFILE")" ] || continue
  if ! grep -q 'Openrind Desktop Claude login hook' "$SHELL_PROFILE" 2>/dev/null; then
    cat >> "$SHELL_PROFILE" <<'PROFILE'

# Openrind Desktop Claude login hook.
if [ -f /var/lib/openrind-shell/runtime/desktop-claude-launch ]; then
  exec /usr/local/bin/openrind-desktop-claude-launch
fi
PROFILE
  fi
done

for SHELL_BASHRC in "/sandbox/.bashrc" "$OPENRIND_SHELL_HOME/.bashrc"; do
  [ -d "$(dirname "$SHELL_BASHRC")" ] || continue
  if ! grep -q 'Openrind Shell FUSE session environment' "$SHELL_BASHRC" 2>/dev/null; then
    cat >> "$SHELL_BASHRC" <<'BASHRC'

# Openrind Shell FUSE session environment.
[ -f /var/lib/openrind-shell/runtime/session.env ] && . /var/lib/openrind-shell/runtime/session.env
case "$-" in
  *i*)
    case "$PWD" in
      /|/sandbox) [ -d "${OPENRIND_SHELL_PROJECT_DIR:-/sandbox/work/workspace}" ] && cd "${OPENRIND_SHELL_PROJECT_DIR:-/sandbox/work/workspace}" ;;
    esac
    if [ -z "${OPENRIND_SHELL_HINT_SHOWN:-}" ]; then
      export OPENRIND_SHELL_HINT_SHOWN=1
      echo "Openrind Shell ready. Run 'claude' to start; /exit or Ctrl-D returns here; 'claude -c' continues."
    fi
    ;;
esac
BASHRC
  fi
  if ! grep -q 'Openrind Desktop Claude interactive hook' "$SHELL_BASHRC" 2>/dev/null; then
    cat >> "$SHELL_BASHRC" <<'BASHRC'

# Openrind Desktop Claude interactive hook.
if [ -f /var/lib/openrind-shell/runtime/desktop-claude-launch ]; then
  exec /usr/local/bin/openrind-desktop-claude-launch
fi
BASHRC
  fi
done

shell_quote() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}
SESSION_ENV="$OPENRIND_SHELL_RUNTIME_DIR/session.env"
{
  printf 'export HOME='; shell_quote "$OPENRIND_SHELL_HOME"; printf '\n'
  printf 'export OPENRIND_SHELL_HOME='; shell_quote "$OPENRIND_SHELL_HOME"; printf '\n'
  printf 'export OPENRIND_SHELL_PROJECT_DIR='; shell_quote "$OPENRIND_SHELL_PROJECT_DIR"; printf '\n'
  printf 'export OPENRIND_SHELL_RUNTIME_DIR='; shell_quote "$OPENRIND_SHELL_RUNTIME_DIR"; printf '\n'
  printf 'export OPENRIND_SHELL_STATE_DIR='; shell_quote "$OPENRIND_SHELL_RUNTIME_DIR"; printf '\n'
  printf 'export OPENRIND_SHELL_DB_URL_FILE='; shell_quote "$OPENRIND_SHELL_DB_URL_FILE"; printf '\n'
  printf 'export OPENRIND_SHELL_INIT_MARKER='; shell_quote "$OPENRIND_SHELL_INIT_MARKER"; printf '\n'
  printf 'export OPENRIND_SHELL_REQUIRE_POSTGRES_TLS=1\n'
  printf 'export OPENERAL_HOME='; shell_quote "$OPENRIND_SHELL_HOME"; printf '\n'
  printf 'export OPENERAL_RUNTIME_DIR='; shell_quote "$OPENRIND_SHELL_RUNTIME_DIR"; printf '\n'
  printf 'export OPENERAL_STATE_DIR='; shell_quote "$OPENRIND_SHELL_RUNTIME_DIR"; printf '\n'
  printf 'export OPENERAL_DB_URL_FILE='; shell_quote "$OPENRIND_SHELL_DB_URL_FILE"; printf '\n'
  printf 'export OPENERAL_INIT_MARKER='; shell_quote "$OPENRIND_SHELL_INIT_MARKER"; printf '\n'
  printf 'export OPENERAL_REQUIRE_POSTGRES_TLS=1\n'
  printf 'export OPENRIND_SHELL_WORKSPACE_ID='; shell_quote "$WORKSPACE_ID"; printf '\n'
  printf 'export OPENERAL_WORKSPACE_ID='; shell_quote "$WORKSPACE_ID"; printf '\n'
  printf 'export WORKSPACE_ID='; shell_quote "$WORKSPACE_ID"; printf '\n'
  printf 'export SHELL=/bin/bash\n'
  if [ "${OPENRIND_SHELL_FAST_START:-}" = "1" ]; then
    printf 'export OPENRIND_SHELL_FAST_START=1\n'
  fi
  if [ -n "${SSL_CERT_FILE:-}" ]; then
    printf 'export NODE_EXTRA_CA_CERTS='; shell_quote "${NODE_EXTRA_CA_CERTS:-$SSL_CERT_FILE}"; printf '\n'
  fi
  [ ! -f "$OPENRIND_SHELL_NPMRC" ] || printf 'export NPM_CONFIG_USERCONFIG=%s\n' "$(shell_quote "$OPENRIND_SHELL_NPMRC")"
  if [ -f "$OPENRIND_SHELL_RUNTIME_DIR/anthropic-base-url" ]; then
    printf 'export ANTHROPIC_BASE_URL='; shell_quote "$(cat "$OPENRIND_SHELL_RUNTIME_DIR/anthropic-base-url")"; printf '\n'
  fi
} > "$SESSION_ENV"
chmod 600 "$SESSION_ENV"

command -v claude-real >/dev/null 2>&1 || {
  echo "setup-fuse.sh: claude-real is missing from the image" >&2
  exit 1
}

if [ "${OPENRIND_SHELL_FAST_START:-}" != "1" ]; then
  openrind-shell-fused flush-all >/dev/null
fi
node "$OPENRIND_SHELL_DIR/dist/bin/openrind-shell-fuse-init.js" mark-done

if [ -n "$DB_URL_FILE" ] && [ "$DB_URL_FILE" != "$OPENERAL_DB_URL_FILE" ]; then
  rm -f "$DB_URL_FILE"
fi

echo
echo "Openrind Shell FUSE initialized for workspace: $WORKSPACE_ID"
echo "Connect with: openshell sandbox connect <sandbox-name>"
echo "Inside the sandbox: run 'claude'; use /exit or Ctrl-D to stop; run 'claude -c' to continue."
echo
