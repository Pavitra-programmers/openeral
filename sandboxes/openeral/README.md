# OpenEral Sandbox Image

This directory contains the OpenShell sandbox image used by the end-user command in the repository README.

Published image:

```text
ghcr.io/sandys/openeral/sandbox:just-bash
```

## Build Locally

```bash
docker build -f sandboxes/openeral/Dockerfile -t openeral-sandbox:local .
```

To let OpenShell build and push a local sandbox image into the gateway, run from the repo root and use the repo-root Dockerfile:

```bash
openshell sandbox create \
  --name openeral-local-dev \
  --from Dockerfile.openeral \
  --provider claude --auto-providers \
  -- env WORKSPACE_ID=openeral-local-dev openeral-init
```

OpenShell sets the Docker build context to the Dockerfile's parent directory. Do not use `--from sandboxes/openeral/Dockerfile` for this repo; that context is too narrow for `COPY openeral-js/` and `COPY .claude/skills/`.

## Launch From The Published Image

```bash
openshell gateway start

openshell sandbox create \
  --name openeral-demo \
  --from ghcr.io/sandys/openeral/sandbox:just-bash \
  --provider claude --auto-providers \
  -- env WORKSPACE_ID=openeral-demo openeral-init

openshell sandbox connect openeral-demo
claude
```

## Launch With PostgreSQL Persistence

PostgreSQL credentials must be uploaded as a plaintext file. Do not use a generic OpenShell provider for `DATABASE_URL`; provider placeholders are for HTTP credential injection and are not usable by raw PostgreSQL clients.

```bash
printf '%s' "$DATABASE_URL" > /tmp/openeral-db-url
chmod 600 /tmp/openeral-db-url

openshell sandbox create \
  --name openeral-demo \
  --from ghcr.io/sandys/openeral/sandbox:just-bash \
  --upload /tmp/openeral-db-url:/sandbox/db-url \
  --provider claude --auto-providers \
  -- env WORKSPACE_ID=openeral-demo openeral-init

rm -f /tmp/openeral-db-url

openshell sandbox connect openeral-demo
claude
```

## What `setup.sh` Does

1. Resolves persistence from `DATABASE_URL`, `OPENERAL_DATABASE_URL`, `POSTGRES_URL`, or uploaded `/sandbox/db-url`.
2. Creates or loads a normalized StringCost proxy config when StringCost input is available.
3. Runs `_openeral` schema migrations.
4. Seeds the workspace keyed by explicit `$WORKSPACE_ID` or `$OPENSHELL_SANDBOX_ID`.
5. Hydrates `/home/agent/.claude/**` and `/home/agent/.openeral/**` from PostgreSQL when persistence is enabled and the init marker is missing or stale.
6. Writes `/tmp/openeral-session.env` and `/tmp/openeral/init.done`.
7. Reapplies the current StringCost proxy after hydration so restored settings cannot point at a stale presign.
8. Exits. `claude`, `pg`, and `openeral memory refresh` lazily start the detached daemon when needed.

## Image Contents

- Node.js 22 LTS.
- OpenEral compiled into `/opt/openeral/dist/`.
- `openeral-bash.mjs`, the daemon/client bridge for `pg`, custom agents, and scoped sync.
- `openeral-daemon-ensure.sh`, the lazy detached daemon starter.
- `setup.sh`, the sandbox entry point used by `openeral-init`.
- `openeral-claude.sh`, the Claude wrapper that applies the OpenEral session environment and flushes on exit.
- `pg-client.mjs`, the `pg` helper for real-bash Claude sessions.
- `policy.yaml`, the OpenShell network policy at `/etc/openshell/policy.yaml`.
