import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDatabaseConnection, stopEmbeddedDatabase } from './embedded.js';
import {
  buildFuseRuntimeIdentity,
  fuseDatasourceHash,
  fuseRuntimeIdentityMatches,
  prepareFuseVolume,
  writeJsonAtomic,
} from './fuse-init.js';
import { runMigrations } from './migrations.js';

const originalDataDir = process.env.OPENERAL_DATA_DIR;
const originalDatabaseUrl = process.env.DATABASE_URL;
const temporaryPaths: string[] = [];

afterEach(async () => {
  await stopEmbeddedDatabase();
  if (originalDataDir === undefined) delete process.env.OPENERAL_DATA_DIR;
  else process.env.OPENERAL_DATA_DIR = originalDataDir;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('FUSE initialization', () => {
  it('uses the same datasource identity contract as the Rust daemon', () => {
    expect(fuseDatasourceHash('postgresql://example/test')).toBe(
      'be400ba13374bc4bd8e768123fb787d3bf01a166f7737e969e7b64c997c500e8',
    );
  });

  it('writes and validates an atomic runtime identity marker', () => {
    const root = mkdtempSync(join(tmpdir(), 'openeral-fuse-marker-'));
    temporaryPaths.push(root);
    const markerPath = join(root, 'database.ready');
    const marker = buildFuseRuntimeIdentity('workspace-a', 'postgresql://example/test');
    writeJsonAtomic(markerPath, marker);

    expect(JSON.parse(readFileSync(markerPath, 'utf8'))).toMatchObject(marker);
    expect(fuseRuntimeIdentityMatches(
      markerPath,
      'workspace-a',
      'postgresql://example/test',
    )).toBe(true);
    expect(fuseRuntimeIdentityMatches(
      markerPath,
      'workspace-b',
      'postgresql://example/test',
    )).toBe(false);
  });

  it('creates a normalized volume and imports only persistent legacy prefixes once', async () => {
    const root = mkdtempSync(join(tmpdir(), 'openeral-fuse-init-'));
    temporaryPaths.push(root);
    delete process.env.DATABASE_URL;
    process.env.OPENERAL_DATA_DIR = join(root, 'pglite');
    const { pool } = await getDatabaseConnection();
    await runMigrations(pool);
    await pool.query(
      `INSERT INTO _openeral.workspace_config (id, display_name, config)
       VALUES ('fuse-test', 'test', '{}'::jsonb)`,
    );
    for (const [path, parent, name, isDir, content] of [
      ['/', '', '', true, null],
      ['/.claude', '/', '.claude', true, null],
      ['/.claude/settings.json', '/.claude', 'settings.json', false, Buffer.from('{}')],
      ['/src', '/', 'src', true, null],
      ['/src/code.ts', '/src', 'code.ts', false, Buffer.from('not imported')],
    ] as const) {
      await pool.query(
        `INSERT INTO _openeral.workspace_files
          (workspace_id, path, parent_path, name, is_dir, content, mode, size,
           mtime_ns, ctime_ns, atime_ns, nlink, uid, gid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1, 1, $9, 1000, 1000)`,
        [
          'fuse-test', path, parent, name, isDir, content,
          isDir ? 0o40755 : 0o100600,
          content?.length ?? 0,
          isDir ? 2 : 1,
        ],
      );
    }

    const prepared = await prepareFuseVolume(pool, 'fuse-test', 998, 998);
    expect(prepared.volumeId).toBe('workspace:fuse-test');
    expect(prepared.importedItems).toBe(2);
    const rootOwner = await pool.query(
      `SELECT uid, gid FROM _openeral.fs_nodes
        WHERE volume_id = $1 AND node_id = $2`,
      ['workspace:fuse-test', prepared.rootNodeId],
    );
    expect(rootOwner.rows[0]).toMatchObject({ uid: 998, gid: 998 });
    const dirents = await pool.query(
      `SELECT convert_from(name, 'UTF8') AS name
         FROM _openeral.fs_dirents
        WHERE volume_id = $1
        ORDER BY name`,
      ['workspace:fuse-test'],
    );
    expect(dirents.rows.map(row => row.name)).toEqual(['.claude', 'settings.json']);

    const repeated = await prepareFuseVolume(pool, 'fuse-test', 997, 997);
    expect(repeated.importedItems).toBe(0);
    const remappedRootOwner = await pool.query(
      `SELECT uid, gid FROM _openeral.fs_nodes
        WHERE volume_id = $1 AND node_id = $2`,
      ['workspace:fuse-test', repeated.rootNodeId],
    );
    expect(remappedRootOwner.rows[0]).toMatchObject({ uid: 997, gid: 997 });
    await pool.end();
  }, 30_000);
});
