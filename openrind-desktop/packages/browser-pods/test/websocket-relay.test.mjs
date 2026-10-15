import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

function startMockCdpServer() {
  const sockets = new Set();
  const wss = new WebSocketServer({ port: 0 });
  const server = wss;

  wss.on('connection', (ws, req) => {
    sockets.add(ws);
    ws.on('close', () => sockets.delete(ws));
  });

  return new Promise((resolve) => {
    wss.on('listening', () => {
      const port = wss.address().port;
      resolve({
        port,
        wss,
        sockets,
        close: async () => {
          for (const s of sockets) {
            try { s.terminate(); } catch {}
          }
          await new Promise((cb) => wss.close(cb));
        },
      });
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

  client.on('error', close);
  remote.on('error', close);

  const propagateClose = (target) => (code, reason) => {
    if (!closed) {
      closed = true;
      const valid = (code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999);
      try {
        if (valid) {
          target.close(code, reason);
        } else {
          target.terminate();
        }
      } catch {
        try { target.terminate(); } catch {}
      }
    }
  };

  client.on('close', propagateClose(remote));
  remote.on('close', propagateClose(client));

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

function startRelayServer(targetPort) {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const activeSockets = new Set();
  const activeRemotes = new Set();

  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });

  server.on('connection', (socket) => {
    activeSockets.add(socket);
    socket.on('close', () => activeSockets.delete(socket));
  });

  server.on('upgrade', (req, socket, head) => {
    activeSockets.add(socket);
    socket.on('close', () => activeSockets.delete(socket));
    socket.on('error', () => {});

    const remote = new WebSocket(`ws://127.0.0.1:${targetPort}/cdp/browser`);
    activeRemotes.add(remote);
    remote.on('close', () => activeRemotes.delete(remote));

    remote.once('open', () => {
      if (socket.destroyed) {
        remote.terminate();
        return;
      }
      wss.handleUpgrade(req, socket, head, (client) => {
        relayWebSockets(client, remote);
      });
    });
    remote.once('error', () => {
      socket.destroy();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        port,
        server,
        wss,
        close: async () => {
          for (const r of activeRemotes) {
            try { r.terminate(); } catch {}
          }
          for (const s of activeSockets) {
            try { s.destroy(); } catch {}
          }
          if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
          }
          await new Promise((cb) => server.close(cb));
          await new Promise((cb) => wss.close(cb));
        },
      });
    });
  });
}

test('bidirectional CDP message forwarding relays text commands and responses intact', { timeout: 3000 }, async (t) => {
  const cdp = await startMockCdpServer();
  const relay = await startRelayServer(cdp.port);
  t.after(async () => {
    await relay.close();
    await cdp.close();
  });

  cdp.wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Page.navigate') {
        ws.send(JSON.stringify({ id: msg.id, result: { frameId: 'FRAME_123', loaderId: 'LOAD_456' } }));
      }
    });
  });

  const client = new WebSocket(`ws://127.0.0.1:${relay.port}/session-1`);
  t.after(() => { try { client.terminate(); } catch {} });

  await new Promise((resolve) => client.on('open', resolve));

  const responsePromise = new Promise((resolve) => {
    client.on('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });

  client.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'http://example.com' } }));
  const response = await responsePromise;

  assert.equal(response.id, 1);
  assert.equal(response.result.frameId, 'FRAME_123');
  assert.equal(response.result.loaderId, 'LOAD_456');
});

test('relays large binary payloads (e.g. screenshots) without truncation', { timeout: 3000 }, async (t) => {
  const cdp = await startMockCdpServer();
  const relay = await startRelayServer(cdp.port);
  t.after(async () => {
    await relay.close();
    await cdp.close();
  });

  const screenshotBytes = crypto.randomBytes(256 * 1024); // 256 KB binary screenshot

  cdp.wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Page.captureScreenshot') {
        ws.send(screenshotBytes, { binary: true });
      }
    });
  });

  const client = new WebSocket(`ws://127.0.0.1:${relay.port}/session-large`);
  t.after(() => { try { client.terminate(); } catch {} });

  await new Promise((resolve) => client.on('open', resolve));

  const binaryPromise = new Promise((resolve) => {
    client.on('message', (data, isBinary) => {
      resolve({ data, isBinary });
    });
  });

  client.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot' }));
  const { data, isBinary } = await binaryPromise;

  assert.equal(isBinary, true);
  assert.equal(data.length, screenshotBytes.length);
  assert.deepEqual(data, screenshotBytes);
});

test('handles rapid sequence of CDP events and requests without dropped frames', { timeout: 3000 }, async (t) => {
  const cdp = await startMockCdpServer();
  const relay = await startRelayServer(cdp.port);
  t.after(async () => {
    await relay.close();
    await cdp.close();
  });

  const count = 20;
  cdp.wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      ws.send(JSON.stringify({ id: msg.id, result: { ack: msg.id * 2 } }));
    });
  });

  const client = new WebSocket(`ws://127.0.0.1:${relay.port}/session-burst`);
  t.after(() => { try { client.terminate(); } catch {} });

  await new Promise((resolve) => client.on('open', resolve));

  const received = new Map();
  client.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    received.set(msg.id, msg.result.ack);
  });

  for (let i = 1; i <= count; i++) {
    client.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expr: `${i}` } }));
  }

  const start = Date.now();
  while (received.size < count && Date.now() - start < 2500) {
    await new Promise((r) => setTimeout(r, 20));
  }

  assert.equal(received.size, count);
  for (let i = 1; i <= count; i++) {
    assert.equal(received.get(i), i * 2);
  }
});

test('client close propagates cleanly to upstream WebSocket with code and reason', { timeout: 3000 }, async (t) => {
  const cdp = await startMockCdpServer();
  const relay = await startRelayServer(cdp.port);
  t.after(async () => {
    await relay.close();
    await cdp.close();
  });

  const upstreamClosePromise = new Promise((resolve) => {
    cdp.wss.on('connection', (ws) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });
  });

  const client = new WebSocket(`ws://127.0.0.1:${relay.port}/session-close`);
  t.after(() => { try { client.terminate(); } catch {} });
  await new Promise((resolve) => client.on('open', resolve));

  client.close(1000, 'session ended normally');
  const upstreamClose = await upstreamClosePromise;

  assert.equal(upstreamClose.code, 1000);
  assert.equal(upstreamClose.reason, 'session ended normally');
});

test('upstream termination terminates client WebSocket immediately', { timeout: 3000 }, async (t) => {
  const cdp = await startMockCdpServer();
  const relay = await startRelayServer(cdp.port);
  t.after(async () => {
    await relay.close();
    await cdp.close();
  });

  const upstreamWsPromise = new Promise((resolve) => {
    cdp.wss.on('connection', (ws) => resolve(ws));
  });

  const client = new WebSocket(`ws://127.0.0.1:${relay.port}/session-upstream-term`);
  t.after(() => { try { client.terminate(); } catch {} });
  await new Promise((resolve) => client.on('open', resolve));

  const upstreamWs = await upstreamWsPromise;
  assert.ok(upstreamWs);

  const clientClosedPromise = new Promise((resolve) => {
    client.on('close', resolve);
  });

  upstreamWs.terminate();

  await clientClosedPromise;
  assert.equal(client.readyState, WebSocket.CLOSED);
});

test('raw HTTP/1.1 upgrade framing connects socket bidirectionally to target port', { timeout: 3000 }, async (t) => {
  const targetSockets = new Set();
  const targetServer = net.createServer((socket) => {
    targetSockets.add(socket);
    socket.on('close', () => targetSockets.delete(socket));
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes('\r\n\r\n')) {
        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n\r\n'
        );
      }
    });
  });

  await new Promise((resolve) => targetServer.listen(0, '127.0.0.1', resolve));
  const targetPort = targetServer.address().port;

  const proxySockets = new Set();
  const proxy = http.createServer();
  proxy.on('connection', (s) => {
    proxySockets.add(s);
    s.on('close', () => proxySockets.delete(s));
  });
  proxy.on('upgrade', (req, socket, head) => {
    proxySockets.add(socket);
    const targetSocket = net.connect(targetPort, '127.0.0.1', () => {
      targetSockets.add(targetSocket);
      targetSocket.on('close', () => targetSockets.delete(targetSocket));
      const rawReq = [
        `${req.method} ${req.url} HTTP/1.1`,
        `Host: 127.0.0.1:${targetPort}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${req.headers['sec-websocket-key']}`,
        'Sec-WebSocket-Version: 13',
      ];
      if (req.headers['sec-websocket-protocol']) {
        rawReq.push(`Sec-WebSocket-Protocol: ${req.headers['sec-websocket-protocol']}`);
      }
      rawReq.push('', '');
      targetSocket.write(rawReq.join('\r\n'));
      if (head && head.length) targetSocket.write(head);
      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
    });
    targetSocket.on('error', () => socket.destroy());
    socket.on('error', () => targetSocket.destroy());
  });

  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const proxyPort = proxy.address().port;

  const clientSocket = net.connect(proxyPort, '127.0.0.1');

  t.after(async () => {
    clientSocket.destroy();
    for (const s of proxySockets) try { s.destroy(); } catch {}
    for (const s of targetSockets) try { s.destroy(); } catch {}
    if (typeof proxy.closeAllConnections === 'function') proxy.closeAllConnections();
    if (typeof targetServer.closeAllConnections === 'function') targetServer.closeAllConnections();
    await new Promise((cb) => proxy.close(cb));
    await new Promise((cb) => targetServer.close(cb));
  });

  const responsePromise = new Promise((resolve) => {
    let data = '';
    clientSocket.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('101 Switching Protocols')) {
        resolve(data);
      }
    });
  });

  await new Promise((resolve) => clientSocket.on('connect', resolve));
  clientSocket.write(
    'GET /devtools/page/1 HTTP/1.1\r\n' +
    'Host: 127.0.0.1\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
    'Sec-WebSocket-Version: 13\r\n\r\n'
  );

  const response = await responsePromise;
  assert.match(response, /HTTP\/1\.1 101 Switching Protocols/);
  assert.match(response, /Sec-WebSocket-Accept/);
});
