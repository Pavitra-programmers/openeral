import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { core, chromium, provenance } from './common.mjs';

const checks = [];
let session; let browser;
try {
  session = await core.createHyperbrowserSession({ width: 1280, height: 800, timezone: 'America/Los_Angeles' });
  assert.equal(session.status, 'active');
  assert.match(session.connectUrl, /^ws:\/\/127\.0\.0\.1:19300\/cdp\/[\w-]+\?keepAlive=true$/);
  checks.push('Actual Argide create function and real option profile');
  const initialized = await core.initializeHyperbrowserSession(session.id, {
    connectUrl: session.connectUrl, url: 'https://example.com',
  });
  assert.equal(initialized.pages.length, 1);
  assert.equal(initialized.vncUrl, undefined);
  assert.equal(initialized.liveViewUrl, undefined);
  assert.equal(initialized.cdpWsUrlTemplate, session.connectUrl);
  checks.push('Actual Argide initialization and VNC parser, without a fake viewer');
  browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0];
  assert.match(await page.title(), /Example Domain/);
  await page.setContent('<label>Name <input id="name"></label><button id="submit">Submit</button><input type="file" id="file">');
  await page.evaluate(() => { document.querySelector('#submit').onclick = () => { document.title = document.querySelector('#name').value; }; });
  await page.locator('#name').fill('Actual Argide retained state');
  await page.locator('#submit').click();
  await browser.close(); browser = null;
  await sleep(61_000);
  assert.ok(await core.getHyperbrowserSession(session.id));
  browser = await chromium.connectOverCDP(session.connectUrl);
  const resumed = browser.contexts()[0].pages()[0];
  assert.equal(await resumed.title(), 'Actual Argide retained state');
  checks.push('Actual Argide get function after 61 seconds; page retained');
  const bytes = Buffer.alloc(2 * 1024 * 1024, 51);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const uploaded = await core.uploadFileToSession(session.id, bytes, 'argide-test.bin');
  const cdp = await resumed.context().newCDPSession(resumed);
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#file' });
  await cdp.send('DOM.setFileInputFiles', { nodeId, files: [uploaded.filePath] });
  const actualHash = await resumed.locator('#file').evaluate(async input => {
    const digest = await crypto.subtle.digest('SHA-256', await input.files[0].arrayBuffer());
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  });
  assert.equal(actualHash, hash);
  checks.push('Actual Argide upload function; browser read exact 2 MiB bytes');
  await browser.close(); browser = null;
  assert.equal(await core.stopHyperbrowserSession(session.id), true);
  assert.equal(await core.stopHyperbrowserSession(session.id), true);
  checks.push('Actual Argide stop function and repeat stop');
  console.log('ARGIDE_RESULT=' + JSON.stringify({ result: 'passed', checks,
    source: 'supplied Argide backend-core bundle', ...provenance }));
} finally {
  await browser?.close().catch(() => {});
  if (session) await core.stopHyperbrowserSession(session.id);
}
