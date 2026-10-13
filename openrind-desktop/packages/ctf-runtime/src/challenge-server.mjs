import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import http from 'node:http';

function parseCookies(value = '') {
  return Object.fromEntries(value.split(';').map(part => part.trim().split(/=(.*)/s, 2)).filter(([name, value]) => name && value));
}

async function readJson(req, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function write(res, result, extra = {}) {
  res.writeHead(result.status, { 'content-type': result.contentType, 'cache-control': 'no-store', ...result.headers, ...extra });
  res.end(result.body);
}

function writeJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

export function createChallengeServer({ task, judgeToken, record = async () => {} }) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(judgeToken)) throw new Error('INVALID_JUDGE_TOKEN');
  const expected = createHash('sha256').update(`Bearer ${judgeToken}`).digest();
  const server = http.createServer(async (req, res) => {
    const started = performance.now();
    try {
      if (!req.url || req.url.length > 4096) { writeJson(res, 400, { code: 'INVALID_REQUEST' }); return; }
      const url = new URL(req.url, 'http://challenge.local');
      if (req.method === 'GET' && url.pathname === '/health') { writeJson(res, 200, { state: 'ready', task: task.id }); return; }
      const cookies = parseCookies(req.headers.cookie);
      const sessionId = cookies.openrind_ctf_session ?? randomBytes(18).toString('base64url');
      const actor = cookies.openrind_ctf_run ?? url.searchParams.get('run') ?? req.headers['x-openrind-run-actor'] ?? null;
      const setCookies = [];
      if (!cookies.openrind_ctf_session) {
        setCookies.push(`openrind_ctf_session=${sessionId}; Path=/site/; HttpOnly; SameSite=Strict`);
      }
      if (url.pathname.startsWith('/site/')) {
        if (url.searchParams.get('run') && !cookies.openrind_ctf_run) {
          setCookies.push(`openrind_ctf_run=${url.searchParams.get('run')}; Path=/site/; SameSite=Strict`);
        }
        const jsonBody = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJson(req, 64 * 1024) : null;
        const result = await task.route({ method: req.method, path: url.pathname, jsonBody, sessionId });
        await record({ kind: 'site', at: new Date().toISOString(), actor, method: req.method, path: url.pathname,
          status: result.status, durationMs: performance.now() - started });
        write(res, result, setCookies.length > 0 ? { 'set-cookie': setCookies } : {}); return;
      }
      const candidate = createHash('sha256').update(req.headers.authorization ?? '').digest();
      if (!timingSafeEqual(candidate, expected)) { writeJson(res, 401, { code: 'UNAUTHORIZED' }); return; }
      if (req.method === 'GET' && url.pathname === '/v1/task') { writeJson(res, 200, { id: task.id, title: task.title, description: task.description, sitePath: '/site/' }); return; }
      if (req.method === 'POST' && url.pathname === '/v1/submit') {
        const body = await readJson(req, 4096);
        const submission = typeof body?.flag === 'string' ? body.flag : '';
        const correct = submission.trim() === task.flag;
        await record({ kind: 'judge', at: new Date().toISOString(), actor: req.headers['x-openrind-run-actor'] ?? null,
          submission, correct, durationMs: performance.now() - started });
        writeJson(res, 200, { correct }); return;
      }
      writeJson(res, 404, { code: 'NOT_FOUND' });
    } catch (error) {
      const code = error instanceof SyntaxError ? 'INVALID_JSON' : error.message === 'REQUEST_TOO_LARGE' ? error.message : 'SERVICE_ERROR';
      writeJson(res, code === 'SERVICE_ERROR' ? 500 : 400, { code });
    }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 60_000;
  return server;
}
