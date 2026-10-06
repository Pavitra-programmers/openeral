import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { isIP } from 'node:net';
import { requireThat } from './contracts.mjs';

export async function readConfig(path, { uid = process.getuid(), privateFile = true } = {}) {
  requireThat(isAbsolute(path), 'ABSOLUTE_CONFIG_PATH_REQUIRED');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    requireThat(stat.isFile() && stat.nlink === 1 && stat.uid === uid && stat.size < 64 * 1024 &&
      (stat.mode & (privateFile ? 0o077 : 0o022)) === 0, 'UNSAFE_CONFIG_FILE');
    return JSON.parse(await file.readFile('utf8'));
  } finally { await file.close(); }
}

export function brokerAddress(config) {
  const host = config.listen?.host;
  const port = config.listen?.port;
  requireThat(isIP(host) === 4 && /^(?:127\.0\.0\.1$|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host), 'PRIVATE_BIND_REQUIRED');
  requireThat(Number.isInteger(port) && port >= 1024 && port <= 65535 && port !== 18770, 'INVALID_BROKER_PORT');
  requireThat(Array.isArray(config.owners) && config.owners.length > 0 && config.owners.length <= 64, 'OWNER_CONFIG_REQUIRED');
  return { host, port };
}
