import { DatabaseSync } from 'node:sqlite';
import { closeSync, constants, fchmodSync, fstatSync, mkdirSync, openSync, statSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { requireThat } from './contracts.mjs';

const APPLICATION_ID = 0x4f524250;

export class PodRegistry {
  constructor(path) {
    requireThat(isAbsolute(path), 'PRIVATE_REGISTRY_REQUIRED');
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const directory = statSync(dirname(path));
    requireThat((directory.mode & 0o077) === 0 && directory.uid === process.getuid(), 'PRIVATE_REGISTRY_REQUIRED');
    const fd = openSync(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    try {
      const info = fstatSync(fd);
      requireThat(info.isFile() && info.nlink === 1 && info.uid === process.getuid(), 'PRIVATE_REGISTRY_REQUIRED');
      fchmodSync(fd, 0o600);
    } finally { closeSync(fd); }
    this.db = new DatabaseSync(path);
    try {
      // SQLite holds the exclusive lock until close. The OS releases it on crash.
      // Unlike a PID file, this cannot leave a stale lock or race PID reuse.
      this.db.exec('PRAGMA locking_mode=EXCLUSIVE; PRAGMA busy_timeout=0; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
      this.db.exec('BEGIN EXCLUSIVE; COMMIT;');
      const id = this.db.prepare('PRAGMA application_id').get().application_id;
      const version = this.db.prepare('PRAGMA user_version').get().user_version;
      requireThat((id === 0 && version === 0) || (id === APPLICATION_ID && [1, 2].includes(version)), 'WRONG_REGISTRY');
      if (version === 0) this.db.exec(`BEGIN EXCLUSIVE;
        CREATE TABLE sessions(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE audit(seq INTEGER PRIMARY KEY, at INTEGER NOT NULL, event TEXT NOT NULL, session TEXT, code TEXT);
        PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=1; COMMIT;`);
      if (version < 2) {
        this.transaction(() => {
          for (const [column, field, type] of [
            ['deleted_at', 'resourceDeletedAt', 'INTEGER'], ['owner_id', 'ownerId', 'TEXT'],
            ['owner_generation', 'ownerGeneration', 'TEXT'], ['workspace_id', 'workspaceId', 'TEXT'],
            ['request_id', 'requestId', 'TEXT'], ['attachment', 'attachment', 'TEXT'],
            ['created_at', 'createdAt', 'INTEGER'], ['provider', 'options.provider', 'TEXT'],
          ]) this.db.exec(`ALTER TABLE sessions ADD COLUMN ${column} ${type}
            GENERATED ALWAYS AS (json_extract(data, '$.${field}')) VIRTUAL;`);
          this.db.exec(`
            CREATE INDEX sessions_active ON sessions(owner_id) WHERE deleted_at IS NULL;
            CREATE INDEX sessions_deleted ON sessions(deleted_at) WHERE deleted_at IS NOT NULL;
            CREATE INDEX sessions_request ON sessions(owner_id, owner_generation, workspace_id, request_id)
              WHERE request_id IS NOT NULL;
            CREATE UNIQUE INDEX sessions_attachment ON sessions(attachment) WHERE attachment IS NOT NULL;
            CREATE INDEX sessions_owner ON sessions(owner_id, owner_generation, workspace_id, provider, created_at DESC, id);
            CREATE INDEX audit_at ON audit(at);
            PRAGMA user_version=2;
          `);
        });
      }
    } catch (error) { this.db.close(); throw error; }
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  all() { return this.db.prepare('SELECT data FROM sessions ORDER BY rowid').all().map(row => JSON.parse(row.data)); }
  active() { return this.db.prepare('SELECT data FROM sessions WHERE deleted_at IS NULL').all().map(row => JSON.parse(row.data)); }
  counts(ownerId) {
    return this.db.prepare('SELECT COUNT(*) AS total, COUNT(CASE WHEN owner_id=? THEN 1 END) AS owner FROM sessions WHERE deleted_at IS NULL').get(ownerId);
  }
  request(owner, id) {
    const row = this.db.prepare('SELECT data FROM sessions WHERE owner_id=? AND owner_generation=? AND workspace_id=? AND request_id=?')
      .get(owner.id, owner.generation, owner.workspaceId, id);
    return row && JSON.parse(row.data);
  }
  attachment(owner, capability) {
    const row = this.db.prepare('SELECT data FROM sessions WHERE attachment=? AND deleted_at IS NULL AND owner_id=? AND owner_generation=? AND workspace_id=?')
      .get(capability, owner.id, owner.generation, owner.workspaceId);
    return row && JSON.parse(row.data);
  }
  listOwned(owner, { provider, page, perPage, status, now, generation }) {
    const state = `CASE WHEN json_extract(data, '$.accessRevokedAt') IS NULL
      AND json_extract(data, '$.brokerGeneration')=? AND json_extract(data, '$.state')='Ready'
      AND json_extract(data, '$.expiresAt')>?
      AND (json_extract(data, '$.idleExpiresAt') IS NULL OR json_extract(data, '$.idleExpiresAt')>?)
      THEN 'active' WHEN json_extract(data, '$.browserStoppedAt') IS NOT NULL THEN 'closed' ELSE 'error' END`;
    const filter = 'owner_id=? AND owner_generation=? AND workspace_id=? AND provider=?' + (status ? ` AND (${state})=?` : '');
    const values = [owner.id, owner.generation, owner.workspaceId, provider, ...(status ? [generation, now, now, status] : [])];
    const totalCount = this.db.prepare(`SELECT COUNT(*) AS count FROM sessions WHERE ${filter}`).get(...values).count;
    const sessions = this.db.prepare(`SELECT data FROM sessions WHERE ${filter} ORDER BY created_at DESC, id LIMIT ? OFFSET ?`)
      .all(...values, perPage, (page - 1) * perPage).map(row => JSON.parse(row.data));
    return { sessions, totalCount };
  }
  prune(now, retentionMs = 24 * 60 * 60 * 1000) {
    // Bound each maintenance batch. Active/uncertain resources are never pruned.
    return this.transaction(() => {
      const cutoff = now - retentionMs;
      const sessions = this.db.prepare('DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE deleted_at IS NOT NULL AND deleted_at<=? ORDER BY deleted_at LIMIT 200)').run(cutoff).changes;
      const audit = this.db.prepare('DELETE FROM audit WHERE seq IN (SELECT seq FROM audit WHERE at<=? ORDER BY at LIMIT 1000)').run(cutoff).changes;
      return { sessions, audit };
    });
  }
  get(id) { const row = this.db.prepare('SELECT data FROM sessions WHERE id=?').get(id); return row && JSON.parse(row.data); }
  put(session) {
    this.db.prepare('INSERT INTO sessions(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(session.id, JSON.stringify(session));
    return session;
  }
  update(id, change) {
    return this.transaction(() => {
      const session = this.get(id);
      requireThat(session, 'SESSION_NOT_FOUND', 404);
      change(session);
      return this.put(session);
    });
  }
  audit(event, id, code = null) {
    this.db.prepare('INSERT INTO audit(at,event,session,code) VALUES(?,?,?,?)').run(Date.now(), event, id, code);
  }
  close() { this.db.close(); }
}
