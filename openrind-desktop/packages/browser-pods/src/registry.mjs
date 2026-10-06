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
      requireThat((id === 0 && version === 0) || (id === APPLICATION_ID && version === 1), 'WRONG_REGISTRY');
      if (version === 0) this.db.exec(`BEGIN EXCLUSIVE;
        CREATE TABLE sessions(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE audit(seq INTEGER PRIMARY KEY, at INTEGER NOT NULL, event TEXT NOT NULL, session TEXT, code TEXT);
        PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=1; COMMIT;`);
    } catch (error) { this.db.close(); throw error; }
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  all() { return this.db.prepare('SELECT data FROM sessions ORDER BY rowid').all().map(row => JSON.parse(row.data)); }
  get(id) { const row = this.db.prepare('SELECT data FROM sessions WHERE id=?').get(id); return row && JSON.parse(row.data); }
  put(session) {
    this.db.prepare('INSERT INTO sessions VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
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
