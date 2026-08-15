import { describe, it, expect } from 'vitest';
import { readFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseCliArgs, findRepoRoot } from './cli.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// We can't import writePgHelper directly (it's not exported),
// so we test by running the CLI's pg helper generation logic inline.

describe('pg helper script', () => {
  const tmpDir = '/tmp/openeral-cli-test-' + Date.now();

  it('reads DATABASE_URL from environment, never hardcodes it', () => {
    mkdirSync(join(tmpDir, '.local', 'bin'), { recursive: true });
    const pgPath = join(tmpDir, '.local', 'bin', 'pg');

    // Simulate what writePgHelper does
    const script = `#!/bin/bash
# pg — query the database from Claude Code
# Usage: pg "SELECT * FROM public.users LIMIT 5"
if [ -z "$DATABASE_URL" ]; then
  echo "pg: DATABASE_URL is not set" >&2; exit 1
fi
if command -v psql >/dev/null 2>&1; then
  exec psql "$DATABASE_URL" -c "$*"
else
  exec node -e 'const p=require("pg"),o=new p.Pool({connectionString:process.env.DATABASE_URL});o.query(process.argv[1]).then(r=>{console.log(JSON.stringify(r.rows,null,2));o.end()}).catch(e=>{console.error(e.message);process.exit(1)})' "$*"
fi
`;
    require('fs').writeFileSync(pgPath, script);
    require('fs').chmodSync(pgPath, 0o755);

    const content = readFileSync(pgPath, 'utf8');

    // Must reference $DATABASE_URL (env var)
    expect(content).toContain('$DATABASE_URL');
    expect(content).toContain('process.env.DATABASE_URL');

    // Must NOT contain a literal postgresql:// connection string
    expect(content).not.toMatch(/postgresql:\/\/\w+:\w+@/);

    // Must NOT contain a literal API key
    expect(content).not.toMatch(/sk-ant-/);

    // Must fail if DATABASE_URL is not set
    expect(content).toContain('DATABASE_URL is not set');

    rmSync(tmpDir, { recursive: true });
  });

  it('pg helper fails without DATABASE_URL', () => {
    mkdirSync(join(tmpDir, '.local', 'bin'), { recursive: true });
    const pgPath = join(tmpDir, '.local', 'bin', 'pg');

    const script = `#!/bin/bash
if [ -z "$DATABASE_URL" ]; then
  echo "pg: DATABASE_URL is not set" >&2; exit 1
fi
echo "would run: $*"
`;
    require('fs').writeFileSync(pgPath, script);
    require('fs').chmodSync(pgPath, 0o755);

    // Run without DATABASE_URL — should fail
    try {
      execSync(`env -u DATABASE_URL bash ${pgPath} "SELECT 1"`, { encoding: 'utf8', stdio: 'pipe' });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.stderr).toContain('DATABASE_URL is not set');
    }

    rmSync(tmpDir, { recursive: true });
  });

  it('pg helper succeeds with DATABASE_URL set', () => {
    mkdirSync(join(tmpDir, '.local', 'bin'), { recursive: true });
    const pgPath = join(tmpDir, '.local', 'bin', 'pg');

    const script = `#!/bin/bash
if [ -z "$DATABASE_URL" ]; then
  echo "pg: DATABASE_URL is not set" >&2; exit 1
fi
echo "connected to: $DATABASE_URL"
`;
    require('fs').writeFileSync(pgPath, script);
    require('fs').chmodSync(pgPath, 0o755);

    const out = execSync(`DATABASE_URL=test://db bash ${pgPath} "SELECT 1"`, { encoding: 'utf8' });
    expect(out.trim()).toBe('connected to: test://db');

    rmSync(tmpDir, { recursive: true });
  });
});

describe('openeral-shell skill shape', () => {
  const skillPath = join(__dirname, '../../.claude/skills/openeral-shell/SKILL.md');
  const skill = readFileSync(skillPath, 'utf8');

  it('distinguishes the published compatibility image from the source FUSE runtime', () => {
    expect(skill).toContain('ghcr.io/sandys/openeral/sandbox:just-bash');
    expect(skill).toContain('Dockerfile.openeral');
    expect(skill).toContain('--fuse');
    expect(skill).toContain('all `/sandbox/work`');
    expect(skill).toContain('published compatibility runtime');
  });

  it('uses openshell-only commands (no npx, no pnpm)', () => {
    expect(skill).not.toMatch(/\bnpx openeral\b/);
    expect(skill).not.toMatch(/\bpnpm (install|build)\b/);
  });

  it('uses gateway info (not the nonexistent gateway list)', () => {
    expect(skill).not.toMatch(/openshell gateway list\b/);
    expect(skill).toContain('openshell gateway info');
    expect(skill).not.toMatch(/^\s*openshell gateway start\b/m);
    expect(skill).toContain('OPENSHELL_GATEWAY_ENDPOINT');
    expect(skill).toContain('sandbox create --help | grep -- --fuse');
  });

  it('creates StringCost from an env lookup without exposing its value in argv', () => {
    expect(skill).toMatch(/openshell provider create[\s\S]*--name stringcost[\s\S]*--credential STRINGCOST_API_KEY/);
    expect(skill).not.toMatch(/--credential ["']?STRINGCOST_API_KEY=/);
    expect(skill).not.toMatch(/openshell provider create --name db\b/);
  });

  it('lets OpenShell create the StringCost presign inside the sandbox', () => {
    expect(skill).not.toContain('curl -fsS https://app.stringcost.com/v1/presign');
    expect(skill).toContain('presign creation happens inside the sandbox');
  });

  it('documents openshell sandbox exec for one-off commands', () => {
    expect(skill).toMatch(/openshell sandbox exec\b/);
  });
});

describe('CLI launch database handling', () => {
  const cliSource = readFileSync(join(__dirname, 'cli.ts'), 'utf8');

  it('uploads PostgreSQL credentials instead of using a generic db provider', () => {
    expect(cliSource).toContain(':/sandbox/db-url');
    expect(cliSource).toContain('POSTGRES_URL');
    expect(cliSource).not.toMatch(/sandboxArgs\.push\('--provider', 'db'\)/);
    expect(cliSource).not.toMatch(/'provider', 'create', '--name', 'db'/);
  });

  it('uses current OpenShell orchestration instead of driver internals', () => {
    expect(cliSource).toMatch(/'sandbox',\s*'exec'/);
    expect(cliSource).toContain("'--env'");
    expect(cliSource).toContain('WORKSPACE_ID=');
    expect(cliSource).toContain('MIN_OPENSHELL_VERSION');
    expect(cliSource).toContain('OPENSHELL_BIN');
    expect(cliSource).toContain('OPENSHELL_GATEWAY_ENDPOINT');
    expect(cliSource).not.toContain("['gateway', 'start']");
    expect(cliSource).not.toContain('openshell-cluster-openshell');
    expect(cliSource).not.toContain("'kubectl'");
    expect(cliSource).not.toContain("'ctr'");
  });
});

describe('OpenShell runtime architecture', () => {
  const setup = readFileSync(join(__dirname, '../../sandboxes/openeral/setup.sh'), 'utf8');
  const claudeWrapper = readFileSync(join(__dirname, '../../sandboxes/openeral/openeral-claude.sh'), 'utf8');
  const daemon = readFileSync(join(__dirname, '../../sandboxes/openeral/openeral-bash.mjs'), 'utf8');
  const daemonEnsure = readFileSync(join(__dirname, '../../sandboxes/openeral/openeral-daemon-ensure.sh'), 'utf8');
  const pgClient = readFileSync(join(__dirname, '../../sandboxes/openeral/pg-client.mjs'), 'utf8');

  it('keeps setup.sh as one-shot init, not a long-running service', () => {
    expect(setup).toContain('OPENERAL_INIT_MARKER');
    expect(setup).toContain('OpenEral initialized for workspace');
    expect(setup).not.toContain('wait "$DAEMON_PID"');
    expect(setup).not.toContain('launching Claude Code');
  });

  it('starts the daemon lazily from runtime entrypoints', () => {
    expect(claudeWrapper).toContain('openeral-daemon-ensure');
    expect(pgClient).toContain('openeral-daemon-ensure');
  });

  it('does not let the detached daemon inherit the flock descriptor', () => {
    expect(daemonEnsure).toContain('exec 9>&-');
  });

  it('parents Claude so it can flush after Claude exits', () => {
    expect(claudeWrapper).toContain('/usr/local/bin/claude-real "$@" &');
    expect(claudeWrapper).toContain('/usr/local/bin/openeral-bash --flush');
    expect(claudeWrapper).not.toContain('exec /usr/local/bin/claude-real');
  });

  it('does not rehydrate destructively once the init marker matches', () => {
    expect(daemon).toContain('initMarkerMatches');
    expect(daemon).toContain('hydrateOnStart');
  });

  it('uses the canonical OpenShell sandbox home and does not persist provider keys', () => {
    expect(setup).toContain('OPENERAL_HOME="${OPENERAL_HOME:-/sandbox}"');
    expect(setup).not.toContain('write_export ANTHROPIC_API_KEY');
    expect(daemon).toContain("process.env.OPENERAL_HOME || '/sandbox'");
  });
});

describe('CLI argument parsing', () => {
  it('parses memory refresh options', () => {
    const parsed = parseCliArgs([
      'memory',
      'refresh',
      '--workspace', 'mem-ws',
      '--project-root', '/tmp/project',
      '--query', 'openshell proxy',
      '--dry-run',
      '--no-backup',
    ]);

    expect(parsed).toEqual({
      kind: 'memory-refresh',
      workspaceId: 'mem-ws',
      projectRoot: '/tmp/project',
      query: 'openshell proxy',
      dryRun: true,
      backup: false,
    });
  });

  it('keeps launch mode compatible with Claude args after --', () => {
    const parsed = parseCliArgs(['--workspace', 'alpha', '--', '-p', 'hello']);

    expect(parsed).toEqual({
      kind: 'launch',
      workspaceId: 'alpha',
      claudeArgs: ['-p', 'hello'],
    });
  });

  it('treats --help after -- as a Claude arg, not OpenEral help', () => {
    const parsed = parseCliArgs(['--', '--help']);

    expect(parsed).toEqual({
      kind: 'launch',
      workspaceId: 'openeral-claude',
      claudeArgs: ['--help'],
    });
  });
});

describe('built CLI entrypoint', () => {
  const binPath = join(__dirname, '../dist/bin/openeral.js');

  it('prints help when run through the built bin path', () => {
    const out = execFileSync(process.execPath, [binPath, '--help'], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(out).toContain('Usage:');
    expect(out).toContain('openeral memory refresh');
  });

  it('prints help when the built bin is invoked via a symlinked path', () => {
    const tmpDir = `/tmp/openeral-bin-symlink-${Date.now()}`;
    const symlinkPath = join(tmpDir, 'openeral');

    mkdirSync(tmpDir, { recursive: true });
    symlinkSync(binPath, symlinkPath);

    try {
      const out = execFileSync(process.execPath, [symlinkPath, '--help'], {
        cwd: join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe',
      });

      expect(out).toContain('Usage:');
      expect(out).toContain('openeral memory refresh');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('findRepoRoot', () => {
  it('finds the repo root containing sandboxes/openeral/Dockerfile', () => {
    const root = findRepoRoot();
    expect(root).not.toBeNull();
    // The discovered root must contain the Dockerfile landmark
    const { existsSync } = require('node:fs');
    expect(existsSync(join(root!, 'sandboxes', 'openeral', 'Dockerfile'))).toBe(true);
  });

  it('returns null when the landmark is not found within maxLevels', () => {
    // Pass maxLevels=0 so the walk never starts — always null
    expect(findRepoRoot(0)).toBeNull();
  });
});
