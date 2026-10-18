import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createChallengeServer } from '../src/challenge-server.mjs';
import { runCtfAgent, validateChallengeEventExport } from '../src/agent.mjs';
import { createTask, publicTask } from '../src/tasks.mjs';

test('task definitions point to the runnable web applications', () => {
  const flagCommand = createTask('flag-command');
  const glacier = createTask('glacier-exchange');
  const amoeba = createTask('amoebananas');
  const clientSecrets = createTask('client-secrets');
  const cookieClicker = createTask('cookie-clicker');
  const myflask = createTask('myflask-traversal');
  const pythonSsti = createTask('python-ssti');
  assert.equal(flagCommand.title, 'Flag Command');
  assert.equal(flagCommand.entrypoint, '/opt/openrind-ctf/task/challenge/run.py');
  assert.equal(glacier.title, 'GlacierXchange');
  assert.equal(glacier.entrypoint, '/opt/openrind-ctf/task/chall/server.py');
  assert.equal(amoeba.title, 'Amoeba Central');
  assert.equal(amoeba.entrypoint, '/opt/openrind-ctf/task/chall/server.py');
  assert.equal(clientSecrets.title, 'Client Authentication');
  assert.equal(clientSecrets.entrypoint, '/opt/openrind-ctf/task/chall/server.py');
  assert.equal(cookieClicker.title, 'Cookie Clicker');
  assert.equal(cookieClicker.entrypoint, '/opt/openrind-ctf/task/chall/server.py');
  assert.equal(myflask.title, 'My Flask App');
  assert.equal(myflask.entrypoint, '/opt/openrind-ctf/task/chall/server.py');
  assert.equal(pythonSsti.title, 'Python Template Injection');
  assert.equal(pythonSsti.entrypoint, '/opt/openrind-ctf/task/chall/server.py');
  assert.equal(flagCommand.sitePath, '/');
  assert.equal(glacier.sitePath, '/');
  assert.equal(amoeba.sitePath, '/');
  assert.equal(clientSecrets.sitePath, '/');
  assert.equal(cookieClicker.sitePath, '/');
  assert.equal(myflask.sitePath, '/');
  assert.equal(pythonSsti.sitePath, '/');
  assert.ok(flagCommand.browserRules.some(rule => rule.path === '/api/options'));
  assert.ok(glacier.browserRules.some(rule => rule.path === '/api/wallet/transaction'));
  assert.ok(amoeba.browserRules.some(rule => rule.path === '/'));
  assert.ok(clientSecrets.browserRules.some(rule => rule.path === '/admin_7de7b2fed84fd29656dff73bc98daef391b0480efdb0f2e3034e7598b5a412ce.html'));
  assert.ok(cookieClicker.browserRules.some(rule => rule.path === '/click'));
  assert.ok(myflask.browserRules.some(rule => rule.path === '/view'));
  assert.ok(pythonSsti.browserRules.some(rule => rule.path === '/'));
  assert.equal('flag' in flagCommand, false);
  assert.equal('entrypoint' in publicTask(glacier), false);
  assert.equal('browserRules' in publicTask(glacier), false);
  assert.equal('entrypoint' in publicTask(amoeba), false);
  assert.equal('entrypoint' in publicTask(cookieClicker), false);
  assert.throws(() => createTask('unknown'), /UNKNOWN_TASK/);
});

test('the service proxies original app paths and records the browser run cookie', async () => {
  const task = createTask('flag-command');
  const events = [];
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'set-cookie': 'benchmark-session=abc; Path=/' });
    res.end(`${req.method} ${req.url}`);
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const service = createChallengeServer({ task, judgeToken: 'a'.repeat(43), expectedFlag: 'HTB{unit-test}',
    upstreamPort: upstream.address().port, record: async event => events.push(event) });
  service.listen(0, '127.0.0.1');
  await once(service, 'listening');
  const origin = `http://127.0.0.1:${service.address().port}`;
  try {
    const page = await fetch(`${origin}/?run=run-12345678`);
    assert.equal(await page.text(), 'GET /');
    assert.deepEqual(page.headers.getSetCookie(), [
      'benchmark-session=abc; Path=/', 'openrind_ctf_run=run-12345678; Path=/; HttpOnly; SameSite=Strict',
    ]);
    const script = await fetch(`${origin}/static/terminal/js/main.js`, {
      headers: { cookie: 'openrind_ctf_run=run-12345678' },
    });
    assert.equal(await script.text(), 'GET /static/terminal/js/main.js');
    assert.ok(events.some(event => event.kind === 'site' && event.path === '/' && event.actor === 'run-12345678'));
    assert.ok(events.some(event => event.kind === 'site' && event.path === '/static/terminal/js/main.js' && event.actor === 'run-12345678'));
  } finally {
    const closed = Promise.all([once(service, 'close'), once(upstream, 'close')]);
    service.close(); upstream.close();
    await closed;
  }
});

test('the judge route is not proxied and is unavailable without the judge credential', async () => {
  const task = createTask('flag-command');
  let upstreamRequests = 0;
  const upstream = http.createServer((_req, res) => { upstreamRequests++; res.end('unexpected'); });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const events = [];
  const token = 'b'.repeat(43);
  const service = createChallengeServer({ task, judgeToken: token, expectedFlag: 'HTB{unit-test}',
    upstreamPort: upstream.address().port, record: async event => events.push(event) });
  service.listen(0, '127.0.0.1');
  await once(service, 'listening');
  const origin = `http://127.0.0.1:${service.address().port}`;
  try {
    const denied = await fetch(`${origin}/v1/submit`, { method: 'POST', body: JSON.stringify({ flag: 'HTB{unit-test}' }) });
    assert.equal(denied.status, 401);
    assert.equal(upstreamRequests, 0);
    const accepted = await fetch(`${origin}/v1/submit`, { method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-openrind-run-actor': 'run-12345678' },
      body: JSON.stringify({ flag: 'HTB{unit-test}' }) });
    assert.deepEqual(await accepted.json(), { correct: true });
    assert.ok(events.some(event => event.kind === 'judge' && event.correct && event.actor === 'run-12345678'));
  } finally {
    const closed = Promise.all([once(service, 'close'), once(upstream, 'close')]);
    service.close(); upstream.close();
    await closed;
  }
});

test('challenge event export rejects records from another run', () => {
  assert.deepEqual(validateChallengeEventExport({ runId: 'run-12345678', truncated: false,
    events: [{ actor: 'run-12345678', kind: 'site' }] }, 'run-12345678'),
  [{ actor: 'run-12345678', kind: 'site' }]);
  assert.throws(() => validateChallengeEventExport({ runId: 'run-12345678', truncated: false,
    events: [{ actor: 'run-87654321', kind: 'site' }] }, 'run-12345678'), /CHALLENGE_EVENT_EXPORT_INCOMPLETE/);
});

test('the unimplemented Haloop mode fails closed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'openrind-ctf-mode-'));
  const configPath = join(directory, 'agent.json');
  try {
    await writeFile(configPath, JSON.stringify({ modelMode: 'haloop' }));
    await assert.rejects(runCtfAgent(configPath), /HALOOP_CTF_PROFILE_NOT_IMPLEMENTED/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
