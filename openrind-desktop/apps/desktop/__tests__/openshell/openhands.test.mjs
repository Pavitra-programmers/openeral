import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { imageForProfile, resolveAgentSessionValue } from '../../electron/openshell/openrind-shell.mjs';
import { resolveHaloopClientProfileIdentity } from '../../electron/openshell/openrind-shell-credentials.mjs';
import { buildHaloopAgentLifecycleEvent } from '../../electron/openshell/haloop-runtime.mjs';

const assertion = `v1.${'a'.repeat(32)}.1700000000000.1700000001000.${'b'.repeat(64)}`;
const source = (file) => readFile(new URL(`../../../../../${file}`, import.meta.url), 'utf8');

for (const profile of ['openrind-shell-openhands', 'openrind-shell-openhands-script']) {
  test(`${profile} uses the FUSE image and a signed launch marker`, () => {
    assert.ok(imageForProfile(profile));
    assert.equal(resolveAgentSessionValue(profile, null, assertion), `${profile}:auto:${assertion}`);
    assert.throws(() => resolveAgentSessionValue(profile, null, ''), /signed Haloop/);
  });
}

test('OpenHands owns a distinct Haloop identity and lifecycle', () => {
  const options = {sandboxName: 'or-openhands-test', workspaceId: 'workspace', agentId: 'openhands'};
  const hands = resolveHaloopClientProfileIdentity(options);
  const claude = resolveHaloopClientProfileIdentity({...options, agentId: 'claude'});
  assert.equal(hands.agentId, 'openhands');
  assert.notEqual(hands.id, claude.id);
  const event = buildHaloopAgentLifecycleEvent('openhands', {id: 'pty-hands', exitCode: 0});
  assert.equal(event.name, 'openhands.session');
  assert.equal(event.ok, true);
});

test('image owns the isolated interpreter and only the fixed native launcher is authorized', async () => {
  const [docker, provider, launcher, setup, runtime] = await Promise.all([
    source('Dockerfile.openrind-shell'), source('vendor/openshell/providers/haloop-anthropic.yaml'),
    source('sandboxes/openeral/openhands-agent-launcher.c'), source('sandboxes/openeral/setup-fuse.sh'),
    source('openrind-desktop/apps/desktop/electron/openshell/fuse-sandbox.mjs'),
  ]);
  assert.match(docker, /openhands==1\.16\.0/);
  assert.match(docker, /venv --copies \/opt\/openrind-openhands/);
  assert.match(provider, /\/usr\/local\/bin\/openrind-openhands-agent/);
  assert.doesNotMatch(provider, /(?<!\/opt\/openrind-openhands)\/bin\/python/);
  assert.match(launcher, /"-I"/);
  assert.match(launcher, /\/opt\/openrind-openhands\/openhands-agent.py/);
  assert.match(setup, /export OPENRIND_SHELL_OPENHANDS_MODE=/);
  assert.match(runtime, /openrind-openhands-home-/);
  assert.match(runtime, /OPENRIND_SHELL_OPENHANDS_MODE:-cli/);
});
