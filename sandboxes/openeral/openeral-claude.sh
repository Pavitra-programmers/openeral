#!/bin/sh
set -eu

if [ -f /tmp/openeral-session.env ]; then
  # shellcheck disable=SC1091
  . /tmp/openeral-session.env
fi

export HOME="${HOME:-/sandbox}"
export SHELL="${SHELL:-/bin/bash}"
export NODE_NO_WARNINGS="${NODE_NO_WARNINGS:-1}"

# These are setup-only credentials. Claude should see the provider API key
# placeholder when present, but not the StringCost management key.
unset STRINGCOST_API_KEY
unset ANTHROPIC_AUTH_TOKEN

if [ ! -x /usr/local/bin/claude-real ]; then
  echo "openeral: claude-real is missing; the sandbox image did not install Claude Code correctly" >&2
  exit 127
fi

if command -v openeral >/dev/null 2>&1; then
  openeral init --ensure
fi

if command -v openeral-daemon-ensure >/dev/null 2>&1; then
  openeral-daemon-ensure
fi

/usr/local/bin/claude-real "$@" &
CHILD=$!

forward_int() { kill -INT "$CHILD" 2>/dev/null || true; }
forward_term() { kill -TERM "$CHILD" 2>/dev/null || true; }
forward_hup() { kill -HUP "$CHILD" 2>/dev/null || true; }

trap forward_int INT
trap forward_term TERM
trap forward_hup HUP

set +e
while true; do
  wait "$CHILD"
  STATUS=$?
  if kill -0 "$CHILD" 2>/dev/null; then
    continue
  fi
  break
done
set -e

trap - INT TERM HUP

/usr/local/bin/openeral-bash --flush >/dev/null 2>&1 || true

exit "$STATUS"
