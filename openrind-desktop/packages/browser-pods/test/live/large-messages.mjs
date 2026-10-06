// Run inside the owner via native exec stdin. Keep large test data off argv and
// host exec output; agent-browser and the real proxy still carry every byte.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const [session, direction] = process.argv.slice(2);
const bytes = 17 * 1024 * 1024;
try {
  assert.ok(['request', 'response'].includes(direction));
  const expression = direction === 'response' ? `'x'.repeat(${bytes})` : `${JSON.stringify('y'.repeat(bytes))}.length`;
  const task = promisify(execFile)('agent-browser', ['--session', session, '--json', 'eval', '--stdin'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024,
  });
  task.child.stdin.on('error', () => {}); task.child.stdin.end(expression);
  const { stdout } = await task;
  const result = JSON.parse(stdout);
  assert.equal(result.success, true);
  if (direction === 'request') assert.equal(result.data.result, bytes);
  else {
    assert.equal(typeof result.data.result, 'string');
    assert.equal(result.data.result.length, bytes);
    assert.equal(/[^x]/.test(result.data.result), false);
  }
  console.log(JSON.stringify({ direction, bytes, result: 'passed' }));
} catch (error) {
  console.error(`Large ${direction} failed: ${String(error.message).slice(0, 600)}`);
  process.exitCode = 1;
}
