import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { HELPER_ORIGIN, MAX_CDP, PodError, deadline, digest, errorResponse, normalizeKernel, parseProbeResult,
  requireThat, validateOwner } from './contracts.mjs';
import { boundedServer, clientRequest, jsonBody, openWebSocket, rejectUpgrade, relayWebSockets, reply } from './transport.mjs';

export async function kernelRequest(core, owner, { method, path, body, requestId, signal }) {
  if (method === 'POST' && path === '/browsers') {
    const session = await core.create(owner, normalizeKernel(body), { requestId, signal });
    return { status: 200, body: { session_id: session.id,
      cdp_ws_url: `${HELPER_ORIGIN.replace('http:', 'ws:')}/cdp/${session.attachment}` } };
  }
  const deleted = path.match(/^\/browsers\/([a-f0-9-]{36})$/);
  if (method === 'DELETE' && deleted) {
    await core.stop(owner, deleted[1]);
    return { status: 204 };
  }
  // Stage 2 artifacts and Hyperbrowser routes are deliberately not fake successes.
  throw new PodError('ROUTE_NOT_FOUND', 404);
}

export function createBroker({ core, owners, runtime }) {
  const auth = new Map();
  const identities = new Set();
  let closing = false;
  for (const config of owners) {
    requireThat(/^[A-Za-z0-9_-]{32,128}$/.test(config.serviceToken), 'INVALID_BROKER_CREDENTIAL');
    const hash = digest(config.serviceToken);
    requireThat(!auth.has(hash), 'DUPLICATE_BROKER_CREDENTIAL');
    const owner = validateOwner(config.owner);
    requireThat(!identities.has(owner.id), 'DUPLICATE_OWNER_CONFIG');
    identities.add(owner.id);
    auth.set(hash, owner);
  }
  const controls = new Map();
  const pending = new Map();
  const budget = { bytes: 0, max: 128 * 1024 * 1024 };
  const controlServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  const cdpServer = new WebSocketServer({ noServer: true, maxPayload: MAX_CDP, perMessageDeflate: false });
  const ownerKey = owner => `${owner.id}:${owner.generation}`;
  function authorize(req) {
    const header = req.headers.authorization ?? '';
    requireThat(/^Bearer [A-Za-z0-9_-]{32,128}$/.test(header), 'UNAUTHORIZED', 401);
    const owner = auth.get(digest(header.slice(7)));
    requireThat(owner, 'UNAUTHORIZED', 401);
    return owner;
  }
  core.prepareAttachment = async (owner, session) => {
    const control = controls.get(ownerKey(owner));
    requireThat(control?.readyState === WebSocket.OPEN, 'HELPER_UNAVAILABLE');
    const requestId = randomUUID();
    const response = new Promise((resolve, reject) => pending.set(requestId, { control, resolve, reject }));
    try {
      control.send(JSON.stringify({ type: 'probe', requestId,
        url: `${HELPER_ORIGIN.replace('http:', 'ws:')}/cdp/${session.attachment}` }));
      const result = await deadline(response, 5000, 'HELPER_PROBE_TIMEOUT');
      requireThat(result.ok === true, 'HELPER_PROBE_FAILED');
    } finally { pending.delete(requestId); }
  };

  const server = boundedServer(http.createServer(async (req, res) => {
    const controller = new AbortController();
    req.on('aborted', () => controller.abort());
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const url = clientRequest(req);
      const owner = authorize(req);
      requireThat(controls.get(ownerKey(owner))?.readyState === WebSocket.OPEN, 'HELPER_UNAVAILABLE');
      const body = req.method === 'POST' ? await jsonBody(req) : undefined;
      const result = await kernelRequest(core, owner, { method: req.method, path: url.pathname, body,
        requestId: req.headers['idempotency-key'], signal: controller.signal });
      reply(res, result.status, result.body);
    } catch (error) { const result = errorResponse(error); reply(res, result.status, result.body); }
  }));

  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => {});
    let lease; let remote;
    try {
      const url = clientRequest(req);
      requireThat(req.method === 'GET', 'METHOD_NOT_ALLOWED', 405);
      const owner = authorize(req);
      const key = ownerKey(owner);
      if (url.pathname === '/control') {
        requireThat(core.ready, 'BROKER_NOT_READY');
        requireThat(!controls.has(key), 'HELPER_ALREADY_REGISTERED', 409);
        controlServer.handleUpgrade(req, socket, head, ws => {
          controls.set(key, ws);
          let alive = true;
          const heartbeat = setInterval(() => {
            if (!alive) { ws.terminate(); return; }
            alive = false; ws.ping();
          }, 5000);
          ws.on('pong', () => { alive = true; });
          ws.on('error', () => ws.terminate());
          ws.on('message', data => {
            let message; try { message = parseProbeResult(data); } catch { ws.terminate(); return; }
            const entry = pending.get(message.requestId);
            if (entry?.control === ws) entry.resolve(message);
          });
          ws.on('close', () => {
            clearInterval(heartbeat);
            if (controls.get(key) === ws) controls.delete(key);
            for (const entry of pending.values()) if (entry.control === ws) entry.reject(new PodError('HELPER_LOST'));
            if (!closing) void core.revokeOwner(owner).catch(() => { core.ready = false; });
          });
          ws.send(JSON.stringify({ type: 'ready', generation: owner.generation }));
        });
        return;
      }
      requireThat(controls.has(key), 'HELPER_UNAVAILABLE');
      const match = url.pathname.match(/^\/cdp\/([A-Za-z0-9_-]{43})$/);
      requireThat(match, 'ROUTE_NOT_FOUND', 404);
      lease = core.acquire(owner, match[1], () => { socket.destroy(); remote?.terminate(); });
      socket.once('close', () => { lease.release(); remote?.terminate(); });
      const endpoint = runtime.cdpEndpoint(lease.session);
      remote = await openWebSocket(`${endpoint}${url.search}`, { pauseOnOpen: true });
      requireThat(!socket.destroyed && core.isLive(core.registry.get(lease.session.id)), 'SESSION_REVOKED', 410);
      cdpServer.handleUpgrade(req, socket, head, client => {
        relayWebSockets(client, remote, budget);
        client.once('close', lease.release);
      });
    } catch (error) {
      remote?.terminate(); lease?.release();
      rejectUpgrade(socket, errorResponse(error).status);
    }
  });
  return { server, async close() {
    closing = true;
    const sockets = [...controls.values(), ...cdpServer.clients];
    const stopped = sockets.map(ws => new Promise(resolve => {
      if (ws.readyState === WebSocket.CLOSED) resolve(); else ws.once('close', resolve);
    }));
    for (const control of controls.values()) control.terminate();
    for (const ws of cdpServer.clients) ws.terminate();
    await Promise.all(stopped);
    for (const config of owners) await core.revokeOwner(config.owner);
    controlServer.close(); cdpServer.close();
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  } };
}
