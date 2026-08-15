#!/usr/bin/env node

import { main } from '../cli.js';

void main().catch((err: unknown) => {
  const error = err instanceof Error ? err : new Error(String(err));
  process.stderr.write(`\x1b[31mopenrind-shell: ${error.message}\x1b[0m\n`);
  process.exit(1);
});
