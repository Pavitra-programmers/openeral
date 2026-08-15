#!/usr/bin/env bash
set -euo pipefail

# Backward-compatible CI entrypoint for the real primary-runtime smoke test.
# The previous script exercised the removed /home/agent + /db custom-supervisor
# filesystem. Keep one implementation of the FUSE lifecycle assertions.

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

if [ -z "${OPENRIND_SHELL_FUSE_E2E_IMAGE:-}" ] && [ -n "${OPENERAL_SANDBOX_IMAGE:-}" ]; then
  export OPENRIND_SHELL_FUSE_E2E_IMAGE="$OPENERAL_SANDBOX_IMAGE"
fi
if [ -z "${OPENRIND_SHELL_FUSE_E2E_IMAGE:-}" ] && [ -n "${OPENERAL_FUSE_E2E_IMAGE:-}" ]; then
  export OPENRIND_SHELL_FUSE_E2E_IMAGE="$OPENERAL_FUSE_E2E_IMAGE"
fi

exec "$repo_root/tests/fuse/test_openshell_e2e.sh" "$@"
