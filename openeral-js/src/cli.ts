#!/usr/bin/env node

/**
 * openeral CLI — run Claude Code with persistent PostgreSQL-backed home.
 *
 * Usage:
 *   npx openeral                      # interactive Claude Code
 *   npx openeral -- -p 'hello'        # non-interactive
 *   npx openeral --workspace myid     # custom workspace ID
 *
 * Required env:
 *   DATABASE_URL          PostgreSQL connection string
 *   ANTHROPIC_API_KEY     Claude API key
 *
 * Optional env:
 *   OPENERAL_WORKSPACE_ID   Workspace ID (default: hostname)
 *   OPENERAL_HOME           Home directory path (default: /tmp/openeral-<id>)
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import { createPool } from './db/pool.js';
import { runMigrations } from './db/migrations.js';
import { refreshClaudeMemory } from './memory/refresh.js';
import { analyzeClaudeOptimization } from './optimizer/analyze.js';
import { applyClaudeOptimization } from './optimizer/apply.js';
import { renderOptimizationReport } from './optimizer/render.js';
import { buildOpeneralSessionId } from './stringcost.js';
import { syncToFs, syncFromFs, watchAndSync } from './sync.js';

function writePgHelper(path: string): void {
  // pg helper reads DATABASE_URL from the environment at runtime.
  // Never hardcode credentials — rely on env propagation from OpenShell providers.
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
  writeFileSync(path, script);
  chmodSync(path, 0o755);
}

type ParsedArgs =
  | { kind: 'launch'; workspaceId: string; claudeArgs: string[] }
  | { kind: 'memory-refresh'; workspaceId: string; projectRoot: string; query: string; dryRun: boolean; backup: boolean; json: boolean }
  | { kind: 'optimize-analyze'; workspaceId: string; projectRoot: string; json: boolean }
  | { kind: 'optimize-apply'; workspaceId: string; projectRoot: string; dryRun: boolean; backup: boolean; json: boolean }
  | { kind: 'help' };

function defaultWorkspaceId(): string {
  return process.env.OPENERAL_WORKSPACE_ID || hostname();
}

function defaultHomeDir(workspaceId: string): string {
  return process.env.OPENERAL_HOME || `/tmp/openeral-${workspaceId}`;
}

function normalizeProjectRoot(value: string): string | undefined {
  return value.trim() ? value : undefined;
}

function readOptimizerMode(): 'analyze' | 'apply' | 'off' {
  const raw = (process.env.OPENERAL_OPTIMIZER || 'analyze').trim().toLowerCase();
  if (raw === 'apply') return 'apply';
  if (raw === 'off') return 'off';
  return 'analyze';
}

async function ensurePersistentWorkspace(
  databaseUrl: string,
  workspaceId: string,
  homeDir: string,
): Promise<pg.Pool> {
  const pool = createPool(databaseUrl);

  process.stderr.write('\x1b[2mopeneral: running migrations...\x1b[0m\n');
  await runMigrations(pool);

  await pool.query(
    `INSERT INTO _openeral.workspace_config (id, display_name, config)
     VALUES ($1, $2, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [workspaceId, workspaceId],
  );

  process.stderr.write('\x1b[2mopeneral: syncing workspace...\x1b[0m\n');
  const synced = await syncToFs(pool, workspaceId, homeDir);
  process.stderr.write(`\x1b[2mopeneral: restored ${synced} files\x1b[0m\n`);

  const pgHelper = join(homeDir, '.local', 'bin', 'pg');
  mkdirSync(join(homeDir, '.local', 'bin'), { recursive: true });
  writePgHelper(pgHelper);

  const claudeMdPath = join(homeDir, 'CLAUDE.md');
  if (!existsSync(claudeMdPath)) {
    writeFileSync(claudeMdPath, `# OpenEral

Your home directory persists across sessions.

## Database

Query the connected database:

    pg "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    pg "SELECT * FROM public.users LIMIT 5"
    pg "\\d public.users"

The \`pg\` command uses psql if available, otherwise Node.js pg.
`);
  }

  return pool;
}

async function savePersistentWorkspace(
  pool: pg.Pool,
  workspaceId: string,
  homeDir: string,
): Promise<void> {
  process.stderr.write('\n\x1b[2mopeneral: saving workspace...\x1b[0m\n');
  try {
    const saved = await syncFromFs(pool, workspaceId, homeDir);
    process.stderr.write(`\x1b[2mopeneral: saved ${saved} files\x1b[0m\n`);
  } catch (err: any) {
    process.stderr.write(`\x1b[31mopeneral: sync failed: ${err.message}\x1b[0m\n`);
  }
}

function printOptimizationSummary(
  report: ReturnType<typeof analyzeClaudeOptimization>,
  opts?: { mode?: 'analyze' | 'apply' },
): void {
  const leadFinding = report.findings[0];
  const summary = `\x1b[2mopeneral: optimizer static prompt ~${report.summary.staticPromptTokens} tokens; findings ${report.findings.length}; cache ${report.summary.cacheReady ? 'ready' : 'review'}\x1b[0m\n`;
  process.stderr.write(summary);
  if (opts?.mode === 'apply') {
    process.stderr.write('\x1b[2mopeneral: optimizer refreshed Claude memory and saved updated optimizer reports\x1b[0m\n');
  }
  if (leadFinding) {
    process.stderr.write(`\x1b[2mopeneral: optimizer top finding — ${leadFinding.title}\x1b[0m\n`);
  }
}

export function parseCliArgs(args: string[]): ParsedArgs {
  // Check for help
  if (args.includes('--help') || args.includes('-h')) {
    // Only show help if it's before --
    const dashIdx = args.indexOf('--');
    const helpIdx = Math.max(args.indexOf('--help'), args.indexOf('-h'));
    if (dashIdx === -1 || helpIdx < dashIdx) {
      return { kind: 'help' };
    }
  }

  // Check for memory refresh command
  if (args[0] === 'memory' && args[1] === 'refresh') {
    let workspaceId = defaultWorkspaceId();
    let projectRoot = '';
    let query = '';
    let dryRun = false;
    let backup = true;
    let json = false;

    for (let i = 2; i < args.length; i++) {
      if ((args[i] === '--workspace' || args[i] === '-w') && args[i + 1]) {
        workspaceId = args[++i];
      } else if (args[i] === '--project-root' && args[i + 1]) {
        projectRoot = args[++i];
      } else if (args[i] === '--query' && args[i + 1]) {
        query = args[++i];
      } else if (args[i] === '--dry-run') {
        dryRun = true;
      } else if (args[i] === '--no-backup') {
        backup = false;
      } else if (args[i] === '--json') {
        json = true;
      }
    }

    return { kind: 'memory-refresh', workspaceId, projectRoot, query, dryRun, backup, json };
  }

  if (args[0] === 'optimize' && args[1] === 'analyze') {
    let workspaceId = defaultWorkspaceId();
    let projectRoot = '';
    let json = false;

    for (let i = 2; i < args.length; i++) {
      if ((args[i] === '--workspace' || args[i] === '-w') && args[i + 1]) {
        workspaceId = args[++i];
      } else if (args[i] === '--project-root' && args[i + 1]) {
        projectRoot = args[++i];
      } else if (args[i] === '--json') {
        json = true;
      }
    }

    return { kind: 'optimize-analyze', workspaceId, projectRoot, json };
  }

  if (args[0] === 'optimize' && args[1] === 'apply') {
    let workspaceId = defaultWorkspaceId();
    let projectRoot = '';
    let dryRun = false;
    let backup = true;
    let json = false;

    for (let i = 2; i < args.length; i++) {
      if ((args[i] === '--workspace' || args[i] === '-w') && args[i + 1]) {
        workspaceId = args[++i];
      } else if (args[i] === '--project-root' && args[i + 1]) {
        projectRoot = args[++i];
      } else if (args[i] === '--dry-run') {
        dryRun = true;
      } else if (args[i] === '--no-backup') {
        backup = false;
      } else if (args[i] === '--json') {
        json = true;
      }
    }

    return { kind: 'optimize-apply', workspaceId, projectRoot, dryRun, backup, json };
  }

  // Default: launch mode
  let workspaceId = defaultWorkspaceId();
  let claudeArgs: string[] = [];

  // Split on -- to separate openeral args from claude args
  const dashIdx = args.indexOf('--');
  const ownArgs = dashIdx >= 0 ? args.slice(0, dashIdx) : args;
  claudeArgs = dashIdx >= 0 ? args.slice(dashIdx + 1) : [];

  for (let i = 0; i < ownArgs.length; i++) {
    if ((ownArgs[i] === '--workspace' || ownArgs[i] === '-w') && ownArgs[i + 1]) {
      workspaceId = ownArgs[++i];
    }
  }

  return { kind: 'launch', workspaceId, claudeArgs };
}

function printHelp(): void {
  console.log(`Usage:
  openeral [options] [-- claude-args]    Launch Claude Code with persistent home
  openeral memory refresh [options]      Refresh memory system
  openeral optimize analyze [options]    Audit Claude prompt/token efficiency
  openeral optimize apply [options]      Write optimizer memory + reports

Launch Options:
  --workspace, -w <id>    Workspace ID (default: hostname)
  --help, -h              Show this help

Memory Refresh Options:
  --workspace, -w <id>    Workspace ID
  --project-root <path>   Project root directory
  --query <text>          Search query
  --dry-run               Preview changes without applying
  --no-backup             Skip backup creation
  --json                  Emit JSON instead of text

Optimize Analyze Options:
  --workspace, -w <id>    Workspace ID
  --project-root <path>   Project root directory
  --json                  Emit JSON instead of text

Optimize Apply Options:
  --workspace, -w <id>    Workspace ID
  --project-root <path>   Project root directory
  --dry-run               Preview changes without applying
  --no-backup             Skip backup creation
  --json                  Emit JSON instead of text

Environment Variables:
  DATABASE_URL            PostgreSQL connection string (required for persistence)
  ANTHROPIC_API_KEY       Claude API key (required)
  STRINGCOST_API_KEY      Enables Stringcost tracking + optimizer metadata
  OPENERAL_WORKSPACE_ID   Default workspace ID
  OPENERAL_HOME           Home directory path
  OPENERAL_OPTIMIZER      analyze | apply | off (default: analyze)
`);
}

export async function main() {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.kind === 'help') {
    printHelp();
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const persistenceEnabled = !!databaseUrl;
  const homeDir = defaultHomeDir(parsed.workspaceId);
  mkdirSync(homeDir, { recursive: true });

  let pool: pg.Pool | null = null;
  if (databaseUrl) {
    pool = await ensurePersistentWorkspace(databaseUrl, parsed.workspaceId, homeDir);
  }

  if (parsed.kind === 'memory-refresh') {
    const result = await refreshClaudeMemory({
      homeDir,
      cwd: process.cwd(),
      projectRoot: normalizeProjectRoot(parsed.projectRoot),
      query: parsed.query,
      dryRun: parsed.dryRun,
      backup: parsed.backup,
    });

    if (pool) {
      if (!parsed.dryRun) {
        await savePersistentWorkspace(pool, parsed.workspaceId, homeDir);
      }
      await pool.end();
      pool = null;
    }

    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`mode=${result.mode}`);
      console.log(`memory_dir=${result.context.memoryDir}`);
      console.log(`planned_files=${result.plannedFiles.join(',')}`);
      if (result.backupDir) console.log(`backup_dir=${result.backupDir}`);
    }
    return;
  }

  if (parsed.kind === 'optimize-analyze') {
    const sessionId = buildOpeneralSessionId(parsed.workspaceId);
    const report = analyzeClaudeOptimization({
      homeDir,
      cwd: process.cwd(),
      projectRoot: normalizeProjectRoot(parsed.projectRoot),
      workspaceId: parsed.workspaceId,
      sessionId,
      stringcostEnabled: !!process.env.STRINGCOST_API_KEY,
    });

    if (pool) {
      await pool.end();
      pool = null;
    }

    if (parsed.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(renderOptimizationReport(report));
    }
    return;
  }

  if (parsed.kind === 'optimize-apply') {
    const sessionId = buildOpeneralSessionId(parsed.workspaceId);
    const result = await applyClaudeOptimization({
      homeDir,
      cwd: process.cwd(),
      projectRoot: normalizeProjectRoot(parsed.projectRoot),
      workspaceId: parsed.workspaceId,
      sessionId,
      stringcostEnabled: !!process.env.STRINGCOST_API_KEY,
      dryRun: parsed.dryRun,
      backup: parsed.backup,
    });

    if (pool) {
      if (!parsed.dryRun) {
        await savePersistentWorkspace(pool, parsed.workspaceId, homeDir);
      }
      await pool.end();
      pool = null;
    }

    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      process.stdout.write(renderOptimizationReport(result.report));
      if (!parsed.dryRun) {
        process.stdout.write(`report_markdown=${result.reportPaths.markdown}\n`);
        process.stdout.write(`report_json=${result.reportPaths.json}\n`);
      }
    }
    return;
  }

  const { workspaceId, claudeArgs } = parsed;

  if (!persistenceEnabled) {
    process.stderr.write(
      '\x1b[33mopeneral: DATABASE_URL not set — running without persistence\x1b[0m\n' +
      '\x1b[2m  Set DATABASE_URL to enable PostgreSQL-backed home directory\x1b[0m\n',
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write(
      '\x1b[33mopeneral: ANTHROPIC_API_KEY not set — Claude Code may not work\x1b[0m\n',
    );
  }

  process.stderr.write(`\x1b[2mopeneral: workspace  ${workspaceId}\x1b[0m\n`);
  process.stderr.write(`\x1b[2mopeneral: home       ${homeDir}\x1b[0m\n`);
  process.stderr.write(`\x1b[2mopeneral: persist    ${persistenceEnabled ? 'PostgreSQL' : 'local only'}\x1b[0m\n`);

  let stopWatch: (() => void) | null = null;
  let optimizationReport: ReturnType<typeof analyzeClaudeOptimization> | null = null;
  const optimizerMode = readOptimizerMode();

  if (optimizerMode !== 'off') {
    const sessionId = buildOpeneralSessionId(workspaceId);
    if (optimizerMode === 'apply') {
      const applied = await applyClaudeOptimization({
        homeDir,
        cwd: process.cwd(),
        workspaceId,
        sessionId,
        stringcostEnabled: !!process.env.STRINGCOST_API_KEY,
        backup: false,
      });
      optimizationReport = applied.report;
    } else {
      optimizationReport = analyzeClaudeOptimization({
        homeDir,
        cwd: process.cwd(),
        workspaceId,
        sessionId,
        stringcostEnabled: !!process.env.STRINGCOST_API_KEY,
      });
    }
    printOptimizationSummary(optimizationReport, { mode: optimizerMode });
    if (optimizationReport.findings.length > 0) {
      if (optimizerMode === 'apply') {
        process.stderr.write('\x1b[2mopeneral: run `openeral optimize analyze` if you want to inspect the current post-apply state again later\x1b[0m\n');
      } else {
        process.stderr.write('\x1b[2mopeneral: run `openeral optimize apply` to write curated memory and optimizer reports\x1b[0m\n');
      }
    }
  }

  if (pool) {
    process.stderr.write('\x1b[2mopeneral: watching for changes...\x1b[0m\n');
    stopWatch = watchAndSync(pool, workspaceId, homeDir);
  }

  // --- StringCost auto-presign ---
  // Build Claude environment from allowlist to avoid exposing unnecessary secrets
  const claudeEnv: Record<string, string | undefined> = {
    HOME: homeDir,
    PATH: `${join(homeDir, '.local', 'bin')}:${process.env.PATH}`,
    // Include required ANTHROPIC_* variables for Claude Code
    ...(process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {}),
    ...(process.env.ANTHROPIC_BASE_URL ? { ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL } : {}),
  };

  if (process.env.STRINGCOST_API_KEY && process.env.ANTHROPIC_API_KEY) {
    process.stderr.write('\x1b[2mopeneral: presigning with StringCost...\x1b[0m\n');
    try {
      // Use a 10-second timeout to prevent indefinite hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch('https://app.stringcost.com/v1/presign', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRINGCOST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'anthropic',
          client_api_key: process.env.ANTHROPIC_API_KEY,
          path: ['/v1/messages'],
          expires_in: -1,
          max_uses: -1,
          tags: optimizationReport?.stringcost.session.tags ?? ['openeral'],
          metadata: optimizationReport?.stringcost.session.metadata ?? { source: 'openeral' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { url?: string };
      if (data.url) {
        claudeEnv.ANTHROPIC_BASE_URL = data.url.replace(/\/v1\/.*$/, '');
        process.stderr.write('\x1b[2mopeneral: StringCost enabled — costs tracked automatically\x1b[0m\n');
      }
    } catch (err: any) {
      process.stderr.write(`\x1b[33mopeneral: StringCost presign failed: ${err.message} — continuing without cost tracking\x1b[0m\n`);
    }
  }

  // --- Launch Claude Code ---
  process.stderr.write('\x1b[2mopeneral: starting Claude Code\x1b[0m\n\n');

  const child = spawn('claude', claudeArgs, {
    stdio: 'inherit',
    env: claudeEnv,
  });

  child.on('error', (err: any) => {
    if (err.code === 'ENOENT') {
      process.stderr.write(
        '\x1b[31mopeneral: `claude` not found. Install Claude Code:\x1b[0m\n' +
        '  npm install -g @anthropic-ai/claude-code\n' +
        '  # or: curl -fsSL https://claude.ai/install.sh | bash\n\n',
      );
    } else {
      process.stderr.write(`openeral: ${err.message}\n`);
    }
    process.exit(1);
  });

  child.on('exit', async (code) => {
    if (pool && stopWatch) {
      stopWatch();
      await savePersistentWorkspace(pool, workspaceId, homeDir);
      await pool.end();
    }
    process.exit(code ?? 0);
  });

  // Forward signals to child
  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    process.on(sig, () => child.kill(sig));
  }
}

// Only run main if this is the entry point (not imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`\x1b[31mopeneral: ${err.message}\x1b[0m\n`);
    process.exit(1);
  });
}
