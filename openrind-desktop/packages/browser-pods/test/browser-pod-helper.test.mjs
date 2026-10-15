import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';

// Helper HTTP agent mimicking ConnectAgent in openrind-browser-pod-helper.mjs
class ConnectAgent extends http.Agent {
  constructor(proxy) {
    super({ keepAlive: true });
    this.proxy = proxy;
    this.fallbackCount = 0;
  }
  createConnection(options, callback) {
    const host = options.hostname || options.host || '127.0.0.1';
    const port = options.port || 9222;
    if (!this.proxy) {
      const sock = net.connect({ host, port }, () => callback(null, sock));
      sock.on('error', callback);
      return;
    }
    const connectReq = http.request({
      host: this.proxy.hostname,
      port: this.proxy.port,
      method: 'CONNECT',
      path: `${host}:${port}`,
      agent: false,
    });
    connectReq.on('connect', (res, socket) => {
      connectReq.removeAllListeners('error');
      if (res.statusCode !== 200) {
        this.fallbackCount++;
        socket.destroy();
        const sock = net.connect({ host, port }, () => callback(null, sock));
        sock.on('error', () => callback(new Error(`Proxy CONNECT status: ${res.statusCode}`)));
        return;
      }
      callback(null, socket);
    });
    connectReq.on('error', (err) => {
      this.fallbackCount++;
      const sock = net.connect({ host, port }, () => callback(null, sock));
      sock.on('error', () => callback(err));
    });
    connectReq.end();
  }
}

// Starts a mock browser-pod helper server
function startHelperServer(cdpPort) {
  const sessions = new Map();
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ready: true,
        generation: 'openrind-desktop',
        implementation: 'provider-pods',
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/browsers') {
      const id = crypto.randomUUID();
      sessions.set(id, { createdAt: Date.now(), endpoint: { host: '127.0.0.1', port: cdpPort } });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        session_id: id,
        cdp_ws_url: `ws://127.0.0.1:${server.address().port}/cdp/${id}`,
      }));
      return;
    }

    if (req.method === 'DELETE' && req.url?.startsWith('/browsers/')) {
      const id = req.url.split('/')[2];
      sessions.delete(id);
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        server,
        sessions,
        close: async () => {
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          await new Promise((cb) => server.close(cb));
        },
      });
    });
  });
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: options.agent,
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body ? JSON.parse(body) : null,
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

test('helper /health endpoint returns readiness and implementation identity', { timeout: 3000 }, async (t) => {
  const helper = await startHelperServer(9222);
  t.after(async () => { await helper.close(); });

  const res = await fetchJson(`http://127.0.0.1:${helper.port}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.body.ready, true);
  assert.equal(res.body.generation, 'openrind-desktop');
  assert.equal(res.body.implementation, 'provider-pods');
});

test('POST /browsers provisions a browser session with a valid UUID and cdp_ws_url', { timeout: 3000 }, async (t) => {
  const helper = await startHelperServer(9222);
  t.after(async () => { await helper.close(); });

  const res = await fetchJson(`http://127.0.0.1:${helper.port}/browsers`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.match(res.body.session_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.equal(res.body.cdp_ws_url, `ws://127.0.0.1:${helper.port}/cdp/${res.body.session_id}`);
  assert.equal(helper.sessions.has(res.body.session_id), true);
});

test('DELETE /browsers/:id removes active session and returns HTTP 204', { timeout: 3000 }, async (t) => {
  const helper = await startHelperServer(9222);
  t.after(async () => { await helper.close(); });

  const created = await fetchJson(`http://127.0.0.1:${helper.port}/browsers`, { method: 'POST' });
  const sessionId = created.body.session_id;
  assert.equal(helper.sessions.has(sessionId), true);

  const deleted = await fetchJson(`http://127.0.0.1:${helper.port}/browsers/${sessionId}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.equal(helper.sessions.has(sessionId), false);

  // Deleting again is idempotent
  const secondDelete = await fetchJson(`http://127.0.0.1:${helper.port}/browsers/${sessionId}`, { method: 'DELETE' });
  assert.equal(secondDelete.status, 204);
});

test('helper rejects unknown routes with HTTP 404', { timeout: 3000 }, async (t) => {
  const helper = await startHelperServer(9222);
  t.after(async () => { await helper.close(); });

  const res = await fetchJson(`http://127.0.0.1:${helper.port}/invalid-route`);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Not found');
});

test('candidate discovery resolves the active Chromium endpoint and falls back gracefully', { timeout: 3000 }, async (t) => {
  // Start a mock Chromium endpoint on dynamic port
  const cdpServer = http.createServer((req, res) => {
    if (req.url === '/json/version') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        Browser: 'Chrome/130.0.0.0',
        'Protocol-Version': '1.3',
        webSocketDebuggerUrl: `ws://127.0.0.1:${cdpServer.address().port}/devtools/browser/mock-id`,
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => cdpServer.listen(0, '127.0.0.1', resolve));
  const workingPort = cdpServer.address().port;

  t.after(async () => {
    if (typeof cdpServer.closeAllConnections === 'function') cdpServer.closeAllConnections();
    await new Promise((cb) => cdpServer.close(cb));
  });

  // Candidates list: first one dead port, second one working
  const candidates = [
    { host: '127.0.0.1', port: 1 }, // dead port
    { host: '127.0.0.1', port: workingPort },
  ];

  async function resolveChromiumEndpoint(cands) {
    for (const cand of cands) {
      try {
        const res = await fetchJson(`http://${cand.host}:${cand.port}/json/version`);
        if (res.body?.webSocketDebuggerUrl) return cand;
      } catch {}
    }
    return null;
  }

  const resolved = await resolveChromiumEndpoint(candidates);
  assert.notEqual(resolved, null);
  assert.equal(resolved.port, workingPort);
});

test('ConnectAgent tunnels through HTTP CONNECT proxy and falls back to direct TCP on proxy error', { timeout: 3000 }, async (t) => {
  // Target HTTP server
  const target = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ target: 'direct' }));
  });
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
  const targetPort = target.address().port;

  // Failing proxy that returns 502 Bad Gateway
  const badProxy = http.createServer();
  badProxy.on('connect', (_req, clientSocket) => {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.destroy();
  });
  await new Promise((resolve) => badProxy.listen(0, '127.0.0.1', resolve));
  const proxyPort = badProxy.address().port;

  t.after(async () => {
    if (typeof target.closeAllConnections === 'function') target.closeAllConnections();
    if (typeof badProxy.closeAllConnections === 'function') badProxy.closeAllConnections();
    await new Promise((cb) => target.close(cb));
    await new Promise((cb) => badProxy.close(cb));
  });

  const agent = new ConnectAgent({ hostname: '127.0.0.1', port: proxyPort });
  t.after(() => agent.destroy());

  // Should fail proxy CONNECT, trigger fallback, and connect directly to target
  const res = await fetchJson(`http://127.0.0.1:${targetPort}/test`, { agent });
  assert.equal(res.status, 200);
  assert.equal(res.body.target, 'direct');
  assert.equal(agent.fallbackCount, 1);
});
