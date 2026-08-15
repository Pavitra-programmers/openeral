#!/bin/bash
set -euo pipefail

# Build and initialize a local OpenEral sandbox through OpenShell's supported
# Dockerfile source path. OpenShell owns image transfer for the selected driver.
SANDBOX_NAME="${OPENERAL_DEV_SANDBOX:-openeral-local-dev}"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
gateway_args=()
if [ -n "${OPENSHELL_GATEWAY_ENDPOINT:-}" ]; then
  gateway_args+=(--gateway-endpoint "$OPENSHELL_GATEWAY_ENDPOINT")
fi

run_openshell() {
  "$OPENSHELL_BIN" "${gateway_args[@]}" "$@"
}

command -v "$OPENSHELL_BIN" >/dev/null 2>&1 || {
  echo "error: OpenShell CLI is not executable: $OPENSHELL_BIN" >&2
  exit 1
}
run_openshell gateway info >/dev/null

if ! run_openshell sandbox create --help | grep -q -- '--fuse'; then
  echo "error: OpenShell CLI does not include the policy-gated --fuse capability" >&2
  exit 1
fi

if run_openshell sandbox get "$SANDBOX_NAME" >/dev/null 2>&1; then
  run_openshell sandbox delete "$SANDBOX_NAME"
fi

args=(
  sandbox create
  --name "$SANDBOX_NAME"
  --from Dockerfile.openeral
  --provider claude
  --auto-providers
  --env "WORKSPACE_ID=$SANDBOX_NAME"
)

db_file=""
cleanup() {
  [ -z "$db_file" ] || rm -f "$db_file"
}
trap cleanup EXIT

database_url="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [ -z "$database_url" ]; then
  echo "error: DATABASE_URL is required by the primary FUSE image" >&2
  echo "use Dockerfile.openeral-compat for the scoped-sync/PGlite runtime" >&2
  exit 1
fi
db_file="$(mktemp /tmp/openeral-db-url-XXXXXX)"
printf '%s' "$database_url" > "$db_file"
chmod 600 "$db_file"
args+=(--fuse --upload "$db_file:/sandbox/db-url")

if [ -n "${STRINGCOST_API_KEY:-}" ]; then
  if openshell provider get stringcost >/dev/null 2>&1; then
    openshell provider update stringcost --credential STRINGCOST_API_KEY
  else
    openshell provider create       --name stringcost       --type generic       --credential STRINGCOST_API_KEY
  fi
  args+=(--provider stringcost)
fi

args+=(-- openeral-init)
run_openshell "${args[@]}"

echo
echo "Local OpenEral sandbox initialized: $SANDBOX_NAME"
echo "Connect: openshell sandbox connect $SANDBOX_NAME"
echo "Then run: claude"
