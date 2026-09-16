import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { __testing as fuse } from "../../electron/openshell/fuse-gateway.mjs";
import { resolveHaloopClientProfileIdentity } from "../../electron/openshell/openrind-shell-credentials.mjs";
import {
  createHaloopRuntimeManager, HALOOP_IMAGE, HALOOP_COLLECTOR_IMAGE,
  HALOOP_IMAGE_CONTRACT, HALOOP_COLLECTOR_IMAGE_CONTRACT,
  HALOOP_CONTAINER_NAME as GATEWAY, HALOOP_COLLECTOR_CONTAINER_NAME as COLLECTOR,
  __testing,
} from "../../electron/openshell/haloop-runtime.mjs";

test("packaged FUSE resolves executable binaries from the imported distro", async () => {
  let command;
  const runtime = await fuse.resolveDistroRuntime(async (args) => {
    command = args.at(-1);
    return { exitCode: 0, stdout: "fixture-checksums" };
  });
  assert.equal(runtime.cli, "/opt/openrind-desktop/fuse-runtime/openshell");
  assert.match(command, /test -x .*openshell-sandbox/);
  assert.match(command, /sha256sum/);
  await assert.rejects(fuse.resolveDistroRuntime(async () => ({ exitCode: 1 })), /missing from the managed distro/);
});

function fixture() {
  const options = { sandboxName: "sandbox-review", workspaceId: "workspace-review", agentId: "claude" };
  const identity = resolveHaloopClientProfileIdentity(options);
  const current = { ...identity, clientToken: "fixture-scoped-token" };
  const captureHash = createHash("sha256").update("W8_DESKTOP_CAPTURE_ONLY=1\n").digest("hex");
  const containers = new Map([
    [GATEWAY, { running: true, hash: "incumbent", image: "sha256:gateway", original: true }],
    [COLLECTOR, { running: true, hash: "", image: "sha256:collector", original: true }],
  ]);
  let savedRoute = { ...options, profileId: identity.id, providerName: identity.providerName, gatewayProfileHash: "incumbent" };
  let committed = false;
  let failProbe = false;
  const calls = [];
  const ok = (stdout = "") => ({ exitCode: 0, stdout, stderr: "" });
  async function run(args, opts = {}) {
    const command = args.join(" ");
    calls.push(command);
    if (command.includes("docker image inspect")) {
      return args.includes(HALOOP_COLLECTOR_IMAGE)
        ? ok(`${HALOOP_COLLECTOR_IMAGE_CONTRACT}|fixture-version|sha256:collector`)
        : ok(`${HALOOP_IMAGE_CONTRACT}|fixture-version|sha256:gateway`);
    }
    if (command.includes("docker network inspect")) {
      return args.includes("openshell-docker") ? ok('[{"Gateway":"172.30.0.1"}]') : ok("true");
    }
    if (command.includes("docker container inspect")) {
      const name = args.find((arg) => containers.has(arg));
      const info = containers.get(name);
      if (!info) return { exitCode: 1, stdout: "", stderr: "No such container" };
      return ok(`${info.running}|healthy|${info.hash}|${info.image}|true|${__testing.COLLECTOR_ANALYSIS_CONTRACT}|${captureHash}`);
    }
    const index = args.indexOf("container");
    if (index >= 0 && ["rename", "stop", "start", "rm"].includes(args[index + 1])) {
      const action = args[index + 1];
      const name = action === "rename" ? args[index + 2] : args.at(-1);
      const info = containers.get(name);
      if (action === "rename") { containers.set(args[index + 3], info); containers.delete(name); }
      if (action === "stop") info.running = false;
      if (action === "start") info.running = true;
      if (action === "rm") containers.delete(name);
      return ok();
    }
    if (command.includes("docker run")) {
      const name = args[args.indexOf("--name") + 1];
      const hash = args.find((arg) => arg.startsWith("com.openrind.desktop.haloop-profile-sha256="))?.split("=")[1] || "";
      containers.set(name, { running: true, hash, image: name === GATEWAY ? "sha256:gateway" : "sha256:collector", original: false });
      return ok("fixture-id");
    }
    if (failProbe && command.includes("docker exec") && command.includes("unexpected collector response")) {
      return { exitCode: 1, stdout: "", stderr: "fixture probe failure" };
    }
    if (args.includes("cat") && args.at(-1).endsWith("ready-route.json")) return ok(JSON.stringify(savedRoute));
    if (command.includes("cat > /var/lib/openrind-desktop/haloop/ready-route.json.tmp")) savedRoute = JSON.parse(opts.stdin);
    return ok();
  }
  const manager = () => createHaloopRuntimeManager({ run, ensureDistro: async () => {}, env: {},
    registerProfile: async () => ({ current, profiles: [current], commit: async () => { committed = true; } }) });
  return { options, containers, calls, manager, fail: () => { failProbe = true; },
    committed: () => committed, stale: () => { savedRoute.gatewayProfileHash = "stale"; } };
}

test("failed replacement restores the incumbent container and does not commit the profile", async () => {
  const f = fixture();
  const manager = f.manager();
  await manager.status();
  f.fail();
  await assert.rejects(manager.ensure({ ...f.options, anthropicApiKey: "fixture-upstream" }), /cannot reach its private collector/);
  assert.equal(f.committed(), false);
  assert.equal(f.containers.get(GATEWAY).original, true);
  assert.equal(f.containers.get(GATEWAY).running, true);
  assert.equal(f.containers.get(COLLECTOR).running, true);
  assert.equal(f.containers.size, 2);
  assert.equal(manager.activeRoute().workspaceId, f.options.workspaceId);
  assert.ok(f.calls.some((command) => command.includes("mv -f /var/lib/openrind-desktop/haloop/openrind-profiles.json.")));
});

test("fresh process restores only a matching ready route without starting inference", async () => {
  const f = fixture();
  const status = await f.manager().status();
  assert.equal(status.activeRoute.sandboxName, f.options.sandboxName);
  assert.ok(!f.calls.some((command) => command.includes("docker run")));
  f.containers.get(GATEWAY).running = false;
  assert.equal((await f.manager().status()).activeRoute.sandboxName, f.options.sandboxName);
  f.stale();
  assert.equal((await f.manager().status()).activeRoute, null);
});

test("billing consent precedes exchange and keys never return to the renderer", () => {
  const main = readFileSync(new URL("../../electron/main.mjs", import.meta.url), "utf8");
  const handler = main.split('case "openrindGatewayExchangeToken": {')[1].split('case "openrindCredentialStatus"')[0];
  assert.ok(handler.indexOf("dialog.showMessageBox") < handler.indexOf("await fetch"));
  assert.match(handler, /consent.response !== 1.*canceled: true/);
  const returned = handler.match(/return\s*\{\s*success:\s*true[\s\S]*?\};/);
  assert.ok(returned);
  assert.doesNotMatch(returned[0], /apiKey:/);
});
