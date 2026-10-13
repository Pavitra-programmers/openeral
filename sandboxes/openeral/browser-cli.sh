#!/bin/sh
export HOME="${OPENRIND_SHELL_CLAUDE_HOME:-${HOME:-/sandbox/claude-home}}"
case "$HOME" in
  /root|'') export HOME=/sandbox/claude-home ;;
esac
base="$(basename "$0")"
case "$base" in
  browser_start|browser_navigate)
    exec agent-browser --session web open "$@"
    ;;
  browser_snapshot)
    exec agent-browser --session web snapshot -i "$@"
    ;;
  browser_click)
    exec agent-browser --session web click "$@"
    ;;
  browser_fill)
    exec agent-browser --session web fill "$@"
    ;;
  browser_close)
    exec agent-browser --session web close
    ;;
  browser)
    case "${1:-}" in
      start|open|navigate)
        shift
        exec agent-browser --session web open "$@"
        ;;
      snapshot)
        shift
        exec agent-browser --session web snapshot -i "$@"
        ;;
      click)
        shift
        exec agent-browser --session web click "$@"
        ;;
      fill)
        shift
        exec agent-browser --session web fill "$@"
        ;;
      close)
        exec agent-browser --session web close
        ;;
      *)
        exec agent-browser --session web "$@"
        ;;
    esac
    ;;
  *)
    exec agent-browser "$@"
    ;;
esac
