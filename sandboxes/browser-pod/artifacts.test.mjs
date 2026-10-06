import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, PassThrough, Writable } from 'node:stream';
import { mkdtemp, readFile, rm, writeFile, symlink, link, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { unzipSync } from 'fflate';
import { PodArtifacts } from './artifacts.mjs';
import { tentativeAddresses } from './network-ready.mjs';

async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'pod-artifacts-'));
  const service = new PodArtifacts({ root: join(dir, 'spool'), downloads: join(dir, 'downloads'), enabled: true, ...overrides });
  await service.start();
  t.after(async () => { await service.close(); await rm(dir, { recursive: true, force: true }); });
  return { dir, service };
}
function multipart(name, bytes, field = 'file') {
  const body = Buffer.concat([Buffer.from(`--test-boundary\r\nContent-Disposition: form-data; name="${field}"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    bytes, Buffer.from('\r\n--test-boundary--\r\n')]);
  const req = Readable.from([body.subarray(0, 17), body.subarray(17)]);
  req.headers = { 'content-type': 'multipart/form-data; boundary=test-boundary' };
  return req;
}
test('multipart upload stores exact bytes at an opaque pod-local path', async t => {
  const { service } = await fixture(t);
  const bytes = Buffer.from('bounded upload\0with bytes');
  const value = await service.upload(multipart('fixture.txt', bytes), new AbortController().signal);
  assert.equal(value.originalName, 'fixture.txt'); assert.equal(value.size, bytes.length);
  assert.match(value.fileName, /^[a-f0-9]{32}\.upload$/);
  assert.deepEqual(await readFile(value.filePath), bytes);
});
test('upload rejects traversal, wrong fields, truncation, and oversize without publication', async t => {
  const { service } = await fixture(t, { limits: { file: 100, stored: 1000, entries: 256 } });
  for (const [name, bytes, field] of [['../escape', Buffer.from('x'), 'file'],
    ['file', Buffer.from('x'), 'unexpected'], ['file', Buffer.alloc(101), 'file']]) {
    await assert.rejects(service.upload(multipart(name, bytes, field), new AbortController().signal));
    assert.deepEqual(await readdir(service.root), []);
  }
  const truncated = Readable.from([Buffer.from('--test-boundary\r\n')]);
  truncated.headers = { 'content-type': 'multipart/form-data; boundary=test-boundary' };
  await assert.rejects(service.upload(truncated, new AbortController().signal));
  assert.deepEqual(await readdir(service.root), []);
});
test('archive is a real immutable zip; partial files and symlinks are excluded', async t => {
  const { dir, service } = await fixture(t);
  await writeFile(join(service.downloads, 'report.txt'), 'download bytes');
  await writeFile(join(service.downloads, 'incomplete.crdownload'), 'partial');
  await writeFile(join(dir, 'secret'), 'not an archive entry');
  await symlink(join(dir, 'secret'), join(service.downloads, 'outside'));
  assert.equal((await service.prepareArchive()).status, 'in_progress');
  while (service.job) await sleep(10);
  const result = await service.prepareArchive();
  assert.equal(result.status, 'completed');
  const entries = unzipSync(await readFile(join(service.root, `${result.artifactId}.zip`)));
  assert.deepEqual(Object.keys(entries), ['report.txt']);
  assert.equal(Buffer.from(entries['report.txt']).toString(), 'download bytes');
  await writeFile(join(service.downloads, 'report.txt'), 'second version');
  assert.equal((await service.prepareArchive()).status, 'in_progress');
  while (service.job) await sleep(10);
  assert.notEqual((await service.prepareArchive()).artifactId, result.artifactId);
  assert.equal(Buffer.from(unzipSync(await readFile(join(service.root, `${result.artifactId}.zip`)))['report.txt']).toString(), 'download bytes');
});
test('hard links, disabled archives, and stopped sessions fail safely', async t => {
  const { dir, service } = await fixture(t);
  await writeFile(join(dir, 'secret'), 'sensitive');
  await link(join(dir, 'secret'), join(service.downloads, 'unsafe'));
  await assert.rejects(service.prepareArchive(), { code: 'UNSAFE_DOWNLOAD' });
  service.enabled = false;
  assert.deepEqual(await service.prepareArchive(), { status: 'not_enabled' });
  service.enabled = true;
  await service.close();
  await assert.rejects(service.prepareArchive(), { code: 'SESSION_STOPPED' });
});
test('archive HTTP completion requires its published hash and file identity', async t => {
  const { service } = await fixture(t);
  await writeFile(join(service.downloads, 'report.txt'), 'verified archive');
  await service.prepareArchive(); await service.job;
  const { artifactId } = await service.prepareArchive();
  const response = () => {
    const chunks = [];
    const stream = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    stream.writeHead = (status, headers) => { stream.status = status; stream.headers = headers; };
    return { stream, chunks };
  };
  const good = response();
  await service.streamArchive(artifactId, good.stream, new AbortController().signal);
  assert.equal(good.stream.status, 200); assert.equal(good.stream.writableFinished, true);
  assert.equal(good.stream.headers['content-length'], undefined);
  assert.equal(Buffer.from(unzipSync(Buffer.concat(good.chunks))['report.txt']).toString(), 'verified archive');

  // Keep file metadata unchanged to exercise the final hash check separately.
  service.archives.get(artifactId).sha256 = '0'.repeat(64);
  const corrupt = response();
  await assert.rejects(service.streamArchive(artifactId, corrupt.stream, new AbortController().signal), { code: 'ARTIFACT_CHANGED' });
  assert.equal(corrupt.stream.writableFinished, false);
  assert.equal(corrupt.stream.destroyed, true);

  await writeFile(join(service.root, `${artifactId}.zip`), 'replacement');
  const replaced = response();
  await assert.rejects(service.streamArchive(artifactId, replaced.stream, new AbortController().signal), { code: 'ARTIFACT_CHANGED' });
  assert.equal(replaced.stream.status, undefined);
});
test('stop cancels an unfinished multipart upload and removes temporary bytes', { timeout: 5000 }, async t => {
  const { service } = await fixture(t);
  const req = new PassThrough(); req.headers = { 'content-type': 'multipart/form-data; boundary=partial' };
  const task = service.upload(req, new AbortController().signal);
  const rejected = assert.rejects(task);
  req.write('--partial\r\nContent-Disposition: form-data; name="file"; filename="file"\r\n\r\nbytes');
  await sleep(20); await service.close(); await rejected;
  assert.deepEqual(await readdir(service.root), []);
});
test('an empty-file flood still consumes object capacity', async t => {
  const { service } = await fixture(t, { limits: { file: 100, stored: 1000, entries: 1 } });
  await service.upload(multipart('empty', Buffer.alloc(0)), new AbortController().signal);
  await assert.rejects(service.upload(multipart('another', Buffer.alloc(0)), new AbortController().signal), { code: 'ARTIFACT_ENTRY_LIMIT' });
});
test('network readiness detects tentative IPv6 addresses without disabling IPv6', () => {
  assert.equal(tentativeAddresses('fe800000000000000000000000000001 02 40 20 40 eth0'), true);
  assert.equal(tentativeAddresses('fe800000000000000000000000000001 02 40 20 80 eth0'), false);
  assert.equal(tentativeAddresses(''), false);
  assert.throws(() => tentativeAddresses('fe800000000000000000000000000001 02 40 20 08 eth0'), /DAD_FAILED/);
});
