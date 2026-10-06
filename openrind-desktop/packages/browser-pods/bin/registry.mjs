#!/usr/bin/env node
import { join } from 'node:path';
import { readConfig } from '../src/config.mjs';
import { PodError, requireThat } from '../src/contracts.mjs';
import { OpenShellRuntime } from '../src/openshell-runtime.mjs';
import { resolveAbsent } from '../src/operator.mjs';
import { PodRegistry } from '../src/registry.mjs';

let registry;
try {
  const [configPath, command, id, confirmation, reason] = process.argv.slice(2);
  requireThat((command === 'pending' && process.argv.length === 4) ||
    (command === 'resolve-absent' && process.argv.length === 7), 'OPERATOR_ARGUMENTS_REQUIRED');
  const config = await readConfig(configPath);
  registry = new PodRegistry(join(config.runtime.stateDir, 'sessions.sqlite'));
  if (command === 'pending') {
    console.log(JSON.stringify(registry.active().map(s => ({ id: s.id, name: s.name, state: s.state,
      observed: Boolean(s.handle?.id), attempts: s.cleanupAttempts ?? 0, error: s.cleanupError ?? null,
      retryAt: s.nextCleanupAt ?? null })), null, 2));
  } else {
    const runtime = new OpenShellRuntime(config.runtime);
    await resolveAbsent(registry, runtime, id, {
      confirmNoPendingCreate: confirmation === '--confirm-no-pending-create', reason,
    });
    console.log('Resolved absent create. The operator confirmation is recorded.');
  }
} catch (error) {
  console.error(`browser-pods: ${error instanceof PodError ? error.code : 'REGISTRY_UNAVAILABLE_STOP_BROKER_FIRST'}`);
  process.exitCode = 1;
} finally { registry?.close(); }
