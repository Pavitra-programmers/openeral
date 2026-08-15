#!/bin/sh
set -eu

if [ -f /tmp/openrind-shell-session.env ]; then
  # shellcheck disable=SC1091
  . /tmp/openrind-shell-session.env
elif [ -f /tmp/openeral-session.env ]; then
  # shellcheck disable=SC1091
  . /tmp/openeral-session.env
fi

export HOME="${HOME:-/sandbox}"
export OPENRIND_SHELL_HOME="${OPENRIND_SHELL_HOME:-${OPENERAL_HOME:-/sandbox}}"
export OPENRIND_SHELL_DIR="${OPENRIND_SHELL_DIR:-${OPENERAL_DIR:-/opt/openrind-shell}}"
export OPENRIND_SHELL_STATE_DIR="${OPENRIND_SHELL_STATE_DIR:-${OPENERAL_STATE_DIR:-/tmp/openrind-shell}}"
export OPENRIND_SHELL_DATA_DIR="${OPENRIND_SHELL_DATA_DIR:-${OPENERAL_DATA_DIR:-$OPENRIND_SHELL_STATE_DIR/data}}"
export OPENRIND_SHELL_DB_URL_FILE="${OPENRIND_SHELL_DB_URL_FILE:-${OPENERAL_DB_URL_FILE:-$OPENRIND_SHELL_STATE_DIR/database-url}}"
export OPENERAL_HOME="$OPENRIND_SHELL_HOME"
export OPENERAL_DIR="$OPENRIND_SHELL_DIR"
export OPENERAL_STATE_DIR="$OPENRIND_SHELL_STATE_DIR"
export OPENERAL_DATA_DIR="$OPENRIND_SHELL_DATA_DIR"
export OPENERAL_DB_URL_FILE="$OPENRIND_SHELL_DB_URL_FILE"
export WORKSPACE_ID="${OPENRIND_SHELL_WORKSPACE_ID:-${OPENERAL_WORKSPACE_ID:-${WORKSPACE_ID:-${OPENSHELL_SANDBOX_ID:-default}}}}"
export OPENRIND_SHELL_WORKSPACE_ID="$WORKSPACE_ID"
export OPENERAL_WORKSPACE_ID="$WORKSPACE_ID"
export NODE_NO_WARNINGS="${NODE_NO_WARNINGS:-1}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$OPENERAL_DB_URL_FILE" ]; then
  DATABASE_URL="$(tr -d '\r' < "$OPENERAL_DB_URL_FILE" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  export DATABASE_URL
fi

if [ -n "${DATABASE_URL:-}" ]; then
  export OPENERAL_ENABLE_SYNC=1
  export OPENRIND_SHELL_ENABLE_SYNC=1
else
  unset OPENERAL_ENABLE_SYNC
  unset OPENRIND_SHELL_ENABLE_SYNC
fi

export OPENRIND_SHELL_SOCKET="${OPENRIND_SHELL_SOCKET:-${OPENERAL_SOCKET:-/tmp/openrind-shell-bash.sock}}"
SOCKET="$OPENRIND_SHELL_SOCKET"
LOCK=/tmp/openrind-shell-bash.lock
LOG=/tmp/openrind-shell-bash.log

health_json() {
  node "$OPENRIND_SHELL_DIR/openrind-shell-bash.mjs" --health 2>/dev/null || true
}

daemon_ready() {
  [ -S "$SOCKET" ] || return 1
  h="$(health_json)"
  [ -n "$h" ] || return 1
  case "$h" in
    *"\"workspaceId\":\"$WORKSPACE_ID\""*) return 0 ;;
    *) return 1 ;;
  esac
}

stop_mismatched_daemon() {
  [ -S "$SOCKET" ] || return 0
  h="$(health_json)"
  [ -n "$h" ] || {
    rm -f "$SOCKET" 2>/dev/null || true
    return 0
  }
  case "$h" in
    *"\"workspaceId\":\"$WORKSPACE_ID\""*) return 0 ;;
  esac
  node "$OPENRIND_SHELL_DIR/openrind-shell-bash.mjs" --stop >/dev/null 2>&1 || true
  i=0
  while [ "$i" -lt 50 ] && [ -S "$SOCKET" ]; do
    sleep 0.1
    i=$((i + 1))
  done
  rm -f "$SOCKET" 2>/dev/null || true
}

start_daemon() {
  rm -f "$SOCKET" 2>/dev/null || true
  if command -v setsid >/dev/null 2>&1; then
    ( exec 9>&-; exec setsid nohup /usr/bin/node "$OPENRIND_SHELL_DIR/openrind-shell-bash.mjs" --daemon </dev/null >"$LOG" 2>&1 ) &
  else
    ( exec 9>&-; exec nohup /usr/bin/node "$OPENRIND_SHELL_DIR/openrind-shell-bash.mjs" --daemon </dev/null >"$LOG" 2>&1 ) &
  fi
}

ensure_daemon() {
  if daemon_ready; then
    return 0
  fi

  stop_mismatched_daemon
  start_daemon

  i=0
  while [ "$i" -lt 300 ]; do
    if daemon_ready; then
      return 0
    fi
    if [ "$i" -eq 50 ]; then
      echo "openrind-shell: waiting for daemon to initialize..." >&2
    fi
    sleep 0.1
    i=$((i + 1))
  done

  echo "openrind-shell: daemon did not become ready after 30s; see $LOG" >&2
  return 1
}

if command -v flock >/dev/null 2>&1; then
  (
    flock 9
    ensure_daemon
  ) 9>"$LOCK"
else
  LOCKDIR=/tmp/openrind-shell-bash.lock.d
  i=0
  while ! mkdir "$LOCKDIR" 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -lt 300 ] || {
      echo "openrind-shell: could not acquire daemon lock" >&2
      exit 1
    }
    sleep 0.1
  done
  trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT INT TERM HUP
  ensure_daemon
fi
