/**
 * Compatibility-only bidirectional sync for `_openeral.workspace_files`.
 *
 * The primary sandbox persists `/sandbox/work` through supervisor-mounted
 * FUSE and must never start this watcher. These helpers remain for the
 * just-bash/library image and for importing its scoped legacy state.
 */

import {
  chmodSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  watch,
  writeFileSync,
} from 'node:fs';
import type { Stats } from 'node:fs';
import { dirname, join } from 'node:path';
import type pg from 'pg';

export type PathPrefixKind = 'dir' | 'file';

export const DEFAULT_EXCLUDE_DIRS = new Set(['node_modules', '.git']);
export const DEFAULT_EXCLUDE_FILES = new Set<string>();
export const HOME_SYNC_EXCLUDE_DIRS = new Set([
  ...DEFAULT_EXCLUDE_DIRS,
  '.aws',
  '.azure',
  '.config',
  '.docker',
  '.gnupg',
  '.kube',
  '.npm',
  '.ssh',
]);
export const HOME_SYNC_EXCLUDE_FILES = new Set([
  '.bash_history',
  '.git-credentials',
  '.lesshst',
  '.mysql_history',
  '.netrc',
  '.npmrc',
  '.psql_history',
  '.python_history',
  '.wget-hsts',
  '.zsh_history',
]);
export const HOME_SYNC_EXCLUDE_PATH_PREFIXES = [
  '/.local/share/keyrings',
  '/.openclaw/logs',
  '/.openclaw/cache',
  '/.openclaw/plugin-runtime-deps',
  '/.openclaw/plugins-runtime',
  '/.openclaw/plugins/installs.json',
  '/.openclaw/gateway',
  '/.openclaw/runtime',
  '/.openclaw/tmp',
  '/.openclaw/var',
  '/.openclaw/memory/main.sqlite',
  '/.openclaw/memory/main.sqlite.migrated',
  '/.openclaw/agents/*/sessions',
  '/.openclaw/sessions',
];

export interface SyncOptions {
  excludeDirs?: Set<string>;
  excludeFiles?: Set<string>;
  excludePathPrefixes?: string[];
  prune?: boolean;
  pathPrefix?: string;
  pathPrefixKind?: PathPrefixKind;
}

interface ResolvedSyncOptions {
  excludeDirs: Set<string>;
  excludeFiles: Set<string>;
  excludePathPrefixes: string[];
  prune: boolean;
  pathPrefix: string;
  pathPrefixKind: PathPrefixKind;
}

export interface SyncWatchHandle {
  stop(): void;
  isDirty(): boolean;
  isWatching(): boolean;
  markDirty(): void;
  markClean(): void;
  suspend<T>(fn: () => Promise<T>): Promise<T>;
}

type SyncFunction = (
  pool: pg.Pool,
  workspaceId: string,
  dir: string,
  opts: SyncOptions,
) => Promise<unknown>;

interface FileBatchRow {
  path: string;
  parentPath: string;
  name: string;
  content: Buffer;
  mode: number;
  size: number;
  mtimeNs: string;
}

interface DirBatchRow {
  path: string;
  parentPath: string;
  name: string;
  mode: number;
  mtimeNs: string;
}

const FILE_BATCH_ROWS = 64;
const DIR_BATCH_ROWS = 256;
const FILE_BATCH_BYTES = 4 * 1024 * 1024;

function nowNs(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

function normalizeDbPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized || normalized === '/') return '/';
  const trimmed = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function splitDbPath(path: string): string[] {
  return normalizeDbPath(path).split('/').filter(Boolean);
}

function parentPathOf(path: string): string {
  if (path === '/') return '';
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

function nameOf(path: string): string {
  return path === '/' ? '' : path.slice(path.lastIndexOf('/') + 1);
}

function prefixMatches(path: string, prefix: string): boolean {
  if (!prefix.includes('*')) return path === prefix || path.startsWith(`${prefix}/`);
  const expected = splitDbPath(prefix);
  const actual = splitDbPath(path);
  if (actual.length < expected.length) return false;
  return expected.every((segment, index) => segment === '*' || segment === actual[index]);
}

function normalizeSyncOptions(opts?: SyncOptions): ResolvedSyncOptions {
  return {
    excludeDirs: opts?.excludeDirs ?? DEFAULT_EXCLUDE_DIRS,
    excludeFiles: opts?.excludeFiles ?? DEFAULT_EXCLUDE_FILES,
    excludePathPrefixes: (opts?.excludePathPrefixes ?? []).map(normalizeDbPath),
    prune: opts?.prune ?? true,
    pathPrefix: normalizeDbPath(opts?.pathPrefix ?? '/'),
    pathPrefixKind: opts?.pathPrefixKind ?? 'dir',
  };
}

function shouldExcludePath(path: string, opts: ResolvedSyncOptions, isDir?: boolean): boolean {
  const normalized = normalizeDbPath(path);
  if (normalized === '/') return false;
  if (opts.excludePathPrefixes.some((prefix) => prefixMatches(normalized, prefix))) return true;

  const segments = splitDbPath(normalized);
  if (segments.some((segment) => opts.excludeDirs.has(segment))) return true;
  return isDir !== true && opts.excludeFiles.has(segments.at(-1) ?? '');
}

export function isExcludedFromSync(path: string, opts?: SyncOptions, isDir?: boolean): boolean {
  return shouldExcludePath(path, normalizeSyncOptions(opts), isDir);
}

export function createHomeSyncOptions(overrides: SyncOptions = {}): SyncOptions {
  return {
    ...overrides,
    excludeDirs: new Set([...HOME_SYNC_EXCLUDE_DIRS, ...(overrides.excludeDirs ?? [])]),
    excludeFiles: new Set([...HOME_SYNC_EXCLUDE_FILES, ...(overrides.excludeFiles ?? [])]),
    excludePathPrefixes: [
      ...HOME_SYNC_EXCLUDE_PATH_PREFIXES,
      ...(overrides.excludePathPrefixes ?? []),
    ],
    prune: overrides.prune ?? false,
  };
}

function pathPrefixQuery(pathPrefix: string, kind: PathPrefixKind): string {
  if (pathPrefix === '/') return 'workspace_id = $1';
  if (kind === 'file') return 'workspace_id = $1 AND path = $2';
  return 'workspace_id = $1 AND (path = $2 OR path LIKE $3)';
}

function pathPrefixParams(
  workspaceId: string,
  pathPrefix: string,
  kind: PathPrefixKind,
): string[] {
  if (pathPrefix === '/') return [workspaceId];
  if (kind === 'file') return [workspaceId, pathPrefix];
  return [workspaceId, pathPrefix, `${pathPrefix}/%`];
}

async function ensureDirRow(
  pool: pg.Pool,
  workspaceId: string,
  path: string,
  mode = 0o40755,
): Promise<void> {
  const timestamp = nowNs().toString();
  await pool.query(
    `INSERT INTO _openeral.workspace_files
     (workspace_id, path, parent_path, name, is_dir, content, mode, size, mtime_ns, ctime_ns, atime_ns, nlink, uid, gid)
     VALUES ($1, $2, $3, $4, true, NULL, $5, 0, $6, $6, $6, 2, 1000, 1000)
     ON CONFLICT (workspace_id, path) DO NOTHING`,
    [workspaceId, path, parentPathOf(path), nameOf(path), mode, timestamp],
  );
}

async function ensureParentDirRows(pool: pg.Pool, workspaceId: string, path: string): Promise<void> {
  await ensureDirRow(pool, workspaceId, '/');
  const parent = parentPathOf(path);
  if (!parent || parent === '/') return;
  let current = '';
  for (const part of parent.split('/').filter(Boolean)) {
    current += `/${part}`;
    await ensureDirRow(pool, workspaceId, current);
  }
}

function pruneLocal(
  baseDir: string,
  dbParent: string,
  dbPaths: Set<string>,
  dbTypes: Map<string, boolean>,
  opts: ResolvedSyncOptions,
): void {
  const fullDir = join(baseDir, dbParent);
  let rootStat;
  try {
    rootStat = statSync(fullDir);
  } catch {
    return;
  }

  if (!rootStat.isDirectory()) {
    if (!dbPaths.has(dbParent) || dbTypes.get(dbParent) === true) {
      try { unlinkSync(fullDir); } catch {}
    }
    return;
  }

  let entries: string[];
  try {
    entries = readdirSync(fullDir);
  } catch {
    return;
  }

  for (const name of entries) {
    const fullPath = join(fullDir, name);
    const dbPath = dbParent === '/' ? `/${name}` : `${dbParent}/${name}`;
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (shouldExcludePath(dbPath, opts, stat.isDirectory())) continue;

    const inDatabase = dbPaths.has(dbPath);
    const databaseIsDir = dbTypes.get(dbPath);
    if (stat.isDirectory()) {
      pruneLocal(baseDir, dbPath, dbPaths, dbTypes, opts);
      if (!inDatabase || databaseIsDir === false) {
        try { rmSync(fullPath, { recursive: true }); } catch {}
      }
    } else if (!inDatabase || databaseIsDir === true) {
      try { unlinkSync(fullPath); } catch {}
    }
  }

  if (dbParent !== opts.pathPrefix && dbParent !== '/') {
    if (!dbPaths.has(dbParent) || dbTypes.get(dbParent) === false) {
      try { rmSync(fullDir, { recursive: true }); } catch {}
    }
  }
}

/** Restore a prefix from compatibility storage onto a real filesystem. */
export async function syncToFs(
  pool: pg.Pool,
  workspaceId: string,
  targetDir: string,
  opts?: SyncOptions,
): Promise<number> {
  const syncOpts = normalizeSyncOptions(opts);
  const query = `SELECT path, is_dir, content, mode FROM _openeral.workspace_files
    WHERE ${pathPrefixQuery(syncOpts.pathPrefix, syncOpts.pathPrefixKind)} ORDER BY path`;
  const params = pathPrefixParams(workspaceId, syncOpts.pathPrefix, syncOpts.pathPrefixKind);
  const { rows: allRows } = await pool.query(query, params);
  const rows = allRows.filter((row) => !shouldExcludePath(row.path, syncOpts, row.is_dir));
  const dbPaths = new Set(rows.map((row) => row.path as string));
  const dbTypes = new Map(rows.map((row) => [row.path as string, row.is_dir as boolean]));

  if (syncOpts.prune) {
    pruneLocal(targetDir, syncOpts.pathPrefix, dbPaths, dbTypes, syncOpts);
  }

  let count = 0;
  for (const row of rows) {
    if (!row.is_dir) continue;
    const fullPath = join(targetDir, row.path);
    mkdirSync(fullPath, { recursive: true });
    try { chmodSync(fullPath, row.mode & 0o7777); } catch {}
    count++;
  }
  for (const row of rows) {
    if (row.is_dir) continue;
    const fullPath = join(targetDir, row.path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, row.content ?? Buffer.alloc(0));
    try { chmodSync(fullPath, row.mode & 0o7777); } catch {}
    count++;
  }
  return count;
}

async function flushDirBatch(
  pool: pg.Pool,
  workspaceId: string,
  batch: DirBatchRow[],
): Promise<void> {
  if (batch.length === 0) return;
  const tuples: string[] = [];
  const params: unknown[] = [workspaceId];
  let parameter = 2;
  for (const row of batch) {
    tuples.push(
      `($1, $${parameter}, $${parameter + 1}, $${parameter + 2}, true, NULL, `
      + `$${parameter + 3}, 0, $${parameter + 4}, $${parameter + 4}, `
      + `$${parameter + 4}, 2, 1000, 1000)`,
    );
    params.push(row.path, row.parentPath, row.name, row.mode, row.mtimeNs);
    parameter += 5;
  }
  await pool.query(
    `INSERT INTO _openeral.workspace_files
     (workspace_id, path, parent_path, name, is_dir, content, mode, size, mtime_ns, ctime_ns, atime_ns, nlink, uid, gid)
     VALUES ${tuples.join(', ')}
     ON CONFLICT (workspace_id, path) DO UPDATE
     SET mode = EXCLUDED.mode, mtime_ns = EXCLUDED.mtime_ns`,
    params,
  );
  batch.length = 0;
}

async function flushFileBatch(
  pool: pg.Pool,
  workspaceId: string,
  batch: FileBatchRow[],
): Promise<void> {
  if (batch.length === 0) return;
  const tuples: string[] = [];
  const params: unknown[] = [workspaceId];
  let parameter = 2;
  for (const row of batch) {
    tuples.push(
      `($1, $${parameter}, $${parameter + 1}, $${parameter + 2}, false, `
      + `$${parameter + 3}, $${parameter + 4}, $${parameter + 5}, `
      + `$${parameter + 6}, $${parameter + 6}, $${parameter + 6}, 1, 1000, 1000)`,
    );
    params.push(
      row.path,
      row.parentPath,
      row.name,
      row.content,
      row.mode,
      row.size,
      row.mtimeNs,
    );
    parameter += 7;
  }
  await pool.query(
    `INSERT INTO _openeral.workspace_files
     (workspace_id, path, parent_path, name, is_dir, content, mode, size, mtime_ns, ctime_ns, atime_ns, nlink, uid, gid)
     VALUES ${tuples.join(', ')}
     ON CONFLICT (workspace_id, path) DO UPDATE
     SET content = EXCLUDED.content, mode = EXCLUDED.mode,
         size = EXCLUDED.size, mtime_ns = EXCLUDED.mtime_ns`,
    params,
  );
  batch.length = 0;
}

/** Persist a scoped real-filesystem snapshot to compatibility storage. */
export async function syncFromFs(
  pool: pg.Pool,
  workspaceId: string,
  sourceDir: string,
  opts?: SyncOptions,
): Promise<number> {
  const syncOpts = normalizeSyncOptions(opts);
  const params = pathPrefixParams(workspaceId, syncOpts.pathPrefix, syncOpts.pathPrefixKind);
  const { rows: existingRows } = await pool.query(
    `SELECT path, mtime_ns::text AS mtime_ns, size::text AS size, is_dir
     FROM _openeral.workspace_files
     WHERE ${pathPrefixQuery(syncOpts.pathPrefix, syncOpts.pathPrefixKind)}`,
    params,
  );
  const existing = new Map<string, { mtimeNs: bigint; size: bigint; isDir: boolean }>();
  for (const row of existingRows) {
    existing.set(row.path, {
      mtimeNs: BigInt(row.mtime_ns),
      size: BigInt(row.size),
      isDir: row.is_dir,
    });
  }

  const seenPaths = new Set<string>();
  if (syncOpts.pathPrefix === '/') seenPaths.add('/');
  if (syncOpts.pathPrefixKind === 'dir') seenPaths.add(syncOpts.pathPrefix);

  const fileBatch: FileBatchRow[] = [];
  const dirBatch: DirBatchRow[] = [];
  let fileBatchBytes = 0;
  let count = 0;

  async function maybeFlushDirs(force = false): Promise<void> {
    if (dirBatch.length > 0 && (force || dirBatch.length >= DIR_BATCH_ROWS)) {
      count += dirBatch.length;
      await flushDirBatch(pool, workspaceId, dirBatch);
    }
  }

  async function maybeFlushFiles(force = false): Promise<void> {
    if (
      fileBatch.length > 0
      && (force || fileBatch.length >= FILE_BATCH_ROWS || fileBatchBytes >= FILE_BATCH_BYTES)
    ) {
      count += fileBatch.length;
      await flushFileBatch(pool, workspaceId, fileBatch);
      fileBatchBytes = 0;
    }
  }

  async function queueFile(fullPath: string, dbPath: string, stat: Stats): Promise<void> {
    if (shouldExcludePath(dbPath, syncOpts, false)) return;
    seenPaths.add(dbPath);
    const mtimeNs = BigInt(Math.floor(stat.mtimeMs * 1_000_000));
    const size = BigInt(stat.size);
    const previous = existing.get(dbPath);
    if (previous && !previous.isDir && previous.mtimeNs === mtimeNs && previous.size === size) return;

    const content = readFileSync(fullPath);
    fileBatch.push({
      path: dbPath,
      parentPath: parentPathOf(dbPath),
      name: nameOf(dbPath),
      content,
      mode: stat.mode,
      size: stat.size,
      mtimeNs: mtimeNs.toString(),
    });
    fileBatchBytes += content.length;
    await maybeFlushFiles();
  }

  async function walkDir(dirPath: string, dbParent: string): Promise<void> {
    let entries: string[];
    try {
      entries = readdirSync(dirPath);
    } catch {
      return;
    }

    for (const name of entries) {
      const fullPath = join(dirPath, name);
      const dbPath = dbParent === '/' ? `/${name}` : `${dbParent}/${name}`;
      let stat: Stats;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (shouldExcludePath(dbPath, syncOpts, true)) continue;
        seenPaths.add(dbPath);
        const mtimeNs = BigInt(Math.floor(stat.mtimeMs * 1_000_000));
        const previous = existing.get(dbPath);
        if (!previous || !previous.isDir || previous.mtimeNs !== mtimeNs) {
          dirBatch.push({
            path: dbPath,
            parentPath: dbParent,
            name,
            mode: stat.mode,
            mtimeNs: mtimeNs.toString(),
          });
          await maybeFlushDirs();
        }
        await walkDir(fullPath, dbPath);
      } else if (stat.isFile()) {
        await queueFile(fullPath, dbPath, stat);
      }
    }
  }

  await ensureParentDirRows(pool, workspaceId, syncOpts.pathPrefix);
  if (syncOpts.pathPrefixKind === 'dir') {
    await ensureDirRow(pool, workspaceId, syncOpts.pathPrefix);
    const walkRoot = syncOpts.pathPrefix === '/'
      ? sourceDir
      : join(sourceDir, syncOpts.pathPrefix);
    await walkDir(walkRoot, syncOpts.pathPrefix);
  } else {
    const fullPath = join(sourceDir, syncOpts.pathPrefix);
    try {
      const stat = statSync(fullPath);
      if (stat.isFile()) await queueFile(fullPath, syncOpts.pathPrefix, stat);
    } catch {
      // A missing exact-file prefix is handled by the scoped prune below.
    }
  }

  await maybeFlushDirs(true);
  await maybeFlushFiles(true);

  if (syncOpts.prune) {
    const toDelete = [...existing.keys()].filter((path) => {
      if (path === '/' || path === syncOpts.pathPrefix && syncOpts.pathPrefixKind === 'dir') {
        return false;
      }
      return !seenPaths.has(path);
    });
    if (toDelete.length > 0) {
      await pool.query(
        `DELETE FROM _openeral.workspace_files
         WHERE workspace_id = $1 AND path = ANY($2::text[])`,
        [workspaceId, toDelete],
      );
    }
  }

  return count;
}

function formatSyncError(err: unknown, label: string): string {
  const error = err instanceof Error ? err : new Error(String(err));
  const code = err && typeof err === 'object' && 'code' in err
    ? ` code=${String((err as { code?: unknown }).code ?? '')}`
    : '';
  return `${label}: ${error.message}${code}`;
}

/** Start a compatibility watcher with lossless dirty-state accounting. */
export function watchAndSync(
  pool: pg.Pool,
  workspaceId: string,
  dir: string,
  opts?: SyncOptions & { debounceMs?: number; syncFn?: SyncFunction },
): SyncWatchHandle {
  const syncOpts = normalizeSyncOptions(opts);
  const debounceMs = opts?.debounceMs ?? 2_000;
  const syncFn = opts?.syncFn ?? syncFromFs;
  const abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let changeGeneration = 0;
  let syncedGeneration = 0;
  let syncing = false;
  let suspended = 0;
  let watching = false;
  let stopped = false;

  const isDirty = () => changeGeneration !== syncedGeneration;
  const markDirty = () => { changeGeneration++; };
  const markClean = () => { syncedGeneration = changeGeneration; };

  const scheduleSync = () => {
    if (stopped || suspended > 0) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!isDirty() || syncing || suspended > 0 || stopped) return;
      syncing = true;
      const startedAtGeneration = changeGeneration;
      void syncFn(pool, workspaceId, dir, syncOpts).then(() => {
        syncedGeneration = Math.max(syncedGeneration, startedAtGeneration);
      }).catch((err: unknown) => {
        process.stderr.write(`${formatSyncError(err, 'openrind-shell: sync error')}\n`);
      }).finally(() => {
        syncing = false;
        if (isDirty()) scheduleSync();
      });
    }, debounceMs);
  };

  try {
    const watchDir = syncOpts.pathPrefixKind === 'file'
      ? join(dir, parentPathOf(syncOpts.pathPrefix))
      : syncOpts.pathPrefix === '/' ? dir : join(dir, syncOpts.pathPrefix);
    const watcher = watch(watchDir, {
      recursive: syncOpts.pathPrefixKind !== 'file',
      signal: abortController.signal,
    });
    watching = true;
    watcher.on('change', (_event, filename) => {
      if (suspended > 0) return;
      if (typeof filename === 'string') {
        if (
          syncOpts.pathPrefixKind === 'file'
          && filename !== nameOf(syncOpts.pathPrefix)
        ) return;
        const dbPath = syncOpts.pathPrefixKind === 'file'
          ? syncOpts.pathPrefix
          : normalizeDbPath(`${syncOpts.pathPrefix}/${filename}`);
        if (shouldExcludePath(dbPath, syncOpts)) return;
      }
      markDirty();
      scheduleSync();
    });
    watcher.on('error', (err) => {
      watching = false;
      markDirty();
      process.stderr.write(`${formatSyncError(err, 'openrind-shell: watcher error')}\n`);
    });
  } catch {
    // Recursive fs.watch is not supported on every host platform.
  }

  return {
    stop() {
      stopped = true;
      watching = false;
      abortController.abort();
      if (timer) clearTimeout(timer);
    },
    isDirty,
    isWatching: () => watching,
    markDirty,
    markClean,
    async suspend<T>(fn: () => Promise<T>): Promise<T> {
      suspended++;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        return await fn();
      } finally {
        suspended = Math.max(0, suspended - 1);
        if (isDirty()) scheduleSync();
      }
    },
  };
}
