#!/usr/bin/env node
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

const BIND_PORT = Number(process.env.HELPER_PORT || 19300);
const BIND_HOST = '127.0.0.1';

const proxyEnv = process.env.HTTP_PROXY || process.env.http_proxy;
const proxyUrl = proxyEnv ? new URL(proxyEnv) : null;

let podHost = process.env.BROWSER_POD_HOST || process.env.BROWSER_POD_NAME;
try {
  const fs = await import('node:fs');
  if (fs.existsSync('/etc/openrind-browser-pods/helper.json')) {
    const raw = fs.readFileSync('/etc/openrind-browser-pods/helper.json', 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.podHost) podHost = parsed.podHost;
  }
} catch {}

function log(...args) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[helper ${ts}]`, ...args);
}

function logError(...args) {
  const ts = new Date().toISOString().slice(11, 23);
  console.error(`[helper ${ts}] ERROR:`, ...args);
}

class ConnectAgent extends http.Agent {
  constructor(proxy) {
    super({ keepAlive: true });
    this.proxy = proxy;
  }
  createConnection(options, callback) {
    const host = options.hostname || options.host || 'host.openshell.internal';
    const port = options.port || 9222;
    if (!this.proxy) {
      log(`Direct TCP connect to ${host}:${port}`);
      const sock = net.connect({ host, port }, () => callback(null, sock));
      sock.on('error', callback);
      return;
    }
    log(`CONNECT via proxy ${this.proxy.hostname}:${this.proxy.port} to ${host}:${port}`);
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
        logError(`Proxy CONNECT returned status: ${res.statusCode}`);
        socket.destroy();
        // Fallback to direct TCP on proxy status error
        const sock = net.connect({ host, port }, () => callback(null, sock));
        sock.on('error', () => callback(new Error(`Proxy CONNECT status: ${res.statusCode}`)));
        return;
      }
      log(`Proxy CONNECT established 200 for ${host}:${port}`);
      callback(null, socket);
    });
    connectReq.on('error', (err) => {
      logError(`Proxy CONNECT error for ${host}:${port}: ${err.message}`);
      // Fallback to direct TCP on connect error
      const sock = net.connect({ host, port }, () => callback(null, sock));
      sock.on('error', () => callback(err));
    });
    connectReq.end();
  }
}

const connectAgent = proxyUrl ? new ConnectAgent(proxyUrl) : null;
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

const CANDIDATES = [
  { host: 'host.openshell.internal', port: 9222 },
  podHost && podHost !== 'host.openshell.internal' ? { host: podHost, port: Number(process.env.BROWSER_POD_PORT || 9222) } : null,
  { host: 'openrind-browser-pod', port: 9222 },
  { host: '127.0.0.1', port: 9222 },
].filter(Boolean);

let activeEndpoint = null;

async function fetchJson(path, endpoint = activeEndpoint) {
  const host = endpoint?.host || 'host.openshell.internal';
  const port = endpoint?.port || Number(process.env.BROWSER_POD_PORT || 9222);
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: host,
      port,
      path,
      method: 'GET',
      headers: { Host: `${host}:${port}` },
      agent: connectAgent,
    };
    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(new Error('TIMEOUT')); });
    req.end();
  });
}

async function checkEndpoint(cand) {
  try {
    const data = await fetchJson('/json/version', cand);
    if (data?.webSocketDebuggerUrl) return cand;
  } catch {}
  return null;
}

async function resolveChromiumEndpoint() {
  const defaultHost = podHost || 'openrind-browser-pod';
  const defaultPort = Number(process.env.BROWSER_POD_PORT || 9222);

  if (activeEndpoint && (await checkEndpoint(activeEndpoint))) {
    return activeEndpoint;
  }
  for (const cand of CANDIDATES) {
    if (await checkEndpoint(cand)) {
      activeEndpoint = cand;
      return cand;
    }
  }
  return { host: defaultHost, port: defaultPort };
}

function openWebSocket(url, options = {}) {
  return new Promise((resolve, reject) => {
    log(`Opening upstream WebSocket: ${url}`);
    const targetUrl = new URL(url);
    const ws = new WebSocket(url, {
      maxPayload: 128 * 1024 * 1024,
      perMessageDeflate: false,
      handshakeTimeout: 10000,
      agent: connectAgent,
      createConnection: connectAgent ? ((opts, cb) => connectAgent.createConnection(opts, cb)) : undefined,
      ...options,
      headers: { ...(options.headers || {}), Host: `${targetUrl.host}` },
    });
    ws.once('open', () => {
      log('Upstream WebSocket OPENED successfully');
      resolve(ws);
    });
    ws.once('error', (err) => {
      logError(`Upstream WebSocket error (${url}):`, err.message);
      reject(err);
    });
  });
}

function relayWebSockets(client, remote) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try { client.terminate(); } catch {}
    try { remote.terminate(); } catch {}
  };

  client.on('error', (e) => { logError('Client WS error:', e.message); close(); });
  remote.on('error', (e) => { logError('Remote WS error:', e.message); close(); });

  client.on('close', (code, reason) => {
    if (!closed) {
      closed = true;
      try { remote.close(code, reason); } catch {}
    }
  });

  remote.on('close', (code, reason) => {
    if (!closed) {
      closed = true;
      try { client.close(code, reason); } catch {}
    }
  });

  client.on('message', (data, isBinary) => {
    if (remote.readyState === WebSocket.OPEN) {
      remote.send(data, { binary: isBinary });
    }
  });

  remote.on('message', (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });
}

const sessions = new Map();

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    let gen = 'openrind-desktop';
    try {
      const fs = await import('node:fs');
      if (fs.existsSync('/etc/openrind-browser-pods/helper.json')) {
        const raw = fs.readFileSync('/etc/openrind-browser-pods/helper.json', 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.generation) gen = parsed.generation;
      }
    } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ready: true,
      generation: gen,
      implementation: 'provider-pods',
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/browsers') {
    log('POST /browsers requested');
    const endpoint = await resolveChromiumEndpoint();
    const id = crypto.randomUUID();
    sessions.set(id, { createdAt: Date.now(), endpoint });
    log(`Created browser session: ${id} on ${endpoint.host}:${endpoint.port}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      session_id: id,
      cdp_ws_url: `ws://127.0.0.1:${BIND_PORT}/cdp/${id}`,
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

server.on('upgrade', async (req, socket, head) => {
  socket.on('error', () => {});
  log(`Upgrade request: ${req.url}`);
  let remote;
  try {
    let endpoint = await resolveChromiumEndpoint();
    if (!endpoint) {
      endpoint = { host: 'openrind-browser-pod', port: 9222 };
    }

    let version;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        version = await fetchJson('/json/version', endpoint);
        if (version?.webSocketDebuggerUrl) break;
      } catch (e) {
        log(`fetchJson attempt ${attempt + 1} failed: ${e.message}`);
        await new Promise(r => setTimeout(r, 400));
      }
    }
    if (!version?.webSocketDebuggerUrl) {
      logError('No webSocketDebuggerUrl available from endpoint');
      socket.destroy();
      return;
    }

    const host = endpoint.host || 'openrind-browser-pod';
    const port = endpoint.port || 9222;
    const targetWsUrl = new URL(version.webSocketDebuggerUrl);
    const remoteUrl = `ws://${host}:${port}${targetWsUrl.pathname}${targetWsUrl.search}`;

    log(`Connecting upstream: ${remoteUrl}`);
    remote = await openWebSocket(remoteUrl);

    if (socket.destroyed) {
      logError('Client socket destroyed while waiting for upstream');
      remote.terminate();
      return;
    }

    log('Handling client WebSocket upgrade...');
    wss.handleUpgrade(req, socket, head, (client) => {
      log('Client upgrade finished! Relaying CDP messages.');
      relayWebSockets(client, remote);
    });
  } catch (err) {
    logError('Upgrade catch:', err.message);
    remote?.terminate();
    socket.destroy();
  }
});

server.listen(BIND_PORT, BIND_HOST, () => {
  process.stdout.write(`browser-pods: helper ready on ${BIND_HOST}:${BIND_PORT}\n`);
});
