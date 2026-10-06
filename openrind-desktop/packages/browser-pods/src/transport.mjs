import http from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { MAX_CDP, MAX_JSON, PodError, deadline, requireThat } from './contracts.mjs';

export class OpenShellProxyAgent extends http.Agent {
  constructor(proxyUrl, destination) {
    super({ keepAlive: true, maxSockets: 16 });
    this.proxy = new URL(proxyUrl);
    this.destination = new URL(destination);
    requireThat(this.proxy.protocol === 'http:' && !this.proxy.username && !this.proxy.password, 'PROXY_REQUIRED');
    requireThat(this.destination.protocol === 'http:' && this.destination.hostname === 'host.openshell.internal' &&
      !this.destination.username && !this.destination.password, 'INVALID_BROKER_ENDPOINT');
  }
  createConnection(options, callback) {
    if (options.host !== this.destination.hostname || Number(options.port) !== Number(this.destination.port || 80)) {
      callback(new PodError('PROXY_DESTINATION_DENIED', 403)); return;
    }
    const req = http.request({ hostname: this.proxy.hostname, port: this.proxy.port || 80,
      method: 'CONNECT', path: this.destination.host, agent: false });
    let called = false;
    const finish = (error, socket) => { if (called) { socket?.destroy(); return; } called = true; clearTimeout(timer); callback(error, socket); };
    const timer = setTimeout(() => req.destroy(new PodError('PROXY_TIMEOUT', 504)), 5000);
    req.on('connect', (res, socket, head) => {
      if (res.statusCode !== 200) { socket.destroy(); finish(new PodError('PROXY_DENIED', 403)); return; }
      if (head.length) socket.unshift(head);
      finish(null, socket);
    });
    req.on('error', () => finish(new PodError('PROXY_UNAVAILABLE')));
    req.end();
  }
}

export function clientRequest(req) {
  requireThat(!req.headers.origin, 'ORIGIN_DENIED', 403);
  requireThat(req.url.startsWith('/') && !req.url.startsWith('//'), 'INVALID_PATH');
  requireThat(!/%|\\|\s/.test(req.url), 'INVALID_PATH');
  const url = new URL(req.url, 'http://route.invalid');
  requireThat(!url.hash, 'INVALID_PATH');
  if (url.pathname.startsWith('/cdp/')) {
    requireThat([...url.searchParams].every(([k, v]) => k === 'keepAlive' && ['true', 'false'].includes(v)), 'INVALID_QUERY');
    requireThat(url.searchParams.getAll('keepAlive').length <= 1, 'INVALID_QUERY');
  } else {
    const allowed = url.pathname === '/api/sessions' ? ['status', 'page', 'limit'] :
      /^\/api\/session\/[a-f0-9-]{36}$/.test(url.pathname) ? ['liveViewTtlSeconds'] : [];
    requireThat([...url.searchParams.keys()].every(key => allowed.includes(key) && url.searchParams.getAll(key).length === 1), 'INVALID_QUERY');
  }
  return url;
}

export async function jsonBody(req, { allowEmpty = false } = {}) {
  requireThat((req.headers['content-type'] ?? '').split(';')[0] === 'application/json', 'JSON_REQUIRED', 415);
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length; requireThat(bytes <= MAX_JSON, 'BODY_TOO_LARGE', 413); chunks.push(chunk);
  }
  if (allowEmpty && bytes === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new PodError('INVALID_JSON', 400); }
}

export function reply(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff' });
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

export function rejectUpgrade(socket, status = 503) {
  if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

export async function openWebSocket(url, options = {}) {
  const { onMessage, pauseOnOpen, ...socketOptions } = options;
  const ws = new WebSocket(url, { maxPayload: MAX_CDP, perMessageDeflate: false,
    handshakeTimeout: 5000, ...socketOptions });
  // Always consume transport errors; raw URLs and credentials must not reach logs.
  ws.on('error', () => {});
  if (onMessage) ws.on('message', onMessage);
  if (pauseOnOpen) ws.once('open', () => ws.pause());
  try { await once(ws, 'open'); return ws; }
  catch { ws.terminate(); throw new PodError('ATTACH_FAILED'); }
}

export function relayWebSockets(a, b, budget) {
  let closed = false; let timer;
  const close = () => { closed = true; clearTimeout(timer); a.terminate(); b.terminate(); };
  for (const [source, destination] of [[a, b], [b, a]]) {
    source.on('error', close);
    source.on('close', (code, reason) => {
      if (!closed) {
        closed = true;
        // 1005/1006 are local observations, not codes that can go on the wire.
        const valid = (code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999);
        if (valid || code === 1005) {
          timer = setTimeout(close, 1000); timer.unref();
          if (code === 1005) destination.close(); else destination.close(code, reason);
        } else close();
      }
      if (a.readyState === WebSocket.CLOSED && b.readyState === WebSocket.CLOSED) clearTimeout(timer);
    });
    source.on('message', (data, binary) => {
      if (closed) return;
      if (budget.bytes + data.length > budget.max) { close(); return; }
      budget.bytes += data.length;
      source.pause();
      destination.send(data, { binary }, error => {
        budget.bytes -= data.length;
        if (error) close(); else if (!closed) source.resume();
      });
    });
  }
  a.resume(); b.resume();
  return close;
}

export async function cdpCall(ws, method, params = {}, timeoutMs = 2500) {
  const id = Math.floor(Math.random() * 0x7fffffff);
  let listener; let failed;
  const result = new Promise((resolve, reject) => {
    failed = () => reject(new PodError('CDP_PROBE_FAILED'));
    listener = bytes => {
      let message; try { message = JSON.parse(bytes.toString()); } catch { failed(); return; }
      if (message === null || typeof message !== 'object' || Array.isArray(message)) { failed(); return; }
      if (message.id !== id) return;
      if (message.error) reject(new PodError('CDP_PROBE_FAILED'));
      else resolve(message.result);
    };
    ws.on('message', listener);
    ws.once('close', failed); ws.once('error', failed);
    ws.send(JSON.stringify({ id, method, params }), error => { if (error) reject(new PodError('CDP_PROBE_FAILED')); });
  });
  try { return await deadline(result, timeoutMs, 'CDP_PROBE_TIMEOUT'); }
  finally { ws.off('message', listener); ws.off('close', failed); ws.off('error', failed); }
}

export function boundedServer(server) {
  server.headersTimeout = 5000;
  server.requestTimeout = 65_000;
  server.maxHeadersCount = 64;
  server.maxConnections = 64;
  server.on('clientError', (_, socket) => { socket.destroy(); });
  return server;
}
