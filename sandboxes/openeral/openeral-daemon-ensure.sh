#!/bin/sh
set -eu

if [ -f /tmp/openeral-session.env ]; then
  # shellcheck disable=SC1091
  . /tmp/openeral-session.env
fi

export HOME="${HOME:-/home/agent}"
export OPENERAL_HOME="${OPENERAL_HOME:-/home/agent}"
export OPENERAL_DIR="${OPENERAL_DIR:-/opt/openeral}"
export OPENERAL_STATE_DIR="${OPENERAL_STATE_DIR:-/tmp/openeral}"
export OPENERAL_DATA_DIR="${OPENERAL_DATA_DIR:-/tmp/openeral/data}"
export OPENERAL_DB_URL_FILE="${OPENERAL_DB_URL_FILE:-$OPENERAL_STATE_DIR/database-url}"
export WORKSPACE_ID="${WORKSPACE_ID:-${OPENSHELL_SANDBOX_ID:-default}}"
export NODE_NO_WARNINGS="${NODE_NO_WARNINGS:-1}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$OPENERAL_DB_URL_FILE" ]; then
  DATABASE_URL="$(cat "$OPENERAL_DB_URL_FILE")"
  export DATABASE_URL
fi

if [ -n "${DATABASE_URL:-}" ]; then
  export OPENERAL_ENABLE_SYNC=1
else
  unset OPENERAL_ENABLE_SYNC
fi

SOCKET=/tmp/openeral-bash.sock
LOCK=/tmp/openeral-bash.lock
LOG=/tmp/openeral-bash.log

health_json() {
  node "$OPENERAL_DIR/openeral-bash.mjs" --health 2>/dev/null || true
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
  node "$OPENERAL_DIR/openeral-bash.mjs" --stop >/dev/null 2>&1 || true
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
    ( exec 9>&-; exec setsid nohup /usr/bin/node "$OPENERAL_DIR/openeral-bash.mjs" --daemon </dev/null >"$LOG" 2>&1 ) &
  else
    ( exec 9>&-; exec nohup /usr/bin/node "$OPENERAL_DIR/openeral-bash.mjs" --daemon </dev/null >"$LOG" 2>&1 ) &
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
      echo "openeral: waiting for daemon to initialize..." >&2
    fi
    sleep 0.1
    i=$((i + 1))
  done

  echo "openeral: daemon did not become ready after 30s; see $LOG" >&2
  return 1
}

if command -v flock >/dev/null 2>&1; then
  (
    flock 9
    ensure_daemon
  ) 9>"$LOCK"
else
  LOCKDIR=/tmp/openeral-bash.lock.d
  i=0
  while ! mkdir "$LOCKDIR" 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -lt 300 ] || {
      echo "openeral: could not acquire daemon lock" >&2
      exit 1
    }
    sleep 0.1
  done
  trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT INT TERM HUP
  ensure_daemon
fi
