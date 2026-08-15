# Building And Developing OpenEral

This guide covers source builds. The currently published compatibility image requires
none of these tools; use [README.md](./README.md) for that flow.

## Source Layout

```text
crates/openeral-fused/       PostgreSQL-backed FUSE daemon
openeral-js/                 migrations, init/import, CLI, and compatibility library
sandboxes/openeral/          primary and compatibility image runtime files
vendor/openshell/            pinned, patched OpenShell source snapshot
tests/fuse/                  FUSE conformance and real OpenShell E2E
Dockerfile.openeral          primary FUSE image
Dockerfile.openeral-compat   scoped-sync/PGlite compatibility image
```

The OpenShell snapshot is pinned in [`vendor/openshell/UPSTREAM`](./vendor/openshell/UPSTREAM):

```text
repository=https://github.com/NVIDIA/OpenShell.git
commit=c4b500a7de64d0b66e3ee8098f58d14299092162
tree=30d1825d5be2a631823d941188803e29f09aedd5
```

`vendor/openshell` has no nested `.git`; it contains the pristine snapshot plus the
default-off OpenEral FUSE patch.

## Prerequisites

- Linux Docker host with `/dev/fuse`.
- Rust 1.95 toolchain.
- Node.js 22 and pnpm for `openeral-js` development.
- OpenShell build dependencies, including Protobuf and Z3.
- External PostgreSQL with TLS for primary-runtime tests.
- Optional Anthropic, AWS, and StringCost providers for live agent tests.

The primary image pulls this existing base and does not rebuild it:

```bash
docker pull ghcr.io/nvidia/openshell-community/sandboxes/base:latest
```

If an anonymous GHCR pull is denied, remove stale registry credentials with
`docker logout ghcr.io` and retry before changing the image source.

## Build OpenEral

Rust daemon and historical Rust workspace:

```bash
cargo build --locked -p openeral-fused
cargo test -p openeral-fused
cargo clippy -p openeral-fused --all-targets -- -D warnings
cargo fmt --all --check
```

TypeScript library and initializer:

```bash
cd openeral-js
pnpm install
pnpm build
pnpm check
```

`pnpm check` runs type checking, structural lints, and unit tests, including PGlite
behavioral tests for prefix-scoped compatibility sync.

## Build Patched OpenShell

```bash
cd vendor/openshell
cargo build -p openshell-cli -p openshell-sandbox -p openshell-server
cargo test -p openshell-cli
cargo test -p openshell-driver-docker
cargo test -p openshell-policy
cargo test -p openshell-supervisor-process
```

The relevant binaries are:

```text
vendor/openshell/target/debug/openshell
vendor/openshell/target/debug/openshell-gateway
vendor/openshell/target/debug/openshell-sandbox
```

The patch adds a public `--fuse` resource request, immutable `fuse_mounts` policy,
Docker operator/device gates, explicit inherited descriptors, FUSE INIT readiness,
critical-child supervision, bounded `on-failure:5` restart, and transient gateway
lifecycle handling. No-FUSE requests preserve the upstream path.

## Configure A Local Docker Gateway

The gateway must run the patched supervisor and explicitly enable FUSE. Generate a
temporary development identity outside the repository:

```bash
export OPENERAL_GATEWAY_DIR="$(mktemp -d /tmp/openeral-fuse-gateway-XXXXXX)"
mkdir -p "$OPENERAL_GATEWAY_DIR/jwt" "$OPENERAL_GATEWAY_DIR/state"
openssl genpkey -algorithm ED25519 -out "$OPENERAL_GATEWAY_DIR/jwt/signing.pem"
openssl pkey \
  -in "$OPENERAL_GATEWAY_DIR/jwt/signing.pem" \
  -pubout \
  -out "$OPENERAL_GATEWAY_DIR/jwt/public.pem"
printf '%s\n' openeral-fuse-dev > "$OPENERAL_GATEWAY_DIR/jwt/kid"
```

Create `$OPENERAL_GATEWAY_DIR/gateway.toml`, replacing `/absolute/repo` with this
checkout's absolute path:

```toml
[openshell]
version = 1

[openshell.gateway]
bind_address = "127.0.0.1:18770"
log_level = "info"
compute_drivers = ["docker"]
disable_tls = true

[openshell.gateway.auth]
allow_unauthenticated_users = true

[openshell.gateway.gateway_jwt]
signing_key_path = "/tmp/replace/jwt/signing.pem"
public_key_path = "/tmp/replace/jwt/public.pem"
kid_path = "/tmp/replace/jwt/kid"
gateway_id = "openeral-fuse-dev"
ttl_secs = 0

[openshell.drivers.docker]
default_image = "openeral-fuse:local"
image_pull_policy = "Never"
sandbox_namespace = "openeral-fuse-dev"
grpc_endpoint = "http://host.openshell.internal:18770"
supervisor_bin = "/absolute/repo/vendor/openshell/target/debug/openshell-sandbox"
enable_fuse = true
```

Use the actual temporary JWT paths rather than the illustrative `/tmp/replace`
values. Start the gateway in a dedicated terminal:

```bash
vendor/openshell/target/debug/openshell-gateway \
  --config "$OPENERAL_GATEWAY_DIR/gateway.toml" \
  --db-url "sqlite:$OPENERAL_GATEWAY_DIR/state/gateway.db?mode=rwc"
```

This repository does not install, start, or mutate a gateway automatically. The
operator owns the gateway and Docker `enable_fuse` decision.

In another terminal:

```bash
export OPENSHELL_BIN="$PWD/vendor/openshell/target/debug/openshell"
export OPENSHELL_GATEWAY_ENDPOINT="http://127.0.0.1:18770"

"$OPENSHELL_BIN" \
  --gateway-endpoint "$OPENSHELL_GATEWAY_ENDPOINT" \
  gateway info
```

## Build The Sandbox Images

Primary FUSE image:

```bash
docker build --pull=false -f Dockerfile.openeral -t openeral-fuse:local .
```

Compatibility image:

```bash
docker build --pull=false -f Dockerfile.openeral-compat -t openeral-compat:local .
```

The root Dockerfiles are canonical for local builds because their context includes
the Rust crates, `openeral-js`, and skills. Keep their equivalents under
`sandboxes/openeral/` synchronized.

`build-image.sh` automates primary sandbox creation against an already running patched
gateway:

```bash
export DATABASE_URL='postgresql://...'
export OPENSHELL_BIN="$PWD/vendor/openshell/target/debug/openshell"
export OPENSHELL_GATEWAY_ENDPOINT='http://127.0.0.1:18770'
bash build-image.sh
```

It invokes OpenShell's public build/create flow and never imports images through
containerd, changes Docker networking, or rebuilds NVIDIA's base.

## Real FUSE E2E

The Docker-driver harness requires a running patched gateway and an image whose policy
allows the supplied database host:

```bash
export DATABASE_URL='postgresql://...'
export OPENSHELL_GATEWAY_ENDPOINT='http://127.0.0.1:18770'
export OPENSHELL_XDG_CONFIG_HOME="$HOME/.config"
export OPENERAL_FUSE_E2E_IMAGE='openeral-fuse:local'

tests/fuse/test_openshell_e2e.sh
```

It verifies:

1. supervisor-owned mount at `/sandbox/work`;
2. eight filesystem conformance cases;
3. fsynced sentinel durability;
4. critical daemon exit causing container restart and lease-epoch advance;
5. persistence after sandbox delete/recreate with the same workspace ID.

The crash-restart assertion uses Docker inspection and therefore intentionally targets
the v1 Docker driver.

To include a real Claude write, attach a configured provider:

```bash
export OPENERAL_FUSE_REAL_CLAUDE=1
export OPENERAL_FUSE_E2E_PROVIDER=claude
tests/fuse/test_openshell_e2e.sh
```

For AWS Bedrock, build `tests/fuse/Dockerfile.bedrock`, attach an `aws` provider, and
set `CLAUDE_CODE_USE_BEDROCK`, `AWS_REGION`, and `ANTHROPIC_MODEL`. Raw provider
credentials must never be passed with `--env`.

### Local TLS PostgreSQL Fixture

The production policy permits Supabase poolers. A private fixture needs a derived
test image with its exact host and port:

```bash
docker build \
  -f tests/fuse/Dockerfile.local-postgres \
  --build-arg OPENERAL_TEST_DB_HOST=172.17.0.1 \
  --build-arg OPENERAL_TEST_DB_PORT=55432 \
  -t openeral-fuse-localdb:test \
  /path/to/context-containing-ca.crt
```

The fixture PostgreSQL server must present a TLS certificate chaining to `ca.crt`.
The overlay adds that CA and an exact raw-tunnel policy route; it does not disable
PostgreSQL TLS.

## Compatibility And Library Tests

The old Docker-only scripts now build the compatibility image explicitly:

```bash
DATABASE_URL='postgresql://...' tests/test_sandbox_e2e.sh
DATABASE_URL='postgresql://...' tests/test_setup_e2e.sh
```

Host-side custom-agent and memory tests remain under `openeral-js`:

```bash
cd openeral-js
DATABASE_URL='postgresql://...' node test-integration.mjs
DATABASE_URL='postgresql://...' node test-memory-refresh.mjs
```

`createOpeneralShell()` exposes `/db`, `/home/agent`, and `/tmp` through just-bash for
custom agents. That path is independent of the primary kernel FUSE mount.

## Custom PostgreSQL Hosts

Add a raw tunnel route and both migration/daemon binaries:

```yaml
network_policies:
  postgres:
    endpoints:
      - { host: db.example.com, port: 5432, tls: skip }
    binaries:
      - { path: /usr/bin/node }
      - { path: /usr/local/bin/openeral-fused }
```

`tls: skip` applies to OpenShell inspection, not PostgreSQL. It tells OpenShell to
relay the tunnel; Node/Rust then require and verify PostgreSQL TLS end to end.

## Source And Rollout Rules

- Never grant mount syscalls or `/dev/fuse` to Claude.
- Never start `openeral-fused` outside the normal hardened `ProcessHandle` path.
- Never make Rust own schema migration.
- Never run a watcher beside FUSE in the primary image.
- Never selectively omit generated/vendor changes from commits; ignore artifacts only
  through `.gitignore`.
- Rebase the pristine OpenShell pin before carrying the patch to materially different
  upstream mount, process, or lifecycle code.
- Keep the published scoped-sync image stable until FUSE correctness, fault,
  performance, and upstream/release gates are complete.

The detailed contract and rejected alternatives are in
[FUSE-DESIGN.md](./FUSE-DESIGN.md) and [FUSE.md](./FUSE.md).
