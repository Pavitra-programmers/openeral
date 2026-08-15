#!/usr/bin/env bash
set -euo pipefail

# test_setup_e2e.sh — Runs compatibility setup.sh inside Docker end-to-end,
# then verifies the resulting state is correct for Claude Code.
#
# This exercises the legacy scoped-sync/PGlite path. The primary FUSE setup is
# covered through a real OpenShell supervisor by tests/fuse/test_openshell_e2e.sh.
#
# Requires: docker, reachable PostgreSQL
# Usage: DATABASE_URL='postgresql://...' ./tests/test_setup_e2e.sh

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

IMAGE="${OPENRIND_SHELL_E2E_IMAGE:-${OPENERAL_E2E_IMAGE:-openrind-shell-compat-e2e:local}}"
DB_URL="${DATABASE_URL:?DATABASE_URL required}"
WORKSPACE="setup-e2e-$$"
PASSED=0
FAILED=0

pass() { echo "  ✓ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

echo ""
echo "=== Building compatibility image ==="
docker build -f Dockerfile.openrind-shell-compat -t "$IMAGE" . 2>&1 | tail -2

echo ""
echo "=== Running setup.sh one-shot init ==="
out=$(timeout 120 docker run --rm --network host \
  -e DATABASE_URL="$DB_URL" \
  -e OPENRIND_SHELL_WORKSPACE_ID="$WORKSPACE" \
  -e OPENSHELL_SANDBOX_ID="$WORKSPACE" \
  -e SOCKET_TOKEN="test-placeholder-token" \
  --user sandbox \
  --entrypoint /bin/sh \
  "$IMAGE" -c '
    /opt/openrind-shell/setup.sh
    . /tmp/openrind-shell-session.env

    echo "CHECK:init=ok"
    [ -f /tmp/openrind-shell/init.done ] && echo "CHECK:init-marker=ok" || echo "CHECK:init-marker=FAIL"
    [ -f /tmp/openrind-shell/database-url ] && echo "CHECK:db-url-store=ok" || echo "CHECK:db-url-store=FAIL"
    [ ! -S /tmp/openrind-shell-bash.sock ] && echo "CHECK:no-init-daemon=ok" || echo "CHECK:no-init-daemon=FAIL"
    grep -q "SHELL=.*bin/bash" /tmp/openrind-shell-session.env && echo "CHECK:shell-real-bash=ok" || echo "CHECK:shell-real-bash=FAIL"
    grep -q "HOME=.*/sandbox" /tmp/openrind-shell-session.env && echo "CHECK:home-sandbox=ok" || echo "CHECK:home-sandbox=FAIL"
    grep -q "DATABASE_URL" /tmp/openrind-shell-session.env && echo "CHECK:session-db-url=LEAK" || echo "CHECK:session-db-url=absent-ok"
    grep -q "ANTHROPIC_API_KEY" /tmp/openrind-shell-session.env && echo "CHECK:session-anthropic-key=LEAK" || echo "CHECK:session-anthropic-key=absent-ok"
    echo "CHECK:home-writable=$(touch /sandbox/.check && echo ok || echo FAIL)"
    echo "CHECK:npm-userconfig=${NPM_CONFIG_USERCONFIG:-not-set}"
    NPM_REG=$(HOME=/sandbox npm config get registry 2>/dev/null || echo "npm-failed")
    echo "CHECK:npm-registry=$NPM_REG"
    if [ -f /sandbox/.npmrc ]; then
      echo "CHECK:user-npmrc=EXISTS-SHOULD-NOT"
    else
      echo "CHECK:user-npmrc=absent-ok"
    fi
    echo "CHECK:socket-token-present=$([ -n "${SOCKET_TOKEN:-}" ] && echo yes || echo no)"

    mkdir -p /sandbox/.claude
    printf "local-edit" > /sandbox/.claude/reinit-keep.md
    REINIT_OUT=$(/opt/openrind-shell/setup.sh 2>&1)
    case "$REINIT_OUT" in
      *"skipping PostgreSQL hydration"*) echo "CHECK:reinit-skip-hydration=ok" ;;
      *) echo "CHECK:reinit-skip-hydration=FAIL" ;;
    esac
    if [ "$(cat /sandbox/.claude/reinit-keep.md 2>/dev/null || true)" = "local-edit" ]; then
      echo "CHECK:reinit-preserves-local-edit=ok"
    else
      echo "CHECK:reinit-preserves-local-edit=FAIL"
    fi
    printf "ensure-edit" > /sandbox/.claude/ensure-keep.md
    if /usr/local/bin/openrind-shell init --ensure >/tmp/openrind-shell-ensure.out 2>&1; then
      echo "CHECK:ensure-short-circuit=ok"
    else
      echo "CHECK:ensure-short-circuit=FAIL"
    fi
    if [ "$(cat /sandbox/.claude/ensure-keep.md 2>/dev/null || true)" = "ensure-edit" ]; then
      echo "CHECK:ensure-preserves-local-edit=ok"
    else
      echo "CHECK:ensure-preserves-local-edit=FAIL"
    fi

    /usr/local/bin/openrind-shell-daemon-ensure
    timeout 5 /usr/local/bin/openrind-shell-daemon-ensure && echo "CHECK:second-ensure=ok" || echo "CHECK:second-ensure=FAIL"
    HEALTH=$(/usr/local/bin/openrind-shell-bash --health 2>/dev/null || true)
    echo "CHECK:daemon-health=$HEALTH"
    DAEMON_RESP=$(node -e "
      const net=require(\"net\"),c=net.createConnection(\"/tmp/openrind-shell-bash.sock\");
      let d=\"\";
      c.on(\"connect\",()=>c.write(JSON.stringify({command:\"echo daemon-works\"})+\"\n\"));
      c.on(\"data\",chunk=>d+=chunk);
      c.on(\"end\",()=>{const r=JSON.parse(d.trim());process.stdout.write(r.stdout.trim())});
    " 2>/dev/null || echo "daemon-failed")
    echo "CHECK:daemon-response=$DAEMON_RESP"

    echo "CHECK:node-available=$(which node)"
    /usr/local/bin/openrind-shell-bash --stop >/dev/null 2>&1 || true
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
check "session uses /sandbox home" "CHECK:home-sandbox=ok"
check "session env no db url"    "CHECK:session-db-url=absent-ok"
check "session env no Anthropic key" "CHECK:session-anthropic-key=absent-ok"
check "home writable"           "CHECK:home-writable=ok"
check "NPM_CONFIG_USERCONFIG"   "CHECK:npm-userconfig=/tmp/openrind-shell-npmrc"
check "npm reads socket.dev"    "CHECK:npm-registry=https://registry.socket.dev"
check "user .npmrc untouched"   "CHECK:user-npmrc=absent-ok"
check "SOCKET_TOKEN present"    "CHECK:socket-token-present=yes"
check "reinit skips hydration"  "CHECK:reinit-skip-hydration=ok"
check "reinit preserves local edit" "CHECK:reinit-preserves-local-edit=ok"
check "ensure short-circuits"   "CHECK:ensure-short-circuit=ok"
check "ensure preserves local edit" "CHECK:ensure-preserves-local-edit=ok"
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
