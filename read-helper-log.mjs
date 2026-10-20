#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const DISTRO = 'openrind-desktop-openshell';

function wslRun(args) {
  return execFileSync('wsl.exe', ['-d', DISTRO, '--', ...args], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

try {
  const psOutput = wslRun(['docker', 'ps', '--format', '{{.Names}}']);
  const containers = psOutput.split('\n').map(s => s.trim()).filter(Boolean);
  const sandboxContainers = containers.filter(c => c.startsWith('openshell-default--'));

  if (!sandboxContainers.length) {
    console.log('No sandbox container found.');
    process.exit(1);
  }

  for (const target of sandboxContainers) {
    console.log(`\n=== Log from ${target} ===`);
    try {
      const log = wslRun(['docker', 'exec', target, 'cat', '/tmp/openrind-browser-pods/helper.log']);
      console.log(log.split('\n').slice(-30).join('\n'));
    } catch (e) {
      console.log('Could not read helper.log:', e.message);
    }
  }
} catch (e) {
  console.error('Error:', e.message);
}
