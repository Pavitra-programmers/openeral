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
export OPENRIND_SHELL_REQUIRE_POSTGRES_TLS=1
# Legacy aliases are exported for user scripts and older library builds.
export OPENERAL_RUNTIME_DIR="$OPENRIND_SHELL_RUNTIME_DIR"
export OPENERAL_STATE_DIR="$OPENRIND_SHELL_STATE_DIR"
export OPENERAL_DB_URL_FILE="$OPENRIND_SHELL_DB_URL_FILE"
export OPENERAL_INIT_MARKER="$OPENRIND_SHELL_INIT_MARKER"
export OPENERAL_HOME="$OPENRIND_SHELL_HOME"
export OPENERAL_REQUIRE_POSTGRES_TLS=1
# OpenShell supplies its combined trust bundle through SSL_CERT_FILE. Node uses
# that bundle only in OpenSSL-CA mode; image-level ENV is not preserved by the
# supervisor's sandbox environment construction.
case " ${NODE_OPTIONS:-} " in
  *" --use-openssl-ca "*) ;;
  *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--use-openssl-ca" ;;
esac
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

echo "setup-fuse.sh: waiting for the mounted filesystem writer lease..."
HEALTH=""
for attempt in $(seq 1 60); do
  HEALTH="$(openrind-shell-fused health 2>/dev/null || true)"
  STATE="$(node -e 'try { process.stdout.write(JSON.parse(process.argv[1]).state || "") } catch {}' "$HEALTH")"
  [ "$STATE" != writable ] || break
  if [ $((attempt % 10)) -eq 0 ]; then
    echo "setup-fuse.sh: still waiting (${STATE:-management socket unavailable}, ${attempt}s)"
  fi
  sleep 1
done
if [ "${STATE:-}" != writable ]; then
  echo "setup-fuse.sh: FUSE daemon did not become writable within 60 seconds" >&2
  [ -z "$HEALTH" ] || echo "setup-fuse.sh: health: $HEALTH" >&2
  exit 1
fi

LEASE_OWNER="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).leaseOwner)' "$HEALTH")"
LEASE_EPOCH="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).leaseEpoch))' "$HEALTH")"
OPENRIND_SHELL_LEASE_OWNER="$LEASE_OWNER" OPENRIND_SHELL_LEASE_EPOCH="$LEASE_EPOCH" \
OPENERAL_LEASE_OWNER="$LEASE_OWNER" OPENERAL_LEASE_EPOCH="$LEASE_EPOCH" \
  node "$OPENRIND_SHELL_DIR/dist/bin/openrind-shell-fuse-init.js" verify-lease

echo "setup-fuse.sh: verifying mounted read/write durability..."
HOME="$OPENRIND_SHELL_HOME" node --input-type=module - <<'NODE'
import { closeSync, constants, mkdirSync, openSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync, fsyncSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';

const directory = '/sandbox/work/.openrind-shell/.init-probes';
mkdirSync(directory, { recursive: true, mode: 0o700 });
for (const name of readdirSync(directory)) rmSync(`${directory}/${name}`, { recursive: true, force: true });
const path = `${directory}/${randomUUID()}`;
const expected = randomBytes(4096);
const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
try {
  writeFileSync(fd, expected);
  fsyncSync(fd);
} finally {
  closeSync(fd);
}
const directoryFd = openSync(directory, constants.O_RDONLY);
try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
const actual = readFileSync(path);
if (!actual.equals(expected)) throw new Error('FUSE canary read-back mismatch');
unlinkSync(path);
const finalDirectoryFd = openSync(directory, constants.O_RDONLY);
try { fsyncSync(finalDirectoryFd); } finally { closeSync(finalDirectoryFd); }
NODE

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

OPENRIND_SHELL_NPMRC="$OPENRIND_SHELL_RUNTIME_DIR/npmrc"
rm -f "$OPENRIND_SHELL_NPMRC"
if [ -n "${SOCKET_TOKEN:-}" ]; then
  cat > "$OPENRIND_SHELL_NPMRC" <<NPMRC
registry=https://registry.socket.dev/npm/
//registry.socket.dev/npm/:_authToken=${SOCKET_TOKEN}
NPMRC
  chmod 600 "$OPENRIND_SHELL_NPMRC"
fi

if ! grep -q 'Openrind Shell FUSE session environment' "$OPENRIND_SHELL_HOME/.bashrc" 2>/dev/null; then
  cat >> "$OPENRIND_SHELL_HOME/.bashrc" <<'BASHRC'

# Openrind Shell FUSE session environment.
[ -f /var/lib/openrind-shell/runtime/session.env ] && . /var/lib/openrind-shell/runtime/session.env
case "$-" in
  *i*)
    if [ -z "${OPENRIND_SHELL_HINT_SHOWN:-}" ]; then
      export OPENRIND_SHELL_HINT_SHOWN=1
      echo "Openrind Shell ready. Run 'claude' to start; /exit or Ctrl-D returns here; 'claude -c' continues."
    fi
    ;;
esac
BASHRC
fi

shell_quote() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}
SESSION_ENV="$OPENRIND_SHELL_RUNTIME_DIR/session.env"
{
  printf 'export HOME='; shell_quote "$OPENRIND_SHELL_HOME"; printf '\n'
  printf 'export OPENRIND_SHELL_HOME='; shell_quote "$OPENRIND_SHELL_HOME"; printf '\n'
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

openrind-shell-fused flush-all >/dev/null
node "$OPENRIND_SHELL_DIR/dist/bin/openrind-shell-fuse-init.js" mark-done

if [ -n "$DB_URL_FILE" ] && [ "$DB_URL_FILE" != "$OPENERAL_DB_URL_FILE" ]; then
  rm -f "$DB_URL_FILE"
fi

echo
echo "Openrind Shell FUSE initialized for workspace: $WORKSPACE_ID"
echo "Connect with: openshell sandbox connect <sandbox-name>"
echo "Inside the sandbox: run 'claude'; use /exit or Ctrl-D to stop; run 'claude -c' to continue."
echo
