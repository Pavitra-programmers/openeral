// Configured Hyperbrowser SDK contract fixture. This is NOT extracted Argide code.
// It follows BROWSER-PODS.md section 10.2 until the original archive is available.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { Hyperbrowser } from '@hyperbrowser/sdk';
import { chromium } from 'playwright-core';
import { unzipSync } from 'fflate';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const client = new Hyperbrowser({ apiKey: 'openrind-compat', baseUrl: 'http://127.0.0.1:19300' });
const options = { region: 'us-west-2', screen: { width: 1440, height: 900 }, timeoutMinutes: 60,
  saveDownloads: true, enableWebRecording: true, enableVideoWebRecording: true,
  useStealth: true, adblock: true, trackers: true, annoyances: true, solveCaptchas: false };
const checks = []; let session; let browser;
try {
  session = await client.sessions.create(options);
  assert.equal(session.status, 'active'); assert.equal(session.token, '');
  assert.equal(session.liveUrl, undefined); assert.equal(session.liveDomain, undefined);
  assert.equal(session.launchState.useStealth, false);
  assert.equal(session.openrind.warnings.length, 7);
  assert.equal(session.openrind.effective.saveDownloads, true);
  assert.deepEqual(session.openrind.effective.screen, options.screen);
  assert.equal(session.creditsUsed, null);
  assert.match(session.wsEndpoint, /^ws:\/\/127\.0\.0\.1:19300\/cdp\/[A-Za-z0-9_-]{43}$/);
  checks.push('SDK create with full documented Argide option profile and honest warnings');
  const detail = await client.sessions.get(session.id, { liveViewTtlSeconds: 3600 });
  assert.equal(detail.wsEndpoint, session.wsEndpoint);
  const listed = await client.sessions.list({ page: 1, limit: 10, status: 'active' });
  assert.ok(listed.sessions.some(s => s.id === session.id));
  checks.push('SDK session detail and list with supported query parameters');
  browser = await chromium.connectOverCDP(`${detail.wsEndpoint}?keepAlive=true`);
  const context = browser.contexts()[0]; let page = context.pages()[0];
  assert.ok(page, 'create must supply a default context and page');
  await page.goto('https://example.com', { timeout: 30_000 });
  await page.setContent('<label>Name <input id="name"></label><button id="submit">Submit</button><input id="file" type="file"><a id="download">Download</a>');
  await page.evaluate(() => { document.querySelector('#submit').onclick = () => { document.title = document.querySelector('#name').value; }; });
  await page.locator('#name').fill('Retained browser state'); await page.locator('#submit').click();
  assert.equal(await page.title(), 'Retained browser state');
  checks.push('real Playwright navigation, fill, and click in the initial page');
  await browser.close(); browser = null;
  await sleep(61_000);
  const reconnected = await client.sessions.get(session.id, { liveViewTtlSeconds: 3600 });
  assert.equal(reconnected.wsEndpoint, session.wsEndpoint);
  browser = await chromium.connectOverCDP(`${reconnected.wsEndpoint}?keepAlive=true`);
  page = browser.contexts()[0].pages()[0];
  assert.equal(await page.title(), 'Retained browser state');
  checks.push('SDK/Playwright disconnect and reconnect retain the same browser after 61 seconds');
  const bytes = Buffer.alloc(2 * 1024 * 1024);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + (i >> 8)) & 255;
  const upload = await client.sessions.uploadFile(session.id, { fileInput: bytes, fileName: 'fixture.bin' });
  assert.match(upload.filePath, /^\/tmp\/openrind-browser\/artifacts\/[a-f0-9]{32}\.upload$/);
  assert.equal(upload.sha256, digest(bytes)); assert.equal(upload.originalName, 'fixture.bin');
  await assert.rejects(access(upload.filePath, constants.F_OK), { code: 'ENOENT' });
  // This path exists in the browser pod, not on the Playwright client host.
  const pageCdp = await page.context().newCDPSession(page);
  const { root } = await pageCdp.send('DOM.getDocument');
  const { nodeId } = await pageCdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#file' });
  await pageCdp.send('DOM.setFileInputFiles', { nodeId, files: [upload.filePath] });
  await pageCdp.detach();
  const browserHash = await page.locator('#file').evaluate(async input => {
    const buffer = await input.files[0].arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return { size: buffer.byteLength, sha256: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') };
  });
  assert.deepEqual(browserHash, { size: bytes.length, sha256: digest(bytes) });
  checks.push('SDK multipart upload above 1 MiB is readable by the browser with the exact hash');
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: '/tmp/downloads', eventsEnabled: true });
  const completed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('download did not complete')), 20_000);
    cdp.on('Browser.downloadProgress', event => {
      if (event.state === 'completed') { clearTimeout(timer); resolve(); }
      if (event.state === 'canceled') { clearTimeout(timer); reject(new Error('download canceled')); }
    });
  });
  // Avoid an unhandled rejection if the click itself fails.
  completed.catch(() => {});
  await page.evaluate(() => {
    const a = document.querySelector('#download');
    a.href = URL.createObjectURL(new Blob(['fixture download bytes\n'], { type: 'application/octet-stream' }));
    a.download = 'fixture-download.txt';
  });
  await page.locator('#download').click(); await completed;
  checks.push('real Chromium download completes in browser-local /tmp/downloads');
  let archive;
  for (let i = 0; i < 100; i++) {
    archive = await client.sessions.getDownloadsURL(session.id);
    if (archive.status === 'completed') break;
    assert.ok(['pending', 'in_progress'].includes(archive.status), JSON.stringify(archive));
    await sleep(100);
  }
  assert.equal(archive.status, 'completed');
  assert.match(archive.downloadsUrl, /^http:\/\/127\.0\.0\.1:19300\/artifacts\/[a-f0-9-]{36}\/[a-f0-9]{32}$/);
  const response = await fetch(archive.downloadsUrl);
  assert.equal(response.status, 200);
  const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
  assert.deepEqual(Object.keys(entries), ['fixture-download.txt']);
  assert.equal(Buffer.from(entries['fixture-download.txt']).toString(), 'fixture download bytes\n');
  for (const path of ['/sandbox/work/fixture-download.txt', '/sandbox/fixture-download.txt']) {
    await assert.rejects(access(path, constants.F_OK), { code: 'ENOENT' });
  }
  checks.push('SDK archive URL streams a verified ZIP without automatic workspace publication');
  await browser.close(); browser = null;
  assert.equal((await client.sessions.stop(session.id)).success, true);
  assert.equal((await client.sessions.stop(session.id)).success, true);
  assert.equal((await client.sessions.get(session.id)).status, 'closed');
  assert.equal((await fetch(archive.downloadsUrl)).status, 404);
  checks.push('SDK stop is idempotent and revokes archive access');
  console.log(JSON.stringify({ fixture: 'hyperbrowser-sdk-contract-not-extracted-argide',
    sdk: '0.91.0', playwright: '1.59.1', sessionId: session.id, checks, uploadSha256: digest(bytes), result: 'passed' }));
} finally {
  await browser?.close().catch(() => {});
  if (session) await client.sessions.stop(session.id);
}
