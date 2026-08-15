#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const sql = process.argv.slice(2).join(' ');
spawnSync('/usr/local/bin/openeral-daemon-ensure', [], {
  stdio: 'ignore',
  env: {
    ...process.env,
    HOME: process.env.HOME || '/sandbox',
    OPENERAL_HOME: process.env.OPENERAL_HOME || '/sandbox',
  },
});
const result = spawnSync('/usr/local/bin/openeral-bash', ['--pg', sql], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOME: process.env.HOME || '/sandbox',
    OPENERAL_HOME: process.env.OPENERAL_HOME || '/sandbox',
  },
});

process.exit(result.status ?? 1);
