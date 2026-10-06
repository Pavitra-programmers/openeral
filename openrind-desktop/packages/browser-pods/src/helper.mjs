import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { HELPER_ORIGIN, MAX_CDP, PodError, deadline, errorResponse, requireThat } from './contracts.mjs';
import { OpenShellProxyAgent, boundedServer, cdpCall, clientRequest, jsonBody,
  openWebSocket, rejectUpgrade, relayWebSockets, reply } from './transport.mjs';

export function createHelper({ brokerOrigin, proxyUrl, placeholder, generation, onLost = () => {} }) {
  const broker = new URL(brokerOrigin);
  requireThat(broker.pathname === '/' && !broker.search && !broker.hash, 'INVALID_BROKER_ENDPOINT');
  requireThat(typeof placeholder === 'string' && placeholder.length > 0 && !/[\r\n]/.test(placeholder), 'PROVIDER_PLACEHOLDER_REQUIRED');
  const agent = new OpenShellProxyAgent(proxyUrl, broker.href);
  const headers = { authorization: `Bearer ${placeholder}` };
  const budget = { bytes: 0, max: 128 * 1024 * 1024 };
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CDP, perMessageDeflate: false });
  let control; let ready = false; let closing = false;
  function validate(req) {
    requireThat(req.headers.host === new URL(HELPER_ORIGIN).host, 'HOST_DENIED', 403);
    requireThat(ready, 'BROWSER_NOT_ENABLED');
    return clientRequest(req);
  }
  const server = boundedServer(http.createServer(async (req, res) => {
    let upstream; let timer;
    try {
      const url = validate(req);
      if (req.method === 'GET' && url.pathname === '/health') {
        reply(res, 200, { ready: true, generation, implementation: 'kernel-spike' }); return;
      }
      requireThat((req.method === 'POST' && url.pathname === '/browsers') ||
        (req.method === 'DELETE' && /^\/browsers\/[a-f0-9-]{36}$/.test(url.pathname)), 'ROUTE_NOT_FOUND', 404);
      // Only bounded provider JSON is read here. This helper has no file path API.
      const body = req.method === 'POST' ? JSON.stringify(await jsonBody(req)) : undefined;
      const outboundHeaders = { ...headers };
      if (body) { outboundHeaders['content-type'] = 'application/json'; outboundHeaders['content-length'] = Buffer.byteLength(body); }
      if (req.headers['idempotency-key']) outboundHeaders['idempotency-key'] = req.headers['idempotency-key'];
      upstream = http.request(new URL(url.pathname, broker), { method: req.method, agent, headers: outboundHeaders }, response => {
        res.writeHead(response.statusCode, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.pipe(res);
        response.on('error', () => res.destroy());
      });
      const fail = () => {
        if (res.headersSent) res.destroy();
        else reply(res, 504, { error: { code: req.method === 'DELETE' ? 'STOP_UNCONFIRMED' : 'BROKER_UNAVAILABLE' } });
      };
      timer = setTimeout(() => { upstream.destroy(); fail(); }, req.method === 'DELETE' ? 2000 : 65_000);
      upstream.on('error', fail);
      res.on('close', () => { clearTimeout(timer); upstream.destroy(); });
      res.on('finish', () => clearTimeout(timer));
      upstream.end(body);
    } catch (error) { clearTimeout(timer); upstream?.destroy(); const result = errorResponse(error); reply(res, result.status, result.body); }
  }));
  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => {});
    let remote;
    try {
      const url = validate(req);
      requireThat(req.method === 'GET' && /^\/cdp\/[A-Za-z0-9_-]{43}$/.test(url.pathname), 'ROUTE_NOT_FOUND', 404);
      remote = await openWebSocket(`${broker.href.replace('http:', 'ws:').replace(/\/$/, '')}${url.pathname}${url.search}`,
        { agent, headers, pauseOnOpen: true });
      requireThat(!socket.destroyed && ready, 'HELPER_LOST');
      wss.handleUpgrade(req, socket, head, client => { relayWebSockets(client, remote, budget); });
      socket.on('close', () => remote.terminate());
    } catch (error) { remote?.terminate(); rejectUpgrade(socket, errorResponse(error).status); }
  });
  async function start() {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(19300, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    try {
      let confirmReady;
      const confirmed = new Promise(resolve => { confirmReady = resolve; });
      const onMessage = async data => {
        let message;
        try {
          message = JSON.parse(data.toString());
          if (message.type === 'ready') {
            requireThat(message.generation === generation, 'OWNER_GENERATION_MISMATCH'); ready = true; confirmReady(); return;
          }
          requireThat(message.type === 'probe' && typeof message.requestId === 'string' &&
            /^ws:\/\/127\.0\.0\.1:19300\/cdp\/[A-Za-z0-9_-]{43}$/.test(message.url), 'INVALID_PROBE');
          const probe = await openWebSocket(message.url);
          try { const version = await cdpCall(probe, 'Browser.getVersion'); requireThat(version?.protocolVersion, 'INVALID_BROWSER'); }
          finally { probe.terminate(); }
          control.send(JSON.stringify({ type: 'probe-result', requestId: message.requestId, ok: true }));
        } catch {
          if (message?.type === 'probe' && control?.readyState === WebSocket.OPEN) {
            control.send(JSON.stringify({ type: 'probe-result', requestId: message.requestId, ok: false }));
          } else control?.terminate();
        }
      };
      control = await openWebSocket(`${broker.href.replace('http:', 'ws:')}control`,
        { agent, headers, maxPayload: 64 * 1024, onMessage });
      control.on('close', () => { ready = false; if (!closing) { void close(); onLost(); } });
      await deadline(confirmed, 5000, 'HELPER_REGISTRATION_TIMEOUT');
    } catch (error) { await close(); throw error; }
  }
  async function close() {
    closing = true; ready = false;
    control?.terminate(); for (const ws of wss.clients) ws.terminate();
    wss.close(); agent.destroy(); server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
  return { server, start, close };
}
