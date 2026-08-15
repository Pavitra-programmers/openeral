import { afterEach, describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { getDatabaseConnection, stopEmbeddedDatabase } from './db/embedded.js';
import { runMigrations } from './db/migrations.js';
import { createHomeSyncOptions, isExcludedFromSync, syncFromFs, syncToFs } from './sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const syncSrc = readFileSync(join(__dirname, 'sync.ts'), 'utf8');
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDataDir = process.env.OPENERAL_DATA_DIR;
const tempPaths: string[] = [];

afterEach(async () => {
  await stopEmbeddedDatabase();
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalDataDir === undefined) delete process.env.OPENERAL_DATA_DIR;
  else process.env.OPENERAL_DATA_DIR = originalDataDir;
});

async function createTestPool() {
  delete process.env.DATABASE_URL;
  const dataDir = mkdtempSync(join(tmpdir(), 'openeral-sync-db-'));
  tempPaths.push(dataDir);
  process.env.OPENERAL_DATA_DIR = dataDir;
  const { pool } = await getDatabaseConnection();
  await runMigrations(pool);
  return pool;
}

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'openeral-sync-fs-'));
  tempPaths.push(dir);
  return dir;
}

function parentPathOf(path: string): string {
  if (path === '/') return '';
  const idx = path.lastIndexOf('/');
  return idx <= 0 ? '/' : path.slice(0, idx);
}

function nameOf(path: string): string {
  if (path === '/') return '';
  return path.slice(path.lastIndexOf('/') + 1);
}

async function seedWorkspace(pool: any, workspaceId: string): Promise<void> {
  await pool.query(
    `INSERT INTO _openeral.workspace_config (id, display_name, config)
     VALUES ($1, $2, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [workspaceId, workspaceId],
  );
}

async function seedFile(pool: any, workspaceId: string, path: string, content: string): Promise<void> {
  const now = (BigInt(Date.now()) * 1_000_000n).toString();
  const bytes = Buffer.from(content);
  await pool.query(
    `INSERT INTO _openeral.workspace_files
     (workspace_id, path, parent_path, name, is_dir, content, mode, size, mtime_ns, ctime_ns, atime_ns, nlink, uid, gid)
     VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, $8, $8, 1, 1000, 1000)
     ON CONFLICT (workspace_id, path) DO UPDATE SET content = $5, size = $7`,
    [workspaceId, path, parentPathOf(path), nameOf(path), bytes, 0o100644, bytes.length, now],
  );
}

describe('sync.ts structural checks', () => {
  it('syncFromFs tracks seen paths for deletion', () => {
    expect(syncSrc).toContain('seenPaths');
    expect(syncSrc).toContain('seenPaths.add(');
  });

  it('syncFromFs deletes DB rows not seen on disk', () => {
    expect(syncSrc).toMatch(/DELETE FROM _openeral\.workspace_files/);
    expect(syncSrc).toContain('!seenPaths.has(');
  });

  it('syncFromFs batches rows and preserves stat metadata', () => {
    expect(syncSrc).toContain('FILE_BATCH_ROWS = 64');
    expect(syncSrc).toContain('DIR_BATCH_ROWS = 256');
    expect(syncSrc).toContain('FILE_BATCH_BYTES = 4 * 1024 * 1024');
    expect(syncSrc).toContain('mode: stat.mode');
    expect(syncSrc).toContain('stat.mtimeMs * 1_000_000');
  });

  it('syncToFs applies chmod after writing files', () => {
    const syncToFsBody = syncSrc.slice(
      syncSrc.indexOf('export async function syncToFs'),
      syncSrc.indexOf('export async function syncFromFs'),
    );
    expect(syncToFsBody).toContain('chmodSync(');
    expect(syncToFsBody).toContain('row.mode & 0o7777');
  });

  it('syncToFs prunes local files not in DB', () => {
    const syncToFsBody = syncSrc.slice(
      syncSrc.indexOf('export async function syncToFs'),
      syncSrc.indexOf('export async function syncFromFs'),
    );
    expect(syncToFsBody).toContain('pruneLocal');
  });

  it('exclude uses exact directory name matching, not regex substring', () => {
    // Must use Set-based matching, not regex
    expect(syncSrc).toContain('DEFAULT_EXCLUDE_DIRS');
    expect(syncSrc).toContain("new Set(['node_modules', '.git'])");
    // shouldExclude must use .has(), not .test()
    expect(syncSrc).toContain('opts.excludeDirs.has(segment)');
    // Must NOT have a regex-based exclude that would match .gitignore
    expect(syncSrc).not.toMatch(/exclude\.test\(name\)/);
  });

  it('.gitignore and .github are NOT excluded', () => {
    expect(syncSrc).not.toContain('/node_modules|\\.git/');
  });

  it('syncToFs prunes BEFORE creating (handles type conflicts)', () => {
    const syncToFsBody = syncSrc.slice(
      syncSrc.indexOf('export async function syncToFs'),
      syncSrc.indexOf('export async function syncFromFs'),
    );
    const pruneIdx = syncToFsBody.indexOf('pruneLocal');
    const mkdirIdx = syncToFsBody.indexOf('mkdirSync(fullPath');
    const writeIdx = syncToFsBody.indexOf('writeFileSync(fullPath');
    // pruneLocal must appear BEFORE mkdir and writeFile
    expect(pruneIdx).toBeGreaterThan(-1);
    expect(mkdirIdx).toBeGreaterThan(pruneIdx);
    expect(writeIdx).toBeGreaterThan(pruneIdx);
  });

  it('pruneLocal handles type conflicts (file↔dir)', () => {
    // pruneLocal must check dbTypes for type mismatches, not just presence
    expect(syncSrc).toContain('dbTypes');
    expect(syncSrc).toContain('databaseIsDir === false');
    expect(syncSrc).toContain('databaseIsDir === true');
  });

  it('supports scoped pathPrefix sync without changing legacy no-prefix behavior', () => {
    expect(syncSrc).toContain('normalizeDbPath(opts?.pathPrefix');
    expect(syncSrc).toContain('opts?.pathPrefix');
    expect(syncSrc).toContain('path = $2 OR path LIKE $3');
    expect(syncSrc).toContain('pruneLocal(targetDir, syncOpts.pathPrefix');
    expect(syncSrc).toContain("syncOpts.pathPrefix === '/'");
  });

  it('watchAndSync passes pathPrefix through to syncFromFs', () => {
    const watchBody = syncSrc.slice(syncSrc.indexOf('export function watchAndSync'));
    expect(watchBody).toContain('const syncOpts = normalizeSyncOptions(opts)');
    expect(watchBody).toContain('watchDir');
    expect(watchBody).toContain('syncFn(pool, workspaceId, dir, syncOpts)');
    expect(watchBody).toContain('startedAtGeneration');
  });
});

describe('sync.ts behavior', () => {
  it('excludes secrets and wildcard OpenClaw transcripts from home compatibility sync', () => {
    const options = createHomeSyncOptions();
    expect(isExcludedFromSync('/.ssh/id_ed25519', options)).toBe(true);
    expect(isExcludedFromSync('/.npmrc', options)).toBe(true);
    expect(isExcludedFromSync('/.openclaw/agents/main/sessions/a.jsonl', options)).toBe(true);
    expect(isExcludedFromSync('/.openclaw/agents/main/agent.json', options)).toBe(false);
    expect(isExcludedFromSync('/.gitignore', options)).toBe(false);
  });

  it('confines syncFromFs deletions to the requested pathPrefix', async () => {
    const pool = await createTestPool();
    const workspaceId = 'sync-delete-prefix';
    const root = makeTempDir();
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(join(root, '.claude', 'keep.md'), 'new keep');

    await seedWorkspace(pool, workspaceId);
    await seedFile(pool, workspaceId, '/.claude/old.md', 'old');
    await seedFile(pool, workspaceId, '/.claude/keep.md', 'old keep');
    await seedFile(pool, workspaceId, '/src/code.ts', 'const ok = true;');

    await syncFromFs(pool as any, workspaceId, root, { pathPrefix: '/.claude' });

    const { rows } = await pool.query(
      `SELECT path FROM _openeral.workspace_files WHERE workspace_id = $1 ORDER BY path`,
      [workspaceId],
    );
    const paths = rows.map((row: any) => row.path);
    expect(paths).not.toContain('/.claude/old.md');
    expect(paths).toContain('/.claude/keep.md');
    expect(paths).toContain('/src/code.ts');
  }, 30000);

  it('confines syncToFs hydration to the requested pathPrefix', async () => {
    const pool = await createTestPool();
    const workspaceId = 'sync-hydrate-prefix';
    const root = makeTempDir();

    await seedWorkspace(pool, workspaceId);
    await seedFile(pool, workspaceId, '/.claude/x.md', 'x');
    await seedFile(pool, workspaceId, '/unrelated/y.md', 'y');

    await syncToFs(pool as any, workspaceId, root, { pathPrefix: '/.claude' });

    expect(readFileSync(join(root, '.claude', 'x.md'), 'utf8')).toBe('x');
    expect(existsSync(join(root, 'unrelated'))).toBe(false);
  }, 30000);

  it('persists an exact file pathPrefix without syncing the whole parent directory', async () => {
    const pool = await createTestPool();
    const workspaceId = 'sync-exact-file-from-fs';
    const root = makeTempDir();
    writeFileSync(join(root, '.claude.json'), '{"ok":true}');
    writeFileSync(join(root, 'unrelated.txt'), 'do not sync');

    await seedWorkspace(pool, workspaceId);

    await syncFromFs(pool as any, workspaceId, root, {
      pathPrefix: '/.claude.json',
      pathPrefixKind: 'file',
    });

    const { rows } = await pool.query(
      `SELECT path, content FROM _openeral.workspace_files WHERE workspace_id = $1 ORDER BY path`,
      [workspaceId],
    );
    const paths = rows.map((row: any) => row.path);
    expect(paths).toContain('/.claude.json');
    expect(paths).not.toContain('/unrelated.txt');
    expect(Buffer.from(rows.find((row: any) => row.path === '/.claude.json').content).toString()).toBe('{"ok":true}');
  }, 30000);

  it('hydrates an exact file pathPrefix without creating unrelated rows on disk', async () => {
    const pool = await createTestPool();
    const workspaceId = 'sync-exact-file-to-fs';
    const root = makeTempDir();

    await seedWorkspace(pool, workspaceId);
    await seedFile(pool, workspaceId, '/.claude.json', '{"persisted":true}');
    await seedFile(pool, workspaceId, '/.claude/x.md', 'x');

    await syncToFs(pool as any, workspaceId, root, {
      pathPrefix: '/.claude.json',
      pathPrefixKind: 'file',
    });

    expect(readFileSync(join(root, '.claude.json'), 'utf8')).toBe('{"persisted":true}');
    expect(existsSync(join(root, '.claude'))).toBe(false);
  }, 30000);

  it('round-trips a heavy scoped workspace without touching adjacent rows', async () => {
    const pool = await createTestPool();
    const workspaceId = 'sync-heavy-prefix';
    const source = makeTempDir();
    const target = makeTempDir();
    const count = 320;
    mkdirSync(join(source, '.claude', 'projects'), { recursive: true });
    for (let index = 0; index < count; index++) {
      writeFileSync(
        join(source, '.claude', 'projects', `memory-${index}.md`),
        `memory ${index}\n${'x'.repeat(index % 97)}`,
      );
    }

    await seedWorkspace(pool, workspaceId);
    await seedFile(pool, workspaceId, '/src/keep.ts', 'export const keep = true;');
    await syncFromFs(pool as any, workspaceId, source, { pathPrefix: '/.claude' });

    const { rows } = await pool.query(
      `SELECT path FROM _openeral.workspace_files WHERE workspace_id = $1`,
      [workspaceId],
    );
    expect(rows.filter((row: any) => row.path.startsWith('/.claude/projects/memory-')))
      .toHaveLength(count);
    expect(rows.some((row: any) => row.path === '/src/keep.ts')).toBe(true);

    await syncToFs(pool as any, workspaceId, target, { pathPrefix: '/.claude' });
    expect(readFileSync(join(target, '.claude', 'projects', 'memory-319.md'), 'utf8'))
      .toBe(`memory 319\n${'x'.repeat(319 % 97)}`);
    expect(existsSync(join(target, 'src'))).toBe(false);
  }, 90000);
});
