import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

export function tentativeAddresses(ipv6) {
  return ipv6.trim().split('\n').filter(Boolean).some(line => {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 6 || !/^[a-f0-9]+$/i.test(fields[4])) throw new Error('INVALID_IPV6_STATE');
    const flags = Number.parseInt(fields[4], 16);
    if (flags & 0x08) throw new Error('IPV6_DAD_FAILED');
    return (flags & 0x40) !== 0;
  });
}

// IPv6 duplicate-address detection can finish after OpenShell Ready. Start Chrome
// after that transition so its first request is not canceled by an address change.
export async function waitForNetworkReady({ timeoutMs = 5000, quietMs = 500 } = {}) {
  const until = performance.now() + timeoutMs;
  let previous; let stableSince = performance.now();
  while (performance.now() < until) {
    const routes = await readFile('/proc/net/route', 'utf8');
    const ipv6 = await readFile('/proc/net/if_inet6', 'utf8').catch(error => {
      if (error.code === 'ENOENT') return ''; throw error;
    });
    const snapshot = routes + ipv6;
    if (tentativeAddresses(ipv6) || snapshot !== previous) stableSince = performance.now();
    else if (performance.now() - stableSince >= quietMs) return;
    previous = snapshot;
    await sleep(100);
  }
  throw new Error('NETWORK_STARTUP_TIMEOUT');
}
