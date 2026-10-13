import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const child = spawn('/usr/lib/chromium/chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--remote-debugging-port=9221',
  '--remote-allow-origins=*',
  'about:blank'
], { stdio: 'inherit' });

const server = http.createServer((req, res) => {
  const proxyReq = http.request({
    host: '127.0.0.1',
    port: 9221,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: '127.0.0.1:9221',
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });

  req.pipe(proxyReq);
});

server.on('upgrade', (req, socket, head) => {
  const targetSocket = net.connect(9221, '127.0.0.1', () => {
    const rawReq = [
      `${req.method} ${req.url} HTTP/1.1`,
      'Host: 127.0.0.1:9221',
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

server.listen(9222, '0.0.0.0', () => {
  console.log('Browser pod ready on 0.0.0.0:9222');
});

const shutdown = () => {
  child.kill('SIGTERM');
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
