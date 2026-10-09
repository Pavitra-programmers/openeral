#!/bin/sh
set -eu
export HOME="${OPENRIND_SHELL_CLAUDE_HOME:-${HOME:-/sandbox/claude-home}}"
case "$HOME" in
  /root|'') export HOME=/sandbox/claude-home ;;
esac
. /opt/openrind/browser/client-env.sh
/usr/bin/node /opt/openrind-browser-pods/bin/check-client.mjs
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
exec /opt/openrind/browser/agent-browser "$@"
