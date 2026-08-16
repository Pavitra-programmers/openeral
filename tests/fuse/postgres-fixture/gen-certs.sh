#!/usr/bin/env bash
# Generate a private CA and a PostgreSQL server certificate for the local TLS
# fixture used by tests/fuse/test_openshell_e2e.sh.
#
# Outputs (all untracked):
#   certs/ca.key, certs/ca.crt        private CA
#   certs/server.key, certs/server.crt server cert with SANs for the Docker
#                                      bridge address and localhost
#   context/ca.crt                     public CA only; use as the docker build
#                                      context for tests/fuse/Dockerfile.local-postgres
#
# Environment:
#   FIXTURE_DB_HOST   IP the sandbox uses to reach the fixture (default 172.17.0.1,
#                     the docker0 bridge address as seen from inside a sandbox)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
host="${FIXTURE_DB_HOST:-172.17.0.1}"
certs="$here/certs"
context="$here/context"

if [ -f "$certs/server.crt" ] && [ -f "$certs/ca.crt" ] && [ "${FIXTURE_REGENERATE:-0}" != 1 ]; then
  echo "postgres-fixture: certificates already exist in $certs (set FIXTURE_REGENERATE=1 to replace)"
  exit 0
fi

mkdir -p "$certs" "$context"
umask 077

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -subj "/CN=openrind-shell-fuse-fixture-ca" \
  -keyout "$certs/ca.key" -out "$certs/ca.crt" >/dev/null 2>&1

openssl req -newkey rsa:2048 -nodes \
  -subj "/CN=openrind-shell-fuse-fixture" \
  -keyout "$certs/server.key" -out "$certs/server.csr" >/dev/null 2>&1

printf 'subjectAltName=IP:%s,IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth\n' "$host" \
  > "$certs/server.ext"

openssl x509 -req -days 3650 \
  -in "$certs/server.csr" -CA "$certs/ca.crt" -CAkey "$certs/ca.key" -CAcreateserial \
  -extfile "$certs/server.ext" -out "$certs/server.crt" >/dev/null 2>&1

chmod 600 "$certs/ca.key" "$certs/server.key"
chmod 644 "$certs/ca.crt" "$certs/server.crt"
cp "$certs/ca.crt" "$context/ca.crt"
chmod 644 "$context/ca.crt"

echo "postgres-fixture: wrote $certs/{ca,server}.{key,crt} (SAN IP:$host) and $context/ca.crt"
