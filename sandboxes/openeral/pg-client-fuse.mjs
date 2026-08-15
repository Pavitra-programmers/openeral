#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const sql = process.argv.slice(2).join(' ');
if (!sql.trim()) {
  process.stderr.write('Usage: pg <SQL query>\n');
  process.exit(1);
}

try {
  if (!process.env.DATABASE_URL) {
    const runtimeDir = process.env.OPENERAL_RUNTIME_DIR || '/var/lib/openeral/runtime';
    process.env.DATABASE_URL = readFileSync(`${runtimeDir}/database-url`, 'utf8').trim();
  }
  process.env.OPENERAL_REQUIRE_POSTGRES_TLS = '1';
  const { getDatabaseConnection } = await import('/opt/openeral/dist/db/embedded.js');
  const { pool, isEmbedded } = await getDatabaseConnection();
  if (isEmbedded) throw new Error('the FUSE runtime does not support PGlite');
  try {
    const result = await pool.query(sql);
    process.stdout.write(`${JSON.stringify(result.rows, null, 2)}\n`);
  } finally {
    await pool.end();
  }
} catch (error) {
  process.stderr.write(`pg error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
