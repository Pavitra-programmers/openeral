#!/usr/bin/env node
import { join } from 'node:path';
import { createBroker } from '../src/broker.mjs';
import { brokerAddress, readConfig } from '../src/config.mjs';
import { PodError, requireThat } from '../src/contracts.mjs';
import { OpenShellRuntime } from '../src/openshell-runtime.mjs';
import { PodRegistry } from '../src/registry.mjs';
import { BrowserSessions } from '../src/sessions.mjs';

let runtime; let registry; let broker; let core; let interval; let tick;
let closing;
async function close() {
  if (closing) return closing;
  closing = (async () => {
    clearInterval(interval);
    const hardStop = setTimeout(() => process.exit(1), 70_000);
    hardStop.unref();
    try {
      if (core) core.ready = false;
      await tick;
      await broker?.close();
      await core?.shutdown();
      // Unconfirmed cleanup stays in SQLite and keeps its quota on restart.
    } finally { runtime?.close(); registry?.close(); clearTimeout(hardStop); }
  })();
  return closing;
}
try {
  requireThat(process.env.OPENRIND_BROWSER_PODS_EXPERIMENTAL === '1', 'EXPERIMENTAL_OPT_IN_REQUIRED');
  requireThat(process.argv.length === 3, 'CONFIG_PATH_REQUIRED');
  const config = await readConfig(process.argv[2]);
  const address = brokerAddress(config);
  registry = new PodRegistry(join(config.runtime.stateDir, 'sessions.sqlite'));
  runtime = new OpenShellRuntime(config.runtime);
  await runtime.preflight();
  core = new BrowserSessions({ registry, runtime });
  await core.recover();
  broker = createBroker({ core, runtime, owners: config.owners });
  await new Promise((resolve, reject) => {
    broker.server.once('error', reject);
    broker.server.listen(address.port, address.host, resolve);
  });
  interval = setInterval(() => {
    if (tick || closing) return;
    tick = (async () => { await runtime.heartbeat(core); await core.sweep({ waitForCleanup: false }); })()
      .catch(() => { core.ready = false; process.stderr.write('browser-pods: maintenance failed; new sessions disabled\n'); })
      .finally(() => { tick = undefined; });
  }, 1000);
  process.stdout.write('browser-pods: experimental Kernel broker ready\n');
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    void close().catch(() => { process.exitCode = 1; });
  });
} catch (error) {
  process.stderr.write(`browser-pods: ${error instanceof PodError ? error.code : 'STARTUP_FAILED'}\n`);
  process.exitCode = 1;
  await close();
}
