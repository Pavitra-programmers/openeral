#!/usr/bin/env node
import net from 'node:net';
import fs from 'node:fs';

const SOCKET_PATH = '/tmp/browser-cdp.sock';
const POD_HOST = process.env.BROWSER_POD_HOST || process.env.BROWSER_POD_NAME || 'openrind-browser-pod';
const POD_PORT = Number(process.env.BROWSER_POD_PORT || 9222);

const CANDIDATES = [
  { host: POD_HOST, port: POD_PORT },
  { host: 'openrind-browser-pod', port: 9222 },
  { host: '172.19.0.1', port: 9222 },
  { host: 'host.openshell.internal', port: 9222 },
  { host: '127.0.0.1', port: 9222 },
];

try { fs.unlinkSync(SOCKET_PATH); } catch {}

const server = net.createServer(client => {
  let connected = false;
  let target = null;

  function tryConnect(idx) {
    if (idx >= CANDIDATES.length) {
      client.destroy();
      return;
    }
    const cand = CANDIDATES[idx];
    target = net.connect(cand.port, cand.host, () => {
      connected = true;
      client.pipe(target).pipe(client);
    });
    target.on('error', () => {
      if (!connected) tryConnect(idx + 1);
      else client.destroy();
    });
    client.on('error', () => target?.destroy());
  }

  tryConnect(0);
});

server.listen(SOCKET_PATH, () => {
  try { fs.chmodSync(SOCKET_PATH, 0o777); } catch {}
  process.stdout.write(`browser-socket-relay: listening on ${SOCKET_PATH}\n`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
