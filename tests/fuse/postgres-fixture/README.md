# Local TLS PostgreSQL Fixture

`tests/fuse/test_openshell_e2e.sh` needs an external PostgreSQL that the sandbox
policy permits and that presents a TLS certificate the sandbox trusts. This
directory provides a reproducible fixture:

1. `gen-certs.sh` creates a private CA and a server certificate (SAN
   `IP:172.17.0.1`, the docker0 address a sandbox uses to reach the host, plus
   `IP:127.0.0.1` and `DNS:localhost`) under `certs/`, and copies only the public
   CA to `context/ca.crt`.
2. `docker-compose.yml` runs `postgres:16-alpine` with `ssl=on` on host port
   `55432`, copying the bind-mounted certificate into place with the ownership
   PostgreSQL requires.
3. `tests/fuse/Dockerfile.local-postgres` derives a sandbox image that trusts
   `context/ca.crt` and adds an exact raw-tunnel policy route for the fixture
   host and port. Pass `--build-arg BASE_IMAGE=<your primary image tag>`.

```bash
tests/fuse/postgres-fixture/gen-certs.sh
cp tests/fuse/postgres-fixture/.env.example tests/fuse/postgres-fixture/.env
# edit .env: set POSTGRES_PASSWORD
docker compose -f tests/fuse/postgres-fixture/docker-compose.yml up -d --wait

docker build -f tests/fuse/Dockerfile.local-postgres \
  --build-arg BASE_IMAGE=openrind-shell-fuse:local \
  --build-arg OPENERAL_TEST_DB_HOST=172.17.0.1 \
  --build-arg OPENERAL_TEST_DB_PORT=55432 \
  -t openrind-shell-fuse-localdb:test tests/fuse/postgres-fixture/context

export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.17.0.1:55432/postgres"
```

`certs/`, `context/`, and `.env` are untracked. Tear down with
`docker compose -f tests/fuse/postgres-fixture/docker-compose.yml down -v`.
