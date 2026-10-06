import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const originalSha256 = '521c43c805a45d88170c3f50f8a8d625b83690b14ff7a23bbccbe1ab0615bd5e';
export const configuredSha256 = '44b72c49478e706ae7c7c5198809ecbef2935ccf9bb4c8c994525cda7c2541fd';
const before = 'return new Hyperbrowser({ apiKey: settings.HYPERBROWSER_API_KEY });';
const after = 'return new Hyperbrowser({ apiKey: settings.HYPERBROWSER_API_KEY, baseUrl: process.env.ARGIDE_HYPERBROWSER_BASE_URL });';

export function configureBundle(source) {
  assert.equal(createHash('sha256').update(source).digest('hex'), originalSha256,
    'Argide bundle changed. Review the new source before updating the fixture pin.');
  assert.equal(source.split(before).length, 2, 'Expected exactly one Hyperbrowser constructor');
  const configured = source.replace(before, after);
  assert.equal(createHash('sha256').update(configured).digest('hex'), configuredSha256);
  return configured;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = '/opt/argide/packages/backend-core/dist/index.js';
  await writeFile(path, configureBundle(await readFile(path, 'utf8')));
  await writeFile('/opt/argide-test/provenance.json', JSON.stringify({ originalSha256, configuredSha256,
    change: 'Hyperbrowser baseUrl constructor option only' }, null, 2));
}
