import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

// Test-only website. It exposes the supplied widget and public Argide API, not
// broker, gateway, dashboard, datastore, or model credentials.
export async function startWidgetFixture(bridge, { bundle, backend }) {
  const target = new URL(backend);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.protocol, 'http:');
  assert.equal(target.username, ''); assert.equal(target.password, '');
  assert.equal(target.pathname, '/'); assert.equal(target.search, ''); assert.equal(target.hash, '');
  const widget = await readFile(bundle);
  assert.equal(createHash('sha256').update(widget).digest('hex'),
    'b0e44dbe2d5a6e82448b76d4bff3880d0d314198aecd27f4047014dc31844bfa', 'Review a changed widget before updating the fixture pin');
  const health = await fetch(new URL('/api/ready', target), { signal: AbortSignal.timeout(5000), redirect: 'error' });
  assert.equal(health.status, 200, 'The real Argide backend is not ready');
  const site = 'http://host.openshell.internal:19302';
  const html = `<!doctype html><html><head><title>Argide browser test</title></head>
<body style="font:20px sans-serif;padding:30px;max-width:650px">
<h1>Contact form</h1><form id="contact">
<p><label>Name <input name="name" id="name" autocomplete="off"></label></p>
<p><label>Email <input name="email" id="email" autocomplete="off"></label></p>
<button type="submit">Submit</button></form><p id="result" role="status"></p>
<script>document.querySelector('#contact').onsubmit=e=>{e.preventDefault();document.querySelector('#result').textContent='Submitted: '+document.querySelector('#name').value+' | '+document.querySelector('#email').value;};</script>
<script src="/widget.js" data-product-id="prod_00000000-0000-4000-8000-000000000002" data-api-url="${site}"></script>
</body></html>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, site);
    if (req.method === 'GET' && url.pathname === '/fixture') {
      res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end(html); return;
    }
    if (req.method === 'GET' && url.pathname === '/widget.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); res.end(widget); return;
    }
    if (!url.pathname.startsWith('/api/v2/public/') || !['GET', 'POST', 'OPTIONS'].includes(req.method)) {
      res.writeHead(404); res.end(); return;
    }
    const upstream = http.request(new URL(url.pathname + url.search, target), {
      method: req.method, headers: { ...req.headers, host: target.host },
    }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    let bytes = 0;
    req.on('data', chunk => { bytes += chunk.length; if (bytes > 8 * 1024 * 1024) upstream.destroy(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(19302, bridge, resolve); });
  return { server, policy: { name: 'argide-test-website',
    endpoints: [{ host: 'host.openshell.internal', port: 19302, protocol: 'rest', tls: 'none',
      allowed_ips: [`${bridge}/32`], enforcement: 'enforce',
      rules: [{ allow: { method: 'GET', path: '/fixture' } }, { allow: { method: 'GET', path: '/widget.js' } },
        ...['GET', 'POST', 'OPTIONS'].flatMap(method => [
          { allow: { method, path: '/api/v2/public/**' } },
        ])] }], binaries: [{ path: '/usr/lib/chromium/chromium' }] },
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
