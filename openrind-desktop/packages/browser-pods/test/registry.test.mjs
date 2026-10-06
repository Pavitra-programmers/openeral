import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PodRegistry } from '../src/registry.mjs';
import { resolveAbsent } from '../src/operator.mjs';

function record(id, deletedAt = null) {
  return { id, name: `pod-${id}`, ownerId: 'owner', ownerGeneration: 'generation', workspaceId: 'workspace',
    requestId: id, attachment: deletedAt === null ? `attachment-${id}` : null, handle: null,
    createdAt: 1, options: { provider: 'kernel' }, resourceDeletedAt: deletedAt,
    accessRevokedAt: 1, browserStoppedAt: deletedAt, state: deletedAt === null ? 'CleanupPending' : 'Stopped',
    cleanupError: 'CREATE_OUTCOME_UNKNOWN' };
}
function fixture(t, { legacy = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pod-registry-'));
  const path = join(dir, 'registry.sqlite');
  if (legacy) {
    const db = new DatabaseSync(path);
    db.exec(`CREATE TABLE sessions(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE audit(seq INTEGER PRIMARY KEY, at INTEGER NOT NULL, event TEXT NOT NULL, session TEXT, code TEXT);
      PRAGMA application_id=1330790992; PRAGMA user_version=1;`);
    db.prepare('INSERT INTO sessions VALUES (?,?)').run('old', JSON.stringify(record('old')));
    db.close();
  }
  const registry = new PodRegistry(path);
  t.after(() => { registry.close(); rmSync(dir, { recursive: true, force: true }); });
  return registry;
}

test('registry v1 migration preserves pending resources and indexes active queries', t => {
  const registry = fixture(t, { legacy: true });
  assert.equal(registry.db.prepare('PRAGMA user_version').get().user_version, 2);
  assert.deepEqual(registry.get('old'), record('old'));
  const owner = { id: 'owner', generation: 'generation', workspaceId: 'workspace' };
  assert.equal(registry.request(owner, 'old').id, 'old');
  assert.equal(registry.attachment(owner, 'attachment-old').id, 'old');
  assert.deepEqual({ ...registry.counts('owner') }, { total: 1, owner: 1 });
  const query = registry.db.prepare('EXPLAIN QUERY PLAN SELECT data FROM sessions WHERE deleted_at IS NULL').all();
  assert.ok(query.some(row => row.detail.includes('sessions_active')));
});

test('retention deletes old terminal records in batches but keeps uncertain resources', t => {
  const registry = fixture(t);
  const now = 200_000_000;
  registry.transaction(() => {
    for (let i = 0; i < 201; i++) registry.put(record(`old-${i}`, 1));
    registry.put(record('pending')); registry.put(record('recent', now));
    registry.db.prepare('INSERT INTO audit(at,event) VALUES(?,?)').run(1, 'old');
    registry.db.prepare('INSERT INTO audit(at,event) VALUES(?,?)').run(now, 'recent');
  });
  assert.deepEqual(registry.prune(now), { sessions: 200, audit: 1 });
  assert.equal(registry.active().length, 1);
  assert.equal(registry.all().length, 3);
  registry.prune(now);
  assert.deepEqual(registry.all().map(s => s.id), ['pending', 'recent']);
  assert.equal(registry.db.prepare('SELECT COUNT(*) AS count FROM audit').get().count, 1);
});

test('operator resolution requires an explicit confirmation, uncertain intent and absent resource', async t => {
  const registry = fixture(t); registry.put(record('unknown'));
  const runtime = { inventory: async () => undefined };
  await assert.rejects(resolveAbsent(registry, runtime, 'unknown', { reason: 'ticket-1' }), { code: 'OPERATOR_CONFIRMATION_REQUIRED' });
  const options = { confirmNoPendingCreate: true, reason: 'ticket-1' };
  await assert.rejects(resolveAbsent(registry, { inventory: async () => ({ id: 'late' }) }, 'unknown', options), { code: 'RESOURCE_STILL_PRESENT' });
  assert.equal(registry.counts('owner').owner, 1);
  await resolveAbsent(registry, runtime, 'unknown', options);
  assert.equal(registry.counts('owner').owner, 0);
  assert.equal(registry.get('unknown').attachment, null);
  assert.equal(registry.get('unknown').operatorResolution, 'ticket-1');
  assert.equal(registry.db.prepare("SELECT code FROM audit WHERE event='operator-resolved-absent'").get().code, 'ticket-1');
  await assert.rejects(resolveAbsent(registry, runtime, 'unknown', options), { code: 'NOT_UNCERTAIN_CREATE' });
});
