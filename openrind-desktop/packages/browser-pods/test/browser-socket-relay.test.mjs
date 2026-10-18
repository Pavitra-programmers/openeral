import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

function createRelay(candidates) {
  const server = net.createServer((client) => {
    let connected = false;
    let target = null;

    function tryConnect(idx) {
      if (idx >= candidates.length) {
        client.destroy();
        return;
      }
      const cand = candidates[idx];
      target = net.connect({ port: cand.port, host: cand.host, timeout: 500 }, () => {
        connected = true;
        client.pipe(target).pipe(client);
      });
      target.on('timeout', () => {
        if (!connected) {
          target.destroy();
          tryConnect(idx + 1);
        }
      });
      target.on('error', () => {
        if (!connected) tryConnect(idx + 1);
        else client.destroy();
      });
      client.on('error', () => target?.destroy());
    }

    tryConnect(0);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        server,
        close: async () => {
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          await new Promise((cb) => server.close(cb));
        },
      });
    });
  });
}

test('relay connects to first available candidate and pipes duplex streams bidirectionally', { timeout: 3000 }, async (t) => {
  const targetServer = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      socket.write(`echo:${chunk.toString()}`);
    });
  });

  await new Promise((resolve) => targetServer.listen(0, '127.0.0.1', resolve));
  const targetPort = targetServer.address().port;

  t.after(async () => {
    if (typeof targetServer.closeAllConnections === 'function') targetServer.closeAllConnections();
    await new Promise((cb) => targetServer.close(cb));
  });

  // Candidate 1 is dead, Candidate 2 is alive
  const candidates = [
    { host: '127.0.0.1', port: 1 }, // will fail immediately
    { host: '127.0.0.1', port: targetPort },
  ];

  const relay = await createRelay(candidates);
  t.after(async () => { await relay.close(); });

  const client = net.connect(relay.port, '127.0.0.1');
  t.after(() => client.destroy());

  const responsePromise = new Promise((resolve) => {
    client.on('data', (chunk) => {
      resolve(chunk.toString());
    });
  });

  await new Promise((resolve) => client.on('connect', resolve));
  client.write('hello-relay');

  const response = await responsePromise;
  assert.equal(response, 'echo:hello-relay');
});

test('relay destroys client connection if all candidate targets fail to connect', { timeout: 3000 }, async (t) => {
  const deadCandidates = [
    { host: '127.0.0.1', port: 1 },
    { host: '127.0.0.1', port: 2 },
  ];

  const relay = await createRelay(deadCandidates);
  t.after(async () => { await relay.close(); });

  const client = net.connect(relay.port, '127.0.0.1');

  const closePromise = new Promise((resolve) => {
    client.on('close', resolve);
  });

  await closePromise;
  assert.equal(client.destroyed, true);
});

test('client error or termination tears down the target socket', { timeout: 3000 }, async (t) => {
  let targetSocket;
  const targetServer = net.createServer((socket) => {
    targetSocket = socket;
  });

  await new Promise((resolve) => targetServer.listen(0, '127.0.0.1', resolve));
  const targetPort = targetServer.address().port;

  t.after(async () => {
    if (typeof targetServer.closeAllConnections === 'function') targetServer.closeAllConnections();
    await new Promise((cb) => targetServer.close(cb));
  });

  const relay = await createRelay([{ host: '127.0.0.1', port: targetPort }]);
  t.after(async () => { await relay.close(); });

  const client = net.connect(relay.port, '127.0.0.1');
  await new Promise((resolve) => client.on('connect', resolve));

  // Wait for target to establish
  while (!targetSocket) {
    await new Promise((r) => setTimeout(r, 10));
  }

  const targetClosePromise = new Promise((resolve) => {
    targetSocket.on('close', resolve);
  });

  client.destroy();
  await targetClosePromise;
  assert.equal(targetSocket.destroyed, true);
});
