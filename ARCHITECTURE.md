# Architecture

## Sandbox Lifecycle

OpenEral follows OpenShell's actual process model. The container entrypoint is the
OpenShell supervisor, not the image command. The trailing command in
`openshell sandbox create ... -- openeral-init` is executed later over SSH, after
the sandbox is Ready.

```
openshell sandbox create ... -- openeral-init
  |
  |-- OpenShell supervisor starts the sandbox workload (`sleep infinity`)
  |-- OpenShell uploads `/sandbox/db-url` or `/sandbox/openeral-input/*`
  `-- SSH session runs `openeral-init`
        |
        |-- resolve PostgreSQL and StringCost inputs
        |-- run migrations and seed `_openeral`
        |-- hydrate `/home/agent/.claude/**` and `/home/agent/.openeral/**`
        |   only when the init marker is missing or stale
        |-- reapply StringCost settings after hydration
        |-- write `/tmp/openeral/init.done`
        `-- exit
```

`openeral-init` is intentionally one-shot. It does not start Claude and does not
own long-running processes.

## Runtime Path

Users start Claude from a normal connected OpenShell shell:

```
openshell sandbox connect <name>
claude
```

`/usr/local/bin/claude` is an OpenEral wrapper around `claude-real`:

```
claude wrapper
  |
  |-- source `/tmp/openeral-session.env`
  |-- run `openeral init --ensure`
  |-- run `openeral-daemon-ensure`
  |-- start `claude-real` as a child process
  `-- flush pending sync with `openeral-bash --flush` after Claude exits
```

`openeral-daemon-ensure` lazily starts a detached daemon when needed by `claude`,
`pg`, or `openeral memory refresh`.

```
/usr/bin/node /opt/openeral/openeral-bash.mjs --daemon
  |
  |-- owns the warm PostgreSQL or PGlite connection
  |-- serves `/tmp/openeral-bash.sock`
  |-- executes the `pg` helper
  |-- runs scoped file watchers in external PostgreSQL mode
  `-- performs best-effort final sync on daemon shutdown
```

The daemon survives SSH disconnects and Claude exits. It does not survive forced
sandbox deletion; users should exit Claude cleanly before deleting a sandbox when
they need the last writes to be durable.

## Persistence Boundary

Only Claude and OpenEral state are persisted to PostgreSQL:

```
/home/agent/.claude/**    <--> _openeral.workspace_files
/home/agent/.openeral/**  <--> _openeral.workspace_files

/home/agent/src/**        ephemeral container disk
/sandbox/**               sandbox-local runtime files
/tmp/openeral/**          runtime state, marker, DB URL, PGlite data
```

The sync layer is prefix-scoped. Startup hydration uses PostgreSQL to populate only
`/.claude` and `/.openeral`. Watchers later push changes under those same prefixes
back to PostgreSQL. Source checkouts and arbitrary files outside those prefixes are
not persisted.

Without `DATABASE_URL`, OpenEral uses embedded PGlite under `/tmp/openeral/data`
inside the sandbox. That state lasts only for the running sandbox lifetime.

## Library Path

The just-bash virtual filesystem still exists for custom agents and host-side
library use:

```
createOpeneralShell()
  |
  |-- /db         -> PgFs, read-only database browsing
  |-- /home/agent -> WorkspaceFs, SQL-backed virtual workspace
  `-- /tmp        -> InMemoryFs
```

Claude Code in the OpenShell sandbox does not run on this virtual filesystem path.
It uses real `/bin/bash`, real kernel files, and the sync daemon for persistence.

## Database Schema

OpenEral stores operational state in the `_openeral` schema:

- `workspace_config` stores workspace metadata.
- `workspace_files` stores persisted file content and metadata.
- `schema_version`, `mount_log`, `cache_hints`, and optimization tables support migrations, diagnostics, and analysis.

Migrations are idempotent and run during `openeral-init`.
