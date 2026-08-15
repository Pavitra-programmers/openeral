#!/bin/bash
set -euo pipefail

# Build and initialize a local Openrind Shell sandbox through OpenShell's supported
# Dockerfile source path. OpenShell owns image transfer for the selected driver.
SANDBOX_NAME="${OPENRIND_SHELL_DEV_SANDBOX:-${OPENERAL_DEV_SANDBOX:-openrind-shell-local-dev}}"
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
  --from Dockerfile.openrind-shell
  --provider claude
  --auto-providers
  --env "OPENRIND_SHELL_WORKSPACE_ID=$SANDBOX_NAME"
)

db_file=""
cleanup() {
  [ -z "$db_file" ] || rm -f "$db_file"
}
trap cleanup EXIT

database_url="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [ -z "$database_url" ]; then
  echo "error: DATABASE_URL is required by the primary FUSE image" >&2
  echo "use Dockerfile.openrind-shell-compat for the scoped-sync/PGlite runtime" >&2
  exit 1
fi
db_file="$(mktemp /tmp/openrind-shell-db-url-XXXXXX)"
printf '%s' "$database_url" > "$db_file"
chmod 600 "$db_file"
args+=(--fuse --upload "$db_file:/sandbox/db-url")

if [ -n "${OPENRIND_GATEWAY_API_KEY:-}" ]; then
  if run_openshell provider get openrind-gateway >/dev/null 2>&1; then
    run_openshell provider update openrind-gateway --credential OPENRIND_GATEWAY_API_KEY
  else
    run_openshell provider create \
      --name openrind-gateway \
      --type generic \
      --credential OPENRIND_GATEWAY_API_KEY
  fi
  args+=(--provider openrind-gateway)
elif [ -n "${STRINGCOST_API_KEY:-}" ]; then
  # Legacy provider alias for existing environments during the rename window.
  if run_openshell provider get stringcost >/dev/null 2>&1; then
    run_openshell provider update stringcost --credential STRINGCOST_API_KEY
  else
    run_openshell provider create \
      --name stringcost \
      --type generic \
      --credential STRINGCOST_API_KEY
  fi
  args+=(--provider stringcost)
fi

args+=(-- openrind-shell-init)
run_openshell "${args[@]}"

echo
echo "Local Openrind Shell sandbox initialized: $SANDBOX_NAME"
echo "Connect: openshell sandbox connect $SANDBOX_NAME"
echo "Then run: claude"
