#!/bin/sh
set -eu
. /opt/openrind/browser/client-env.sh
/usr/bin/node /opt/openrind-browser-pods/bin/check-client.mjs
exec /opt/openrind/browser/agent-browser "$@"
