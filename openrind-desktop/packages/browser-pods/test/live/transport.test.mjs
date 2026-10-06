// This is a real TCP/WebSocket transport test with a fake CDP peer. It is not
// an OpenShell, credential-rewrite, Chromium, or agent-browser acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { PodRegistry } from '../../src/registry.mjs';
import { BrowserSessions } from '../../src/sessions.mjs';
import { createBroker } from '../../src/broker.mjs';
import { createHelper } from '../../src/helper.mjs';
import { HELPER_ORIGIN } from '../../src/contracts.mjs';
import { cdpCall, openWebSocket } from '../../src/transport.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
async function close(server) {
  server.closeAllConnections?.();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

test('Kernel create probes the full helper route; CDP relays a 17 MiB message', { timeout: 30_000 }, async t => {
  const peer = http.createServer();
  const proxy = http.createServer();
  const connections = new Set();
  let wss; let dir; let registry; let core; let broker; let helper;
  t.after(async () => {
    await helper?.close(); await broker?.close(); await core?.shutdown();
    for (const socket of connections) socket.destroy();
    for (const ws of wss?.clients ?? []) ws.terminate();
    wss?.close();
    await close(proxy); await close(peer); registry?.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  const peerPort = await listen(peer); // Fail visibly if this runner forbids TCP.
  wss = new WebSocketServer({ server: peer, maxPayload: 64 * 1024 * 1024 });
  wss.on('connection', ws => ws.on('message', (bytes, binary) => {
    if (binary) { ws.send(bytes, { binary: true }); return; }
    const message = JSON.parse(bytes.toString());
    ws.send(JSON.stringify({ id: message.id, result: { protocolVersion: '1.3' } }));
  }));
  dir = await mkdtemp(join(tmpdir(), 'browser-transport-'));
  registry = new PodRegistry(join(dir, 'sessions.sqlite'));
  const runtime = { provision: async () => ({ id: 'pod', instance: 'instance' }),
    stop: async () => ({ stopped: true }), remove: async () => ({ deleted: true }),
    cdpEndpoint: () => `ws://127.0.0.1:${peerPort}/cdp` };
  core = new BrowserSessions({ registry, runtime });
  const owner = { id: 'owner', generation: 'generation', workspaceId: 'workspace', helperOrigin: HELPER_ORIGIN, providers: ['kernel'] };
  const serviceToken = 'x'.repeat(43);
  await core.recover();
  broker = createBroker({ core, runtime, owners: [{ owner, serviceToken }] });
  const brokerPort = await listen(broker.server);
  let connects = 0;
  proxy.on('connect', (req, socket, head) => {
    assert.equal(req.url, `host.openshell.internal:${brokerPort}`); connects++;
    const remote = net.connect(brokerPort, '127.0.0.1');
    connections.add(remote); connections.add(socket);
    remote.once('connect', () => { socket.write('HTTP/1.1 200 Connected\r\n\r\n'); if (head.length) remote.write(head); socket.pipe(remote).pipe(socket); });
    for (const connection of [remote, socket]) {
      connection.on('error', () => { socket.destroy(); remote.destroy(); });
      connection.on('close', () => { connections.delete(connection); socket.destroy(); remote.destroy(); });
    }
  });
  const proxyPort = await listen(proxy);
  helper = createHelper({ brokerOrigin: `http://host.openshell.internal:${brokerPort}`,
    proxyUrl: `http://127.0.0.1:${proxyPort}`, placeholder: serviceToken, generation: owner.generation });
  await helper.start();
  const response = await fetch(`${HELPER_ORIGIN}/browsers`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ headless: true, stealth: false, timeout_seconds: 300 }) });
  assert.equal(response.status, 200);
  const session = await response.json();
  const ws = await openWebSocket(session.cdp_ws_url);
  assert.equal((await cdpCall(ws, 'Browser.getVersion')).protocolVersion, '1.3');
  const payload = Buffer.alloc(17 * 1024 * 1024, 71);
  const received = once(ws, 'message'); ws.send(payload);
  assert.deepEqual((await received)[0], payload);
  const closed = once(ws, 'close');
  const browserPeer = [...wss.clients].find(peer => peer.readyState === 1);
  browserPeer.close(4001, 'browser ended');
  const [code, reason] = await closed;
  assert.equal(code, 4001); assert.equal(reason.toString(), 'browser ended');
  const originalStop = core.stop.bind(core);
  let unblock;
  core.stop = () => new Promise(resolve => { unblock = resolve; });
  try {
    const started = performance.now();
    const refused = await fetch(`${HELPER_ORIGIN}/browsers/${session.session_id}`, { method: 'DELETE' });
    assert.ok(refused.status >= 500, 'an unconfirmed stop must not report success');
    const elapsed = performance.now() - started;
    assert.ok(elapsed >= 1900 && elapsed < 3000, `DELETE deadline took ${elapsed} ms`);
  } finally { core.stop = originalStop; unblock?.(); }
  assert.equal((await fetch(`${HELPER_ORIGIN}/browsers/${session.session_id}`, { method: 'DELETE' })).status, 204);
  assert.ok(connects >= 3);
});

test('new control registration replaces the same owner generation without old-close revocation', { timeout: 10_000 }, async t => {
  const revoked = []; const clients = [];
  const owner = { id: 'owner', generation: 'generation', workspaceId: 'workspace', helperOrigin: HELPER_ORIGIN, providers: ['kernel'] };
  const token = 'x'.repeat(43);
  const core = { ready: true, revokeOwner: async value => { revoked.push(value.id); } };
  const broker = createBroker({ core, runtime: {}, owners: [{ owner, serviceToken: token }] });
  t.after(async () => { for (const ws of clients) ws.terminate(); await broker.close(); });
  const port = await listen(broker.server);
  async function register() {
    let ready; const registered = new Promise(resolve => { ready = resolve; });
    const ws = await openWebSocket(`ws://127.0.0.1:${port}/control`, {
      headers: { authorization: `Bearer ${token}` }, onMessage: bytes => { if (JSON.parse(bytes).type === 'ready') ready(); },
    });
    clients.push(ws); await registered; return ws;
  }
  const first = await register(); const oldClosed = once(first, 'close');
  const second = await register(); await oldClosed;
  assert.deepEqual(revoked, []); assert.equal(second.readyState, 1);
  const stopped = once(second, 'close'); second.terminate(); await stopped;
  for (let i = 0; i < 100 && !revoked.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(revoked, ['owner']);
});
