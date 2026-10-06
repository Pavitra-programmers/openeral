# Experimental Browser Pods

This package implements the initial Kernel path in
[BROWSER-PODS.md](../../../BROWSER-PODS.md). It is not a completed browser product.
Normal Desktop launch does not enable it. Development setup is in
[BUILD.md](../../../BUILD.md#experimental-browser-pods).

## First Run

For a new Linux checkout, follow
[Real Linux Browser Test](../../../BUILD.md#real-linux-browser-test). It installs
the host dependency, builds the native runtime and both images, and runs the
isolated fixture. It needs no provider keys or database. Require exit code 0,
13 checks, a screenshot, and no cleanup error. It removes its own sandboxes.

For normal Claude use, follow the root
[Desktop guide](../../../README.md#start-claude-in-desktop). Browser pods are not
enabled by that flow. `openrind-browser` is an in-owner action skill, not a host
installer. Use `openrind-dev` for this package's setup and tests.

The only implemented client provider is agent-browser's built-in `kernel` with
`KERNEL_ENDPOINT=http://127.0.0.1:19300`. Our API creates real Chromium pods; it
does not contact Kernel cloud. The compatibility key is non-secret. Native
OpenShell provider injection supplies the separate real broker credential.

## Implemented

- A private SQLite registry with one broker lock, owner quotas, create intent,
  deadlines, cleanup-pending state, leases, and restart cleanup.
- `POST /browsers` and `DELETE /browsers/{id}` for the pinned agent-browser Kernel
  provider. Unsupported routes return errors. No request falls back to a vendor.
- A fixed owner helper at `127.0.0.1:19300`. Its broker connections require the
  OpenShell HTTP CONNECT proxy. There is no direct-dial fallback or file translation.
- Native OpenShell create, exec, and `forward service` calls. No supervisor,
  gateway, TLS, or FUSE source was changed for browser pods.
- A separate headless Chromium image, a detached pod agent, control leases,
  browser-instance checks, and confirmed process-group stop with deletion fallback.
- Primary image recipes for agent-browser v0.38.2, release checksums, license,
  native upload/download denial policy, helper, and the `openrind-browser` skill.
  A launcher supplies Kernel defaults before it executes the unchanged binary.
  OpenShell exec/SSH sessions clear image environment variables.
- Removal of the old automatic Desktop MCP launch hook. The new Claude wrapper
  ignores the retired managed descriptor and credentials. User MCP configuration
  and Control Chrome are unchanged. The FUSE contract remains v29.

## Not Ready

The following are release gates, not optional follow-up tests:

- Full Desktop activation with a real Claude skill session and FUSE screenshot
  persistence. The passing Linux fixture below has a browser-only owner image.
- Cold-start and health-probe tail latency under concurrent load. The current
  SQLite path is synchronous; it must not delay the client's three-second probe.
- Whole-process memory and file limits. The current relay limits each assembled
  message to 64 MiB and queued sends to 128 MiB. Partial messages inside `ws`
  receivers are not included in that shared budget. Do not claim a 128 MiB total
  process-memory bound.
- Native ForwardTcp capacity and failure tests. The current adapter uses two CLI
  forward listeners. The CLI issues a token per accepted connection. This is not
  the two pooled-token implementation described in the final spec.
- A complete host activation/retirement transaction, owner-runtime identity
  checks, and Windows/WSL installation. Static host configuration is for Stage 0
  only. The broker currently learns owner loss from the helper, not a separate
  gateway lifecycle watch.
- Safe updates for existing containers. Removing the source launch hook does not
  patch old images. Do not replace a live FUSE owner or bump its contract to work
  around this. The in-place retirement installer is still required.
- Hyperbrowser HTTP routes and the extracted Argide fixture. The option normalizer
  is a tested contract only, not a working adapter.
- Browser artifact upload, archives, and explicit FUSE export. Current file APIs
  return 404. Browser data is ephemeral. There is no viewer or sidebar.
- Registry/audit retention, sustained-load tests, and operator handling of a
  permanently uncertain create. An unobserved timed-out create retains quota;
  a single empty inventory result is not proof that allocation cannot arrive later.

## Test Evidence

Unit tests cover session transitions, ownership, quota, late creates, stop
acknowledgement, restart cleanup, Kernel fields, proxy-only routing, relay
backpressure, configuration checks, and Claude/FUSE regression behavior. They also
check that slow deletion does not block other lease requests or access revocation,
and that malformed control and CDP replies fail without an uncaught exception.

`test/live/transport.test.mjs` uses real TCP and WebSockets with a fake CDP peer.
It checks the route and a 17 MiB payload. It does not test Chromium or native
OpenShell credential injection. It fails rather than silently skips if the runner
cannot bind a port.

`test/live/owner-smoke.sh` runs the installed binary inside an explicitly enabled
FUSE owner. It saves screenshot evidence on `/sandbox/work`. It is a smoke test,
not the full Stage 0 acceptance suite.

On 2026-10-06, all 34 browser-pod unit tests, all 261 Desktop OpenShell tests,
Electron typecheck, and the real TCP/WebSocket test passed. The transport test
relayed its 17 MiB payload through the helper and broker with a fake CDP peer.

`test/live/openshell-e2e.mjs` also passed against a real isolated Docker gateway,
the vendored supervisor, Chromium 154.0.8037.92, and the unchanged agent-browser
v0.38.2 Linux x64 release. Its 13 checks cover runtime provider attachment,
HTTP/WebSocket credential injection, navigation, snapshots, screenshots,
click/fill, session reuse, destination denial, client upload/download denial,
browser-crash replacement, client DELETE, and confirmed registry cleanup.
Seccomp, Landlock, executable identity checks, and the website allowlist remain on.

One run created and navigated in 3.8 seconds. Ten later commands took 72-117 ms
each, including native exec. These are samples, not concurrent-load p95/p99 claims.
The owner has no FUSE, Claude, Haloop, or Desktop UI. Screenshot evidence is saved
on its temporary disk and copied to the host. This does not prove FUSE persistence
or Argide compatibility. The remaining release gates above still apply.

The test found and fixed missing Docker build-context files, overlong pod names,
missing OpenShell network tools in the pod image, and missing client settings in
exec sessions. An unoptimized SHA-256 build of the supervisor also caused cold
Chromium identity checks to outlast navigation timeouts. The passing run optimized
the `sha2` dependency, without changing security checks. See BUILD.md for the
exact build command and evidence files.

## Operation Rules

Run one broker per gateway under a dedicated host account. Its gateway/Docker
access is trusted host authority, not a sandbox permission. Keep its configuration,
SQLite database, and service token private. Stop admission on failed recovery.

Use an operator-supplied, pre-pulled browser image digest. Set the native Docker
driver's `image_pull_policy` to `Never`, and use the same Docker daemon for the
broker and gateway. Local preflight alone cannot prevent a gateway image pull.
The broker accepts a website allowlist and requires explicit acceptance of
Chromium's `--no-sandbox` mode. Do not grant pod access to the broker or gateway.

Only the host writes helper configuration and provider grants. All processes in
one owner sandbox share its browser authority. The helper port is not a separate
user security boundary. CDP gives full control of that owner's browser.

Stop revokes access immediately. It returns 204 only after confirmed browser stop.
Container deletion can continue, but quota remains reserved. An uncertain stop
returns an error. Gateway, broker, helper, or browser failure can end the session.
Do not replay a website mutation to recover it.
