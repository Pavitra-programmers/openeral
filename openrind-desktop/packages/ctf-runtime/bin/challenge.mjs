#!/usr/bin/env node
import { mkdir, open } from 'node:fs/promises';
import { createChallengeServer } from '../src/challenge-server.mjs';
import { createTask } from '../src/tasks.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index]; const value = process.argv[index + 1];
  if (!name?.startsWith('--') || !value || args.has(name)) throw new Error('INVALID_ARGUMENTS');
  args.set(name, value);
}
const task = createTask(args.get('--task'));
const token = args.get('--judge-token');
const port = Number(args.get('--port') ?? '19401');
const eventsPath = args.get('--events') ?? '/sandbox/events.jsonl';
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[A-Za-z0-9_-]{43}$/.test(token ?? '')) throw new Error('INVALID_ARGUMENTS');
await mkdir('/sandbox', { recursive: true });
const events = await open(eventsPath, 'a', 0o600);
const record = async value => { await events.write(`${JSON.stringify(value)}\n`); await events.sync(); };
const server = createChallengeServer({ task, judgeToken: token, record });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
await record({ kind: 'challenge_ready', at: new Date().toISOString(), task: task.id, port });
const close = async () => { server.close(); await events.close(); };
process.once('SIGTERM', () => { close().finally(() => process.exit(0)); });
process.once('SIGINT', () => { close().finally(() => process.exit(0)); });
