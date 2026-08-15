import { afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { getDatabaseConnection, stopEmbeddedDatabase } from './embedded.js';
import { prepareFuseVolume } from './fuse-init.js';
import { runMigrations } from './migrations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'migrations.ts'), 'utf8');
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDataDir = process.env.OPENRIND_SHELL_DATA_DIR;
const temporaryPaths: string[] = [];

afterEach(async () => {
  await stopEmbeddedDatabase();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalDataDir === undefined) delete process.env.OPENRIND_SHELL_DATA_DIR;
  else process.env.OPENRIND_SHELL_DATA_DIR = originalDataDir;
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe('migrations.ts structural checks', () => {
  it('polls a non-blocking advisory lock for concurrent callers', () => {
    expect(src).toContain('pg_try_advisory_lock');
    expect(src).toContain('LOCK_WAIT_MS');
    expect(src).toContain('LOCK_POLL_MS');
  });

  it('releases the advisory lock in a finally block', () => {
    expect(src).toContain('pg_advisory_unlock');
    // The unlock must be inside a finally so it runs even on error
    const finallyIdx = src.indexOf('finally');
    const unlockIdx = src.indexOf('pg_advisory_unlock');
    expect(finallyIdx).toBeGreaterThan(-1);
    expect(unlockIdx).toBeGreaterThan(finallyIdx);
  });

  it('acquires a connection from the pool (not pool.query) for lock scope', () => {
    // Advisory locks are session-scoped — must use a single client connection,
    // not pool.query which may use different connections for lock and unlock
    expect(src).toContain('pool.connect()');
    expect(src).toContain('client.query');
    expect(src).toContain('client.release()');
  });

  it('takes a schema-version fast path and retains the existing storage namespace', () => {
    expect(src).toContain('export const SCHEMA_VERSION = 8');
    expect(src).toContain('currentSchemaVersion(client)');
    expect(src).toContain('FROM _openeral.schema_version');
    expect(src).not.toContain('_openrind.schema_version');
  });

  it('avoids table locks for indexes that already exist', () => {
    expect(src).toContain('SELECT to_regclass($1) IS NOT NULL AS present');
    expect(src).toContain('SET lock_timeout');
    expect(src).toContain('ensureIndex(');
  });
});

describe('renamed compatibility schema migration', () => {
  it('imports _openrind workspace rows without overwriting newer _openeral data', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'openrind-migration-'));
    temporaryPaths.push(dataDir);
    delete process.env.DATABASE_URL;
    process.env.OPENRIND_SHELL_DATA_DIR = dataDir;
    const { pool } = await getDatabaseConnection();

    await pool.query('CREATE SCHEMA _openrind');
    await pool.query(`
      CREATE TABLE _openrind.workspace_config (
        id TEXT PRIMARY KEY,
        display_name TEXT,
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE _openrind.workspace_files (
        workspace_id TEXT NOT NULL REFERENCES _openrind.workspace_config(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        parent_path TEXT NOT NULL,
        name TEXT NOT NULL,
        is_dir BOOLEAN NOT NULL DEFAULT false,
        content BYTEA,
        mode INTEGER NOT NULL DEFAULT 33188,
        size BIGINT NOT NULL DEFAULT 0,
        mtime_ns BIGINT NOT NULL,
        ctime_ns BIGINT NOT NULL,
        atime_ns BIGINT NOT NULL,
        nlink INTEGER NOT NULL DEFAULT 1,
        uid INTEGER NOT NULL DEFAULT 1000,
        gid INTEGER NOT NULL DEFAULT 1000,
        PRIMARY KEY (workspace_id, path)
      )
    `);
    await pool.query(
      `INSERT INTO _openrind.workspace_config
         (id, display_name, config, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')`,
      ['renamed-workspace', 'renamed', '{"source":"just-bash"}'],
    );
    await pool.query(
      `INSERT INTO _openrind.workspace_files
         (workspace_id, path, parent_path, name, content, size,
          mtime_ns, ctime_ns, atime_ns)
       VALUES ($1, '/.openrind-shell/presign.json', '/.openrind-shell',
               'presign.json', $2, $3, 100, 100, 100)`,
      ['renamed-workspace', Buffer.from('from-just-bash'), 14],
    );
    const sourceCode = Buffer.from('export const imported = true;');
    await pool.query(
      `INSERT INTO _openrind.workspace_files
         (workspace_id, path, parent_path, name, content, size,
          mtime_ns, ctime_ns, atime_ns)
       VALUES ($1, '/src/code.ts', '/src', 'code.ts', $2, $3, 150, 150, 150)`,
      ['renamed-workspace', sourceCode, sourceCode.length],
    );

    await runMigrations(pool);

    const imported = await pool.query(
      `SELECT content, mtime_ns
         FROM _openeral.workspace_files
        WHERE workspace_id = $1 AND path = '/.openrind-shell/presign.json'`,
      ['renamed-workspace'],
    );
    expect(Buffer.from(imported.rows[0].content).toString()).toBe('from-just-bash');
    expect(Number(imported.rows[0].mtime_ns)).toBe(100);
    const provenance = await pool.query(
      'SELECT 1 FROM _openeral.renamed_workspace_imports WHERE workspace_id = $1',
      ['renamed-workspace'],
    );
    expect(provenance.rows).toHaveLength(1);

    await pool.query(
      `UPDATE _openeral.workspace_files
          SET content = $2, size = $3, mtime_ns = 300
        WHERE workspace_id = $1 AND path = '/.openrind-shell/presign.json'`,
      ['renamed-workspace', Buffer.from('newer-fuse-side'), 15],
    );
    await pool.query(
      `UPDATE _openrind.workspace_files
          SET content = $2, size = $3, mtime_ns = 200
        WHERE workspace_id = $1 AND path = '/.openrind-shell/presign.json'`,
      ['renamed-workspace', Buffer.from('stale-compat'), 12],
    );
    await pool.query('DELETE FROM _openeral.schema_version WHERE version = 8');

    await runMigrations(pool);

    const retried = await pool.query(
      `SELECT content, mtime_ns, COUNT(*) OVER ()::int AS row_count
         FROM _openeral.workspace_files
        WHERE workspace_id = $1 AND path = '/.openrind-shell/presign.json'`,
      ['renamed-workspace'],
    );
    expect(Buffer.from(retried.rows[0].content).toString()).toBe('newer-fuse-side');
    expect(Number(retried.rows[0].mtime_ns)).toBe(300);
    expect(retried.rows[0].row_count).toBe(1);

    const prepared = await prepareFuseVolume(pool, 'renamed-workspace', 1000, 1000);
    expect(prepared.importedItems).toBe(2);
    const normalizedNames = await pool.query(
      `SELECT convert_from(name, 'UTF8') AS name
         FROM _openeral.fs_dirents
        WHERE volume_id = $1
        ORDER BY name`,
      [prepared.volumeId],
    );
    expect(normalizedNames.rows.map((row) => row.name)).toEqual([
      '.openrind-shell',
      'code.ts',
      'presign.json',
      'src',
    ]);
    await pool.end();
  }, 90_000);
});
