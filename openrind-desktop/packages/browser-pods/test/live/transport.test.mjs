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
  ws.terminate();
  assert.equal((await fetch(`${HELPER_ORIGIN}/browsers/${session.session_id}`, { method: 'DELETE' })).status, 204);
  assert.ok(connects >= 3);
});
