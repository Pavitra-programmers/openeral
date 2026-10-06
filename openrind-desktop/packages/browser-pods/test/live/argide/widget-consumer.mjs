import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { core, chromium, provenance } from './common.mjs';

let session; let browser; let page;
try {
  session = await core.createHyperbrowserSession({ width: 1440, height: 1000, timezone: 'America/Los_Angeles' });
  // The host starts log capture before allowing the widget task to proceed.
  await writeFile('/tmp/argide-widget-session-ready', session.id, { mode: 0o600, flag: 'wx' });
  let ready = false;
  for (let i = 0; i < 180; i++) {
    if (await access('/tmp/argide-widget-ready').then(() => true, () => false)) { ready = true; break; }
    await sleep(500);
  }
  assert.ok(ready, 'Test-only website policy was not installed');
  browser = await chromium.connectOverCDP(session.connectUrl);
  page = browser.contexts()[0].pages()[0];
  await page.addInitScript(() => {
    window.__argideEvents = [];
    const fetchOriginal = window.fetch;
    window.fetch = async function (...args) {
      const response = await fetchOriginal.apply(this, args);
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const clone = response.clone();
        void (async () => {
          const reader = clone.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
          while (true) {
            const { value, done } = await reader.read(); if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let end;
            while ((end = buffer.indexOf('\n\n')) !== -1) {
              const block = buffer.slice(0, end); buffer = buffer.slice(end + 2);
              const type = block.match(/^event: (.+)$/m)?.[1];
              const data = block.match(/^data: (.+)$/m)?.[1];
              if (type && data) window.__argideEvents.push({ type, data: JSON.parse(data) });
            }
          }
        })().catch(() => {});
      }
      return response;
    };
    // Only this deterministic fixture auto-approves. Never ship this in a runtime.
    setInterval(() => {
      document.getElementById('og2-widget-root')?.shadowRoot?.querySelector('.og2-allow-btn')?.click();
    }, 150);
  });
  const response = await page.goto('http://host.openshell.internal:19302/fixture', { waitUntil: 'domcontentloaded', timeout: 20_000 });
  assert.equal(response.status(), 200, 'The controlled website must pass OpenShell policy');
  await page.waitForFunction(() => document.getElementById('og2-widget-root')?.shadowRoot?.querySelector('button'), null, { timeout: 20_000 });
  const checks = ['Actual archived Argide widget mounts in OpenShell Chromium'];
  await page.locator('#og2-widget-root button').first().click();
  const input = page.locator('#og2-widget-root textarea');
  // The harness enters only the chat request. Argide must perform every form action.
  await input.fill('Fill the Name field with Openrind Real Agent. Fill Email with agent@example.test. Click Submit. Then tell me the exact confirmation text.');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('#result')?.textContent === 'Submitted: Openrind Real Agent | agent@example.test', null, { timeout: 120_000 });
  checks.push('Real Argide model and widget execute the requested form actions');
  await page.waitForFunction(() => window.__argideEvents.some(e => e.type === 'chat.finish'), null, { timeout: 30_000 });
  const events = await page.evaluate(() => window.__argideEvents);
  const tools = events.filter(e => e.type === 'tool.call.dispatched').map(e => e.data.payload?.toolName);
  assert.ok(tools.some(name => ['perform_action', 'batch_fill_form'].includes(name)));
  assert.ok(!events.some(e => e.type === 'chat.error'));
  const widgetText = await page.locator('#og2-widget-root').evaluate(el => el.shadowRoot.textContent);
  assert.ok(widgetText.includes('Submitted: Openrind Real Agent | agent@example.test'));
  checks.push('Real backend tool dispatch and terminal chat.finish observed');
  await page.screenshot({ path: '/sandbox/argide-widget.png', fullPage: true });
  checks.push('Real widget and changed form saved in screenshot evidence');
  console.log('ARGIDE_WIDGET_RESULT=' + JSON.stringify({ result: 'passed', checks, ...provenance,
    eventTypes: events.map(e => e.type), toolNames: tools,
    pageResult: await page.locator('#result').innerText() }));
} catch (error) {
  if (page) {
    await page.screenshot({ path: '/sandbox/argide-widget.png', fullPage: true }).catch(() => {});
    const details = await page.evaluate(() => ({ title: document.title, text: document.body.innerText,
      widget: document.getElementById('og2-widget-root')?.shadowRoot?.textContent,
      events: window.__argideEvents })).catch(() => null);
    await writeFile('/sandbox/argide-widget-failure.json', JSON.stringify(details), { mode: 0o600 });
  }
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (session) await core.stopHyperbrowserSession(session.id);
}
