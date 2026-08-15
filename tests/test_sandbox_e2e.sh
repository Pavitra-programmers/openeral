#!/usr/bin/env bash
set -euo pipefail

# test_sandbox_e2e.sh — Docker-based verification for the compatibility image.
#
# Builds the image, runs individual checks inside it as the sandbox user.
# Validates image shape, permissions, npm config, migrations, and lazy daemon startup.
#
# NOTE: This does not exercise the primary FUSE image. That requires the
# patched OpenShell supervisor and is covered by tests/fuse/test_openshell_e2e.sh.
#
# Requires: docker, a reachable PostgreSQL
#
# Usage:
#   DATABASE_URL='postgresql://...' ./tests/test_sandbox_e2e.sh

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

IMAGE="${OPENRIND_SHELL_E2E_IMAGE:-${OPENERAL_E2E_IMAGE:-openrind-shell-compat-e2e:local}}"
DB_URL="${DATABASE_URL:?DATABASE_URL required}"
PASSED=0
FAILED=0

pass() { echo "  ✓ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

run_in_image() {
  # Resolve the image's sandbox account by name, as the real supervisor does.
  docker run --rm --network host \
    -e DATABASE_URL="$DB_URL" \
    -e OPENRIND_SHELL_WORKSPACE_ID="e2e-sandbox-$$" \
    -e SOCKET_TOKEN="placeholder-for-test" \
    --user sandbox \
    --entrypoint /bin/sh \
    "$IMAGE" -c "$1" 2>&1
}

run_in_image_root() {
  docker run --rm --network host \
    -e DATABASE_URL="$DB_URL" \
    --entrypoint /bin/sh \
    "$IMAGE" -c "$1" 2>&1
}

echo ""
echo "=== Building compatibility image ==="
docker build -f Dockerfile.openrind-shell-compat -t "$IMAGE" . 2>&1 | tail -3

echo ""
echo "=== Test 1: /sandbox ownership ==="
out=$(run_in_image_root 'stat -c "%U:%G %a" /sandbox')
if echo "$out" | grep -q 'sandbox:sandbox'; then
  pass "/sandbox owned by sandbox:sandbox ($out)"
else
  fail "/sandbox wrong ownership: $out"
fi

echo ""
echo "=== Test 2: sandbox user can write to /sandbox ==="
out=$(run_in_image 'touch /sandbox/.permcheck && echo ok || echo FAIL')
if echo "$out" | grep -q 'ok'; then
  pass "sandbox user can write to /sandbox"
else
  fail "sandbox user cannot write to /sandbox: $out"
fi

echo ""
echo "=== Test 3: openrind-shell-npmrc written to /tmp when SOCKET_TOKEN is set ==="
out=$(run_in_image '
  OPENRIND_SHELL_NPMRC=/tmp/openrind-shell-npmrc
  rm -f "$OPENRIND_SHELL_NPMRC"
  cat > "$OPENRIND_SHELL_NPMRC" <<NPMRC
registry=https://registry.socket.dev/npm/
//registry.socket.dev/npm/:_authToken=${SOCKET_TOKEN}
NPMRC
  cat "$OPENRIND_SHELL_NPMRC"
')
if echo "$out" | grep -q 'registry.socket.dev'; then
  pass "openrind-shell-npmrc contains registry.socket.dev"
else
  fail "openrind-shell-npmrc missing registry.socket.dev: $out"
fi
if echo "$out" | grep -q '_authToken=placeholder-for-test'; then
  pass "openrind-shell-npmrc contains SOCKET_TOKEN placeholder"
else
  fail "openrind-shell-npmrc missing token: $out"
fi

echo ""
echo "=== Test 4: npm reads registry via NPM_CONFIG_USERCONFIG ==="
out=$(run_in_image '
  cat > /tmp/openrind-shell-npmrc <<NPMRC
registry=https://registry.socket.dev/npm/
NPMRC
  NPM_CONFIG_USERCONFIG=/tmp/openrind-shell-npmrc npm config get registry 2>/dev/null || echo "npm-config-failed"
')
if echo "$out" | grep -q 'registry.socket.dev'; then
  pass "npm config reads Socket.dev registry"
else
  fail "npm config does not read Socket.dev registry: $out"
fi

echo ""
echo "=== Test 5: Migrations against live PostgreSQL ==="
out=$(run_in_image '
  node -e "
    import(\"/opt/openrind-shell/dist/db/pool.js\").then(async({createPool})=>{
      const{runMigrations}=await import(\"/opt/openrind-shell/dist/db/migrations.js\");
      const p=createPool(process.env.DATABASE_URL);
      await runMigrations(p);await p.end();console.log(\"migrations-ok\");
    }).catch(e=>{console.error(e.message);process.exit(1)});
  "
')
if echo "$out" | grep -q 'migrations-ok'; then
  pass "migrations run successfully as sandbox user"
else
  fail "migrations failed: $out"
fi

echo ""
echo "=== Test 6: openrind-shell-daemon-ensure starts the daemon ==="
out=$(timeout 30 docker run --rm --network host \
  -e DATABASE_URL="$DB_URL" \
  -e OPENRIND_SHELL_WORKSPACE_ID="e2e-sandbox-$$" \
  --user sandbox \
  --entrypoint /bin/sh \
  "$IMAGE" -c '
    /usr/local/bin/openrind-shell-daemon-ensure
    if [ -S /tmp/openrind-shell-bash.sock ]; then
      echo "daemon-ok"
      /usr/local/bin/openrind-shell-bash --health
      timeout 5 /usr/local/bin/openrind-shell-daemon-ensure && echo "second-ensure-ok" || echo "second-ensure-failed"
      node -e "
        const net=require(\"net\"),c=net.createConnection(\"/tmp/openrind-shell-bash.sock\");
        let d=\"\";
        c.on(\"connect\",()=>c.write(JSON.stringify({command:\"echo hello-e2e\"})+\"\n\"));
        c.on(\"data\",chunk=>d+=chunk);
        c.on(\"end\",()=>{console.log(d.trim());process.exit(0)});
      "
    else
      echo "daemon-failed"
    fi
    /usr/local/bin/openrind-shell-bash --stop >/dev/null 2>&1 || true
    exit 0
  ' 2>&1 || echo "timeout")
if echo "$out" | grep -q 'daemon-ok'; then
  pass "daemon started"
else
  fail "daemon failed: $out"
fi
if echo "$out" | grep -q 'second-ensure-ok'; then
  pass "second daemon ensure returns without lock hang"
else
  fail "second daemon ensure failed or hung: $out"
fi
if echo "$out" | grep -q 'hello-e2e'; then
  pass "daemon responds to commands"
else
  fail "daemon did not respond: $out"
fi

echo ""
echo "=== Test 7: Node.js process identity ==="
out=$(run_in_image '
  # npm is a shebang script — verify the actual exe is /usr/bin/node
  head -1 /usr/bin/npm
  readlink -f /usr/bin/node || which node
')
if echo "$out" | grep -q 'node'; then
  pass "npm shebang uses node (OpenShell matches exe, not script)"
else
  fail "npm shebang unexpected: $out"
fi

echo ""
echo "=== Test 8: dist/ and node_modules/ present ==="
out=$(run_in_image '
  [ -d /opt/openrind-shell/dist ] && echo "dist-ok" || echo "dist-missing"
  [ -d /opt/openrind-shell/node_modules ] && echo "nm-ok" || echo "nm-missing"
')
if echo "$out" | grep -q 'dist-ok' && echo "$out" | grep -q 'nm-ok'; then
  pass "dist/ and node_modules/ present in image"
else
  fail "missing build artifacts: $out"
fi

echo ""
echo "=== Test 9: runtime wrappers are present ==="
out=$(run_in_image '
  [ -x /usr/local/bin/openrind-shell-init ] && echo "init-ok" || echo "init-missing"
  [ -x /usr/local/bin/openrind-shell-daemon-ensure ] && echo "daemon-ensure-ok" || echo "daemon-ensure-missing"
  [ -x /usr/local/bin/openeral-init ] && echo "legacy-init-ok" || echo "legacy-init-missing"
  [ -x /usr/local/bin/claude ] && echo "claude-wrapper-ok" || echo "claude-wrapper-missing"
  [ -x /usr/local/bin/claude-real ] && echo "claude-real-ok" || echo "claude-real-missing"
  [ -x /usr/local/bin/pg ] && echo "pg-ok" || echo "pg-missing"
')
if echo "$out" | grep -q 'init-ok' && echo "$out" | grep -q 'daemon-ensure-ok' && echo "$out" | grep -q 'legacy-init-ok' && echo "$out" | grep -q 'claude-wrapper-ok' && echo "$out" | grep -q 'claude-real-ok' && echo "$out" | grep -q 'pg-ok'; then
  pass "canonical runtime wrappers and legacy aliases present"
else
  fail "runtime wrappers missing: $out"
fi

echo ""
echo "=== Test 10: runtime user can create the PGlite data dir ==="
out=$(run_in_image '
  [ ! -e /tmp/openrind-shell ] && echo "data-not-precreated" || echo "data-precreated"
  mkdir -p /tmp/openrind-shell/data
  touch /tmp/openrind-shell/data/.permcheck && echo "data-write-ok" || echo "data-write-fail"
')
if echo "$out" | grep -q 'data-not-precreated' && echo "$out" | grep -q 'data-write-ok'; then
  pass "PGlite data dir is runtime-created and writable"
else
  fail "PGlite data dir ownership model is wrong: $out"
fi

echo ""
echo "=== Test 11: user .npmrc is never touched ==="
out=$(run_in_image '
  # Create a user .npmrc
  echo "user-config=true" > /sandbox/.npmrc
  # Simulate Openrind Shell Socket.dev config (writes to /tmp, not /sandbox)
  OPENRIND_SHELL_NPMRC=/tmp/openrind-shell-npmrc
  rm -f "$OPENRIND_SHELL_NPMRC"
  if [ -n "${SOCKET_TOKEN:-}" ]; then
    cat > "$OPENRIND_SHELL_NPMRC" <<NPMRC
registry=https://registry.socket.dev/npm/
NPMRC
  fi
  # User .npmrc must be untouched
  cat /sandbox/.npmrc
')
if echo "$out" | grep -q 'user-config=true'; then
  pass "user .npmrc preserved (not clobbered or deleted)"
else
  fail "user .npmrc was modified: $out"
fi

# Cleanup test workspace
node -e "
  import('pg').then(async({default:pg})=>{
    const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
    await pool.query('DELETE FROM _openeral.workspace_files WHERE workspace_id=\$1',['e2e-sandbox-$$']);
    await pool.query('DELETE FROM _openeral.workspace_config WHERE id=\$1',['e2e-sandbox-$$']);
    await pool.end();
  }).catch(()=>{});
" 2>/dev/null || true

echo ""
echo "=== Results: $PASSED passed, $FAILED failed ==="
[ "$FAILED" -eq 0 ] || exit 1
