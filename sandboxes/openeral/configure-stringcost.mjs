#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const home = process.env.OPENERAL_HOME || '/sandbox/work';
const runtimeDir = process.env.OPENERAL_RUNTIME_DIR || '/var/lib/openeral/runtime';
const presignPath = join(home, '.openeral', 'presign.json');
const settingsPath = join(home, '.claude', 'settings.json');
const baseUrlPath = join(runtimeDir, 'anthropic-base-url');

function normalize(raw) {
  const match = String(raw || '').trim().match(
    /https:\/\/proxy\.stringcost\.com\/stringcost-proxy\/t\/[^\s"'<>]+/,
  );
  if (!match) return '';
  const url = new URL(match[0]);
  url.pathname = url.pathname.replace(/\/v1\/.*$/, '');
  url.search = '';
  url.hash = '';
  const value = url.toString().replace(/\/$/, '');
  return /^https:\/\/proxy\.stringcost\.com\/stringcost-proxy\/t\/[^/]+$/.test(value)
    ? value
    : '';
}

function uploadedPresign() {
  const candidates = [
    '/sandbox/stringcost-presign',
    '/sandbox/stringcost-url',
    '/sandbox/openeral-input/presign.json',
    '/sandbox/openeral-input/stringcost-url',
  ];
  const cleanupPaths = [];
  let found = '';
  for (const root of candidates) {
    if (!existsSync(root)) continue;
    cleanupPaths.push(root);
    for (const path of filesUnder(root)) {
      try {
        const raw = readFileSync(path, 'utf8').trim();
        let value = raw;
        try { value = JSON.parse(raw)?.url || ''; } catch {}
        found ||= normalize(value);
      } catch {}
    }
  }
  return { cleanupPaths, url: found };
}

function filesUnder(path, depth = 0) {
  try {
    const stat = lstatSync(path);
    if (stat.isFile()) return [path];
    if (!stat.isDirectory() || depth >= 3) return [];
    return readdirSync(path).flatMap((name) => filesUnder(join(path, name), depth + 1));
  } catch {
    return [];
  }
}

function storedPresign() {
  try {
    return normalize(JSON.parse(readFileSync(presignPath, 'utf8'))?.url || '');
  } catch {
    return '';
  }
}

async function createPresign() {
  if (!process.env.STRINGCOST_API_KEY || !process.env.ANTHROPIC_API_KEY) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('https://app.stringcost.com/v1/presign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRINGCOST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'anthropic',
        client_api_key: process.env.ANTHROPIC_API_KEY,
        path: ['/v1/messages'],
        expires_in: -1,
        max_uses: -1,
        cost_limit: 10_000_000,
        tags: ['openeral'],
        metadata: { source: 'openeral-fuse-sandbox' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`presign failed (${response.status}): ${await response.text()}`);
    }
    return normalize((await response.json())?.url || '');
  } finally {
    clearTimeout(timeout);
  }
}

function persist(baseUrl) {
  mkdirSync(dirname(presignPath), { recursive: true });
  writeFileSync(
    presignPath,
    `${JSON.stringify({ url: baseUrl, updated_at: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 },
  );
  chmodSync(presignPath, 0o600);

  mkdirSync(dirname(settingsPath), { recursive: true });
  let settings = {};
  try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {}
  settings.env = settings.env && typeof settings.env === 'object' ? settings.env : {};
  settings.env.ANTHROPIC_BASE_URL = baseUrl;
  delete settings.env.ANTHROPIC_API_KEY;
  delete settings.env.ANTHROPIC_AUTH_TOKEN;
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  writeFileSync(baseUrlPath, `${baseUrl}\n`, { mode: 0o600 });
  chmodSync(baseUrlPath, 0o600);
}

async function main() {
  mkdirSync(runtimeDir, { recursive: true });
  const uploaded = uploadedPresign();
  let baseUrl = normalize(process.env.STRINGCOST_PROXY_URL)
    || uploaded.url
    || storedPresign();
  if (!baseUrl) {
    try {
      baseUrl = await createPresign();
    } catch (error) {
      process.stderr.write(`setup-fuse.sh: StringCost presign failed: ${error.message}\n`);
    }
  }

  if (baseUrl) {
    persist(baseUrl);
    process.stdout.write('setup-fuse.sh: StringCost proxy configured\n');
  } else {
    rmSync(baseUrlPath, { force: true });
  }
  for (const path of uploaded.cleanupPaths) rmSync(path, { force: true, recursive: true });
}

main().catch((error) => {
  process.stderr.write(`setup-fuse.sh: StringCost configuration failed: ${error.message}\n`);
  process.exit(1);
});
