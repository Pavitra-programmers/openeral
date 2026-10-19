// Build-time only. Install the unchanged release binary after checksum validation.
import { createHash } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(await readFile(new URL('./agent-browser.json', import.meta.url), 'utf8'));
const target = manifest.targets[process.arch];
if (process.platform !== 'linux' || !target) throw new Error('Unsupported agent-browser image architecture');
async function fetchWithRetry(url, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts) {
      await new Promise(r => setTimeout(r, attempt * 3000));
    }
  }
  throw lastError;
}

const response = await fetchWithRetry(target.url);
const parts = []; let size = 0;
for await (const part of response.body) {
  size += part.length;
  if (size > 64 * 1024 * 1024) throw new Error('Pinned agent-browser asset is too large');
  parts.push(part);
}
const bytes = Buffer.concat(parts);
if (createHash('sha256').update(bytes).digest('hex') !== target.sha256) throw new Error('agent-browser checksum mismatch');
const binary = '/opt/openrind/browser/agent-browser';
await writeFile(binary, bytes, { flag: 'wx', mode: 0o755 });
await chmod(binary, 0o755);
const version = execFileSync(binary, ['--version'], { encoding: 'utf8', timeout: 15_000 });
if (!version.trim().endsWith(manifest.version)) throw new Error('agent-browser version mismatch');
await writeFile('/usr/local/bin/agent-browser', await readFile(new URL('./agent-browser.sh', import.meta.url)),
  { flag: 'wx', mode: 0o755 });
await chmod('/opt/openrind/browser/agent-browser-policy.json', 0o644).catch(() => {});
await chmod('/opt/openrind/browser/agent-browser.json', 0o644).catch(() => {});
