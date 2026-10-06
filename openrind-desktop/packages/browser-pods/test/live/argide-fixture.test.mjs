import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureBundle } from './argide/configure.mjs';
import { startWidgetFixture } from './argide/widget-host.mjs';

test('Argide configuration refuses an unreviewed source bundle', () => {
  assert.throws(() => configureBundle('return new Hyperbrowser({ apiKey: settings.HYPERBROWSER_API_KEY });'),
    /Argide bundle changed/);
});

test('Argide website relay rejects a remote or credential-bearing backend before I/O', async () => {
  for (const backend of ['https://127.0.0.1:14000', 'http://example.com',
    'http://user:password@127.0.0.1:14000', 'http://127.0.0.1:14000/admin']) {
    await assert.rejects(startWidgetFixture('127.0.0.1', { backend, bundle: '/not-a-bundle' }),
      { code: 'ERR_ASSERTION' });
  }
});

test('Argide website relay refuses a changed widget without contacting the backend', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'argide-widget-pin-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bundle = join(dir, 'widget.js');
  await writeFile(bundle, '// not the supplied widget');
  await assert.rejects(startWidgetFixture('127.0.0.1', { backend: 'http://127.0.0.1:1', bundle }),
    /Review a changed widget/);
});
