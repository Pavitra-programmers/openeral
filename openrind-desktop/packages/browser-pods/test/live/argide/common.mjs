import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { configuredSha256 } from './configure.mjs';

// These are the kit's dummy settings. The module fixture makes no model or DB
// calls. The real backend runs separately with its selected model credential.
for (const line of (await readFile('/opt/argide-test/backend.env.example', 'utf8')).split('\n')) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, '');
}
process.env.ARGIDE_HYPERBROWSER_BASE_URL = 'http://127.0.0.1:19300';
process.env.HYPERBROWSER_API_KEY = 'openrind-compat';
const path = '/opt/argide/packages/backend-core/dist/index.js';
assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), configuredSha256);
export const core = await import(path);
const require = createRequire('/opt/argide/packages/backend-core/package.json');
export const { chromium } = require('playwright-core');
export const provenance = JSON.parse(await readFile('/opt/argide-test/provenance.json', 'utf8'));
