# Architecture

## Runtime Split

Openrind Shell has two intentionally separate sandbox runtimes:

- The primary image uses an OpenShell-supervised FUSE mount backed by external
  PostgreSQL for `/sandbox/work`, plus a per-workspace Docker named volume for
  Claude's high-churn home at `/sandbox/claude-home`. Neither path uses a file watcher.
- The compatibility image uses the existing real filesystem plus prefix-scoped
  replication. It supports optional PostgreSQL and PGlite and persists only Claude
  and Openrind Shell state.

The just-bash `WorkspaceFs`/`PgFs` library path remains available to custom agents. It
is not the filesystem used by Claude Code in either sandbox image.

## Primary Sandbox Lifecycle

OpenShell replaces the image entrypoint with `openshell-sandbox`. The trailing command
after `sandbox create --` is executed over SSH after Ready; it never becomes PID 1.

```mermaid
flowchart TB
  create["sandbox create --fuse<br/>--upload db-url -- openrind-shell-init"]
  gate["Docker driver validates request<br/>enable_fuse=true and /dev/fuse"]

  subgraph container["Sandbox container startup"]
    supervisor["openshell-sandbox PID 1"]
    validate["Validate immutable fuse_mounts policy,<br/>root-owned daemon, normalized empty mountpoint"]
    mount["Open /dev/fuse and mount /sandbox/work"]
    prelude["Install TSYNC supervisor prelude<br/>mount and unmount now denied"]
    daemon["Spawn openrind-shell-fused as sandbox:sandbox<br/>through ProcessHandle"]
    fds["Inherited FD 0: FUSE channel<br/>Inherited FD 1: readiness pipe"]
    ready["FUSE INIT complete"]
    services["Start SSH and managed<br/>sleep infinity workload"]
  end

  subgraph trailing["Post-Ready trailing command over SSH"]
    upload["Upload /sandbox/db-url"]
    init["openrind-shell-init one-shot"]
    database["Migrate V1-V8, bridge renamed rows,<br/>prepare volume and one-time legacy import"]
    verify["Verify writer lease in PostgreSQL<br/>and fsync/read/unlink through mount"]
    configure["Prepare user-owned Claude home,<br/>configure required Haloop route, remove upload"]
    marker["Write init marker and exit 0"]
  end

  create --> gate --> supervisor --> validate --> mount --> prelude --> daemon
  daemon --> fds --> ready --> services
  services -->|"OpenShell reports Ready"| upload --> init
  init --> database --> verify --> configure --> marker
```

The FUSE daemon starts before the database upload exists. It completes the kernel
FUSE handshake, keeps the mount present, and returns bounded `EIO` for operations that
cannot wait for database readiness. The init-owned marker and management socket are
same-UID coordination mechanisms, not security trust signals. Initialization also
checks the lease row and mounted durability independently.

## Data Path

```mermaid
flowchart LR
  tools["Claude, git, compilers,<br/>editors, language servers"]
  vfs["Linux VFS<br/>/sandbox/work"]
  kernel["Kernel FUSE channel<br/>supervisor-owned FD"]
  daemon["openrind-shell-fused<br/>sandbox UID + Landlock + seccomp"]
  proxy["OpenShell local proxy<br/>binary-attributed endpoint policy"]
  tls["Raw CONNECT tunnel<br/>PostgreSQL TLS end to end"]
  schema[("PostgreSQL<br/>_openeral.fs_* namespace")]

  tools -->|"POSIX syscalls"| vfs --> kernel --> daemon
  daemon -->|"HTTP CONNECT only<br/>no direct-dial fallback"| proxy --> tls --> schema
```

Claude receives neither `/dev/fuse` nor mount capability. The Rust daemon refuses to
dial PostgreSQL directly: a valid OpenShell HTTP proxy environment is mandatory. The
PostgreSQL endpoint uses `tls: skip` at the OpenShell route so the proxy relays the
non-HTTP PostgreSQL TLS session without terminating it.

The default interactive cwd is `/sandbox/work`, while the sandbox user's login home
stays `/sandbox`. Initialization installs a hook in `/sandbox/.bashrc` that enters the
FUSE mount. The `claude` wrapper alone sets `HOME=/sandbox/claude-home`, a persistent
per-workspace Docker named volume, so Claude's high-churn settings and session state do
not add remote filesystem latency to terminal startup and input. Project discovery still
targets `/sandbox/work`; the FUSE daemon therefore keeps a generation-fenced metadata
and directory cache. Its first lookup loads one authoritative directory snapshot, and
subsequent hits and misses stay local until a committed namespace mutation invalidates
the cache.
`/sandbox` remains the OCI bootstrap working directory because initialization and
supervisor startup must work before the database-backed mount is writable.

## Storage Model

Migration V7 introduces a normalized namespace:

- `fs_volumes`: workspace-to-volume identity and root inode.
- `fs_nodes`: stable inode metadata, type, mode, ownership, timestamps, size, links,
  generation, symlink target, and deletion state.
- `fs_dirents`: byte-preserving parent/name/child namespace edges.
- `fs_chunks`: sparse 256 KiB file chunks.
- `fs_mount_epochs`: one-writer lease, owner, expiry, and fencing epoch.
- `fs_operations`: mutation IDs and request hashes for uncertain-commit resolution.
- `fs_legacy_imports`: one-time import completion from scoped-sync rows.

TypeScript owns migrations, volume preparation, and legacy import. Rust validates the
installed schema and never migrates it. A PostgreSQL advisory lock and expiring lease
allow only one writable daemon for a workspace.

Migration V8 is an upgrade bridge for compatibility images from the renamed just-bash
branch. If `_openrind.workspace_config` and `_openrind.workspace_files` exist, their
rows are copied into `_openeral` once; conflicts keep the row with the newer mtime.
It records source-workspace provenance so first-time volume preparation imports every
valid just-bash home path. Older `_openeral` compatibility workspaces still import
only the historical state allowlist. The normalized FUSE tables never move out of
`_openeral`.

## Durability Contract

Ordinary writes enter a shared, bounded dirty cache and are flushed in the background.
They are not all synchronous PostgreSQL commits.

The following are durability barriers:

- `fsync` and `fdatasync`;
- `O_SYNC` and `O_DSYNC` writes;
- dirty-source rename, including replacement, which commits captured data and the
  namespace transaction before success;
- close/FLUSH after rewriting a pre-existing file through `O_TRUNC`;
- the Claude wrapper's final `openrind-shell-fused flush-all` on clean exit.

Namespace and metadata mutations commit synchronously. Uncertain mutation commits are
resolved through operation IDs. A lost PostgreSQL connection is not a lost lease: the
daemon reconnects within the lease safety window, re-takes the advisory lock, and
renews the same owner/epoch before serving again; mutations return `EIO` meanwhile.
On terminal lease loss (the row was taken over or expired), the old daemon discards
dirty bytes, surfaces writeback errors, never reacquires a new epoch in-process, and
exits.

## Failure And Recovery

In-process remount is intentionally impossible after the supervisor installs its
TSYNC seccomp prelude. Recovery therefore rebuilds the container mount namespace:

```mermaid
stateDiagram-v2
  [*] --> Writable: mount + FUSE INIT + writer lease
  Writable --> CriticalExit: daemon exit, FUSE loop exit, or terminal fence
  CriticalExit --> Restarting: supervisor exits with reserved status
  Restarting --> Writable: Docker restarts, remounts, higher writer epoch
  Restarting --> Error: on-failure retry budget exhausted
  Writable --> Stopped: explicit sandbox stop
  Stopped --> Restarting: explicit sandbox start
  Error --> [*]: delete and recreate with the same workspace ID
```

Explicit sandbox stop remains Stopped; explicit start reconstructs the mount. A
sandbox that exhausted the retry budget is terminal `Error`; `sandbox start` requires
`Stopped`, so recovery is delete plus recreate with the same workspace ID. An arbitrary
alive-but-deadlocked daemon is a documented v1 gap because same-UID health endpoints
cannot serve as a supervisor trust signal.

A container restart terminates every process in the sandbox, including interactive
SSH shells and Claude sessions. Open file descriptors and unbarriered dirty bytes
cannot survive it. Committed data survives daemon, container, and sandbox
replacement.

## Security Boundary

The FUSE capability is default-off in three places: the public request, the image's
immutable policy, and Docker's operator config. Unsupported drivers reject it.

The supervisor validates the daemon binary and mountpoint, performs the privileged
mount, then launches the daemon through the normal unprivileged child path. The daemon
inherits the sandbox UID, Landlock, child seccomp, network namespace, proxy, TLS roots,
and binary-attributed egress policy. Claude cannot choose the daemon, mountpoint, or
inherited descriptors.

V1 does not claim same-UID secret isolation. Claude and the daemon share the sandbox
UID; Claude can read runtime files and signal the daemon. Network policy, TLS, lease
fencing, and least-privilege PostgreSQL roles remain required. A separate storage UID
and supervisor-mediated secret channel are future hardening work.

Provider credentials are different from the uploaded PostgreSQL URL. OpenShell
supplies placeholders and replaces them at approved endpoints. Raw PostgreSQL
cannot use that HTTP-header mechanism, so its URL is a mode-0600 upload consumed
into runtime state and removed from `/sandbox` after init. Legacy presign and
StringCost code is not a primary Desktop inference fallback.

## Primary Inference

Desktop starts the host-managed Haloop edge and private trace collector. It
registers an Anthropic route and a scoped OpenShell provider for the selected
workspace, sandbox, and agent. The upstream Anthropic key stays on the host.
The sandbox uses an endpoint-bound placeholder; OpenShell replaces it with the
scoped edge token at the allowed endpoint. The browser broker uses a separate
provider and credential. It is not on the inference path.

```mermaid
sequenceDiagram
  actor User
  participant Desktop
  participant Shell as Owner sandbox
  participant Proxy as OpenShell proxy
  participant Haloop as Host Haloop edge
  participant Model as Anthropic
  User->>Desktop: Create or reconnect Claude session
  Desktop->>Haloop: Register server-owned route and scope
  Desktop->>Shell: Launch Claude with signed conversation context
  Shell->>Proxy: Model request with provider placeholder
  Proxy->>Haloop: Substitute scoped token at approved endpoint
  Haloop->>Haloop: Verify signed context and derive trace identity
  Haloop->>Model: Model request with upstream credential
  Model-->>Haloop: Model response
  Haloop-->>Proxy: Response
  Proxy-->>Shell: Response
```

The edge rejects missing or invalid conversation context. A raw SSH shell does
not supply that context, so manually running `claude` is not the primary customer
launch. Startup readiness is required. Trace capture after startup is best-effort;
check capture counters before claiming a trace exists. Desktop cleanup closes
agents and revokes scoped providers before it removes a sandbox. Use that managed
cleanup for Desktop-owned resources.

## Experimental Browser Pods

This is a separate browser runtime, not a new persistence path. The Kernel API
adapter and relay run outside the model's MCP tool path. The real Linux fixture
passed 13 checks with agent-browser v0.38.2 and Chromium 154.0.8037.92 on
2026-10-06. Normal Desktop activation remains disabled pending the separate
Desktop/Claude/FUSE, installation, and load requirements. See the
[package status](./openrind-desktop/packages/browser-pods/README.md), not the target
spec alone, for current availability.

```mermaid
flowchart LR
  subgraph owner["Existing FUSE owner sandbox"]
    claude["Claude<br/>bundled openrind-browser skill"]
    client["agent-browser v0.38.2<br/>Kernel provider"]
    helper["Native helper parent + Node relay<br/>127.0.0.1:19300"]
    ownerproxy["OpenShell CONNECT proxy<br/>REST header credential injection"]
    files["/sandbox/work<br/>existing PostgreSQL FUSE"]
    claude --> client --> helper --> ownerproxy
    client -->|"screenshot bytes"| files
  end
  subgraph host["Gateway host"]
    broker["Experimental Kernel broker<br/>private host endpoint"]
    db[("Private SQLite<br/>owner, lease, cleanup state")]
    native["Native sandbox create/exec<br/>and ForwardTcp"]
    broker --> db
    broker --> native
  end
  subgraph pod["Separate browser sandbox; no FUSE or owner home"]
    control["Detached pod agent<br/>loopback control + lease"]
    chromium["Headless Chromium<br/>loopback CDP"]
    webproxy["OpenShell website policy<br/>allowlist + tls: skip"]
    control --> chromium --> webproxy
  end
  ownerproxy --> broker
  native --> control
  native <--> chromium
  webproxy --> web["Allowed websites"]
```

The installed client launcher sets `AGENT_BROWSER_PROVIDER=kernel` and
`KERNEL_ENDPOINT=http://127.0.0.1:19300`, then executes the unchanged release
binary. OpenShell clears Docker ENV in exec/SSH sessions. The launcher's defaults
therefore apply at each client invocation. `KERNEL_API_KEY` contains a non-secret
compatibility value. The real broker token is an OpenShell provider credential,
not a Kernel cloud key or an agent environment secret.

The helper is installed in our owner images. It is not a binary-free transport
for arbitrary third-party images. It has one fixed loopback port per owner. Its
native parent supplies the policy-attributed binary identity while Node relays
traffic through the OpenShell CONNECT proxy. Native header injection authenticates
the HTTP requests and WebSocket upgrades. The broker endpoint uses `protocol: rest`
with no request-body or WebSocket-frame credential rewrite. It is a private host
HTTP endpoint, not a public service route or a custom TLS termination service.

```mermaid
sequenceDiagram
  participant Client as agent-browser Kernel provider
  participant Helper as Owner loopback helper
  participant Broker as Host Kernel-compatible broker
  participant OS as Native OpenShell
  participant Pod as Chromium pod
  Client->>Helper: POST /browsers
  Helper->>Broker: Request through OpenShell proxy and provider injection
  Broker->>Broker: Reserve quota and store create intent in SQLite
  Broker->>OS: Create isolated sandbox and exec detached pod agent
  OS->>Pod: Apply policy and launch real Chromium
  Broker->>OS: ForwardTcp for control and CDP
  Broker->>Helper: Probe CDP through the complete owner route
  Broker-->>Client: session_id and owner-loopback cdp_ws_url
  Client->>Helper: Open CDP WebSocket
  Helper->>Pod: Relay through broker and native ForwardTcp
  Pod-->>Client: Page results and screenshot bytes
  Client->>Helper: DELETE /browsers/id
  Helper->>Broker: Stop request
  Broker->>Broker: Revoke attachment
  Broker->>Pod: Stop browser and confirm
  Broker-->>Client: 204 after confirmed stop
  Broker->>OS: Delete container and retain quota until confirmed
```

Only Kernel create/delete routes ship. Hyperbrowser option validation exists,
but the HTTP adapter, Argide fixture, and file artifact API do not. No request
falls back to a vendor endpoint. The service does not impersonate vendor domains.
Local browser executable selection and path translation are outside this design.

The helper has no path translation API. Client `upload` and `download` commands
are denied by a native client policy. This is a client guardrail, not a security
boundary. Direct CDP controls the assigned browser. Website allowlists constrain
destinations, not the content sent to them.

The pod uses `--no-sandbox` with explicit host operator acceptance. OpenShell is
the outer isolation boundary. The runtime requests a 2 GiB memory limit, a 1 GiB
`/tmp` tmpfs, and a 256 MiB `/dev/shm` tmpfs. These run in the Linux fixture;
concurrent-load and whole-process resource-bound tests remain required. The pod
receives no FUSE mount, owner home, or owner provider credentials. Website HTTPS
uses `tls: skip`: Chromium verifies website TLS through a policy-controlled tunnel.

Create persists its intent before allocation. It waits for a real browser probe
through the owner's helper before it returns a CDP URL. Stop revokes access first.
It reports success only after confirmed browser stop or container deletion.
Cleanup-pending rows retain quota. Broker restart ends old sessions; it does not
replay website actions. A helper disconnect also ends its owner's sessions.

Before each command the client checks browser liveness. A failed three-second
probe can cause it to delete the old provider session and create another. This
is replacement, not reconnection to the same page. Broker restart and session
expiry also do not restore cookies or tabs. Do not replay a possibly completed
website action on the assumption that replacement rolled it back.

The broker has native gateway and Docker authority. It must not be reachable
from browser pods. No public CDP route or Desktop viewer is added. FUSE, the old
compatibility watcher, and user-owned MCP settings stay separate.

See [implementation limits](./openrind-desktop/packages/browser-pods/README.md)
and [developer setup](./BUILD.md#experimental-browser-pods) before testing.

## Compatibility Runtime

`Dockerfile.openrind-shell-compat` retains the previous model:

```mermaid
flowchart LR
  shell["Claude with real /bin/bash"] --> disk["Kernel files under /sandbox"]
  disk --> watcher["Detached Node daemon<br/>prefix-scoped watchers"]
  watcher <--> rows[("_openeral.workspace_files<br/>PostgreSQL or PGlite")]
  watcher --> included[".claude/**<br/>.claude.json<br/>.openrind-shell/**<br/>legacy .openeral/**"]
  disk --> excluded["All other paths<br/>ephemeral"]
```

It supports PGlite and optional PostgreSQL. Source files outside those prefixes are
ephemeral. The Docker-only tests under `tests/test_sandbox_e2e.sh` and
`tests/test_setup_e2e.sh` target this image explicitly.

## Custom-Agent Library Path

`createOpenrindShell()` remains an in-process just-bash integration. The legacy
`createOpeneralShell()` export is an alias:

```mermaid
flowchart LR
  agent["Custom agent"] --> shell["createOpenrindShell<br/>just-bash interpreter"]
  shell --> db["/db<br/>read-only PgFs SQL browser"]
  shell --> home["/home/agent<br/>PostgreSQL-backed WorkspaceFs"]
  shell --> tmp["/tmp<br/>InMemoryFs"]
```

This path is useful when every command is interpreted by just-bash. Native Claude Code
uses the kernel-backed sandbox paths above and does not see `/db` as a virtual mount.
