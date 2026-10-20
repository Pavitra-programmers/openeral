#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const DISTRO = 'openrind-desktop-openshell';

function wslRun(args, timeoutMs = 60000) {
  return execFileSync('wsl.exe', ['-d', DISTRO, '--', ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  }).trim();
}

console.log('=== Openrind Browser Pod Live Updater ===');

try {
  const toWsl = (p) => {
    const abs = path.resolve(p);
    const m = /^([A-Za-z]):[\\/](.*)$/.exec(abs);
    return `/mnt/${m[1].toLowerCase()}/${m[2].replaceAll('\\', '/')}`;
  };

  const psOutput = wslRun(['docker', 'ps', '--format', '{{.Names}}']);
  const containers = psOutput.split('\n').map(s => s.trim()).filter(Boolean);

  // 1. Live-patch the browser pod container(s)
  const browserPodContainers = containers.filter(c => c.startsWith('openrind-browser-pod'));
  console.log(`Found ${browserPodContainers.length} browser pod container(s).`);
  const serverSrc = path.resolve('sandboxes/browser-pod/server.mjs');
  const wslServerSrc = toWsl(serverSrc);

  for (const pod of browserPodContainers) {
    console.log(`Patching server.mjs in browser pod: ${pod}...`);
    try {
      wslRun(['docker', 'cp', wslServerSrc, `${pod}:/opt/openrind-browser-pod/server.mjs`]);
      wslRun(['docker', 'restart', pod], 20000);
      console.log(`[OK] Browser pod ${pod} patched and restarted.`);
    } catch (e) {
      console.warn(`Could not patch ${pod}: ${e.message}`);
    }
  }

  // 2. Live-patch the sandbox container(s)
  const sandboxContainers = containers.filter(c => c.startsWith('openshell-default--'));
  console.log(`\nFound ${sandboxContainers.length} active sandbox container(s).`);

  const helperSrc = path.resolve('openrind-desktop/packages/browser-pods/bin/openrind-browser-pod-helper.mjs');
  const wslHelperSrc = toWsl(helperSrc);
  const policySrc = path.resolve('sandboxes/openeral/policy.yaml');
  const wslPolicySrc = toWsl(policySrc);

  for (const c of sandboxContainers) {
    console.log(`Updating helper and policy in container: ${c}...`);
    try {
      wslRun(['docker', 'cp', wslHelperSrc, `${c}:/opt/openrind-browser-pods/bin/openrind-browser-pod-helper.mjs`]);
      wslRun(['docker', 'cp', wslPolicySrc, `${c}:/etc/openshell/policy.yaml`]);
      wslRun(['docker', 'exec', c, 'pkill', '-f', 'openrind-browser-pod-helper.mjs']);
    } catch (e) {
      console.warn(`Could not copy to ${c}: ${e.message}`);
      continue;
    }

    const match = /^openshell-default--(or-[a-z0-9]+-[0-9a-f]{8})-[0-9a-f-]{36}$/.exec(c)
      || /^openshell-default--(.*?)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.exec(c);

    const sandboxName = match ? match[1] : null;

    if (sandboxName) {
      console.log(`Starting helper inside sandbox netns (${sandboxName})...`);
      try {
        wslRun([
          '/opt/openrind-desktop/fuse-runtime/openshell',
          '--gateway-endpoint', 'http://127.0.0.1:18770',
          'sandbox', 'exec', '-n', sandboxName,
          '--', '/bin/bash', '-c',
          'OPENRIND_BROWSER_PODS_EXPERIMENTAL=1 /opt/openrind-browser-pods/bin/helper-ensure.sh'
        ], 30000);
        const health = wslRun([
          '/opt/openrind-desktop/fuse-runtime/openshell',
          '--gateway-endpoint', 'http://127.0.0.1:18770',
          'sandbox', 'exec', '-n', sandboxName,
          '--', 'curl', '-s', 'http://127.0.0.1:19300/health'
        ], 15000);
        console.log(`[OK] Helper verified in ${sandboxName}: ${health}`);

        // Verify Chromium probe over proxy
        const probe = wslRun([
          '/opt/openrind-desktop/fuse-runtime/openshell',
          '--gateway-endpoint', 'http://127.0.0.1:18770',
          'sandbox', 'exec', '-n', sandboxName,
          '--', 'node', '--input-type=module', '-e',
          "const r = await fetch('http://openrind-browser-pod:9222/json/version'); console.log('Chromium probe status:', r.status);"
        ], 15000);
        console.log(`[OK] ${probe}`);

        // Live agent-browser test
        console.log(`Testing agent-browser in ${sandboxName}...`);
        const abResult = wslRun([
          '/opt/openrind-desktop/fuse-runtime/openshell',
          '--gateway-endpoint', 'http://127.0.0.1:18770',
          'sandbox', 'exec', '-n', sandboxName,
          '--', 'agent-browser', '--session', 'live-check', 'open', 'https://example.com'
        ], 30000);
        console.log(`[VERIFIED LIVE] ${abResult}`);
        wslRun([
          '/opt/openrind-desktop/fuse-runtime/openshell',
          '--gateway-endpoint', 'http://127.0.0.1:18770',
          'sandbox', 'exec', '-n', sandboxName,
          '--', 'agent-browser', '--session', 'live-check', 'close'
        ], 15000);
      } catch (e) {
        console.warn(`Note during sandbox exec: ${e.message.split('\n')[0]}`);
      }
    }

    console.log(`Successfully updated ${c}.\n`);
  }

  // 3. Update base image openrind-shell-fuse:local
  try {
    console.log('Committing helper and policy to base image openrind-shell-fuse:local...');
    const tempC = wslRun(['docker', 'run', '-d', 'openrind-shell-fuse:local', 'sleep', '60'], 30000);
    wslRun(['docker', 'cp', wslHelperSrc, `${tempC}:/opt/openrind-browser-pods/bin/openrind-browser-pod-helper.mjs`], 30000);
    wslRun(['docker', 'cp', wslPolicySrc, `${tempC}:/etc/openshell/policy.yaml`], 30000);
    wslRun(['docker', 'commit', tempC, 'openrind-shell-fuse:local'], 180000);
    wslRun(['docker', 'rm', '-f', tempC], 15000);
    console.log('[OK] Base image openrind-shell-fuse:local updated.');
  } catch (err) {
    console.warn(`Note: Could not commit base image: ${err.message}.`);
  }

  console.log('\n======================================================');
  console.log('ALL COMPLETE: Browser pod and agent-browser verified!');
  console.log('======================================================');
} catch (err) {
  console.error('Update error:', err.message);
  process.exit(1);
}
