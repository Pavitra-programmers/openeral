#!/usr/bin/env node
import { readConfig } from '../src/config.mjs';
import { PodError } from '../src/contracts.mjs';
import { createHelper } from '../src/helper.mjs';

let helper;
try {
  const config = await readConfig('/etc/openrind-browser-pods/helper.json', { uid: 0, privateFile: false });
  helper = createHelper({ ...config, placeholder: process.env.OPENRIND_BROWSER_POD_TOKEN,
    proxyUrl: process.env.HTTP_PROXY || process.env.http_proxy,
    onLost: () => { process.stderr.write('browser-pods: helper connection lost; browser sessions ended\n'); process.exitCode = 1; } });
  await helper.start();
  process.stdout.write('browser-pods: helper ready on 127.0.0.1:19300\n');
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {
    void helper.close().catch(() => { process.exitCode = 1; });
  });
} catch (error) {
  process.stderr.write(`browser-pods: ${error instanceof PodError ? error.code : 'HELPER_STARTUP_FAILED'}\n`);
  process.exitCode = 1;
  await helper?.close();
}
