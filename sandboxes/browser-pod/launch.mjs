import { spawn } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';

let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 4096) throw new Error('POD_CONFIG_TOO_LARGE');
}
const config = JSON.parse(input);
if (!/^[a-f0-9-]{36}$/.test(config.sessionId) || !/^[A-Za-z0-9_-]{43}$/.test(config.secret) ||
    ![config.screen?.width, config.screen?.height].every(n => Number.isInteger(n) && n > 0 && n <= 8192)) {
  throw new Error('INVALID_POD_CONFIG');
}
await mkdir('/tmp/openrind-browser', { mode: 0o700 });
await writeFile('/tmp/openrind-browser/config.json', JSON.stringify(config), { mode: 0o600, flag: 'wx' });
const log = await open('/tmp/openrind-browser/agent.log', 'ax', 0o600);
try {
  const child = spawn(process.execPath, ['/opt/openrind-browser-pod/agent.mjs'], {
    detached: true, stdio: ['ignore', log.fd, log.fd],
  });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
} finally { await log.close(); }
