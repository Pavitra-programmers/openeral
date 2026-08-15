import type pg from 'pg';
import type { DbPool } from './pool.js';

/**
 * Highest migration version this build knows how to apply. The storage schema
 * deliberately remains `_openeral`: public tool renames must not strand
 * existing compatibility rows or normalized FUSE volumes.
 */
export const SCHEMA_VERSION = 8;

const MIGRATION_LOCK_KEY = 1330795854;
const LOCK_WAIT_MS = 20_000;
const LOCK_POLL_MS = 500;
const DDL_LOCK_TIMEOUT_MS = 5_000;

async function currentSchemaVersion(client: pg.PoolClient): Promise<number> {
  try {
    const result = await client.query(
      `SELECT COALESCE(MAX(version), 0)::int AS version FROM _openeral.schema_version`,
    );
    return result.rows[0]?.version ?? 0;
  } catch (err) {
    if ((err as { code?: string }).code === '42P01') return 0;
    throw err;
  }
}

async function acquireMigrationLock(client: pg.PoolClient): Promise<boolean> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    const result = await client.query(
      `SELECT pg_try_advisory_lock($1::bigint) AS acquired`,
      [MIGRATION_LOCK_KEY],
    );
    if (result.rows[0]?.acquired) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
}

async function ensureIndex(
  client: pg.PoolClient,
  qualifiedIndexName: string,
  ddl: string,
): Promise<void> {
  const result = await client.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [
    qualifiedIndexName,
  ]);
  if (!result.rows[0]?.present) await client.query(ddl);
}

/**
 * Import compatibility rows written after the public Openrind rename.
 *
 * The primary FUSE branch deliberately retains `_openeral` as its stable
 * storage namespace. The just-bash branch briefly wrote its compatibility
 * workspace into `_openrind`, so copy those rows once without allowing stale
 * compatibility state to overwrite newer data already present here.
 */
async function importRenamedCompatibilitySchema(client: pg.PoolClient): Promise<void> {
  const source = await client.query(
    `SELECT
       to_regclass('_openrind.workspace_config') IS NOT NULL AS config_present,
       to_regclass('_openrind.workspace_files') IS NOT NULL AS files_present`,
  );
  if (!source.rows[0]?.config_present) return;

  await client.query(`
    INSERT INTO _openeral.workspace_config AS target
      (id, display_name, config, created_at, updated_at)
    SELECT id, display_name, config, created_at, updated_at
      FROM _openrind.workspace_config
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      config = EXCLUDED.config,
      created_at = LEAST(target.created_at, EXCLUDED.created_at),
      updated_at = EXCLUDED.updated_at
    WHERE EXCLUDED.updated_at > target.updated_at
  `);

  if (!source.rows[0]?.files_present) return;

  await client.query(`
    INSERT INTO _openeral.workspace_files AS target
      (workspace_id, path, parent_path, name, is_dir, content, mode, size,
       mtime_ns, ctime_ns, atime_ns, nlink, uid, gid)
    SELECT workspace_id, path, parent_path, name, is_dir, content, mode, size,
           mtime_ns, ctime_ns, atime_ns, nlink, uid, gid
      FROM _openrind.workspace_files
    ON CONFLICT (workspace_id, path) DO UPDATE SET
      parent_path = EXCLUDED.parent_path,
      name = EXCLUDED.name,
      is_dir = EXCLUDED.is_dir,
      content = EXCLUDED.content,
      mode = EXCLUDED.mode,
      size = EXCLUDED.size,
      mtime_ns = EXCLUDED.mtime_ns,
      ctime_ns = EXCLUDED.ctime_ns,
      atime_ns = EXCLUDED.atime_ns,
      nlink = EXCLUDED.nlink,
      uid = EXCLUDED.uid,
      gid = EXCLUDED.gid
    WHERE EXCLUDED.mtime_ns > target.mtime_ns
  `);

  await client.query(`
    INSERT INTO _openeral.renamed_workspace_imports (workspace_id)
    SELECT id FROM _openrind.workspace_config
    ON CONFLICT (workspace_id) DO NOTHING
  `);
}

async function applyMigrations(client: pg.PoolClient): Promise<void> {
      // V1: Create _openeral schema and schema_version table
      await client.query(`CREATE SCHEMA IF NOT EXISTS _openeral`);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // V2: Create mount_log table
      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.mount_log (
            id SERIAL PRIMARY KEY,
            mounted_at TIMESTAMPTZ DEFAULT NOW(),
            mount_point TEXT NOT NULL,
            schemas_filter TEXT[],
            page_size INTEGER,
            openeral_version TEXT
        )
      `);

      // V3: Create cache_hints table
      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.cache_hints (
            id SERIAL PRIMARY KEY,
            schema_name TEXT NOT NULL,
            table_name TEXT NOT NULL,
            hint_type TEXT NOT NULL,
            hint_value TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (schema_name, table_name, hint_type)
        )
      `);

      // V4: Create workspace_config, workspace_files, and index
      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.workspace_config (
            id TEXT PRIMARY KEY,
            display_name TEXT,
            config JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.workspace_files (
            workspace_id TEXT NOT NULL REFERENCES _openeral.workspace_config(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            parent_path TEXT NOT NULL,
            name TEXT NOT NULL,
            is_dir BOOLEAN NOT NULL DEFAULT false,
            content BYTEA,
            mode INTEGER NOT NULL DEFAULT 33188,
            size BIGINT NOT NULL DEFAULT 0,
            mtime_ns BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1e9)::BIGINT,
            ctime_ns BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1e9)::BIGINT,
            atime_ns BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1e9)::BIGINT,
            nlink INTEGER NOT NULL DEFAULT 1,
            uid INTEGER NOT NULL DEFAULT 1000,
            gid INTEGER NOT NULL DEFAULT 1000,
            PRIMARY KEY (workspace_id, path)
        )
      `);

      await ensureIndex(
        client,
        '_openeral.idx_ws_files_parent',
        `CREATE INDEX IF NOT EXISTS idx_ws_files_parent
            ON _openeral.workspace_files (workspace_id, parent_path)`,
      );

      // V5: Create optimization tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.optimization_metrics (
            id BIGSERIAL PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            original_model TEXT NOT NULL,
            original_prompt_tokens INTEGER NOT NULL,
            original_estimated_cost DECIMAL(10, 6) NOT NULL,
            optimized_model TEXT NOT NULL,
            optimized_prompt_tokens INTEGER NOT NULL,
            optimized_actual_cost DECIMAL(10, 6) NOT NULL,
            optimizations_applied TEXT[] NOT NULL,
            task_type TEXT NOT NULL,
            cache_hit BOOLEAN NOT NULL DEFAULT false,
            tokens_saved INTEGER NOT NULL,
            cost_saved DECIMAL(10, 6) NOT NULL,
            savings_percentage DECIMAL(5, 2) NOT NULL,
            metadata JSONB
        )
      `);

      await ensureIndex(
        client,
        '_openeral.idx_optimization_metrics_workspace',
        `CREATE INDEX IF NOT EXISTS idx_optimization_metrics_workspace
            ON _openeral.optimization_metrics (workspace_id, timestamp DESC)`,
      );

      await ensureIndex(
        client,
        '_openeral.idx_optimization_metrics_model',
        `CREATE INDEX IF NOT EXISTS idx_optimization_metrics_model
            ON _openeral.optimization_metrics (optimized_model, timestamp DESC)`,
      );

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.api_cache (
            key TEXT PRIMARY KEY,
            response JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await ensureIndex(
        client,
        '_openeral.idx_api_cache_created',
        `CREATE INDEX IF NOT EXISTS idx_api_cache_created
            ON _openeral.api_cache (created_at)`,
      );

      // V6: grant read access to Supabase's built-in dashboard/API roles so
      // `_openeral.*` rows are visible in the Table Editor and via PostgREST.
      // On non-Supabase PostgreSQL these roles don't exist; the GRANT fails
      // with `role "..." does not exist` and we ignore it — strictly a
      // visibility fix for Supabase-hosted databases.
      for (const role of ['service_role', 'dashboard_user', 'authenticated', 'anon']) {
        try {
          await client.query(`GRANT USAGE ON SCHEMA _openeral TO ${role}`);
        } catch (err) {
          if ((err as { code?: string }).code !== '42704') throw err; // undefined_object
        }
      }
      for (const role of ['service_role', 'dashboard_user']) {
        try {
          await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA _openeral TO ${role}`);
          await client.query(
            `ALTER DEFAULT PRIVILEGES IN SCHEMA _openeral GRANT SELECT ON TABLES TO ${role}`,
          );
        } catch (err) {
          if ((err as { code?: string }).code !== '42704') throw err;
        }
      }

      // V7: normalized filesystem storage for the primary FUSE runtime.
      // Node IDs are global and start above FUSE_ROOT_ID (1); a volume's
      // database root node is mapped to inode 1 only at the FUSE boundary.
      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.fs_volumes (
            volume_id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL UNIQUE,
            root_node_id BIGINT NOT NULL,
            schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.fs_nodes (
            volume_id TEXT NOT NULL,
            node_id BIGINT GENERATED ALWAYS AS IDENTITY (START WITH 2),
            kind SMALLINT NOT NULL CHECK (kind IN (1, 2, 3)),
            mode INTEGER NOT NULL CHECK (mode >= 0),
            uid INTEGER NOT NULL CHECK (uid >= 0),
            gid INTEGER NOT NULL CHECK (gid >= 0),
            size BIGINT NOT NULL DEFAULT 0 CHECK (size >= 0),
            nlink INTEGER NOT NULL CHECK (nlink >= 0),
            atime_ns BIGINT NOT NULL,
            mtime_ns BIGINT NOT NULL,
            ctime_ns BIGINT NOT NULL,
            generation BIGINT NOT NULL DEFAULT 1 CHECK (generation > 0),
            symlink_target BYTEA,
            deleted BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY (volume_id, node_id),
            UNIQUE (node_id),
            CONSTRAINT fs_nodes_volume_fk
              FOREIGN KEY (volume_id) REFERENCES _openeral.fs_volumes(volume_id)
              ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
            CONSTRAINT fs_nodes_kind_target_check CHECK (
              (kind = 3 AND symlink_target IS NOT NULL AND size = OCTET_LENGTH(symlink_target)) OR
              (kind IN (1, 2) AND symlink_target IS NULL)
            )
        )
      `);

      // The volume/root relation is cyclic during first creation, so both
      // sides are deferred and the root id is fixed before transaction commit.
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fs_volumes_root_fk'
              AND connamespace = '_openeral'::regnamespace
          ) THEN
            ALTER TABLE _openeral.fs_volumes
              ADD CONSTRAINT fs_volumes_root_fk
              FOREIGN KEY (volume_id, root_node_id)
              REFERENCES _openeral.fs_nodes(volume_id, node_id)
              DEFERRABLE INITIALLY DEFERRED;
          END IF;
        END
        $$
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.fs_dirents (
            volume_id TEXT NOT NULL,
            parent_node_id BIGINT NOT NULL,
            name BYTEA NOT NULL,
            child_node_id BIGINT NOT NULL,
            PRIMARY KEY (volume_id, parent_node_id, name),
            UNIQUE (volume_id, child_node_id),
            CONSTRAINT fs_dirents_parent_fk
              FOREIGN KEY (volume_id, parent_node_id)
              REFERENCES _openeral.fs_nodes(volume_id, node_id)
              ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
            CONSTRAINT fs_dirents_child_fk
              FOREIGN KEY (volume_id, child_node_id)
              REFERENCES _openeral.fs_nodes(volume_id, node_id)
              ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
            CONSTRAINT fs_dirents_name_check CHECK (
              OCTET_LENGTH(name) BETWEEN 1 AND 255
              AND name <> DECODE('2e', 'hex')
              AND name <> DECODE('2e2e', 'hex')
              AND POSITION(DECODE('2f', 'hex') IN name) = 0
              AND POSITION(DECODE('00', 'hex') IN name) = 0
            )
        )
      `);

      await ensureIndex(
        client,
        '_openeral.idx_fs_dirents_child',
        `CREATE INDEX IF NOT EXISTS idx_fs_dirents_child
          ON _openeral.fs_dirents (volume_id, child_node_id)`,
      );

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.fs_chunks (
            volume_id TEXT NOT NULL,
            node_id BIGINT NOT NULL,
            chunk_index BIGINT NOT NULL CHECK (chunk_index >= 0),
            data BYTEA NOT NULL CHECK (OCTET_LENGTH(data) <= 262144),
            PRIMARY KEY (volume_id, node_id, chunk_index),
            CONSTRAINT fs_chunks_node_fk
              FOREIGN KEY (volume_id, node_id)
              REFERENCES _openeral.fs_nodes(volume_id, node_id)
              ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.fs_mount_epochs (
            volume_id TEXT PRIMARY KEY REFERENCES _openeral.fs_volumes(volume_id) ON DELETE CASCADE,
            epoch BIGINT NOT NULL CHECK (epoch > 0),
            owner_id UUID NOT NULL,
            lease_expires_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await ensureIndex(
        client,
        '_openeral.idx_fs_mount_epochs_expiry',
        `CREATE INDEX IF NOT EXISTS idx_fs_mount_epochs_expiry
          ON _openeral.fs_mount_epochs (lease_expires_at)`,
      );

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.fs_operations (
            volume_id TEXT NOT NULL REFERENCES _openeral.fs_volumes(volume_id) ON DELETE CASCADE,
            epoch BIGINT NOT NULL CHECK (epoch > 0),
            operation_id UUID NOT NULL,
            request_hash BYTEA NOT NULL CHECK (OCTET_LENGTH(request_hash) = 32),
            result JSONB NOT NULL,
            committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (volume_id, epoch, operation_id)
        )
      `);

      await ensureIndex(
        client,
        '_openeral.idx_fs_operations_gc',
        `CREATE INDEX IF NOT EXISTS idx_fs_operations_gc
          ON _openeral.fs_operations (committed_at)`,
      );

      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.fs_legacy_imports (
            workspace_id TEXT PRIMARY KEY,
            volume_id TEXT NOT NULL REFERENCES _openeral.fs_volumes(volume_id) ON DELETE CASCADE,
            completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // V8: bridge compatibility data from the renamed just-bash branch.
      // Provenance lets first-time FUSE initialization import that branch's
      // full-home snapshot while older scoped workspaces retain their narrow
      // allowlist. The normalized FUSE schema remains `_openeral.fs_*`.
      await client.query(`
        CREATE TABLE IF NOT EXISTS _openeral.renamed_workspace_imports (
            workspace_id TEXT PRIMARY KEY
              REFERENCES _openeral.workspace_config(id) ON DELETE CASCADE,
            imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await importRenamedCompatibilitySchema(client);

}

/**
 * Run all database migrations (V1-V8) in order.
 *
 * The common path is one version query. Fresh or stale databases use a
 * bounded, polled advisory lock; catalog checks avoid taking table locks for
 * indexes that already exist. This matters when several FUSE sandboxes start
 * concurrently against the same PostgreSQL service.
 */
export async function runMigrations(pool: DbPool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 30000');

    if ((await currentSchemaVersion(client)) >= SCHEMA_VERSION) return;

    if (!(await acquireMigrationLock(client))) {
      if ((await currentSchemaVersion(client)) >= SCHEMA_VERSION) return;
      throw new Error(
        `Timed out after ${Math.round(LOCK_WAIT_MS / 1000)}s waiting for the migration `
        + `lock; the schema is still below v${SCHEMA_VERSION}.`,
      );
    }

    try {
      if ((await currentSchemaVersion(client)) >= SCHEMA_VERSION) return;

      await client.query(`SET lock_timeout = ${DDL_LOCK_TIMEOUT_MS}`);
      await applyMigrations(client);
      await client.query(
        `INSERT INTO _openeral.schema_version (version)
         SELECT generate_series(1, $1::int)
         ON CONFLICT (version) DO NOTHING`,
        [SCHEMA_VERSION],
      );
    } finally {
      try {
        await client.query('SET lock_timeout = 0');
      } catch {
        // The connection is released below even if session cleanup fails.
      }
      try {
        await client.query(`SELECT pg_advisory_unlock($1::bigint)`, [MIGRATION_LOCK_KEY]);
      } catch {
        // Advisory locks are session scoped and disappear with the session.
      }
    }
  } finally {
    client.release();
  }
}
