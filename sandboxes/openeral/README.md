# OpenEral Sandbox Images

This directory contains two different runtimes. Do not mix their Dockerfiles, setup
scripts, wrappers, or persistence claims.

## Primary FUSE Image

Files:

```text
Dockerfile
setup-fuse.sh
openeral-claude-fuse.sh
pg-client-fuse.mjs
configure-stringcost.mjs
policy.yaml
```

The repository-root `Dockerfile.openeral` is the canonical local-build entrypoint
because it has access to the Rust and TypeScript source trees. Keep this directory's
Dockerfile equivalent.

The primary image requires:

- the patched OpenShell Docker driver and explicit `--fuse` request;
- Docker operator config `enable_fuse = true` and host `/dev/fuse`;
- external PostgreSQL with TLS;
- `--upload <mode-0600-file>:/sandbox/db-url`;
- a stable `WORKSPACE_ID`.

It declares one root-owned mount policy:

```yaml
fuse_mounts:
  - binary: /usr/local/bin/openeral-fused
    args: ["serve"]
    mountpoint: /sandbox/work
    fs_name: openeral
```

OpenShell mounts before its supervisor seccomp prelude, then launches the daemon as a
normal hardened sandbox child with inherited FUSE and readiness descriptors. Claude
does not receive `/dev/fuse` or mount capability.

`openeral-init` is the trailing one-shot command. It runs migrations/import, publishes
database coordination, waits for the writer lease, verifies that lease in PostgreSQL,
performs a mounted fsync canary, seeds Claude state, removes the uploaded URL, and
exits. The FUSE daemon is already a supervisor-owned critical child; init does not
launch or detach it.

Claude runs through `openeral-claude-fuse.sh` with `HOME=/sandbox/work`. `/exit` or
`Ctrl+D` returns to the shell after `flush-all`; `claude -c` resumes the latest session.

No watcher or PGlite process participates in primary persistence.

## Compatibility Image

Files:

```text
Dockerfile.compat
setup.sh
openeral-bash.mjs
openeral-daemon-ensure.sh
openeral-claude.sh
pg-client.mjs
```

The repository-root `Dockerfile.openeral-compat` builds this runtime. It strips
`fuse_mounts` and daemon-specific policy entries from the shared policy, rewrites
primary `/sandbox/work` tool paths back to `/sandbox`, and does not install
`openeral-fused`.

Compatibility mode supports optional PostgreSQL or sandbox-lifetime PGlite. With
PostgreSQL, its detached Node daemon watches and syncs only `.claude`, `.claude.json`,
and `.openeral`. It remains the implementation behind the currently published
`ghcr.io/sandys/openeral/sandbox:just-bash` tag.

## PostgreSQL Policy

The shared production policy permits raw CONNECT tunnels to Supabase poolers on 5432
and 6543. PostgreSQL negotiates TLS end to end inside the tunnel, so the OpenShell
endpoint must use `tls: skip` rather than HTTP/TLS inspection.

A custom database host needs an exact route. Primary mode must authorize both Node
(migrations/init) and the Rust daemon:

```yaml
postgres:
  endpoints:
    - { host: db.example.com, port: 5432, tls: skip }
  binaries:
    - { path: /usr/bin/node }
    - { path: /usr/local/bin/openeral-fused }
```

## Local Build

From the repository root:

```bash
docker build --pull=false -f Dockerfile.openeral -t openeral-fuse:local .
docker build --pull=false -f Dockerfile.openeral-compat -t openeral-compat:local .
```

Both inherit `ghcr.io/nvidia/openshell-community/sandboxes/base:latest`. Do not rebuild
that base to work around a registry or local-image configuration problem.

Primary launch and E2E instructions are in the repository [README](../../README.md)
and [BUILD](../../BUILD.md).
