import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../electron/openshell/fuse-gateway.mjs", import.meta.url),
  "utf8",
);

test("desktop owns a distinct README-compatible FUSE gateway", () => {
  assert.match(source, /MANAGED_FUSE_GATEWAY_ENDPOINT = "http:\/\/127\.0\.0\.1:18770"/);
  assert.match(source, /SERVICE_NAME = "openrind-desktop-fuse-gateway\.service"/);
  assert.match(source, /RUNTIME_DIR = "\/opt\/openrind-desktop\/fuse-runtime"/);
  assert.match(source, /systemctl enable/);
  assert.match(source, /systemctl restart/);
  assert.match(source, /enable_fuse = true/);
  assert.match(source, /grpc_endpoint = "http:\/\/host\.openshell\.internal:18770"/);
  assert.match(source, /supervisor_bin =/);
  assert.match(source, /openshell-gateway --config/);
  assert.doesNotMatch(source, /OPENRIND_DESKTOP_FUSE_GATEWAY_ENDPOINT/);
});

test("primary and interactive FUSE paths start the managed gateway first", () => {
  for (const file of ["fuse-sandbox.mjs", "fuse-management.mjs", "openrind-shell-pty.mjs", "openrind-shell-terminal.mjs"]) {
    const moduleSource = readFileSync(new URL(`../../electron/openshell/${file}`, import.meta.url), "utf8");
    assert.match(moduleSource, /ensureManagedFuseGateway/);
  }
});
