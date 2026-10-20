#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DISTRO_NAME = 'openrind-desktop-openshell';
const CHROMIUM_VERSION = '154.0.8037.92-1~deb12u1';

function toWslPath(windowsPath) {
  const resolved = path.resolve(windowsPath);
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(resolved);
  if (!match) return resolved;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll('\\', '/')}`;
}

const repoRoot = path.resolve('.');
const wslRepoRoot = toWslPath(repoRoot);
const dockerfile = `${wslRepoRoot}/sandboxes/browser-pod/Dockerfile`;
const contextDir = `${wslRepoRoot}/sandboxes/browser-pod`;

const args = [
  '-d', DISTRO_NAME,
  '--',
  'docker', 'build',
  '--no-cache',
  '-f', dockerfile,
  '--build-arg', `CHROMIUM_VERSION=${CHROMIUM_VERSION}`,
  '-t', 'openrind-browser-pod:e2e',
  '-t', 'openrind-browser-pod:latest',
  contextDir
];

console.log(`[build] Rebuilding browser pod image in WSL (${DISTRO_NAME})...`);
console.log(`[build] Context: ${contextDir}`);

const child = spawn('wsl.exe', args, {
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (err) => {
  console.error('[build] Failed to spawn wsl.exe:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('[build] Successfully built openrind-browser-pod:e2e and openrind-browser-pod:latest');
  } else {
    console.error(`[build] Failed with exit code ${code}`);
  }
  process.exit(code ?? 1);
});
