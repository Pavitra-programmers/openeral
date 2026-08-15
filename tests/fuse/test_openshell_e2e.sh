#!/usr/bin/env bash
set -euo pipefail

# Real OpenShell Docker-driver verification for the primary FUSE image.
#
# Required:
#   DATABASE_URL                 PostgreSQL URL accepted by the image policy
#   OPENSHELL_GATEWAY_ENDPOINT   patched gateway with Docker FUSE enabled
#
# Optional:
#   OPENSHELL_BIN                default: vendor/openshell/target/debug/openshell
#   OPENSHELL_XDG_CONFIG_HOME    isolated OpenShell client config
#   OPENERAL_FUSE_E2E_IMAGE      default: openeral-fuse:test
#   OPENERAL_FUSE_E2E_KEEP=1     retain the final sandbox for inspection
#   OPENERAL_FUSE_REAL_CLAUDE=1  run a provider-backed Claude write
#   OPENERAL_FUSE_E2E_PROVIDER   provider name attached for the Claude stage
#
# The image policy must permit DATABASE_URL's host. The stock primary policy
# permits Supabase poolers. tests/fuse/Dockerfile.local-postgres builds an
# overlay for a private TLS PostgreSQL fixture.

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo_root"

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
OPENSHELL_GATEWAY_ENDPOINT="${OPENSHELL_GATEWAY_ENDPOINT:?OPENSHELL_GATEWAY_ENDPOINT is required}"
OPENSHELL_BIN="${OPENSHELL_BIN:-$repo_root/vendor/openshell/target/debug/openshell}"
OPENSHELL_XDG_CONFIG_HOME="${OPENSHELL_XDG_CONFIG_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}"
OPENSHELL_WORKSPACE="${OPENSHELL_WORKSPACE:-default}"
IMAGE="${OPENERAL_FUSE_E2E_IMAGE:-openeral-fuse:test}"
KEEP="${OPENERAL_FUSE_E2E_KEEP:-0}"
RUN_ID="${OPENERAL_FUSE_E2E_RUN_ID:-$(date +%s)-$$}"
RUN_TAG="$(printf '%s' "$RUN_ID" | cksum | awk '{print $1}')"
VOLUME_WORKSPACE="openeral-fuse-e2e-$RUN_ID"
FIRST_SANDBOX="ofe-a-$RUN_TAG"
SECOND_SANDBOX="ofe-b-$RUN_TAG"
SENTINEL_CONTENT="durable-$RUN_ID"
SENTINEL_PATH="/sandbox/work/.openeral/e2e-persistence.txt"
DB_FILE="$(mktemp /tmp/openeral-fuse-e2e-db-XXXXXX)"
CURRENT_SANDBOX=""

chmod 600 "$DB_FILE"
printf '%s' "$DATABASE_URL" > "$DB_FILE"

cleanup() {
  rm -f "$DB_FILE"
  if [ "$KEEP" != 1 ] && [ -n "$CURRENT_SANDBOX" ]; then
    os sandbox delete "$CURRENT_SANDBOX" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

os() {
  env XDG_CONFIG_HOME="$OPENSHELL_XDG_CONFIG_HOME" \
    "$OPENSHELL_BIN" \
    --gateway-endpoint "$OPENSHELL_GATEWAY_ENDPOINT" \
    --workspace "$OPENSHELL_WORKSPACE" \
    "$@"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "FUSE E2E: missing required command: $1" >&2
    exit 1
  }
}

pass() {
  printf 'PASS %s\n' "$1"
}

json_field() {
  node -e '
    const value = JSON.parse(process.argv[1]);
    const selected = value[process.argv[2]];
    if (selected === undefined || selected === null) process.exit(2);
    process.stdout.write(String(selected));
  ' "$1" "$2"
}

create_sandbox() {
  local name="$1"
  local -a args=(
    sandbox create
    --name "$name"
    --from "$IMAGE"
    --fuse
    --env "WORKSPACE_ID=$VOLUME_WORKSPACE"
    --upload "$DB_FILE:/sandbox/db-url"
    --no-tty
  )

  if [ "${OPENERAL_FUSE_REAL_CLAUDE:-0}" = 1 ]; then
    local provider="${OPENERAL_FUSE_E2E_PROVIDER:?OPENERAL_FUSE_E2E_PROVIDER is required for real Claude}"
    args+=(--provider "$provider" --auto-providers --no-credential-warnings)
    for key in CLAUDE_CODE_USE_BEDROCK AWS_REGION AWS_DEFAULT_REGION ANTHROPIC_MODEL; do
      if [ -n "${!key:-}" ]; then
        args+=(--env "$key=${!key}")
      fi
    done
  fi

  CURRENT_SANDBOX="$name"
  os "${args[@]}" -- openeral-init
}

sandbox_exec() {
  local name="$1"
  shift
  os sandbox exec -n "$name" --no-tty -- "$@"
}

health_json() {
  sandbox_exec "$1" openeral-fused health
}

container_name() {
  local name="$1"
  docker ps --format '{{.Names}}' | awk -v needle="--${name}-" 'index($0, needle) { print; exit }'
}

wait_for_recovery() {
  local name="$1"
  local container="$2"
  local previous_restarts="$3"
  local attempt health state restarts phase

  for attempt in $(seq 1 90); do
    restarts="$(docker inspect --format '{{.RestartCount}}' "$container" 2>/dev/null || printf '0')"
    phase="$(os sandbox get "$name" -o json 2>/dev/null | node -e '
      let input = "";
      process.stdin.on("data", chunk => input += chunk);
      process.stdin.on("end", () => {
        try { process.stdout.write(JSON.parse(input).phase || ""); } catch {}
      });
    ' || true)"
    health="$(health_json "$name" 2>/dev/null || true)"
    state="$(json_field "$health" state 2>/dev/null || true)"
    if [ "$restarts" -gt "$previous_restarts" ] && [ "$phase" = Ready ] && [ "$state" = writable ]; then
      return 0
    fi
    sleep 1
  done

  echo "FUSE E2E: sandbox did not recover within 90 seconds" >&2
  return 1
}

require docker
require node
test -x "$OPENSHELL_BIN" || {
  echo "FUSE E2E: OpenShell binary is not executable: $OPENSHELL_BIN" >&2
  exit 1
}
docker image inspect "$IMAGE" >/dev/null

echo "=== Create and initialize primary FUSE sandbox ==="
create_sandbox "$FIRST_SANDBOX"

mount_output="$(sandbox_exec "$FIRST_SANDBOX" mount)"
grep -q 'openeral on /sandbox/work type fuse' <<<"$mount_output"
pass "OpenShell mounted openeral at /sandbox/work"

echo "=== Filesystem conformance ==="
os sandbox upload "$FIRST_SANDBOX" tests/fuse/conformance.mjs /tmp/openeral-fuse-conformance
sandbox_exec "$FIRST_SANDBOX" \
  env NODE_NO_WARNINGS=1 HOME=/sandbox/work \
  node /tmp/openeral-fuse-conformance/conformance.mjs
pass "FUSE behavioral conformance"

echo "=== Durable sentinel ==="
sandbox_exec "$FIRST_SANDBOX" env NODE_NO_WARNINGS=1 node -e '
  const fs = require("node:fs");
  const path = process.argv[1];
  fs.mkdirSync(require("node:path").dirname(path), { recursive: true });
  const fd = fs.openSync(path, "w", 0o600);
  try { fs.writeFileSync(fd, process.argv[2]); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const dir = fs.openSync(require("node:path").dirname(path), "r");
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
' "$SENTINEL_PATH" "$SENTINEL_CONTENT"
pass "sentinel acknowledged after fsync"

if [ "${OPENERAL_FUSE_REAL_CLAUDE:-0}" = 1 ]; then
  echo "=== Real Claude Code write ==="
  CLAUDE_SENTINEL="claude-$RUN_ID"
  sandbox_exec "$FIRST_SANDBOX" claude \
    --dangerously-skip-permissions \
    -p "Use Bash to write exactly ${CLAUDE_SENTINEL} to /sandbox/work/.openeral/e2e-claude.txt, then reply exactly WROTE."
  actual="$(sandbox_exec "$FIRST_SANDBOX" cat /sandbox/work/.openeral/e2e-claude.txt)"
  [ "$actual" = "$CLAUDE_SENTINEL" ]
  pass "real Claude wrote through the FUSE mount"
fi

echo "=== Critical-daemon crash recovery ==="
health_before="$(health_json "$FIRST_SANDBOX")"
epoch_before="$(json_field "$health_before" leaseEpoch)"
container="$(container_name "$FIRST_SANDBOX")"
[ -n "$container" ] || {
  echo "FUSE E2E: cannot identify Docker container for $FIRST_SANDBOX" >&2
  exit 1
}
restarts_before="$(docker inspect --format '{{.RestartCount}}' "$container")"
sandbox_exec "$FIRST_SANDBOX" bash -lc 'kill -TERM "$(pidof openeral-fused)"' >/dev/null 2>&1 || true
wait_for_recovery "$FIRST_SANDBOX" "$container" "$restarts_before"
health_after="$(health_json "$FIRST_SANDBOX")"
epoch_after="$(json_field "$health_after" leaseEpoch)"
[ "$epoch_after" -gt "$epoch_before" ]
actual="$(sandbox_exec "$FIRST_SANDBOX" cat "$SENTINEL_PATH")"
[ "$actual" = "$SENTINEL_CONTENT" ]
pass "container restarted, lease epoch advanced, and durable data survived"

echo "=== Persistence across sandbox replacement ==="
os sandbox delete "$FIRST_SANDBOX"
CURRENT_SANDBOX=""
create_sandbox "$SECOND_SANDBOX"
actual="$(sandbox_exec "$SECOND_SANDBOX" cat "$SENTINEL_PATH")"
[ "$actual" = "$SENTINEL_CONTENT" ]
pass "same workspace restored after delete and recreate"

if [ "${OPENERAL_FUSE_REAL_CLAUDE:-0}" = 1 ]; then
  actual="$(sandbox_exec "$SECOND_SANDBOX" cat /sandbox/work/.openeral/e2e-claude.txt)"
  [ "$actual" = "$CLAUDE_SENTINEL" ]
  pass "real Claude write restored in the replacement sandbox"
fi

echo "FUSE E2E complete for workspace $VOLUME_WORKSPACE"
if [ "$KEEP" = 1 ]; then
  echo "Retained sandbox: $CURRENT_SANDBOX"
fi
