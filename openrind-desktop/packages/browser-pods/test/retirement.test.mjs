import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../../../../', import.meta.url);

test('Claude still starts with stale managed browser credentials and flushes FUSE', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'browser-retirement-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const wrapper = await readFile(new URL('sandboxes/openeral/openeral-claude-fuse.sh', root), 'utf8');
  const claude = join(dir, 'claude-real');
  await writeFile(claude, '#!/bin/sh\n[ -z "${OPENRIND_BROWSER_GRANT:-}" ] || exit 90\n[ -z "${OPENRIND_BROWSER_SERVICE_TOKEN:-}" ] || exit 91\nprintf "%s\\n" "$@" > "$TEST_ARGS"\nexit 7\n', { mode: 0o700 });
  await writeFile(join(dir, 'openrind-shell-fused'), '#!/bin/sh\ncase "$1" in health) echo \'{"state":"writable"}\';; flush-all) echo flush >> "$TEST_FLUSH";; *) exit 98;; esac\n', { mode: 0o700 });
  await writeFile(join(dir, 'wrapper'), wrapper.replaceAll('/usr/local/bin/claude-real', claude));
  const args = join(dir, 'args'); const flush = join(dir, 'flush');
  const result = spawnSync('/bin/sh', [join(dir, 'wrapper'), '--mcp-config', '/user/settings.json'], {
    cwd: dir, encoding: 'utf8', timeout: 10_000, env: { ...process.env, PATH: `${dir}:${process.env.PATH}`,
      OPENRIND_SHELL_RUNTIME_DIR: dir, OPENRIND_SHELL_CLAUDE_HOME: dir, OPENRIND_DESKTOP_CLAUDE_LAUNCH: '1',
      OPENRIND_BROWSER_GRANT: 'stale', OPENRIND_BROWSER_SERVICE_TOKEN: 'stale', TEST_ARGS: args, TEST_FLUSH: flush },
  });
  assert.equal(result.status, 7, result.stderr);
  assert.equal(await readFile(args, 'utf8'), '--mcp-config\n/user/settings.json\n');
  assert.equal(await readFile(flush, 'utf8'), 'flush\n');
});

test('primary images agree on client packaging without another FUSE contract bump', async () => {
  const paths = ['Dockerfile.openrind-shell', 'Dockerfile.openeral', 'sandboxes/openeral/Dockerfile'];
  const content = [];
  for (const path of paths) content.push(await readFile(new URL(path, root), 'utf8'));
  assert.equal(content[0], content[1]); assert.equal(content[0], content[2]);
  assert.match(content[0], /fuse-haloop-required-v29-browser-client/);
  assert.match(content[0], /install-agent-browser\.mjs/);
  const skill = await readFile(new URL('.claude/skills/openrind-browser/SKILL.md', root), 'utf8');
  assert.match(skill, /name: openrind-browser/);
});
