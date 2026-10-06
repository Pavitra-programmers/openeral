import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ARGIDE_PROFILE, HELPER_ORIGIN, normalizeHyperbrowser } from '../src/contracts.mjs';
import { PodRegistry } from '../src/registry.mjs';
import { BrowserSessions } from '../src/sessions.mjs';
import { hyperbrowserRequest } from '../src/hyperbrowser.mjs';
import { clientRequest } from '../src/transport.mjs';

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'hyperbrowser-contract-'));
  const registry = new PodRegistry(join(dir, 'sessions.sqlite'));
  const core = new BrowserSessions({ registry, prepareAttachment: async () => {}, runtime: {
    provision: async s => ({ id: s.id, instance: 'instance' }), stop: async () => ({ stopped: true }), remove: async () => ({ deleted: true }),
  } });
  const owner = { id: 'one', generation: 'generation', workspaceId: 'workspace', providers: ['hyperbrowser'],
    helperOrigin: HELPER_ORIGIN, compatibilityProfile: ARGIDE_PROFILE };
  await core.recover();
  t.after(async () => { await core.shutdown(); registry.close(); rmSync(dir, { recursive: true, force: true }); });
  const request = (method, path, body, identity = owner) => hyperbrowserRequest(core, identity,
    { method, url: clientRequest({ url: path, headers: {} }), body });
  return { core, owner, request };
}
test('Hyperbrowser create/get/list/stop share ownership, leases and honest fields', async t => {
  const { request, owner } = await fixture(t);
  const { body: session } = await request('POST', '/api/session', { useStealth: true, saveDownloads: true });
  assert.equal(session.status, 'active'); assert.equal(session.token, ''); assert.equal(session.liveUrl, undefined);
  assert.equal(session.launchState.useStealth, false);
  assert.deepEqual(session.openrind.warnings, ['useStealth:not-implemented']);
  assert.match(session.wsEndpoint, /^ws:\/\/127\.0\.0\.1:19300\/cdp\/[A-Za-z0-9_-]{43}$/);
  const get = await request('GET', `/api/session/${session.id}?liveViewTtlSeconds=3600`);
  assert.equal(get.body.wsEndpoint, session.wsEndpoint);
  assert.ok(get.body.openrind.warnings.includes('liveViewTtlSeconds:not-implemented'));
  const list = await request('GET', '/api/sessions?page=1&limit=10&status=active');
  assert.equal(list.body.totalCount, 1); assert.equal(list.body.perPage, 10);
  await assert.rejects(request('GET', `/api/session/${session.id}`, undefined, { ...owner, id: 'other' }), { code: 'SESSION_NOT_FOUND' });
  assert.equal((await request('GET', '/api/sessions', undefined, { ...owner, id: 'other' })).body.totalCount, 0);
  for (let i = 0; i < 2; i++) assert.deepEqual((await request('PUT', `/api/session/${session.id}/stop`)).body, { success: true });
  assert.equal((await request('GET', `/api/session/${session.id}`)).body.status, 'closed');
  assert.equal((await request('GET', `/api/session/${session.id}`)).body.wsEndpoint, '');
});
test('Hyperbrowser uses trusted profile selection and bounded query fields', async t => {
  const { request, owner } = await fixture(t);
  await assert.rejects(request('POST', '/api/session', { useStealth: true }, { ...owner, compatibilityProfile: undefined }), { code: 'UNSUPPORTED_OPTION' });
  await assert.rejects(request('POST', '/api/session', {}, { ...owner, providers: ['kernel'] }), { code: 'PROVIDER_DENIED' });
  for (const path of ['/api/sessions?limit=10000', '/api/sessions?page=0', '/api/sessions?status=unknown']) {
    await assert.rejects(request('GET', path));
  }
  for (const path of ['/api/sessions?limit=1&limit=2', '/api/session/id?owner=other', '/control?limit=10']) {
    assert.throws(() => clientRequest({ url: path, headers: {} }));
  }
});
test('stop cancels artifact streams and transfer capacity is separate from CDP', async t => {
  const { core, owner } = await fixture(t);
  const session = await core.create(owner, normalizeHyperbrowser({}, ARGIDE_PROFILE));
  const transfer = core.beginTransfer(owner, session.id);
  const cdp = core.acquire(owner, session.attachment, () => {});
  assert.throws(() => core.beginTransfer(owner, session.id), { code: 'TRANSFER_BUSY' });
  await core.stop(owner, session.id);
  assert.equal(transfer.signal.aborted, true); transfer.release(); cdp.release();
  assert.throws(() => core.beginTransfer(owner, session.id), { code: 'SESSION_NOT_FOUND' });
});
