# Openrind Shell

Run Claude Code inside an isolated OpenShell sandbox using the published image:

```text
ghcr.io/openrind/openrind-shell/sandbox:just-bash
```

No local source checkout or JavaScript toolchain is required for the normal user flow. Contributor workflows live in [BUILD.md](./BUILD.md).

## Prerequisites

- Docker is running.
- The [`openshell` CLI](https://github.com/NVIDIA/OpenShell-Community) is installed.
- `curl` is available for creating the optional Openrind Gateway presign.
- `ANTHROPIC_API_KEY` is set in the shell where you run `openshell`.
- `DATABASE_URL` points at an external PostgreSQL (Supabase, Neon, etc.). Openrind Shell has no embedded database — workspaces always live in PostgreSQL.

If you keep credentials in `.env`, load them first:

```bash
set -a
source .env
set +a
```

For Supabase, use the pooler connection string from **Project Settings -> Database -> Connection pooler**. It looks like:

```text
postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

Sensitive home credentials and config such as `.ssh`, `.aws`, `.git-credentials`, `.npmrc`, and keyrings are intentionally not persisted.

## Start Claude Code

```bash
export ANTHROPIC_API_KEY='sk-ant-...'
export DATABASE_URL='postgresql://...'

# Compatibility with .env files that use POSTGRES_URL.
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

printf '%s' "$DATABASE_URL" > /tmp/openrind-shell-db-url
chmod 600 /tmp/openrind-shell-db-url

openshell gateway start

openshell sandbox create --tty \
  --from ghcr.io/openrind/openrind-shell/sandbox:just-bash \
  --upload /tmp/openrind-shell-db-url:/sandbox/db-url \
  --provider claude --auto-providers \
  -- openrind-shell

rm -f /tmp/openrind-shell-db-url
```

The first Claude Code launch may ask you to choose a theme, accept the security notice, trust `/sandbox`, and confirm API usage billing. After that, Claude opens with `HOME=/home/agent` inside the sandbox.

Openrind Shell reads `/sandbox/db-url`, creates the `_openrind` schema, runs migrations, restores the persisted workspace into `/home/agent`, syncs changes during runtime, and does a final flush on shutdown. In Supabase, switch the Table Editor schema selector to `_openrind` to inspect the rows.

Reuse the same sandbox name on every machine, and point it at the same `DATABASE_URL`. Openrind Shell uses the OpenShell sandbox ID as the workspace ID, so `--name openrind-shell-claude` is what makes the same PostgreSQL-backed home restore after deletion or from another host.

Do not pass the database URL through an OpenShell generic provider. PostgreSQL is raw TCP, so the credential must be delivered by `--upload`.

## Add Openrind Gateway Tracking for Claude Code

Openrind Gateway is optional. It routes Claude Code API calls through a presigned proxy URL for token and cost metering.

```bash
export ANTHROPIC_API_KEY='sk-ant-...'
export OPENRIND_GATEWAY_API_KEY='sk-st-...'

OPENRIND_SHELL_INPUT="$(mktemp -d)"

curl -fsS https://app.openrind.com/v1/presign \
  -H "Authorization: Bearer $OPENRIND_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "client_api_key": "'"$ANTHROPIC_API_KEY"'",
    "path": ["/v1/messages"],
    "expires_in": -1,
    "max_uses": -1,
    "cost_limit": 10000000,
    "metadata": { "source": "openrind-shell-sandbox", "client": "claude-code", "labels": ["openrind-shell", "claude-code"] }
  }' \
  > "$OPENRIND_SHELL_INPUT/presign.json"

# Optional: combine PostgreSQL persistence in the same upload.
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [ -n "${DATABASE_URL:-}" ]; then
  printf '%s' "$DATABASE_URL" > "$OPENRIND_SHELL_INPUT/db-url"
fi

chmod -R go-rwx "$OPENRIND_SHELL_INPUT"

openshell provider create --name openrind-gateway --type generic \
  --credential "OPENRIND_GATEWAY_API_KEY=$OPENRIND_GATEWAY_API_KEY" \
  || openshell provider update openrind-gateway \
    --credential "OPENRIND_GATEWAY_API_KEY=$OPENRIND_GATEWAY_API_KEY"

openshell sandbox create --tty \
  --from ghcr.io/openrind/openrind-shell/sandbox:just-bash \
  --upload "$OPENRIND_SHELL_INPUT:/sandbox/openrind-shell-input" \
  --provider claude --auto-providers \
  -- openrind-shell

rm -rf "$OPENRIND_SHELL_INPUT"
```

Create the presign on the host. Inside OpenShell, provider secrets are placeholders; they work for HTTP headers but not as JSON body values for Openrind Gateway's `client_api_key`.

---

## Start OpenClaw

OpenClaw is an alternative AI coding agent that runs in the same image. The `openclaw` provider is what signals the sandbox to launch OpenClaw instead of Claude Code.

Create the provider once (this is the only one-time step — the provider persists in your OpenShell gateway):

```bash
openshell provider create --name openclaw --type generic \
  --credential "OPENRIND_SHELL_AGENT=openclaw" \
  || openshell provider update openclaw \
    --credential "OPENRIND_SHELL_AGENT=openclaw"
```

OpenClaw uses the same `_openrind` schema as Claude Code. Both `ANTHROPIC_API_KEY` and `DATABASE_URL` must be delivered as uploaded files — OpenShell provider credentials arrive as opaque placeholders that OpenClaw's gateway cannot resolve, and PostgreSQL is raw TCP that needs the literal connection string.

```bash
export ANTHROPIC_API_KEY='sk-ant-...'
export DATABASE_URL='postgresql://...'
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

OPENRIND_SHELL_INPUT="$(mktemp -d)"
printf '%s' "$ANTHROPIC_API_KEY" > "$OPENRIND_SHELL_INPUT/anthropic-api-key"
printf '%s' "$DATABASE_URL"      > "$OPENRIND_SHELL_INPUT/db-url"
chmod -R go-rwx "$OPENRIND_SHELL_INPUT"

openshell gateway start

openshell sandbox create --tty --name openrind-shell-openclaw \
  --from ghcr.io/openrind/openrind-shell/sandbox:just-bash \
  --upload "$OPENRIND_SHELL_INPUT:/sandbox/openrind-shell-input" \
  --provider openclaw --auto-providers \
  -- openrind-shell

rm -rf "$OPENRIND_SHELL_INPUT"
```

`setup.sh` reads `/sandbox/openrind-shell-input/anthropic-api-key`, writes it into `~/.openclaw/openclaw.json`, starts the openclaw gateway on `ws://127.0.0.1:18789`, waits for `/readyz`, then launches the OpenClaw TUI. Reuse `--name openrind-shell-openclaw` on every machine and point it at the same `DATABASE_URL` so the PostgreSQL-backed home restores after deletion or on another host.

> **If Claude Code launches instead of OpenClaw**, the `openclaw` provider was not created or was not passed. Run the `openshell provider create` command above (one-time) and ensure you pass `--provider openclaw` in the sandbox create command.

> **Note:** For Openrind Gateway cost tracking on OpenClaw, see [Add Openrind Gateway Tracking for OpenClaw](#add-openrind-gateway-tracking-for-openclaw).

## Add Openrind Gateway Tracking for OpenClaw

Openrind Gateway is optional. It routes OpenClaw's Anthropic API calls through a presigned proxy URL so token spend, COGS, and revenue land in your Openrind Gateway vendor portfolio under the `openclaw` label.

```bash
export ANTHROPIC_API_KEY='sk-ant-...'
export OPENRIND_GATEWAY_API_KEY='sk-st-...'
export DATABASE_URL='postgresql://...'
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

OPENRIND_SHELL_INPUT="$(mktemp -d)"

curl -fsS https://app.openrind.com/v1/presign \
  -H "Authorization: Bearer $OPENRIND_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "client_api_key": "'"$ANTHROPIC_API_KEY"'",
    "path": ["/v1/messages"],
    "expires_in": -1,
    "max_uses": -1,
    "cost_limit": 10000000,
    "metadata": { "source": "openrind-shell-sandbox", "client": "openclaw", "labels": ["openrind-shell", "openclaw"] }
  }' \
  > "$OPENRIND_SHELL_INPUT/presign.json"

printf '%s' "$ANTHROPIC_API_KEY" > "$OPENRIND_SHELL_INPUT/anthropic-api-key"
printf '%s' "$DATABASE_URL"      > "$OPENRIND_SHELL_INPUT/db-url"
chmod -R go-rwx "$OPENRIND_SHELL_INPUT"

openshell provider create --name openclaw --type generic \
  --credential "OPENRIND_SHELL_AGENT=openclaw" \
  || openshell provider update openclaw \
    --credential "OPENRIND_SHELL_AGENT=openclaw"

openshell sandbox create --tty --name openrind-shell-openclaw-openrind-gateway \
  --from ghcr.io/openrind/openrind-shell/sandbox:just-bash \
  --upload "$OPENRIND_SHELL_INPUT:/sandbox/openrind-shell-input" \
  --provider openclaw --auto-providers \
  -- openrind-shell

rm -rf "$OPENRIND_SHELL_INPUT"
```

Create the presign on the host. Inside OpenShell, provider secrets are placeholders; they work for HTTP headers but not as JSON body values for Openrind Gateway's `client_api_key`. The `metadata.labels: ["openrind-shell", "openclaw"]` field is what Openrind Gateway's vendor portfolio classifier reads, so OpenClaw usage shows up separately from Claude Code in your dashboard.

`setup.sh` reads the uploaded `presign.json`, exports `ANTHROPIC_BASE_URL` so the openclaw gateway routes all Anthropic traffic through the proxy, and writes the URL into `~/.openclaw/openclaw.json` so reconnect sessions also get the override. The real `ANTHROPIC_API_KEY` is still required — `openclaw onboard` writes it to `~/.openclaw/agents/main/agent/auth-profiles.json`, and the Openrind Gateway proxy ignores the inbound `x-api-key` because it authenticates via the token embedded in the proxy URL.

## Manage Sandboxes

```bash
openshell sandbox list
openshell sandbox connect <name>
openshell sandbox delete <name>
```

Run one-off commands through SSH config:

```bash
openshell sandbox ssh-config <name> > /tmp/openrind-shell-sandbox-ssh

ssh -F /tmp/openrind-shell-sandbox-ssh openshell-<name> \
  'HOME=/home/agent node /opt/openrind-shell/dist/bin/openrind-shell.js memory refresh'
```

Keep the `HOME=/home/agent` prefix. OpenShell SSH starts in `/sandbox`, while Openrind Shell state lives under `/home/agent`.

## Troubleshooting

**No active gateway / gateway not reachable** - run `openshell gateway start --recreate`. The `--recreate` flag handles a stopped or crashed gateway container without conflicts.

**Claude exits with `Input must be provided either through stdin or as a prompt argument`** - the command was run without an interactive terminal. Use a real terminal and keep `--tty` in the command.

**Claude says authentication failed** - set `ANTHROPIC_API_KEY` in the same shell that runs `openshell sandbox create`.

**Claude says credit balance is too low** - the Anthropic account for that key needs credits or billing enabled.

**Files disappear after `sandbox delete`** - PostgreSQL persistence was not enabled. Use the `/sandbox/db-url` upload flow above.

**OpenClaw hangs at `noodling…` and never responds** — the API key was not delivered to OpenClaw. The `openclaw` provider credential arrives as an opaque placeholder that OpenClaw cannot use directly. You must upload the real key as a file: include `anthropic-api-key` in the `openrind-shell-input` directory as shown in [Start OpenClaw](#start-openclaw).

**OpenClaw shows `Gateway: not reachable at ws://127.0.0.1:18789`** — the openclaw gateway failed to start before the TUI launched. Check `/tmp/openclaw-gateway.log` inside the sandbox (`openshell sandbox connect <name>` then `cat /tmp/openclaw-gateway.log`). The gateway stages 35 npm packages on first cold start and can take a few minutes; setup waits up to 10 minutes before giving up.

**`setup.sh: error: DATABASE_URL is required.`** — no PostgreSQL connection string was uploaded. Openrind Shell has no embedded fallback. Pass `--upload /tmp/openrind-shell-db-url:/sandbox/db-url` (or place `db-url` inside `/sandbox/openrind-shell-input/` for OpenClaw) as shown in [Start Claude Code](#start-claude-code) or [Start OpenClaw](#start-openclaw).

**Migration fails with `tunnel to ... denied - 403`** - the PostgreSQL host is not allowlisted in the image policy. Common Supabase pooler hosts are included. Other hosts require a custom image; see [BUILD.md](./BUILD.md#custom-postgresql-hosts).

**Migration fails with `EAI_AGAIN` or a placeholder-looking database URL** - do not use a generic `db` provider for PostgreSQL. Upload the connection string file with `--upload /tmp/openrind-shell-db-url:/sandbox/db-url`.

## Openrind Desktop

The [`openrind-desktop/`](./openrind-desktop) subdirectory is Openrind Desktop — our rebrand of the open-source [OpenWork](https://github.com/different-ai/openwork) project (the local-first desktop app and CLI for AI-assisted workflows, built on top of OpenCode).

Openrind Desktop provides sessions, live SSE streaming, permissions, templates, and a skills manager. The non-opensource `ee/` directory has been removed; everything here is MIT-licensed.

To restore dependencies after cloning, see [openrind-desktop/README.md](./openrind-desktop/README.md).

## Contributing

Architecture, image customization, source-development workflows, and tests are documented in [BUILD.md](./BUILD.md).


## Advanced Configurations & Edge Cases

### Configuration Profile 0: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 1: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 2: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 3: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 4: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 5: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 6: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 7: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 8: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 9: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 10: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 11: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 12: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 13: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 14: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 15: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 16: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 17: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 18: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 19: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 20: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 21: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 22: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 23: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 24: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 25: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 26: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 27: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 28: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 29: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 30: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 31: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 32: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 33: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 34: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 35: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 36: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 37: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 38: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 39: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 40: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 41: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 42: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 43: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 44: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 45: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 46: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 47: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 48: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 49: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 50: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 51: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 52: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 53: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 54: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 55: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 56: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 57: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 58: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 59: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 60: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 61: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 62: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 63: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 64: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 65: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 66: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 67: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 68: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 69: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 70: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 71: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 72: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 73: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 74: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 75: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 76: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 77: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 78: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 79: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 80: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 81: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 82: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 83: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 84: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 85: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 86: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 87: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 88: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 89: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 90: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 91: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 92: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 93: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 94: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 95: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 96: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 97: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 98: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 99: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 100: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 101: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 102: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 103: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 104: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 105: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 106: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 107: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 108: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 109: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 110: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 111: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 112: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 113: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 114: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 115: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 116: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 117: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 118: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 119: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 120: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 121: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 122: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 123: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 124: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 125: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 126: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 127: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 128: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 129: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 130: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 131: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 132: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 133: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 134: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 135: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 136: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 137: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 138: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 139: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 140: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 141: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 142: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 143: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 144: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 145: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 146: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 147: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 148: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 149: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 150: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 151: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 152: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 153: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 154: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 155: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 156: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 157: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 158: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 159: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 160: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 161: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 162: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 163: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 164: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 165: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 166: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 167: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 168: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 169: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 170: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 171: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 172: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 173: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 174: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 175: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 176: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 177: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 178: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 179: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 180: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 181: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 182: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 183: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 184: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 185: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 186: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 187: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 188: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 189: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 190: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 191: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 192: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 193: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 194: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 195: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 196: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 197: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 198: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 199: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 200: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 201: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 202: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 203: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 204: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 205: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 206: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 207: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 208: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 209: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 210: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 211: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 212: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 213: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 214: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 215: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 216: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 217: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 218: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 219: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 220: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 221: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 222: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 223: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 224: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 225: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 226: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 227: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 228: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 229: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 230: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 231: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 232: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 233: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 234: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 235: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 236: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 237: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 238: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 239: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 240: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 241: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 242: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 243: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 244: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 245: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 246: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 247: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 248: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 249: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 250: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 251: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 252: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 253: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 254: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 255: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 256: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 257: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 258: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 259: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 260: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 261: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 262: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 263: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 264: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 265: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 266: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 267: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 268: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 269: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 270: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 271: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 272: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 273: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 274: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 275: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 276: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 277: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 278: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 279: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 280: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 281: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 282: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 283: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 284: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 285: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 286: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 287: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 288: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 289: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 290: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 291: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 292: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 293: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 294: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 295: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 296: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 297: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 298: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

### Configuration Profile 299: Enterprise Sandbox Constraints
In this configuration profile, the sandbox operates in a strictly locked-down network environment. Egress is limited to pre-approved AI provider endpoints. You must configure the `policy.yaml` to specifically allow out-bound traffic to your internal gateway while denying all standard internet routing. This ensures that the agent cannot exfiltrate generated code or proprietary logic.

