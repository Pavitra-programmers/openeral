#!/bin/sh
# Desktop-only Claude entrypoint for the primary FUSE image.
#
# The Desktop follows README's documented sandbox-connect flow. It writes a
# one-shot marker before connecting; the session hook invokes this launcher,
# and the bridge sets the remote SSH PTY raw before it accepts framed input.
# Direct CLI connections without a marker still open the documented manual shell.

set -eu

RUNTIME_DIR="${OPENRIND_SHELL_RUNTIME_DIR:-${OPENERAL_RUNTIME_DIR:-/var/lib/openrind-shell/runtime}}"
MARKER_PATH="$RUNTIME_DIR/desktop-claude-launch"

if [ ! -f "$MARKER_PATH" ]; then
  # This reaches the renderer through the raw exec stream. Do not write it only
  # to stderr: desktop transport diagnostics are deliberately not terminal data.
  echo "Openrind Shell: desktop Claude launch marker was not found. Reconnect the session."
  exit 64
fi

marker="$(tr -d '\r\n ' < "$MARKER_PATH" 2>/dev/null || true)"
rm -f "$MARKER_PATH" 2>/dev/null || true

case "$marker" in
  auto)
    unset OPENRIND_DESKTOP_CLAUDE_SESSION
    ;;
  [0-9a-fA-F][0-9a-fA-F-]*)
    export OPENRIND_DESKTOP_CLAUDE_SESSION="$marker"
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
exec /usr/local/bin/openrind-pty-bridge.py --framed /usr/local/bin/claude