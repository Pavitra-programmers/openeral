import { spawn } from 'node:child_process';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { closeSync, openSync, writeSync } from 'node:fs';
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

const config = JSON.parse(await readFile('/tmp/openrind-browser/config.json', 'utf8'));
const secretHash = createHash('sha256').update(`Bearer ${config.secret}`).digest();
const proxy = new URL(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'missing:');
if (proxy.protocol !== 'http:' || proxy.username || proxy.password) throw new Error('OPENSHELL_PROXY_REQUIRED');
const instance = randomUUID();
let state = 'starting'; let cdpPath; let leaseUntil = Date.now() + 30_000; let stopping;
// Keep bounded startup diagnostics private to this disposable browser pod.
const chromeLog = openSync('/tmp/openrind-browser/chromium.log', 'wx', 0o600);
let logBytes = 0;
const child = spawn('/usr/lib/chromium/chromium', [
  '--headless=new', '--no-sandbox', '--disable-quic', '--disable-background-networking',
  '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/openrind-browser/profile',
  `--window-size=${config.screen.width},${config.screen.height}`,
  `--proxy-server=${proxy.origin}`, '--proxy-bypass-list=<-loopback>', 'about:blank',
], { detached: true, stdio: ['ignore', 'ignore', 'pipe'],
  env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: '/tmp/openrind-browser', TMPDIR: '/tmp' } });
child.stderr.on('data', chunk => {
  const part = chunk.subarray(0, Math.max(0, 64 * 1024 - logBytes));
  if (part.length) { try { writeSync(chromeLog, part); logBytes += part.length; } catch { logBytes = 64 * 1024; } }
});
child.stderr.on('close', () => closeSync(chromeLog));
child.on('error', () => { state = 'failed'; });
child.on('exit', () => { if (state !== 'stopped') state = 'failed'; });

function groupAlive() {
  if (!child.pid) return false;
  try { process.kill(-child.pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

function signalGroup(signal) {
  if (!child.pid) return;
  try { process.kill(-child.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}

async function stop() {
  if (stopping) return stopping;
  stopping = (async () => {
    if (groupAlive()) {
      signalGroup('SIGTERM');
      for (let i = 0; i < 10 && groupAlive(); i++) await sleep(50);
      if (groupAlive()) signalGroup('SIGKILL');
      for (let i = 0; i < 10 && groupAlive(); i++) await sleep(50);
    }
    // A live group or an unreaped child is not a stop acknowledgement. The
    // broker must confirm container deletion if this check cannot finish.
    if (groupAlive() || (child.pid && child.exitCode === null && child.signalCode === null)) throw new Error('STOP_UNCONFIRMED');
    state = 'stopped';
  })();
  return stopping;
}

const server = http.createServer(async (req, res) => {
  const candidate = createHash('sha256').update(req.headers.authorization ?? '').digest();
  if (req.headers.origin || !timingSafeEqual(candidate, secretHash)) { res.writeHead(403); res.end(); return; }
  try {
    if (req.method === 'POST' && req.url === '/lease') leaseUntil = Date.now() + 15_000;
    else if (req.method === 'POST' && req.url === '/stop') await stop();
    else if (!(req.method === 'GET' && req.url === '/health')) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ sessionId: config.sessionId, instance, state, cdpPath }));
  } catch { res.writeHead(503); res.end(); }
});
server.headersTimeout = 3000; server.requestTimeout = 3000; server.maxConnections = 4;
server.on('clientError', (_, socket) => socket.destroy());
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9230, '127.0.0.1', resolve); });

async function probe() {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (state !== 'starting') return;
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(1000) });
      const version = await response.json();
      const url = new URL(version.webSocketDebuggerUrl);
      if (url.hostname !== '127.0.0.1' || url.port !== '9222' || !/^\/devtools\/browser\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
        throw new Error('INVALID_CDP_DISCOVERY');
      }
      const ws = new WebSocket(url);
      try {
        const targets = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('CDP_PROBE_TIMEOUT')), 2000);
          const fail = () => { clearTimeout(timer); reject(new Error('CDP_PROBE_FAILED')); };
          ws.addEventListener('error', fail);
          ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Target.getTargets' })));
          ws.addEventListener('message', event => {
            try {
              const message = JSON.parse(event.data);
              if (message.id === 1) { clearTimeout(timer); resolve(message.result?.targetInfos); }
            } catch { fail(); }
          });
        });
        if (!targets?.some(target => target.type === 'page')) throw new Error('PAGE_NOT_READY');
      } finally { try { ws.close(); } catch {} }
      if (state === 'starting') { cdpPath = url.pathname; state = 'ready'; }
      return;
    } catch { await sleep(200); }
  }
  await stop();
}
void probe().catch(() => { state = 'failed'; });
const timer = setInterval(() => {
  if (Date.now() <= leaseUntil) return;
  void shutdown().catch(() => { process.exitCode = 1; });
}, 1000);
async function shutdown() {
  clearInterval(timer);
  try { await stop(); } finally { server.closeAllConnections(); server.close(); }
}
process.on('SIGHUP', () => {});
process.on('SIGTERM', () => { void shutdown().catch(() => { process.exitCode = 1; }); });
process.on('SIGINT', () => { void shutdown().catch(() => { process.exitCode = 1; }); });
