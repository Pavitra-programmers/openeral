#!/bin/sh
# Run in an explicitly enabled disposable FUSE owner through OpenShell exec.
# This checks the installed client. It is not the full Stage 0 acceptance suite.
set -eu
command -v agent-browser
agent-browser --version | grep -F '0.38.2'
node /opt/openrind-browser-pods/bin/helper-probe.mjs
export AGENT_BROWSER_SESSION="openrind-smoke-$$"
trap 'agent-browser close >/dev/null 2>&1 || true' EXIT
evidence=$(mktemp -d /sandbox/work/browser-pod-smoke.XXXXXXXX)
agent-browser open https://example.com
agent-browser get title | grep -F 'Example Domain'
agent-browser snapshot -i > "$evidence/snapshot.txt"
agent-browser screenshot "$evidence/page.png"
test -s "$evidence/page.png"
if agent-browser upload @e1 /sandbox/work/not-a-browser-file >"$evidence/upload.txt" 2>&1; then
  echo 'browser-pods: unsupported upload was not denied' >&2; exit 1
fi
grep -i 'denied\|policy\|blocked' "$evidence/upload.txt" >/dev/null
agent-browser close
openrind-shell-fused flush-all
printf 'Browser client smoke passed. Evidence: %s\n' "$evidence"
