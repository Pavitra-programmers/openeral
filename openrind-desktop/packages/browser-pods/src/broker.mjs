import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { HELPER_ORIGIN, MAX_CDP, PodError, deadline, digest, errorResponse, normalizeKernel, parseProbeResult,
  requireThat, validateOwner } from './contracts.mjs';
import { boundedServer, clientRequest, jsonBody, openWebSocket, rejectUpgrade, relayWebSockets, reply } from './transport.mjs';
import { artifactRoute, hyperbrowserRequest, ownedHyperbrowser, sessionRoute } from './hyperbrowser.mjs';

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
      const sessionMatch = url.pathname.match(sessionRoute);
      const artifactMatch = url.pathname.match(artifactRoute);
      const upload = req.method === 'POST' && sessionMatch?.[2] === 'uploads';
      const archive = req.method === 'GET' && sessionMatch?.[2] === 'downloads-url';
      if (upload || archive || (req.method === 'GET' && artifactMatch)) {
        const id = sessionMatch?.[1] ?? artifactMatch[1];
        ownedHyperbrowser(core, owner, id, { live: true });
        const transfer = core.beginTransfer(owner, id);
        const signal = AbortSignal.any([transfer.signal, controller.signal, AbortSignal.timeout(60_000)]);
        try {
          if (artifactMatch) await runtime.streamArtifact(transfer.session, artifactMatch[2], req, res, signal);
          else {
            const result = upload ? await runtime.upload(transfer.session, req, signal) : await runtime.downloads(transfer.session, signal);
            requireThat(core.isLive(core.registry.get(id)), 'SESSION_REVOKED', 410);
            if (archive && result.status === 'completed') {
              requireThat(/^[a-f0-9]{32}$/.test(result.artifactId), 'INVALID_ARTIFACT');
              reply(res, 200, { status: 'completed', downloadsUrl: `${HELPER_ORIGIN}/artifacts/${id}/${result.artifactId}` });
            } else reply(res, 200, result);
          }
        } finally { transfer.release(); }
        return;
      }
      const body = req.method === 'POST' ? await jsonBody(req, { allowEmpty: url.pathname === '/api/session' }) : undefined;
      const request = { method: req.method, path: url.pathname, url, body,
        requestId: req.headers['idempotency-key'], signal: controller.signal };
      const result = url.pathname.startsWith('/api/') ? await hyperbrowserRequest(core, owner, request) :
        await kernelRequest(core, owner, request);
      reply(res, result.status, result.body);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else { const result = errorResponse(error); reply(res, result.status, { ...result.body,
        code: result.body.error.code, message: result.body.error.message }); }
    }
  }));

  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => {});
    let lease; let remote; let upgraded = false;
    try {
      const url = clientRequest(req);
      requireThat(req.method === 'GET', 'METHOD_NOT_ALLOWED', 405);
      const owner = authorize(req);
      const key = ownerKey(owner);
      if (url.pathname === '/control') {
        requireThat(core.ready, 'BROKER_NOT_READY');
        controlServer.handleUpgrade(req, socket, head, ws => {
          const previous = controls.get(key);
          controls.set(key, ws);
          previous?.terminate();
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
            const current = controls.get(key) === ws;
            if (current) controls.delete(key);
            for (const entry of pending.values()) if (entry.control === ws) entry.reject(new PodError('HELPER_LOST'));
            if (!closing && current) void core.revokeOwner(owner).catch(() => { core.ready = false; });
          });
          ws.send(JSON.stringify({ type: 'ready', generation: owner.generation }));
        });
        return;
      }
      requireThat(controls.has(key), 'HELPER_UNAVAILABLE');
      const match = url.pathname.match(/^\/cdp\/([A-Za-z0-9_-]{43})$/);
      requireThat(match, 'ROUTE_NOT_FOUND', 404);
      lease = core.acquire(owner, match[1], () => { socket.destroy(); remote?.terminate(); });
      socket.once('close', () => { lease.release(); if (!upgraded) remote?.terminate(); });
      const endpoint = runtime.cdpEndpoint(lease.session);
      remote = await openWebSocket(`${endpoint}${url.search}`, { pauseOnOpen: true });
      requireThat(!socket.destroyed && core.isLive(core.registry.get(lease.session.id)), 'SESSION_REVOKED', 410);
      cdpServer.handleUpgrade(req, socket, head, client => {
        upgraded = true;
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
