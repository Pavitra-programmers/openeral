#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';

const DISTRO_NAME = 'openrind-desktop-openshell';
const FUSE_IMAGE = 'openrind-shell-fuse:local';

function toWslPath(windowsPath) {
  const resolved = path.resolve(windowsPath);
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(resolved);
  if (!match) return resolved;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll('\\', '/')}`;
}

const repoRoot = path.resolve('.');
const wslRepoRoot = toWslPath(repoRoot);
const dockerfile = `${wslRepoRoot}/Dockerfile.openrind-shell`;

const args = [
  '-d', DISTRO_NAME,
  '--',
  'docker', 'build',
  '--pull=false',
  '-f', dockerfile,
  '-t', FUSE_IMAGE,
  wslRepoRoot
];

console.log(`[build] Rebuilding sandbox image (${FUSE_IMAGE}) in WSL (${DISTRO_NAME})...`);

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
    console.log(`[build] Successfully built ${FUSE_IMAGE}`);
  } else {
    console.error(`[build] Failed with exit code ${code}`);
  }
  process.exit(code ?? 1);
});
