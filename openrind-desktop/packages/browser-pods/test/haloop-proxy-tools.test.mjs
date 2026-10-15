import test from 'node:test';
import assert from 'node:assert/strict';

// Tool name mapping algorithm from sandboxes/openeral/haloop-agent-proxy.mjs
function mapToolNameToClient(name, clientToolNames = []) {
  if (!name) return name;
  if (clientToolNames.includes(name)) return name;

  // 1. Try prefixing with mcp__openrind_browser__
  const mcpPrefixed = `mcp__openrind_browser__${name}`;
  if (clientToolNames.includes(mcpPrefixed)) return mcpPrefixed;

  // 2. Convert PascalCase / camelCase to snake_case and check with prefix
  const snake = name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  const mcpSnake = `mcp__openrind_browser__${snake}`;
  if (clientToolNames.includes(mcpSnake)) return mcpSnake;
  if (clientToolNames.includes(snake)) return snake;

  // 3. Extract core action (e.g. "start" from "browser_start" or "BrowserStart")
  const core = snake.replace(/^(?:mcp__)?(?:openrind_)?(?:browser_)?/, '');
  const corePrefixed = `mcp__openrind_browser__browser_${core}`;
  if (clientToolNames.includes(corePrefixed)) return corePrefixed;
  const coreBrowser = `browser_${core}`;
  if (clientToolNames.includes(coreBrowser)) return coreBrowser;

  // 4. Try matching case-insensitively
  const match = clientToolNames.find(t =>
    t.toLowerCase() === name.toLowerCase() ||
    t.toLowerCase() === mcpPrefixed.toLowerCase() ||
    t.toLowerCase() === mcpSnake.toLowerCase() ||
    t.toLowerCase() === corePrefixed.toLowerCase() ||
    t.toLowerCase() === coreBrowser.toLowerCase()
  );
  if (match) return match;

  return name;
}

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
