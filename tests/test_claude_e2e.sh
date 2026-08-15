#!/usr/bin/env bash
set -euo pipefail

# Run the real-Claude stage of the primary OpenShell/FUSE E2E. Claude writes
# through /sandbox/work, the daemon is crashed and recovered, and a replacement
# sandbox must read the same durable file. This is intentionally not a separate
# just-bash harness: FUSE is the primary persistence authority on this branch.

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${OPENSHELL_GATEWAY_ENDPOINT:?OPENSHELL_GATEWAY_ENDPOINT is required}"

export OPENRIND_SHELL_FUSE_REAL_CLAUDE=1
export OPENRIND_SHELL_FUSE_E2E_PROVIDER="${OPENRIND_SHELL_FUSE_E2E_PROVIDER:-${OPENERAL_FUSE_E2E_PROVIDER:-claude}}"

exec "$repo_root/tests/fuse/test_openshell_e2e.sh" "$@"
