import { readConfig } from '../src/config.mjs';
import { HELPER_IMPLEMENTATION } from '../src/contracts.mjs';

try {
  const config = await readConfig('/etc/openrind-browser-pods/helper.json', { uid: 0, privateFile: false });
  const result = await fetch('http://127.0.0.1:19300/health', { signal: AbortSignal.timeout(1000) });
  const value = await result.json();
  if (!result.ok || !value.ready || value.generation !== config.generation || value.implementation !== HELPER_IMPLEMENTATION) throw new Error();
} catch { process.exitCode = 1; }
