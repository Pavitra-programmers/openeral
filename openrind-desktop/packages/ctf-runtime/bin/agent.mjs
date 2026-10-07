#!/usr/bin/env node
import { runCtfAgent } from '../src/agent.mjs';

if (process.argv.length !== 3) throw new Error('CONFIG_PATH_REQUIRED');
await runCtfAgent(process.argv[2]);
