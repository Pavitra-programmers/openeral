# CLAUDE.md

## Documentation Layout

- \`README.md\` is the end-user OpenShell flow. Keep package-manager commands out.
- \`BUILD.md\` is the contributor build, test, and local-gateway guide.
- \`ARCHITECTURE.md\` describes the implemented runtime split and security boundary.
- \`FUSE.md\` records alternatives and source research.
- \`FUSE-DESIGN.md\` is the detailed FUSE correctness contract.

Public names use **Openrind Shell** and \`openrind-shell\`. Historical source paths,
Cargo package names, legacy aliases, and the \`_openeral\` PostgreSQL schema remain
until an explicit compatibility migration exists.

## Runtime Split

\`\`\`mermaid
flowchart LR
  primary["Primary FUSE image"] --> mount["/sandbox/work<br/>all files persisted"]
  mount --> normalized[("_openeral.fs_*")]

  compat["Compatibility image"] --> watcher["Scoped watcher only"]
  watcher --> legacy[("_openeral.workspace_files")]

  custom["Custom-agent library"] --> justbash["createOpenrindShell<br/>WorkspaceFs + /db PgFs"]
\`\`\`

- Primary FUSE requires external PostgreSQL and the patched OpenShell Docker driver.
- Compatibility supports optional PostgreSQL or sandbox-lifetime PGlite.
- \`sync.ts\` is compatibility-only. Never watch or mirror \`/sandbox/work\`.
- Claude uses native bash in both images. \`/db\` is custom-agent-only.

## Build And Test

\`\`\`bash
cd openeral-js
pnpm install
pnpm check

cd ..
cargo fmt --all --check
cargo test -p openeral-fused
cargo clippy -p openeral-fused --all-targets -- -D warnings

cd vendor/openshell
cargo fmt --all --check
cargo check -p openshell-cli -p openshell-driver-docker \
  -p openshell-policy -p openshell-supervisor-process
\`\`\`

Docker and live tests:

\`\`\`bash
docker build --pull=false -f Dockerfile.openrind-shell -t openrind-shell-fuse:local .
docker build --pull=false -f Dockerfile.openrind-shell-compat -t openrind-shell-compat:local .

DATABASE_URL='...' tests/test_sandbox_e2e.sh
DATABASE_URL='...' tests/test_setup_e2e.sh

DATABASE_URL='...' \
OPENSHELL_GATEWAY_ENDPOINT='http://127.0.0.1:18770' \
OPENRIND_SHELL_FUSE_E2E_IMAGE='openrind-shell-fuse:local' \
tests/fuse/test_openshell_e2e.sh
\`\`\`

Do not rebuild NVIDIA's Community base to solve an image-resolution problem.

## Project Structure

\`\`\`text
crates/openeral-fused/       primary PostgreSQL FUSE daemon
openeral-js/                 migrations, CLI, compatibility sync, just-bash library
sandboxes/openeral/          image scripts and shared policy
vendor/openshell/            pinned OpenShell FUSE capability patch
tests/fuse/                  POSIX conformance and real OpenShell FUSE E2E
.claude/skills/openrind-*/   repository operating skills
\`\`\`

## Hard Rules

- Keep the supervisor-owned mount and critical-child lifecycle intact.
- Never give Claude \`/dev/fuse\`, mount syscalls, mount capability, or daemon choice.
- Never add a direct PostgreSQL dialing or TLS-disable fallback to the FUSE daemon.
- TypeScript owns migrations/import; Rust validates schema and volume state.
- Lease loss is terminal; a fenced process discards dirty state and exits.
- Preserve rename-replace, \`O_TRUNC\`, fsync, sparse-file, and open-unlinked semantics.
- Keep compatibility sync prefix-scoped and exclude credential/cache paths.
- Do not rename \`_openeral\` without a tested in-place data migration.
- Never hardcode credentials or print database URLs/provider keys.
- Ignore generated artifacts through \`.gitignore\`, not selective commit omission.
- Never delete, move, or overwrite user files without explicit permission.

## Commit Style

Use descriptive imperative commit subjects. Do not amend unless explicitly requested.
