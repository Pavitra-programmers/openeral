#!/bin/sh
# Desktop-only Claude entrypoint for the primary FUSE image.
#
# The Desktop follows README's documented sandbox-connect flow. It writes a
# one-shot marker before connecting; the session hook invokes this launcher,
# and the bridge sets the remote SSH PTY raw before it accepts framed input.
# Direct CLI connections without a marker still open the documented manual shell.

set -eu

RUNTIME_DIR="${OPENRIND_SHELL_RUNTIME_DIR:-${OPENERAL_RUNTIME_DIR:-/var/lib/openrind-shell/runtime}}"

if [ -f "$RUNTIME_DIR/session.env" ]; then
  # shellcheck disable=SC1090
  . "$RUNTIME_DIR/session.env"
fi

MARKER_PATH="$RUNTIME_DIR/desktop-claude-launch"

if [ ! -f "$MARKER_PATH" ]; then
  # This reaches the renderer through the connected terminal stream. Do not
  # write it only to stderr: transport diagnostics are not terminal data.
  echo "Openrind Shell: desktop Claude launch marker was not found. Reconnect the session."
  exit 64
fi

marker="$(tr -d '\r\n ' < "$MARKER_PATH" 2>/dev/null || true)"
rm -f "$MARKER_PATH" 2>/dev/null || true

profile="${marker%%:*}"
session_id="${marker#*:}"

if [ "$profile" = "$marker" ]; then
  profile="openrind-shell-claude"
  session_id="$marker"
fi

case "$session_id" in
  auto)
    unset OPENRIND_DESKTOP_CLAUDE_SESSION
    ;;
  [0-9a-fA-F][0-9a-fA-F-]*)
    export OPENRIND_DESKTOP_CLAUDE_SESSION="$session_id"
    ;;
  *)
    echo "Openrind Shell: desktop Claude launch marker is invalid. Reconnect the session."
    exit 64
    ;;
esac

export OPENRIND_DESKTOP_CLAUDE_LAUNCH=1

FAST_FIRST_LAUNCH_MARKER="$RUNTIME_DIR/desktop-fast-first-launch"
if [ -f "$FAST_FIRST_LAUNCH_MARKER" ]; then
  rm -f "$FAST_FIRST_LAUNCH_MARKER"
  export OPENRIND_SHELL_SKIP_CLAUDE_REPAIR=1
fi
unset FAST_FIRST_LAUNCH_MARKER

# Run Openrind Gateway proxy configuration on session launch!
node /opt/openrind-shell/configure-openrind-gateway.mjs || true

# If ANTHROPIC_API_KEY is not set but OPENROUTER_API_KEY is, alias them so
# the agent (which expects ANTHROPIC_API_KEY) can authenticate seamlessly.
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -n "${OPENROUTER_API_KEY:-}" ]; then
  export ANTHROPIC_API_KEY="$OPENROUTER_API_KEY"
fi

# Validate marker profile against the canonical agent variable from session.env
expected_profile="openrind-shell-claude"
if [ "${OPENRIND_SHELL_AGENT:-}" = "openclaw" ]; then
  expected_profile="openrind-shell-openclaw"
fi
if [ "$profile" != "$expected_profile" ]; then
  echo "Openrind Shell: launch profile mismatch (marker: $profile, expected: $expected_profile)."
  exit 64
fi

# Set proxy configuration for Claude, unset for OpenClaw
if [ "${OPENRIND_SHELL_AGENT:-}" = "openclaw" ]; then
  unset ANTHROPIC_BASE_URL
else
  if [ -f "$RUNTIME_DIR/anthropic-base-url" ]; then
    export ANTHROPIC_BASE_URL="$(cat "$RUNTIME_DIR/anthropic-base-url" 2>/dev/null | tr -d '\r\n ')"
  fi
fi

# Select binary based solely on the canonical variable
AGENT_BIN="/usr/local/bin/claude"
if [ "${OPENRIND_SHELL_AGENT:-}" = "openclaw" ]; then
  if command -v openclaw >/dev/null 2>&1; then
    AGENT_BIN="openclaw"
  elif [ -x /usr/local/bin/openclaw ]; then
    AGENT_BIN="/usr/local/bin/openclaw"
  elif [ -x /usr/bin/openclaw ]; then
    AGENT_BIN="/usr/bin/openclaw"
  else
    AGENT_BIN="/usr/bin/opencode"
  fi
fi

exec /usr/local/bin/openrind-pty-bridge.py --framed "$AGENT_BIN"
