import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { PodRegistry } from '../src/registry.mjs';
import { BrowserSessions } from '../src/sessions.mjs';
import { ARGIDE_PROFILE, HELPER_ORIGIN, PodError, normalizeHyperbrowser, normalizeKernel } from '../src/contracts.mjs';

const owner = { id: 'owner', generation: 'generation', workspaceId: 'workspace',
  providers: ['kernel', 'hyperbrowser'], helperOrigin: HELPER_ORIGIN };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function fixture(t, overrides = {}, settings = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'browser-pods-'));
  const registry = new PodRegistry(join(dir, 'registry.sqlite'));
  const removed = [];
  const runtime = {
    async provision(s) { return { id: s.name, instance: 'browser-instance' }; },
    async stop() { return { stopped: true }; },
    async remove(s) { removed.push(s.id); return { deleted: true }; }, ...overrides,
  };
  const core = new BrowserSessions({ registry, runtime, prepareAttachment: async () => {},
    stopTimeoutMs: 30, ...settings });
  await core.recover();
  t.after(async () => {
    await Promise.allSettled([...core.allocations.values(), ...core.cleanup.values()]);
    registry.close(); rmSync(dir, { recursive: true, force: true });
  });
  return { registry, core, removed, dir };
}

test('Kernel options match the pinned client and reject unsupported features', () => {
  assert.equal(normalizeKernel({}).effective.idleMs, 300_000);
  assert.equal(normalizeKernel({ timeout_seconds: 1 }).effective.idleMs, 1000);
  for (const value of [{ stealth: true }, { headless: false }, { profile: null },
    { timeout_seconds: '300' }, { timeout_seconds: 0 }, { timeout_seconds: 7201 }, { ownerId: 'other' }]) {
    assert.throws(() => normalizeKernel(value));
  }
});

test('Argide profile records no-op warnings without claiming feature parity', () => {
  const options = { region: 'us-west-2', screen: { width: 1440, height: 900 }, timeoutMinutes: 60,
    saveDownloads: true, enableWebRecording: true, enableVideoWebRecording: true,
    useStealth: true, adblock: true, trackers: true, annoyances: true, solveCaptchas: false };
  assert.throws(() => normalizeHyperbrowser(options));
  const normalized = normalizeHyperbrowser(options, ARGIDE_PROFILE);
  assert.equal(normalized.warnings.length, 7);
  assert.equal(normalized.effective.stealth, false);
  assert.equal(normalized.effective.lifetimeMs, 3600_000);
  assert.throws(() => normalizeHyperbrowser({ ...options, solveCaptchas: true }, ARGIDE_PROFILE));
});

test('SQLite admits only one broker and releases the lock on close', async t => {
  const { dir } = await fixture(t);
  assert.throws(() => new PodRegistry(join(dir, 'registry.sqlite')), /locked/);
});

test('owner and broker quotas include allocated sessions', async t => {
  const { core } = await fixture(t, {}, { ownerLimit: 1 });
  const session = await core.create(owner, normalizeKernel({}));
  assert.equal(session.state, 'Ready');
  assert.match(session.name, /^br-[a-f0-9]{16}$/);
  await assert.rejects(core.create(owner, normalizeKernel({})), { code: 'CAPACITY_EXHAUSTED' });
  await assert.rejects(core.stop({ ...owner, generation: 'different' }, session.id), { code: 'SESSION_NOT_FOUND' });
  await assert.rejects(core.stop({ ...owner, workspaceId: 'different' }, session.id), { code: 'SESSION_NOT_FOUND' });
});

test('only a stable request ID deduplicates create; conflicting bodies fail', async t => {
  const { core } = await fixture(t);
  const a = await core.create(owner, normalizeKernel({}), { requestId: 'request1' });
  const b = await core.create(owner, normalizeKernel({}), { requestId: 'request1' });
  assert.equal(a.id, b.id);
  await assert.rejects(core.create(owner, normalizeKernel({ timeout_seconds: 1 }), { requestId: 'request1' }),
    { code: 'REQUEST_ID_CONFLICT' });
  const c = await core.create(owner, normalizeKernel({}));
  assert.notEqual(a.id, c.id);
});

test('late create after timeout remains tracked and is cleaned up', async t => {
  const allocation = deferred();
  const { core, registry, removed } = await fixture(t, { provision: () => allocation.promise }, { createTimeoutMs: 15 });
  await assert.rejects(core.create(owner, normalizeKernel({})), { code: 'CREATE_CANCELLED' });
  const pending = registry.all()[0];
  assert.equal(pending.state, 'CleanupPending');
  assert.equal(pending.resourceDeletedAt, null);
  allocation.resolve({ id: pending.name, instance: 'late-browser' });
  await sleep(20);
  assert.deepEqual(removed, [pending.id]);
  assert.equal(registry.get(pending.id).state, 'Stopped');
});

test('cancelled HTTP caller cannot leave an untracked allocation', async t => {
  const allocation = deferred();
  const { core, registry } = await fixture(t, { provision: () => allocation.promise });
  const controller = new AbortController();
  const created = core.create(owner, normalizeKernel({}), { signal: controller.signal });
  controller.abort();
  await assert.rejects(created, { code: 'CREATE_CANCELLED' });
  allocation.resolve({ id: registry.all()[0].name, instance: 'late' });
  await sleep(20);
  assert.equal(registry.all()[0].state, 'Stopped');
});

test('stop acknowledgement does not release quota before container deletion', async t => {
  const deletion = deferred();
  const { core, registry } = await fixture(t, { remove: () => deletion.promise }, { ownerLimit: 1 });
  const session = await core.create(owner, normalizeKernel({}));
  const stopped = await core.stop(owner, session.id);
  assert.notEqual(stopped.browserStoppedAt, null);
  assert.equal(stopped.resourceDeletedAt, null);
  assert.equal(stopped.state, 'CleanupPending');
  await assert.rejects(core.create(owner, normalizeKernel({})), { code: 'CAPACITY_EXHAUSTED' });
  assert.notEqual((await core.stop(owner, session.id)).browserStoppedAt, null);
  deletion.resolve({ deleted: true });
  await sleep(10);
  assert.equal(registry.get(session.id).state, 'Stopped');
  assert.equal((await core.create(owner, normalizeKernel({}))).state, 'Ready');
});

test('unconfirmed stop returns an error and retains quota', async t => {
  const { core, registry } = await fixture(t, { stop: async () => ({ stopped: false }) });
  const session = await core.create(owner, normalizeKernel({}));
  await assert.rejects(core.stop(owner, session.id), { code: 'STOP_UNCONFIRMED' });
  assert.equal(registry.get(session.id).browserStoppedAt, null);
  assert.equal(registry.get(session.id).resourceDeletedAt, null);
});

test('old close events cannot reset the lease of a new controlling connection', async t => {
  let now = 100;
  const { core, registry } = await fixture(t, {}, { clock: () => now });
  const session = await core.create(owner, normalizeKernel({ timeout_seconds: 2 }));
  const a = core.acquire(owner, session.attachment, () => {});
  const b = core.acquire(owner, session.attachment, () => {});
  a.release(); a.release();
  assert.equal(registry.get(session.id).idleExpiresAt, null);
  now += 3000; await core.sweep();
  assert.equal(registry.get(session.id).state, 'Ready');
  b.release();
  assert.equal(registry.get(session.id).idleExpiresAt, now + 2000);
  now += 2001; await core.sweep();
  assert.equal(registry.get(session.id).state, 'Stopped');
});

test('hard lifetime expires even with a controlling connection', async t => {
  let now = 100;
  const { core, registry } = await fixture(t, {}, { clock: () => now });
  const session = await core.create(owner, normalizeKernel({}));
  let closed = false;
  core.acquire(owner, session.attachment, () => { closed = true; });
  now = session.expiresAt + 1;
  await core.sweep();
  assert.equal(closed, true);
  assert.equal(registry.get(session.id).state, 'Stopped');
});

test('broker recovery revokes old generations before accepting new creates', async t => {
  const { core, registry } = await fixture(t);
  const session = await core.create(owner, normalizeKernel({}));
  const next = new BrowserSessions({ registry, runtime: core.runtime, prepareAttachment: async () => {} });
  await assert.rejects(next.create(owner, normalizeKernel({})), { code: 'BROKER_NOT_READY' });
  await next.recover();
  assert.equal(registry.get(session.id).state, 'Stopped');
  assert.throws(() => next.acquire(owner, session.attachment, () => {}), { code: 'SESSION_NOT_FOUND' });
});

test('uncertain create survives restart with quota and bounded cleanup backoff', async t => {
  let now = 1000; let attempts = 0;
  const { core, registry } = await fixture(t, {}, { clock: () => now, ownerLimit: 1 });
  const old = await core.create(owner, normalizeKernel({}));
  registry.update(old.id, s => { s.handle = null; });
  const runtime = { ...core.runtime, stop: async s => {
    if (s.id === old.id) { attempts++; throw new PodError('CREATE_OUTCOME_UNKNOWN'); }
    return { stopped: true };
  } };
  const next = new BrowserSessions({ registry, runtime, prepareAttachment: async () => {}, clock: () => now, ownerLimit: 1 });
  await next.recover();
  assert.equal(next.ready, true);
  assert.equal(registry.get(old.id).cleanupError, 'CREATE_OUTCOME_UNKNOWN');
  assert.equal(registry.get(old.id).resourceDeletedAt, null);
  assert.equal(attempts, 1);
  await assert.rejects(next.create(owner, normalizeKernel({})), { code: 'CAPACITY_EXHAUSTED' });
  assert.equal((await next.create({ ...owner, id: 'different-owner' }, normalizeKernel({}))).state, 'Ready');
  now = 1999; await next.sweep(); assert.equal(attempts, 1);
  now = 2000; await next.sweep(); assert.equal(attempts, 2);
  assert.equal(registry.get(old.id).nextCleanupAt, 4000);
  now = 3999; await next.sweep(); assert.equal(attempts, 2);
  const restarted = new BrowserSessions({ registry, runtime, prepareAttachment: async () => {}, clock: () => now });
  await restarted.recover();
  assert.equal(restarted.ready, true); assert.equal(registry.get(old.id).resourceDeletedAt, null);
});

test('create, attachment and sweep do not enumerate retained terminal records', async t => {
  const { core, registry } = await fixture(t);
  registry.all = () => assert.fail('hot path must use indexed queries');
  const session = await core.create(owner, normalizeKernel({}), { requestId: 'request' });
  assert.equal((await core.create(owner, normalizeKernel({}), { requestId: 'request' })).id, session.id);
  const stream = core.acquire(owner, session.attachment, () => {});
  await core.sweep(); stream.release(); await core.stop(owner, session.id);
});

test('stop waits for a signal from cleanup rather than polling the registry', async t => {
  const stopped = deferred();
  const { core, registry } = await fixture(t, { stop: () => stopped.promise }, { stopTimeoutMs: 500 });
  const session = await core.create(owner, normalizeKernel({}));
  let reads = 0; const get = registry.get.bind(registry);
  registry.get = id => { reads++; return get(id); };
  const stopping = core.stop(owner, session.id);
  const before = reads; await sleep(50);
  assert.equal(reads, before);
  stopped.resolve({ stopped: true });
  assert.notEqual((await stopping).browserStoppedAt, null);
  assert.equal(core.stopWaiters.size, 0);
});

test('shutdown confirms completed deletion even when its retry time is in the future', async t => {
  let attempts = 0;
  const { core, registry } = await fixture(t, { remove: async () => {
    if (++attempts === 1) throw new PodError('CLEANUP_PENDING');
    return { deleted: true };
  } }, { clock: () => 100 });
  const session = await core.create(owner, normalizeKernel({}));
  await core.stop(owner, session.id); await Promise.all([...core.cleanup.values()]);
  assert.equal(registry.get(session.id).resourceDeletedAt, null);
  assert.ok(registry.get(session.id).nextCleanupAt > 100);
  await core.shutdown();
  assert.equal(registry.get(session.id).resourceDeletedAt, 100);
  assert.equal(attempts, 2);
});

test('owner loss revokes all attachments before waiting for a slow deletion', async t => {
  const deletion = deferred();
  const { core, registry } = await fixture(t, { remove: () => deletion.promise });
  const sessions = [await core.create(owner, normalizeKernel({})), await core.create(owner, normalizeKernel({}))];
  const closed = [];
  for (const session of sessions) core.acquire(owner, session.attachment, () => closed.push(session.id));
  const revoked = core.revokeOwner(owner);
  try {
    assert.deepEqual(closed, sessions.map(session => session.id));
    for (const session of sessions) {
      assert.notEqual(registry.get(session.id).accessRevokedAt, null);
      assert.equal(registry.get(session.id).resourceDeletedAt, null);
    }
  } finally { deletion.resolve({ deleted: true }); await revoked; }
});

test('maintenance revokes all expired sessions without waiting for cleanup', async t => {
  let now = 100;
  const deletion = deferred();
  const { core, registry } = await fixture(t, { remove: () => deletion.promise }, { clock: () => now });
  const sessions = [await core.create(owner, normalizeKernel({})), await core.create(owner, normalizeKernel({}))];
  now = sessions[0].expiresAt + 1;
  let returned = false;
  const sweep = core.sweep({ waitForCleanup: false }).then(() => { returned = true; });
  try {
    await Promise.resolve();
    assert.equal(returned, true, 'cleanup must not block the next heartbeat');
    for (const session of sessions) assert.notEqual(registry.get(session.id).accessRevokedAt, null);
    assert.equal(core.cleanup.size, 2);
  } finally {
    deletion.resolve({ deleted: true }); await sweep;
    await Promise.all([...core.cleanup.values()]);
  }
});
