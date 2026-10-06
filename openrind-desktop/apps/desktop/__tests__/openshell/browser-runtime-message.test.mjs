import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrowserWorkerMessage } from '../../electron/openshell/browser-runtime.mjs';

test('legacy browser worker replies are validated before use', () => {
  const id = 'ab'.repeat(16);
  assert.deepEqual(parseBrowserWorkerMessage({ type: 'ready', protocol: 1 }), { type: 'ready' });
  assert.deepEqual(parseBrowserWorkerMessage({ type: 'result', id, ok: true, value: { ready: true } }),
    { type: 'result', id, ok: true, value: { ready: true } });
  assert.deepEqual(parseBrowserWorkerMessage({ type: 'result', id, ok: false }),
    { type: 'result', id, ok: false, value: undefined });
  for (const message of [null, undefined, 1, 'ready', [], {}, { type: 'ready', protocol: 2 },
    { type: 'result', id: 'unknown', ok: true }, { type: 'result', id, ok: 'true' }]) {
    assert.equal(parseBrowserWorkerMessage(message), null);
  }
});
