import { afterEach, describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { getDatabaseConnection, stopEmbeddedDatabase } from './db/embedded.js';
import { runMigrations } from './db/migrations.js';
import { syncFromFs, syncToFs } from './sync.js';

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

  it('syncFromFs uses st.mode, not hardcoded values', () => {
    // Only check the walkDir function body (exclude the root dir INSERT)
    const walkDirStart = syncSrc.indexOf('async function walkDir');
    const walkDirEnd = syncSrc.indexOf('// Ensure root exists');
    const walkDirBody = syncSrc.slice(walkDirStart, walkDirEnd);
    expect(walkDirBody).toContain('st.mode');
    const insertStatements = walkDirBody.match(/INSERT INTO[\s\S]*?ON CONFLICT[\s\S]*?\]/g) || [];
    for (const stmt of insertStatements) {
      expect(stmt).not.toMatch(/0o40755|0o100644/);
    }
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
    expect(syncSrc).toContain('excludeDirs.has(name)');
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
    expect(syncSrc).toContain('dbIsDir === false');
    expect(syncSrc).toContain('dbIsDir === true');
  });

  it('supports scoped pathPrefix sync without changing legacy no-prefix behavior', () => {
    expect(syncSrc).toContain('normalizePathPrefix');
    expect(syncSrc).toContain('opts?.pathPrefix');
    expect(syncSrc).toContain('path = $2 OR path LIKE $3');
    expect(syncSrc).toContain('pruneLocal(targetDir, pathPrefix');
    expect(syncSrc).toContain('pathPrefix === \'/\'');
  });

  it('watchAndSync passes pathPrefix through to syncFromFs', () => {
    const watchBody = syncSrc.slice(syncSrc.indexOf('export function watchAndSync'));
    expect(watchBody).toContain('const pathPrefix = normalizePathPrefix(opts?.pathPrefix)');
    expect(watchBody).toContain('watchDir');
    expect(watchBody).toContain('syncFromFs(pool, workspaceId, dir, { excludeDirs, pathPrefix })');
  });
});

describe('sync.ts behavior', () => {
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
  });

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
  });
});
