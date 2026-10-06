#!/bin/sh
set -eu
# This is explicit experimental activation, never a mandatory Claude preflight.
[ "${OPENRIND_BROWSER_PODS_EXPERIMENTAL:-0}" = 1 ] || {
  echo 'browser-pods: experimental opt-in is required' >&2; exit 1;
}
[ -f /etc/openrind-browser-pods/helper.json ] || {
  echo 'browser-pods: trusted helper configuration is missing' >&2; exit 1;
}
umask 077
state=/tmp/openrind-browser-pods
if ! mkdir -m 700 "$state" 2>/dev/null; then
  [ ! -L "$state" ] && [ -d "$state" ] && [ "$(stat -c %u "$state")" = "$(id -u)" ] &&
    [ "$(stat -c %a "$state")" = 700 ] || exit 1
fi
exec 9>"$state/launch.lock"
flock -x -w 10 9 || exit 1
probe() {
  /usr/bin/node /opt/openrind-browser-pods/bin/helper-probe.mjs
}
if probe >/dev/null 2>&1; then exit 0; fi
# Do not inherit the lock FD or the SSH terminal in the detached native parent.
setsid nohup /usr/local/bin/openrind-browser-pod-helper \
  </dev/null >>"$state/helper.log" 2>&1 9>&- &
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if probe >/dev/null 2>&1; then exit 0; fi
  sleep 1
done
echo 'browser-pods: helper did not start; check the private helper log' >&2
exit 1
