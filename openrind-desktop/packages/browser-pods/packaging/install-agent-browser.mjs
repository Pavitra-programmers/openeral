// Build-time only. Install the unchanged release binary after checksum validation.
import { createHash } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(await readFile(new URL('./agent-browser.json', import.meta.url), 'utf8'));
const target = manifest.targets[process.arch];
if (process.platform !== 'linux' || !target) throw new Error('Unsupported agent-browser image architecture');
const response = await fetch(target.url, { signal: AbortSignal.timeout(120_000) });
if (!response.ok) throw new Error('Pinned agent-browser download failed');
const parts = []; let size = 0;
for await (const part of response.body) {
  size += part.length;
  if (size > 64 * 1024 * 1024) throw new Error('Pinned agent-browser asset is too large');
  parts.push(part);
}
const bytes = Buffer.concat(parts);
if (createHash('sha256').update(bytes).digest('hex') !== target.sha256) throw new Error('agent-browser checksum mismatch');
await writeFile('/usr/local/bin/agent-browser', bytes, { flag: 'wx', mode: 0o755 });
await chmod('/usr/local/bin/agent-browser', 0o755);
const version = execFileSync('/usr/local/bin/agent-browser', ['--version'], { encoding: 'utf8', timeout: 15_000 });
if (!version.trim().endsWith(manifest.version)) throw new Error('agent-browser version mismatch');
