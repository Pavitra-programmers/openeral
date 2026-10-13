#!/bin/sh
set -eu
export HOME="${OPENRIND_SHELL_CLAUDE_HOME:-${HOME:-/sandbox/claude-home}}"
case "$HOME" in
  /root|'') export HOME=/sandbox/claude-home ;;
esac
. /opt/openrind/browser/client-env.sh
/usr/bin/node /opt/openrind-browser-pods/bin/check-client.mjs

if ! /usr/bin/node /opt/openrind-browser-pods/bin/helper-probe.mjs >/dev/null 2>&1; then
  pkill -f /opt/openrind/browser/agent-browser 2>/dev/null || true
  OPENRIND_BROWSER_PODS_EXPERIMENTAL=1 /opt/openrind-browser-pods/bin/helper-ensure.sh >/dev/null 2>&1 || true
fi

unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
exec /opt/openrind/browser/agent-browser "$@"
