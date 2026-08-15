#!/usr/bin/env node

/**
 * openrind-shell-bash — long-lived compatibility daemon and bash client.
 *
 * Two modes:
 *
 *   --daemon     Start a persistent daemon on a Unix socket. The daemon holds
 *                the openeral shell instance (PostgreSQL connection, just-bash
 *                runtime) so each command doesn't pay startup cost.
 *
 *   -c <cmd>     Execute a single command. If the daemon is running, connects
 *                to it. Otherwise, falls back to per-invocation mode (creates
 *                a fresh shell, runs the command, exits).
 *
 * Claude Code runtime uses real /bin/bash. This daemon still powers the
 * `pg` helper, scoped PostgreSQL sync, and custom-agent / legacy just-bash paths.
 *
 * Database: uses getDatabaseConnection() which picks up external PostgreSQL
 * when DATABASE_URL is set, or starts embedded PGlite otherwise.
 */

import { createServer, createConnection } from 'node:net';
import { existsSync, unlinkSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOCKET_PATH = process.env.OPENRIND_SHELL_SOCKET
  || process.env.OPENERAL_SOCKET
  || '/tmp/openrind-shell-bash.sock';
const SYNC_PREFIXES = [
  { pathPrefix: '/.claude', pathPrefixKind: 'dir' },
  { pathPrefix: '/.openrind-shell', pathPrefixKind: 'dir' },
  { pathPrefix: '/.openeral', pathPrefixKind: 'dir' },
  { pathPrefix: '/.claude.json', pathPrefixKind: 'file' },
];
const SYNC_EXCLUDES = new Set([
  'node_modules',
  '.git',
  '.cache',
  '.openrind-shell-memory-backups',
  '.openeral-memory-backups',
]);
const DB_URL_FILE = process.env.OPENRIND_SHELL_DB_URL_FILE
  || process.env.OPENERAL_DB_URL_FILE
  || '/tmp/openrind-shell/database-url';
let syncMutex = Promise.resolve();

function runWithSyncMutex(fn) {
  const run = syncMutex.then(fn, fn);
  syncMutex = run.then(() => undefined, () => undefined);
  return run;
}

function formatError(err, label) {
  const error = err instanceof Error ? err : new Error(String(err));
  return `${label}: ${error.message}`;
}

function loadStoredDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  try {
    if (existsSync(DB_URL_FILE)) {
      const value = readFileSync(DB_URL_FILE, 'utf8').trim();
      if (value) process.env.DATABASE_URL = value;
    }
  } catch {}
}

function workspaceIdFromEnv() {
  return process.env.OPENRIND_SHELL_WORKSPACE_ID
    || process.env.OPENERAL_WORKSPACE_ID
    || process.env.WORKSPACE_ID
    || process.env.OPENSHELL_SANDBOX_ID
    || 'default';
}

function syncRootFromEnv() {
  return process.env.OPENRIND_SHELL_HOME || process.env.OPENERAL_HOME || '/sandbox';
}

async function runPgQuery(pool, sql) {
  if (!sql.trim()) {
    return { stdout: '', stderr: 'Usage: pg <SQL query>\n', exitCode: 1 };
  }
  try {
    const result = await pool.query(sql);
    return {
      stdout: JSON.stringify(result.rows, null, 2) + '\n',
      stderr: '',
      exitCode: 0,
    };
  } catch (err) {
    return {
      stdout: '',
      stderr: `pg error: ${err.message}\n`,
      exitCode: 1,
    };
  }
}

// ---------------------------------------------------------------------------
// Daemon mode
// ---------------------------------------------------------------------------

async function startDaemon() {
  loadStoredDatabaseUrl();
  const { initMarkerMatches } = await import('/opt/openrind-shell/dist/init-marker.js');
  const { createOpenrindShell } = await import('/opt/openrind-shell/dist/shell.js');
  const { getDatabaseConnection } = await import('/opt/openrind-shell/dist/db/embedded.js');
  const { syncToFs, syncFromFs, watchAndSync } = await import('/opt/openrind-shell/dist/sync.js');

  const workspaceId = workspaceIdFromEnv();
  const syncRoot = syncRootFromEnv();
  const enableSync = (
    process.env.OPENRIND_SHELL_ENABLE_SYNC === '1'
    || process.env.OPENERAL_ENABLE_SYNC === '1'
  ) && !!process.env.DATABASE_URL;
  const hydrateOnStart = enableSync && !initMarkerMatches({ workspaceId });
  const syncWatchers = [];
  let server;
  let shuttingDown = false;

  const { pool, connectionString } = await getDatabaseConnection();

  async function syncFromRealFsInner() {
    if (!enableSync) return 0;
    let count = 0;
    for (const prefix of SYNC_PREFIXES) {
      count += await syncFromFs(pool, workspaceId, syncRoot, {
        ...prefix,
        excludeDirs: SYNC_EXCLUDES,
      });
    }
    return count;
  }

  async function flushSync() {
    return runWithSyncMutex(syncFromRealFsInner);
  }

  async function syncToRealFs() {
    if (!enableSync) return 0;
    return runWithSyncMutex(async () => {
      let count = 0;
      for (let index = 0; index < SYNC_PREFIXES.length; index++) {
        const hydrate = () => syncToFs(pool, workspaceId, syncRoot, {
          ...SYNC_PREFIXES[index],
          excludeDirs: SYNC_EXCLUDES,
        });
        const watcher = syncWatchers[index];
        count += watcher ? await watcher.suspend(hydrate) : await hydrate();
        watcher?.markClean();
      }
      return count;
    });
  }

  async function execCommandWithSync(command) {
    try {
      await flushSync();
    } catch (err) {
      return { stdout: '', stderr: `${formatError(err, 'openrind-shell-bash: pre-sync failed')}\n`, exitCode: 1 };
    }

    let result;
    let commandError;
    try {
      result = await shell.exec(command);
    } catch (err) {
      commandError = err;
    }

    try {
      await syncToRealFs();
    } catch (err) {
      const detail = `${formatError(err, 'openrind-shell-bash: post-sync failed')}\n`;
      if (commandError) {
        return {
          stdout: '',
          stderr: `${formatError(commandError, 'openrind-shell-bash: command failed')}\n${detail}`,
          exitCode: 1,
        };
      }
      return {
        stdout: result?.stdout ?? '',
        stderr: `${result?.stderr ?? ''}${detail}`,
        exitCode: result?.exitCode === 0 ? 1 : result?.exitCode ?? 1,
      };
    }

    if (commandError) {
      return { stdout: '', stderr: `${formatError(commandError, 'openrind-shell-bash: command failed')}\n`, exitCode: 1 };
    }
    return result;
  }

  async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const watcher of syncWatchers) {
      try { watcher.stop(); } catch {}
    }
    try { await flushSync(); } catch (err) {
      process.stderr.write(`openrind-shell-bash: final sync failed: ${err.message}\n`);
      code = code || 1;
    }
    try { await pool.end(); } catch {}
    try { server?.close(); } catch {}
    try { unlinkSync(SOCKET_PATH); } catch {}
    process.exit(code);
  }

  if (hydrateOnStart) {
    mkdirSync(syncRoot, { recursive: true });
    for (const prefix of SYNC_PREFIXES) {
      if (prefix.pathPrefixKind === 'dir') {
        mkdirSync(join(syncRoot, prefix.pathPrefix), { recursive: true });
      }
      const count = await runWithSyncMutex(() => syncToFs(pool, workspaceId, syncRoot, {
        ...prefix,
        excludeDirs: SYNC_EXCLUDES,
      }));
      process.stderr.write(`openrind-shell-bash: hydrated ${count} item(s) under ${prefix.pathPrefix}\n`);
    }
  } else if (enableSync) {
    mkdirSync(syncRoot, { recursive: true });
    for (const prefix of SYNC_PREFIXES) {
      if (prefix.pathPrefixKind === 'dir') {
        mkdirSync(join(syncRoot, prefix.pathPrefix), { recursive: true });
      }
    }
  }

  const shell = await createOpenrindShell({
    connectionString,
    workspaceId,
    migrate: false, // setup.sh already ran migrations
    pool,
  });

  // Clean up stale socket
  if (existsSync(SOCKET_PATH)) {
    unlinkSync(SOCKET_PATH);
  }

  if (enableSync) {
    for (const prefix of SYNC_PREFIXES) {
      syncWatchers.push(watchAndSync(pool, workspaceId, syncRoot, {
        ...prefix,
        excludeDirs: SYNC_EXCLUDES,
        debounceMs: 1000,
        syncFn: async () => {
          await runWithSyncMutex(() => syncFromFs(pool, workspaceId, syncRoot, {
            ...prefix,
            excludeDirs: SYNC_EXCLUDES,
          }));
        },
      }));
    }
    process.stderr.write(`openrind-shell-bash: scoped sync enabled for ${SYNC_PREFIXES.map(p => p.pathPrefix).join(', ')}\n`);
  }

  server = createServer((conn) => {
    let data = '';

    conn.on('data', async (chunk) => {
      data += chunk.toString();

      // Protocol: newline-terminated JSON request, newline-terminated JSON response
      const idx = data.indexOf('\n');
      if (idx === -1) return;

      const line = data.slice(0, idx);
      data = data.slice(idx + 1);

      let request;
      try {
        request = JSON.parse(line);
      } catch {
        conn.end(JSON.stringify({ error: 'Invalid JSON' }) + '\n');
        return;
      }

      try {
        if (request.type === 'health') {
          conn.end(JSON.stringify({ ok: true, workspaceId, sync: enableSync }) + '\n');
          return;
        }

        if (request.type === 'pg') {
          const sql = request.sql;
          if (typeof sql !== 'string') {
            conn.end(JSON.stringify({ stdout: '', stderr: 'pg error: missing SQL\n', exitCode: 1 }) + '\n');
            return;
          }
          conn.end(JSON.stringify(await runPgQuery(pool, sql)) + '\n');
          return;
        }

        if (request.type === 'flush') {
          const count = await flushSync();
          conn.end(JSON.stringify({ ok: true, count }) + '\n');
          return;
        }

        if (request.type === 'stop') {
          conn.end(JSON.stringify({ ok: true }) + '\n');
          setTimeout(() => { shutdown(0); }, 10);
          return;
        }

        const command = request.command;
        if (typeof command !== 'string') {
          conn.end(JSON.stringify({ error: 'Missing command' }) + '\n');
          return;
        }

        const result = await execCommandWithSync(command);
        conn.end(JSON.stringify({
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        }) + '\n');
      } catch (err) {
        conn.end(JSON.stringify({
          stdout: '',
          stderr: `openrind-shell-bash: ${err.message}\n`,
          exitCode: 1,
        }) + '\n');
      }
    });

    conn.on('error', () => {}); // ignore client disconnects
  });

  server.listen(SOCKET_PATH, () => {
    // Make socket accessible to sandbox user
    try { chmodSync(SOCKET_PATH, 0o777); } catch {}
    process.stderr.write(`openrind-shell-bash: daemon listening on ${SOCKET_PATH}\n`);
  });

  // Graceful shutdown
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      shutdown(0);
    });
  }
}

// ---------------------------------------------------------------------------
// Client mode — connect to daemon
// ---------------------------------------------------------------------------

function requestDaemon(request) {
  return new Promise((resolve, reject) => {
    const conn = createConnection(SOCKET_PATH);
    let data = '';

    conn.on('connect', () => {
      conn.write(JSON.stringify(request) + '\n');
    });

    conn.on('data', (chunk) => {
      data += chunk.toString();
    });

    conn.on('end', () => {
      try {
        resolve(JSON.parse(data.trim()));
      } catch {
        reject(new Error('Invalid daemon response'));
      }
    });

    conn.on('error', (err) => {
      reject(err);
    });
  });
}

function execViaDaemon(command) {
  return requestDaemon({ command });
}

function pgViaDaemon(sql) {
  return requestDaemon({ type: 'pg', sql });
}

// ---------------------------------------------------------------------------
// Per-invocation fallback — create shell, run command, exit
// ---------------------------------------------------------------------------

async function execStandalone(command) {
  loadStoredDatabaseUrl();
  const { createOpenrindShell } = await import('/opt/openrind-shell/dist/shell.js');
  const { getDatabaseConnection } = await import('/opt/openrind-shell/dist/db/embedded.js');

  const workspaceId = workspaceIdFromEnv();

  const { pool, connectionString } = await getDatabaseConnection();

  const shell = await createOpenrindShell({
    connectionString,
    workspaceId,
    migrate: false,
    pool,
  });

  return shell.exec(command);
}

async function pgStandalone(sql) {
  loadStoredDatabaseUrl();
  const { getDatabaseConnection } = await import('/opt/openrind-shell/dist/db/embedded.js');
  const { pool } = await getDatabaseConnection();
  try {
    return await runPgQuery(pool, sql);
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadStoredDatabaseUrl();
  const args = process.argv.slice(2);

  // Daemon mode
  if (args[0] === '--daemon') {
    await startDaemon();
    return;
  }

  if (args[0] === '--health') {
    const result = await requestDaemon({ type: 'health' });
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  if (args[0] === '--flush') {
    const result = await requestDaemon({ type: 'flush' });
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  if (args[0] === '--stop') {
    const result = await requestDaemon({ type: 'stop' });
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  if (args[0] === '--pg') {
    const sql = args.slice(1).join(' ');
    let result;
    try {
      result = await pgViaDaemon(sql);
    } catch {
      result = await pgStandalone(sql);
    }
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode);
  }

  // Find -c flag (how Claude Code calls bash)
  let command = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' && i + 1 < args.length) {
      command = args[i + 1];
      break;
    }
  }

  if (!command) {
    // No -c flag — pass through to real bash for interactive use
    const { execFileSync } = await import('node:child_process');
    try {
      execFileSync('/bin/bash.real', args, { stdio: 'inherit' });
    } catch (err) {
      process.exit(err.status || 1);
    }
    return;
  }

  // Try daemon first, fall back to standalone
  let result;
  try {
    result = await execViaDaemon(command);
  } catch {
    // Daemon not running — standalone mode
    result = await execStandalone(command);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}

main().catch((err) => {
  process.stderr.write(`openrind-shell-bash: ${err.message}\n`);
  process.exit(1);
});
