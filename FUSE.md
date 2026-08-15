# FUSE and Persistent Filesystem Options for Openrind Shell

**Status:** architecture survey with implementation status; the selected contract is
specified in [FUSE-DESIGN.md](FUSE-DESIGN.md)

**Research date:** 2026-08-15

**Audience:** an engineer or coding agent expected to challenge the design before
rollout

This report records every filesystem route investigated for Openrind Shell. It is not the
implementation specification. Where this survey and FUSE-DESIGN.md differ,
FUSE-DESIGN.md wins.

## Executive Verdict

The historical and currently published `:just-bash` runtime is a scoped replication
system, not a live filesystem. Claude Code uses the kernel filesystem under `/sandbox`;
a detached Node daemon copies only `.claude`, `.claude.json`, `.openrind-shell`, and
legacy `.openeral` between
disk and PostgreSQL. That design remains the compatibility route.

The current source-tree primary runtime implements the selected FUSE design: one
OpenShell-supervised mount at `/sandbox/work`, normalized PostgreSQL storage, no
watcher, and external PostgreSQL as a startup requirement. It remains experimental
until the performance and upstream/release gates in FUSE-DESIGN.md are complete.

The product decision for the next runtime is different. These choices were made
explicitly; they are not accidental consequences of the FUSE implementation:

- PostgreSQL-backed FUSE becomes the primary sandbox filesystem.
- Claude's `HOME` and working directory become `/sandbox/work`.
- The FUSE mount contains both Claude state and project files.
- External PostgreSQL is mandatory for this image; PGlite is not the backing store.
- A successful ordinary `write(2)` means accepted into bounded daemon memory.
- `fsync(2)` and `fdatasync(2)` are the general PostgreSQL durability barriers.
- Dirty-source rename and close after rewriting an existing file through `O_TRUNC`
  are narrow safe-replacement barriers; they synchronously persist the captured data
  before reporting the namespace or close operation successful.
- Docker is the first supported OpenShell driver.

The best architecture for those requirements is an **in-sandbox FUSE daemon launched
and supervised by OpenShell**. The supervisor performs the privileged mount before
its own seccomp prelude, then launches the image-provided FUSE daemon through the
normal unprivileged workload process path with an inherited FUSE fd. The daemon's
PostgreSQL connection therefore remains inside the sandbox network namespace and is
subject to OpenShell's binary-attributed egress policy.

This requires a substantial, first-class OpenShell patch. It does not require relaxing
the agent's seccomp filter, giving mount capability to Claude, replacing OpenShell's
supervisor, or carrying the historical Openrind Shell gateway/cluster/CSI image matrix.

## Evidence Labels

- **Verified:** inspected in the pinned source revision.
- **Empirical:** directly exercised in a local checkout.
- **Inferred:** conclusion from source or kernel/container behavior, not yet tested in
  the proposed combination.
- **Proposed:** an unimplemented alternative or future extension.

## Repository Provenance

| Repository or branch | Pinned revision | Use |
|---|---:|---|
| NVIDIA/OpenShell `main` | [`c4b500a7de64d0b66e3ee8098f58d14299092162`](https://github.com/NVIDIA/OpenShell/tree/c4b500a7de64d0b66e3ee8098f58d14299092162) | Current supervisor, policy, driver, lifecycle, public API, and SDK behavior. Fresh clone: `/tmp/OpenShell-latest-20260814`. |
| Openrind Shell `nemo` | `0dcabc8ad3aecf6a562fef5b611d52ec4cee018a` plus this implementation worktree | Scoped-sync baseline plus the implemented primary FUSE candidate. |
| Historical Rust tree | current repository `crates/` plus historical commits | FUSE correctness evidence; not a reusable production implementation. |
| Renamed `origin/just-bash` | `6775f03f763e4405a155e081e035c43fc47f5977` | Virtual-filesystem comparison. |
| vercel-labs/just-bash | `2586623e5dbfd9bd88871c185b251dc7b6c02a78` | Interpreter and `IFileSystem` behavior. |
| NVIDIA/NemoClaw | `b5283712bb3da9a6e7de7c2e334a665f0f04c9be` | Recovery-controller and process-lifecycle lessons. |
| NVIDIA/OpenShell-Community | `fffb6b2248ff6ba585f50517f3711b08122089f2` | Published sandbox base; it contains no FUSE integration. |
| libkrun/libkrun | `b9f33aec4179d816f44e65cd5fa1e938295b727d` | Additional virtiofs API evidence. |

The OpenShell pin incorporates the first-class sandbox `stop`/`start` and `cargo-deny`
changes reviewed in the prior draft plus six newer commits through `v0.0.106`. Those
newer commits add or complete Go and TypeScript SDKs, TLS/OpenShift support, telemetry,
and dependency automation. A source diff confirms that none adds FUSE device
injection, FUSE policy, inherited-fd process spawning, critical-child supervision, or
automatic recovery from a live daemon deadlock. The new TypeScript SDK must receive
the generated FUSE resource bindings alongside the existing SDK/API surfaces.

## Compatibility Baseline

### Claude sandbox path

Verified from the current worktree:

```text
Claude Code and native tools
  -> real /bin/bash
  -> real kernel files under /sandbox
  -> fs.watch daemon
  -> prefix-scoped sync
  -> _openeral.workspace_files
```

Only these paths round-trip:

```text
/sandbox/.claude/**
/sandbox/.claude.json
/sandbox/.openrind-shell/**
/sandbox/.openeral/** (legacy)
```

The design preserves native `git`, `node`, `npm`, language servers, and arbitrary
binaries. Its limitations are structural:

- PostgreSQL is not the live namespace.
- PostgreSQL-to-disk restore occurs at initialization, not continuously.
- disk-to-PostgreSQL writes are debounced.
- a forced teardown can lose the debounce or in-flight window.
- source code is intentionally ephemeral.
- the daemon and Claude share the same Linux UID and credential boundary.

### just-bash library path

`createOpenrindShell()` still exposes an in-process virtual namespace; the old export
is a compatibility alias:

```text
/db          -> PgFs, read-only SQL browser
/home/agent  -> WorkspaceFs, PostgreSQL-backed files
/tmp         -> InMemoryFs
```

This is useful for custom agents whose every command runs through just-bash. It is not
the filesystem used by Claude Code in an OpenShell sandbox.

## Current OpenShell Constraints and Useful Features

### The supervisor owns the container

OpenShell replaces the image entrypoint with `openshell-sandbox`. The managed workload
defaults to `sleep infinity`. A trailing command after `openshell sandbox create --`
is executed later over SSH after the sandbox reaches Ready. It is not PID 1 and must
not own a critical daemon.

This is verified in the Docker driver, `openshell-sandbox`, and the CLI SSH execution
path at the pinned revision.

### The agent cannot mount FUSE

Even if `/dev/fuse` were visible, a normal workload still cannot mount it:

- the supervisor drops the workload to the sandbox UID;
- `PR_SET_NO_NEW_PRIVS` prevents a setuid mount helper from elevating;
- the workload seccomp policy blocks `mount`, `umount2`, the new mount API, `setns`,
  and user-namespace creation;
- Landlock confines the resulting process.

Relaxing these controls for Claude would break the OpenShell security model. The
mount must be established by the already-privileged supervisor.

### The supervisor cannot remount after startup hardening

`run.rs` prepares the filesystem and then invokes
`apply_supervisor_startup_hardening()`. That process-wide TSYNC seccomp prelude blocks
`mount`, `umount2`, and the new mount API for the supervisor itself. Therefore:

- the initial FUSE `mount(2)` must happen before the prelude;
- the daemon should be spawned after the prelude through `ProcessHandle`;
- a daemon crash cannot be repaired with an in-place unmount/remount without
  weakening the prelude;
- reliable recovery must recreate the supervisor/container mount namespace.

### Docker lifecycle now supports that recovery boundary

At the pinned `c4b500a7`, OpenShell exposes:

```text
openshell sandbox stop NAME
openshell sandbox start NAME
```

The Docker driver currently creates containers with `restart_policy: unless-stopped`.
The selected patch changes only FUSE-requested containers to bounded
`on-failure:5`: a critical daemon exit terminates the supervisor and lets Docker
reconstruct the container and mount namespace without an infinite crash loop.
Explicit stop must remain stopped. Explicit start must reset the retry budget and boot
a new supervisor in the retained container; the implementation must verify Docker's
behavior and use the restart-policy update API if a plain start does not reset it.

One upstream gap remains: the Docker driver reports `ContainerRestarting`, while the
gateway's current transient-reason list does not include it. Without a lifecycle fix,
an automatic restart can be recorded as terminal `Error`. The selected design fixes
and tests this state mapping.

### Existing external mounts are useful but not sufficient

OpenShell PR [#1785](https://github.com/NVIDIA/OpenShell/pull/1785) added driver-config
mount support. Current Docker/Podman drivers can consume existing named volumes,
binds when operator-enabled, and tmpfs mounts; Kubernetes can consume an existing
PVC. These capabilities make a host FUSE plugin or CSI design possible without a
custom supervisor.

They do not inject `/dev/fuse`, let a sidecar's private mount namespace appear in the
agent container, or create a PostgreSQL-backed filesystem by themselves.

## Approach 1: Scoped Native-Filesystem Sync

**Shape:** native disk plus startup hydration, watcher replication, and clean-exit
flush.

**Strengths:** smallest runtime, no device privileges, native tool compatibility,
optional PGlite, and low metadata latency.

**Weaknesses:** not a unified live namespace, no `fsync`-level durability, duplicate
disk/database authorities, and a forced-shutdown loss window.

**Verdict:** a valid compatibility mode, but it does not meet the selected persistent
workspace requirement.

## Approach 2: just-bash `WorkspaceFs`

The just-bash branch persists operations that actually pass through its `IFileSystem`
adapter. That is real functionality, not merely a mock. It is missing from the native
Claude path only because Claude and its child processes access the kernel filesystem
directly.

Verified limitations:

- just-bash built-ins can use `MountableFs` and `ReadWriteFs`;
- arbitrary host binaries do not enter that in-process namespace;
- running `node`, `git`, or `npm` through a stock just-bash instance returns command
  not found unless separately emulated;
- a native fallback would bypass `WorkspaceFs` and recreate split-brain state.

**Verdict:** objectively good for constrained custom agents. It is not a transparent
POSIX filesystem for Claude Code and cannot replace FUSE for this product decision.

## Approach 3: Historical In-Sandbox FUSE

The historical Rust implementation proved that native Claude workloads can use a
PostgreSQL-backed mount, but it also exposed correctness and operational problems.
The current `crates/openeral-core/src/fs/workspace.rs` is not safe to revive wholesale:

- each open handle buffers a full file independently;
- `write` replies before database persistence;
- persistence happens only on `flush` or `release`;
- there is no `fsync` implementation in that filesystem;
- whole files are rewritten for partial changes;
- directory rename is split into separate operations;
- descendant rename failure is logged while the FUSE request still returns success;
- path-derived inodes and whole-row storage complicate rename and open-unlinked
  semantics.

The historical fd entry also runs its own Refinery migrations and opens PostgreSQL
directly. That conflicts with the TypeScript migration owner and cannot traverse
OpenShell's CONNECT-only egress path as written. Its pre-opened-fd mode spawns a
background FUSE session and parks forever, so an event-loop failure can remain hidden.

Historical commits remain useful evidence, with corrected attribution:

- `ccc278b`: Supabase/PostgreSQL truncate parameter typing and integration coverage.
- `a457ec9`: multi-threaded fuser request handling plus live-smoke harness work.
- `ba6549a`: cloned-fd/parallel request and cache work to avoid serialized startup.
- `7142b2d`: metadata queries that do not load file contents.
- `e06f90b`: long metadata caching under a single-writer assumption.
- `ef00832`: stable rename inode behavior, open-time truncation,
  `FUSE_ATOMIC_O_TRUNC`, disabled writeback cache, and durable-config mount layout.

The final historical live Claude smoke was not recorded green after the last fixes.

**Verdict:** reuse tests, failure cases, and selected helper code. Do not reuse the
storage model or daemon lifecycle as the new implementation base.

## Approach 4: Host FUSE Plugin or Kubernetes CSI

```text
agent kernel VFS
  -> Docker volume plugin or CSI node mount
  -> host-side FUSE client
  -> OpenShell ForwardTcp or exposed WebSocket
  -> storage service in a dedicated sandbox
  -> OpenShell egress proxy
  -> PostgreSQL
```

This is the strongest no-OpenShell-patch option. The plugin does not need PostgreSQL
credentials; the storage sandbox owns them. Existing driver mounts inject the result
at `/sandbox/work`.

It is also a distributed filesystem. High reliability requires operation IDs,
transactional deduplication, fencing epochs, replay, backpressure, bounded reconnect,
and a mount-owning frontend that survives transport-worker restarts. Active OpenShell
relay streams are not resumed after every gateway/supervisor interruption.

`service expose` is HTTP-oriented. A WebSocket can carry multiplexed binary RPC over
one durable connection, but every broken stream must be reconnected and reconciled by
Openrind Shell. `ForwardTcp` is a better protocol fit, but a production controller must run
on the compute host and repair forwards; a forward on a user's remote laptop cannot
serve a Docker volume plugin on the gateway host.

**Verdict:** viable and still the right design when avoiding all OpenShell changes is
the overriding requirement. Rejected for the selected product because it adds a host
plugin, storage sandbox, relay controller, wire protocol, and second trust boundary.

## Approach 5: First-Class In-Sandbox FUSE

```text
Claude/native tool
  -> kernel VFS at /sandbox/work
  -> inherited /dev/fuse connection
  -> unprivileged openrind-shell-fused process
  -> OpenShell netns and CONNECT proxy
  -> PostgreSQL with end-to-end TLS
```

The supervisor performs only the privileged setup:

1. validate the static policy declaration;
2. open `/dev/fuse` and mount `/sandbox/work` before startup hardening;
3. apply its normal process-wide hardening;
4. spawn `openrind-shell-fused` through `ProcessHandle`, passing only explicitly mapped
   inherited fds;
5. treat the daemon as a critical child.

Claude never receives mount capability. The daemon runs as the sandbox UID, inside
the normal network namespace, Landlock ruleset, child seccomp policy, proxy/TLS
environment, and binary-attributed network policy.

This route has one network hop, no host plugin, no OpenShell relay protocol, and one
persistence authority. The vendored implementation includes the required first-class
OpenShell API/policy/driver, supervisor, gateway-lifecycle changes, and the new
correctness-focused FUSE daemon.

The implementation is present against a plain source snapshot at
`vendor/openshell/`, initially pinned to
`c4b500a7de64d0b66e3ee8098f58d14299092162`, with pristine upstream import and Openrind Shell
patches kept separate. Comparable upstream resource and lifecycle changes
show that this is likely a 30-60-file OpenShell patch with 3,000-6,000 non-generated
changed lines, plus generated SDK/API artifacts. "Minimal" means default-off and
security-coherent, not a small raw line count.

The database marker and health socket are same-UID operational coordination, not
supervisor trust. Supervisor startup readiness comes from an inherited fd, and
critical-child exit is observed through `ProcessHandle`; arbitrary alive-but-deadlocked
daemon detection needs a separate supervisor-owned heartbeat and is deferred until
after v1. Product init also cross-checks the lease in PostgreSQL and exercises a
write/fsync/read/unlink canary through the mounted filesystem.

**Verdict:** selected. The complete proposal is [FUSE-DESIGN.md](FUSE-DESIGN.md).

## Approach 6: Additional MicroVM virtiofs Share

OpenShell's MicroVM rootfs already uses virtiofs. Issue
[#1509](https://github.com/NVIDIA/OpenShell/issues/1509) records that a second share is
not currently supported in NVIDIA's libkrun integration even though upstream libkrun
exports `krun_add_virtiofs*` APIs.

If OpenShell adds a second virtiofs device, it can project a host filesystem into the
guest without exposing `/dev/fuse` inside the VM. That is attractive when a trusted
host FUSE service already exists, but it still needs the host-side architecture from
Approach 4. It does not help the selected in-sandbox daemon and is not available
today.

Issue [#1606](https://github.com/NVIDIA/OpenShell/issues/1606) addresses deriving
GPU/CDI requirements. It does not provide general device passthrough, FUSE mount
orchestration, or inherited fd delivery.

**Verdict:** future VM transport, not the Docker v1 route.

## NemoClaw Lessons

NemoClaw contributes process and recovery patterns, not a PostgreSQL filesystem:

- distinguish direct-container entrypoint ownership from OpenShell-managed PID 1;
- never rely on a long-running trailing SSH command;
- make health and recovery explicit;
- verify process identity rather than trusting a stale PID;
- keep configuration and mutable state separate;
- use host orchestration when the sandbox cannot repair itself safely.

The selected design applies these lessons differently: the FUSE daemon is a real
supervisor-managed critical child, and recovery restarts the supervisor/container
instead of using an SSH-side `nohup` process.

## Decision Matrix

| Approach | Native Claude tools | One live POSIX namespace | `fsync` durability | OpenShell change | Extra host service | Selected |
|---|---|---|---|---|---|---|
| Scoped sync | Yes | No | No | No | No | Compatibility only |
| just-bash `WorkspaceFs` | No, interpreter surface only | Only inside just-bash | Per adapter operation | No | No | Library/custom agents |
| Historical FUSE revival | Yes | Yes | Not correctly implemented | Large historical fork | Historical CSI/runtime | No |
| Host plugin/CSI plus relay | Yes | Yes | Implementable | No | Yes | Alternative |
| First-class in-sandbox FUSE | Yes | Yes | Implementable | Substantial first-class patch | No | **Yes** |
| Extra MicroVM virtiofs | Yes | Yes | Backend-dependent | Required and unavailable | Yes | Future |

## Security Boundary

The selected route preserves OpenShell's network controls:

- raw PostgreSQL traffic remains blocked by the sandbox network namespace;
- `openrind-shell-fused` uses HTTP CONNECT through the OpenShell proxy;
- PostgreSQL negotiates TLS end-to-end inside that tunnel;
- policy permits the PostgreSQL host/port for the daemon and the init-time Node
  migration path; both remain destination- and binary-attributed by OpenShell;
- no mount syscall is exposed to Claude.

It does **not** create credential isolation from Claude. The daemon and Claude run as
the same sandbox UID in v1. Claude can signal the daemon and read the runtime database
URL; because Node remains authorized for TypeScript migrations, it can also initiate
CONNECT traffic to the same policy-declared database endpoint. Critical-child restart
protects availability, not confidentiality. A separate service UID,
supervisor-mediated secret delivery, and narrow migration service are a future
hardening phase and must not be implied by v1 documentation.

## Reliability Boundary

The selected durability contract is deliberately narrower than "every acknowledged
write is durable":

- before database readiness, blocking filesystem operations wait at most five seconds
  and return `EIO`, not `EAGAIN`;
- ordinary writes are acknowledged after bounded in-memory acceptance;
- dirty data is flushed on a short background interval and under memory pressure;
- `fsync`/`fdatasync` acknowledge only after PostgreSQL commits;
- a rename whose regular-file source has dirty data commits the captured source bytes
  and namespace move/replacement in one transaction before returning success;
- closing a handle that rewrote a pre-existing file through `O_TRUNC` synchronously
  commits data through the close-time `FLUSH` sequence before that close succeeds;
- all other metadata and namespace mutations commit before success is returned;
- `O_SYNC`/`O_DSYNC` writes commit before success;
- daemon or container failure can lose ordinary writes not covered by any completed
  durability barrier;
- lease loss terminally fences the daemon: old dirty bytes are discarded with
  writeback errors and are never flushed under a new epoch;
- committed data survives daemon, supervisor, container, and sandbox replacement.

The safe-replacement rules intentionally protect the common replace-via-rename and
replace-via-truncate patterns described by Linux ext4's
[`auto_da_alloc`](https://cdn.kernel.org/doc/html/latest/admin-guide/ext4.html). They
are explicit Openrind Shell guarantees, not generic POSIX guarantees or a substitute for
application `fsync`. No proposal should claim zero data loss for ordinary unbarriered
writes or transparent survival of open file descriptors across a mount restart.

V1 bounds database and request failures while the event loop remains responsive. An
arbitrary daemon deadlock requires operator `sandbox stop`/`sandbox start`; automatic
hang recovery is a post-v1 watchdog feature and must use a supervisor-owned heartbeat,
not the same-UID management socket or mounted filesystem.

## Adversarial Review Checklist

An implementation review should reject the feature until it can answer all of these:

1. Which exact OpenShell proto, CLI, policy, gateway, driver, and supervisor paths
   carry the FUSE request?
2. Can a sandbox workload obtain `/dev/fuse` or mount capability outside the declared
   supervisor path?
3. Does the daemon receive the same UID, Landlock, seccomp, netns, proxy, and TLS
   treatment as a normal child?
4. What does `write` guarantee, and what stronger guarantee does `fsync` provide?
5. Does dirty-source rename commit the captured bytes before or atomically with both
   replacing and non-replacing namespace changes?
6. Does close after an existing-file `O_TRUNC` rewrite report writeback failure and
   make its captured sequence durable without relying on a later background flush?
7. Are dirty bytes bounded per inode and globally?
8. Is rename atomic, including directory subtrees and replacement semantics?
9. Are inode IDs stable across rename?
10. How are open-unlinked nodes reclaimed after release and after daemon restart?
11. How does an uncertain PostgreSQL commit resolve without applying a mutation twice?
12. Does lease loss discard old dirty state, surface writeback errors, and force a
    fresh daemon rather than reacquiring an epoch in-process?
13. Does a daemon exit restart the sandbox without leaving gateway state in terminal
    `Error`?
14. Does explicit `sandbox stop` remain stopped, and does `sandbox start` remount and
    reconnect correctly?
15. What happens while credentials or PostgreSQL are unavailable?
16. Does the FUSE event-loop failure terminate the daemon rather than park forever?
17. Do real Git, npm, compiler, and Claude workloads pass fault injection and
    performance gates?

## Verification Status

Verified in the current implementation:

- the OpenShell pin is imported under `vendor/openshell` with provenance metadata;
- the default-off FUSE resource, policy, Docker gate, inherited-fd path, readiness,
  critical-child handling, and gateway restart mapping compile and pass focused tests;
- `openrind-shell-fused` runs through OpenShell's hardened child path and mandatory CONNECT
  proxy;
- the normalized chunked schema passes eight live filesystem conformance checks;
- Docker automatic restart reconstructs the mount, advances the lease epoch, returns
  the sandbox to Ready, and preserves fsynced data;
- delete/recreate with the same workspace restores the mounted volume;
- real Claude Code has written through `/sandbox/work` and that write restored from
  PostgreSQL in a replacement sandbox.

Not yet complete:

- automatic recovery from an alive-but-deadlocked daemon is not part of v1;
- the normalized filesystem has not completed the published Supabase performance
  matrix and scale gates;
- retry exhaustion and explicit stop/start need inclusion in the repeatable release
  fault suite;
- upstream acceptance and a released FUSE image/CLI are pending;
- Podman, Kubernetes, and MicroVM are explicitly unsupported for v1.

## Final Recommendation

Continue hardening and reviewing the implemented first-class in-sandbox design in
FUSE-DESIGN.md. Keep scoped-sync and just-bash available outside the primary FUSE
sandbox until the new runtime passes durability, failure, performance, and release
gates. Do not
carry forward the historical whole-file schema, dual migration ownership, in-place
remount promise, or watcher/FUSE split persistence model.

Maintain the OpenShell capability from the recorded `vendor/openshell/` pin while
submitting the default-off patch upstream. Upstream rejection means carrying a
reviewable vendor patch, not weakening the design into user-controlled device or mount
configuration. A failed correctness or performance gate means scoped sync remains the
published stable default.
