import test from 'node:test';
import assert from 'node:assert/strict';

import { mapToolNameToClient } from '../../../../sandboxes/openeral/haloop-agent-proxy.mjs';

test('mapToolNameToClient returns original name if name already exists in client tools', () => {
  const tools = ['browser_navigate', 'browser_click', 'bash'];
  assert.equal(mapToolNameToClient('browser_navigate', tools), 'browser_navigate');
  assert.equal(mapToolNameToClient('bash', tools), 'bash');
});

test('mapToolNameToClient adds MCP prefix when MCP tool variant is registered', () => {
  const tools = ['mcp__openrind_browser__browser_navigate', 'mcp__openrind_browser__browser_click'];
  assert.equal(mapToolNameToClient('browser_navigate', tools), 'mcp__openrind_browser__browser_navigate');
  assert.equal(mapToolNameToClient('browser_click', tools), 'mcp__openrind_browser__browser_click');
});

test('mapToolNameToClient converts PascalCase/camelCase to snake_case and matches prefix', () => {
  const tools = ['mcp__openrind_browser__browser_snapshot', 'browser_take_control'];
  assert.equal(mapToolNameToClient('BrowserSnapshot', tools), 'mcp__openrind_browser__browser_snapshot');
  assert.equal(mapToolNameToClient('browserTakeControl', tools), 'browser_take_control');
});

test('mapToolNameToClient resolves core action to registered browser tool', () => {
  const tools = ['mcp__openrind_browser__browser_fill', 'browser_screenshot'];
  assert.equal(mapToolNameToClient('fill', tools), 'mcp__openrind_browser__browser_fill');
  assert.equal(mapToolNameToClient('screenshot', tools), 'browser_screenshot');
});

test('mapToolNameToClient matches case-insensitively when tool casing differs', () => {
  const tools = ['mcp__openrind_browser__browser_close'];
  assert.equal(mapToolNameToClient('BROWSER_CLOSE', tools), 'mcp__openrind_browser__browser_close');
  assert.equal(mapToolNameToClient('Browser_Close', tools), 'mcp__openrind_browser__browser_close');
});

test('mapToolNameToClient returns unmapped name if no registered client tool matches', () => {
  const tools = ['bash', 'edit_file'];
  assert.equal(mapToolNameToClient('unknown_tool', tools), 'unknown_tool');
  assert.equal(mapToolNameToClient('', tools), '');
});
