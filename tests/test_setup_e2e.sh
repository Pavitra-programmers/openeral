#!/usr/bin/env bash
set -euo pipefail

# test_setup_e2e.sh — Runs setup.sh inside the Docker image end-to-end,
# then verifies the resulting state is correct for Claude Code.
#
# This replaces the final `exec claude` with verification commands.
# It exercises the ACTUAL setup.sh code path, not manual reproductions.
#
# Requires: docker, reachable PostgreSQL
# Usage: DATABASE_URL='postgresql://...' ./tests/test_setup_e2e.sh

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

IMAGE="${OPENERAL_E2E_IMAGE:-openeral-e2e:local}"
DB_URL="${DATABASE_URL:?DATABASE_URL required}"
WORKSPACE="setup-e2e-$$"
PASSED=0
FAILED=0

pass() { echo "  ✓ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

echo ""
echo "=== Building image ==="
docker build -f sandboxes/openeral/Dockerfile -t "$IMAGE" . 2>&1 | tail -2

echo ""
echo "=== Running setup.sh one-shot init ==="
out=$(timeout 120 docker run --rm --network host \
  -e DATABASE_URL="$DB_URL" \
  -e WORKSPACE_ID="$WORKSPACE" \
  -e OPENSHELL_SANDBOX_ID="$WORKSPACE" \
  -e SOCKET_TOKEN="test-placeholder-token" \
  --user sandbox \
  --entrypoint /bin/sh \
  "$IMAGE" -c '
    /opt/openeral/setup.sh
    . /tmp/openeral-session.env

    echo "CHECK:init=ok"
    [ -f /tmp/openeral/init.done ] && echo "CHECK:init-marker=ok" || echo "CHECK:init-marker=FAIL"
    [ -f /tmp/openeral/database-url ] && echo "CHECK:db-url-store=ok" || echo "CHECK:db-url-store=FAIL"
    [ ! -S /tmp/openeral-bash.sock ] && echo "CHECK:no-init-daemon=ok" || echo "CHECK:no-init-daemon=FAIL"
    grep -q "SHELL=.*bin/bash" /tmp/openeral-session.env && echo "CHECK:shell-real-bash=ok" || echo "CHECK:shell-real-bash=FAIL"
    grep -q "DATABASE_URL" /tmp/openeral-session.env && echo "CHECK:session-db-url=LEAK" || echo "CHECK:session-db-url=absent-ok"
    echo "CHECK:home-writable=$(touch /home/agent/.check && echo ok || echo FAIL)"
    echo "CHECK:npm-userconfig=${NPM_CONFIG_USERCONFIG:-not-set}"
    NPM_REG=$(HOME=/home/agent npm config get registry 2>/dev/null || echo "npm-failed")
    echo "CHECK:npm-registry=$NPM_REG"
    if [ -f /home/agent/.npmrc ]; then
      echo "CHECK:user-npmrc=EXISTS-SHOULD-NOT"
    else
      echo "CHECK:user-npmrc=absent-ok"
    fi
    echo "CHECK:socket-token-present=$([ -n "${SOCKET_TOKEN:-}" ] && echo yes || echo no)"

    /usr/local/bin/openeral-daemon-ensure
    timeout 5 /usr/local/bin/openeral-daemon-ensure && echo "CHECK:second-ensure=ok" || echo "CHECK:second-ensure=FAIL"
    HEALTH=$(node /opt/openeral/openeral-bash.mjs --health 2>/dev/null || true)
    echo "CHECK:daemon-health=$HEALTH"
    DAEMON_RESP=$(node -e "
      const net=require(\"net\"),c=net.createConnection(\"/tmp/openeral-bash.sock\");
      let d=\"\";
      c.on(\"connect\",()=>c.write(JSON.stringify({command:\"echo daemon-works\"})+\"\n\"));
      c.on(\"data\",chunk=>d+=chunk);
      c.on(\"end\",()=>{const r=JSON.parse(d.trim());process.stdout.write(r.stdout.trim())});
    " 2>/dev/null || echo "daemon-failed")
    echo "CHECK:daemon-response=$DAEMON_RESP"

    echo "CHECK:node-available=$(which node)"
    /usr/local/bin/openeral-bash --stop >/dev/null 2>&1 || true
    exit 0
  ' 2>&1)

echo "$out"
echo ""
echo "=== Checking results ==="

check() {
  local label="$1" pattern="$2"
  if echo "$out" | grep -q "$pattern"; then
    pass "$label"
  else
    fail "$label"
  fi
}

check "init completed"          "CHECK:init=ok"
check "init marker"             "CHECK:init-marker=ok"
check "db url store"            "CHECK:db-url-store=ok"
check "init does not start daemon" "CHECK:no-init-daemon=ok"
check "session uses real bash"   "CHECK:shell-real-bash=ok"
check "session env no db url"    "CHECK:session-db-url=absent-ok"
check "home writable"           "CHECK:home-writable=ok"
check "NPM_CONFIG_USERCONFIG"   "CHECK:npm-userconfig=/tmp/openeral-npmrc"
check "npm reads socket.dev"    "CHECK:npm-registry=https://registry.socket.dev"
check "user .npmrc untouched"   "CHECK:user-npmrc=absent-ok"
check "SOCKET_TOKEN present"    "CHECK:socket-token-present=yes"
check "second daemon ensure"    "CHECK:second-ensure=ok"
check "daemon health"           "CHECK:daemon-health=.*\"workspaceId\":\"$WORKSPACE\""
check "daemon responds"         "CHECK:daemon-response=daemon-works"

# Cleanup
node -e "
  import('pg').then(async({default:pg})=>{
    const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
    await pool.query('DELETE FROM _openeral.workspace_files WHERE workspace_id=\$1',['$WORKSPACE']);
    await pool.query('DELETE FROM _openeral.workspace_config WHERE id=\$1',['$WORKSPACE']);
    await pool.end();
  }).catch(()=>{});
" 2>/dev/null || true

echo ""
echo "=== Results: $PASSED passed, $FAILED failed ==="
[ "$FAILED" -eq 0 ] || exit 1
