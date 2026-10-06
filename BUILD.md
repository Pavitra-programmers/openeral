# Building And Developing Openrind Shell

This guide covers source builds. The GHCR compatibility target requires registry pull
access; [README.md](./README.md) also shows the local child-image fallback.

## Source Layout

```text
crates/openeral-fused/       PostgreSQL-backed FUSE daemon
openeral-js/                 migrations, init/import, CLI, and compatibility library
sandboxes/openeral/          primary and compatibility image runtime files
vendor/openshell/            pinned, patched OpenShell source snapshot
tests/fuse/                  FUSE conformance and real OpenShell E2E
Dockerfile.openrind-shell          primary FUSE image
Dockerfile.openrind-shell-compat   scoped-sync/PGlite compatibility image
```

The historical source-directory, Cargo-package, test build-argument, and `_openeral`
schema names remain stable for compatibility. Installed commands, environment
variables, skills, and image names use `openrind-shell`; legacy aliases are tested.

Migration V8 bridges workspace rows written by the renamed just-bash branch from
`_openrind.workspace_*` into the stable `_openeral.workspace_*` namespace. It does
not rename `_openeral.fs_*` or overwrite a compatibility row with an older mtime.
Source provenance permits a first FUSE volume to import the full just-bash home;
historical scoped workspaces keep their state-only import boundary.

The OpenShell snapshot is pinned in [`vendor/openshell/UPSTREAM`](./vendor/openshell/UPSTREAM):

```text
repository=https://github.com/NVIDIA/OpenShell.git
commit=c4b500a7de64d0b66e3ee8098f58d14299092162
tree=30d1825d5be2a631823d941188803e29f09aedd5
```

`vendor/openshell` has no nested `.git`; it contains the pristine snapshot plus the
default-off Openrind Shell FUSE patch.

## Prerequisites

- Linux Docker host with `/dev/fuse`.
- Rust 1.95 toolchain.
- Node.js 22 and pnpm for `openeral-js` development.
- OpenShell build dependencies, including Protobuf and Z3 (Z3 is also needed at
  runtime by the patched gateway; see below).
- External PostgreSQL with TLS for primary-runtime tests.
- Optional Anthropic, AWS, and Openrind Gateway providers for live agent tests.

The primary image pulls this existing base and does not rebuild it:

```bash
docker pull ghcr.io/nvidia/openshell-community/sandboxes/base:latest
```

If an anonymous GHCR pull is denied, remove stale registry credentials with
`docker logout ghcr.io` and retry before changing the image source.

## Build Openrind Shell

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

`openshell-gateway` links the system Z3 library dynamically (`libz3.so.4`, from the
`openshell-prover` crate). Z3 is therefore a runtime dependency of the gateway host,
not only a build dependency: install `libz3-4`/`libz3-dev` (Debian/Ubuntu) or
`z3-libs` (Fedora), or point `LD_LIBRARY_PATH` at an extracted copy before starting the
gateway. A missing library fails immediately with "error while loading shared
libraries: libz3.so.4".

The patch adds a public `--fuse` resource request, immutable `fuse_mounts` policy,
Docker operator/device gates, explicit inherited descriptors, FUSE INIT readiness,
critical-child supervision, bounded `on-failure:5` restart, and transient gateway
lifecycle handling. No-FUSE requests preserve the upstream path.

## Configure A Local Docker Gateway

The gateway must run the patched supervisor and explicitly enable FUSE. Generate a
temporary development identity outside the repository:

```bash
export OPENRIND_SHELL_GATEWAY_DIR="$(mktemp -d /tmp/openrind-shell-fuse-gateway-XXXXXX)"
mkdir -p "$OPENRIND_SHELL_GATEWAY_DIR/jwt" "$OPENRIND_SHELL_GATEWAY_DIR/state"
openssl genpkey -algorithm ED25519 -out "$OPENRIND_SHELL_GATEWAY_DIR/jwt/signing.pem"
openssl pkey \
  -in "$OPENRIND_SHELL_GATEWAY_DIR/jwt/signing.pem" \
  -pubout \
  -out "$OPENRIND_SHELL_GATEWAY_DIR/jwt/public.pem"
printf '%s\n' openrind-shell-fuse-dev > "$OPENRIND_SHELL_GATEWAY_DIR/jwt/kid"
```

Create `$OPENRIND_SHELL_GATEWAY_DIR/gateway.toml`, replacing `/absolute/repo` with this
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
gateway_id = "openrind-shell-fuse-dev"
ttl_secs = 0

[openshell.drivers.docker]
default_image = "openrind-shell-fuse:local"
image_pull_policy = "Never"
sandbox_namespace = "openrind-shell-fuse-dev"
grpc_endpoint = "http://host.openshell.internal:18770"
supervisor_bin = "/absolute/repo/vendor/openshell/target/debug/openshell-sandbox"
enable_fuse = true
```

Use the actual temporary JWT paths rather than the illustrative `/tmp/replace`
values. Start the gateway in a dedicated terminal:

```bash
vendor/openshell/target/debug/openshell-gateway \
  --config "$OPENRIND_SHELL_GATEWAY_DIR/gateway.toml" \
  --db-url "sqlite:$OPENRIND_SHELL_GATEWAY_DIR/state/gateway.db?mode=rwc"
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
docker build --pull=false -f Dockerfile.openrind-shell -t openrind-shell-fuse:local .
```

Compatibility image:

```bash
docker build --pull=false -f Dockerfile.openrind-shell-compat -t openrind-shell-compat:local .
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

## Experimental Browser Pods

This is the initial Kernel implementation, not the completed v1 release.
Read the [status and remaining gates](./openrind-desktop/packages/browser-pods/README.md).
Do not enable it for normal Desktop launches until Stage 0 passes. It uses the
existing FUSE fork without adding OpenShell patches.

Run unit and local transport tests on Node.js 22.19 or newer:

```bash
cd openrind-desktop
pnpm --filter @openrind/browser-pods install --frozen-lockfile
pnpm --filter @openrind/browser-pods test
pnpm --filter @openrind/browser-pods test:transport
cd ..
cc -std=c11 -D_POSIX_C_SOURCE=200809L -O2 -Wall -Wextra -Werror \
  -fsyntax-only openrind-desktop/packages/browser-pods/native/helper.c
```

The transport test needs TCP loopback access, including port 19300. It uses a fake
CDP peer. It does not prove OpenShell or Chromium compatibility. It is not skipped
when the test runner denies sockets.

### Build Assets

The primary image recipes install the unchanged agent-browser v0.38.2 Linux
release for x64 or arm64. The manifest records its commit and SHA-256. The image
build checks both checksum and version. No browser or package is downloaded on
first use. A version check does not prove the native daemon works under OpenShell.

The separate pod image requires an explicit Debian Chromium package version:

```bash
docker build --pull=false -f sandboxes/browser-pod/Dockerfile \
  --build-arg CHROMIUM_VERSION='<exact Debian package version>' \
  -t openrind-browser-pod:stage0 sandboxes/browser-pod
docker image inspect --format '{{.Id}}' openrind-browser-pod:stage0
```

Select a version available in the base image's Debian repository and record it in
the test evidence. Do not invent a version or accept `latest` in broker config.
Pre-pull or build in the gateway's Docker daemon. On Windows, use the managed WSL
daemon. The broker requires an image digest and fails preflight if it is absent.
Set `image_pull_policy = "Never"` in the gateway's `[openshell.drivers.docker]`
configuration, as in the local gateway example above. The broker and gateway must
use the same Docker daemon. The broker's local image check does not verify either
condition. Without `Never`, OpenShell can still pull during create, for example
if an image disappears after preflight or the gateway uses `Always`.
Image publication and a cross-platform tested Chromium pin remain release work.

### Broker Process

The broker runs on the gateway host. Node's SQLite database enforces a single
broker. Install the package with its production dependency, `ws@8.19.0`, at
`/opt/openrind-browser-pods`. The standalone `package-lock.json` supports `npm ci`
for that deployment. The workspace uses the existing pnpm lockfile.

Create a private JSON configuration owned by the broker user, mode 0600. This is
a template, not a ready-to-run customer configuration:

```json
{
  "listen": { "host": "172.18.0.1", "port": 19301 },
  "runtime": {
    "binary": "/opt/openshell/bin/openshell",
    "gateway": "http://127.0.0.1:18770",
    "image": "sha256:<verified local image ID>",
    "stateDir": "/var/lib/openrind-browser-pods",
    "websiteHosts": ["example.com"],
    "acceptNoSandbox": true
  },
  "owners": [{
    "serviceToken": "<random host-only base64url token>",
    "owner": {
      "id": "<native owner sandbox ID>",
      "generation": "<fresh owner generation>",
      "workspaceId": "<registered workspace ID>",
      "helperOrigin": "http://127.0.0.1:19300",
      "providers": ["kernel"]
    }
  }]
}
```

Use the actual private Docker bridge address. Never bind all interfaces or use
the gateway's port 18770 for the broker. The owner ID, generation, and workspace
come from trusted host setup, not a browser request. Runtime observation of this
binding remains a Stage 0 gate. The service token must be 32-128 base64url characters.

```bash
OPENRIND_BROWSER_PODS_EXPERIMENTAL=1 \
node openrind-desktop/packages/browser-pods/bin/broker.mjs \
  /etc/openrind-browser-pods/broker.json
```

The optional service unit is at
`openrind-desktop/packages/browser-pods/service/openrind-browser-pods.service`.
It expects an `openrind-browser` system account with Docker access and the installed
package. Docker access is host administrative authority. Review that grant before
installation. The unit supplies a private HOME/config directory for the native CLI.
Broker shutdown revokes sessions and retains incomplete cleanup in SQLite. Startup
will not admit new sessions until old resources are removed.

### Owner Activation

This step is still explicit developer provisioning. No production Desktop UI calls
it. `browserPodBinding()` in `browser-binding.mjs` creates the native profile and
network rule. `attachBrowserPodProvider()` in `browser-provider.mjs` can attach it
through the existing Windows/WSL runtime. Linux setup uses the same native profile
import and provider attach commands. A common cross-platform installer is pending.

The profile grants the dedicated helper only `POST /browsers`,
`DELETE /browsers/*`, and WebSocket upgrades at `/control` and `/cdp/*`.
It uses `protocol: rest`, `tls: none`, one bridge `/32`, and no request-body or
WebSocket-frame credential rewrite. Store the real token only in the host broker
config and OpenShell provider. The helper receives `OPENRIND_BROWSER_POD_TOKEN`
as a native provider placeholder. Do not copy the host token into the sandbox.

Trusted provisioning must install `/etc/openrind-browser-pods/helper.json`, owned
by root and not writable by the agent:

```json
{
  "brokerOrigin": "http://host.openshell.internal:19301",
  "generation": "<same owner generation as the broker>"
}
```

The new primary image supplies static Kernel settings and a root-owned action
policy. Start a fresh shell after attaching the provider. Do not reuse an
agent-browser daemon started with other settings. In that shell:

```bash
OPENRIND_BROWSER_PODS_EXPERIMENTAL=1 openrind-browser-pod-ensure
node /opt/openrind-browser-pods/bin/helper-probe.mjs
```

The helper is detached with its native parent intact. It serves one sandbox's
loopback port 19300. It stops on broker connection loss. It does not restart or
replay browser operations automatically. Client policy validation is a guardrail;
arbitrary client flags and user configuration are not a server-side boundary.

Run the installed-client smoke from the host against a disposable enabled owner:

```bash
"$OPENSHELL_BIN" --gateway-endpoint "$OPENSHELL_GATEWAY_ENDPOINT" \
  sandbox exec -n "$OWNER_SANDBOX" --no-tty -- /bin/sh -s \
  < openrind-desktop/packages/browser-pods/test/live/owner-smoke.sh
```

This stores evidence on FUSE. It does not test the full failure matrix, concurrent
create latency, raw credential injection, or Argide. Those checks still block release.
Existing owner containers are not patched automatically. Do not delete or replace
one to obtain these assets without a separate user-approved migration.

## Real FUSE E2E

The Docker-driver harness requires a running patched gateway and an image whose policy
allows the supplied database host:

```bash
export DATABASE_URL='postgresql://...'
export OPENSHELL_GATEWAY_ENDPOINT='http://127.0.0.1:18770'
export OPENSHELL_XDG_CONFIG_HOME="$HOME/.config"
export OPENRIND_SHELL_FUSE_E2E_IMAGE='openrind-shell-fuse:local'

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
export OPENRIND_SHELL_FUSE_REAL_CLAUDE=1
export OPENRIND_SHELL_FUSE_E2E_PROVIDER=claude
tests/fuse/test_openshell_e2e.sh
```

For AWS Bedrock, build `tests/fuse/Dockerfile.bedrock`, attach an `aws` provider, and
set `CLAUDE_CODE_USE_BEDROCK`, `AWS_REGION`, and `ANTHROPIC_MODEL`. Raw provider
credentials must never be passed with `--env`.

### Local TLS PostgreSQL Fixture

The production policy permits Supabase poolers. For local testing,
`tests/fuse/postgres-fixture/` provides a reproducible TLS PostgreSQL via Docker
Compose plus a certificate generator (see its README):

```bash
tests/fuse/postgres-fixture/gen-certs.sh
cp tests/fuse/postgres-fixture/.env.example tests/fuse/postgres-fixture/.env
# edit .env: set POSTGRES_PASSWORD
docker compose -f tests/fuse/postgres-fixture/docker-compose.yml up -d --wait
export DATABASE_URL="postgresql://postgres:<password>@172.17.0.1:55432/postgres"
```

A private fixture needs a derived test image that trusts the fixture CA and allows
its exact host and port. `BASE_IMAGE` must name your primary image tag:

```bash
docker build \
  -f tests/fuse/Dockerfile.local-postgres \
  --build-arg BASE_IMAGE=openrind-shell-fuse:local \
  --build-arg OPENERAL_TEST_DB_HOST=172.17.0.1 \
  --build-arg OPENERAL_TEST_DB_PORT=55432 \
  -t openrind-shell-fuse-localdb:test \
  tests/fuse/postgres-fixture/context
```

The fixture PostgreSQL server must present a TLS certificate chaining to `ca.crt`
(the compose fixture does). The overlay adds that CA and an exact raw-tunnel policy
route; it does not disable PostgreSQL TLS. Point `OPENRIND_SHELL_FUSE_E2E_IMAGE`
at the derived tag when running the E2E, and tear the fixture down with
`docker compose -f tests/fuse/postgres-fixture/docker-compose.yml down -v`.

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

`createOpenrindShell()` exposes `/db`, `/home/agent`, and `/tmp` through just-bash for
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
      - { path: /usr/local/bin/openrind-shell-fused }
```

`tls: skip` applies to OpenShell inspection, not PostgreSQL. It tells OpenShell to
relay the tunnel; Node/Rust then require and verify PostgreSQL TLS end to end.

## Source And Rollout Rules

- Never grant mount syscalls or `/dev/fuse` to Claude.
- Never start `openrind-shell-fused` outside the normal hardened `ProcessHandle` path.
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
# Required production image publication

Before packaging Desktop, publish the sandbox image and run the root
`Publish matched Haloop images` workflow with a reviewed full commit SHA from
`openrind/w8-haloop`. Configure `HALOOP_SOURCE_READ_TOKEN` as a read-only repository
secret because that fork is private. Both Haloop image labels must match the
Desktop contract and pinned version before either image is pushed.

Set the three GHCR packages (`sandbox`, `haloop-gateway`, `haloop-collector`) to
public in their package settings. Publishing does not change package visibility.
The workflow and Desktop packaging commands verify anonymous manifests; a failed
check blocks packaging. Do not ship an installer while this check fails. No
customer registry login or direct-provider fallback is required or supported.
