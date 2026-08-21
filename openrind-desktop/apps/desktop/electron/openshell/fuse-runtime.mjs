// Shared command construction for the primary Openrind Shell FUSE runtime.
//
// The README deliberately requires a vendored OpenShell CLI and its paired
// gateway. Do not fall back to `openshell` on PATH: that can silently select a
// stock CLI which neither understands `--fuse` nor enforces the primary
// runtime's mount lifecycle.

import process from "node:process";

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

/**
 * Resolve the exact control-plane variables documented for the primary FUSE
 * runtime. Both values must be available to the WSL process, not merely to
 * Electron on Windows, so callers must use buildFuseWslEnv when spawning it.
 */
export function resolveFuseRuntimeConfig(env = process.env) {
  const bin = env.OPENSHELL_BIN?.trim();
  const gatewayEndpoint = env.OPENSHELL_GATEWAY_ENDPOINT?.trim();
  if (!bin) {
    throw new Error(
      "OPENSHELL_BIN is required for the FUSE runtime. Set it to the vendored patched OpenShell CLI (for example, /path/to/vendor/openshell/target/debug/openshell).",
    );
  }
  if (!gatewayEndpoint) {
    throw new Error(
      "OPENSHELL_GATEWAY_ENDPOINT is required for the FUSE runtime. Set it to the patched Docker gateway endpoint (for example, http://127.0.0.1:18770).",
    );
  }
  return { bin, gatewayEndpoint };
}

/**
 * Preserve the caller's WSLENV entries while forwarding the two primary FUSE
 * control-plane variables into the Linux process. Values are never embedded
 * in a command string.
 */
export function buildFuseWslEnv(extra = {}, env = process.env) {
  const { bin, gatewayEndpoint } = resolveFuseRuntimeConfig(env);
  const existing = String(env.WSLENV ?? "")
    .split(":")
    .filter(Boolean);
  const names = new Set([
    ...existing,
    "OPENSHELL_BIN",
    "OPENSHELL_GATEWAY_ENDPOINT",
    ...Object.keys(extra),
  ]);
  return {
    ...env,
    ...extra,
    OPENSHELL_BIN: bin,
    OPENSHELL_GATEWAY_ENDPOINT: gatewayEndpoint,
    WSLENV: [...names].join(":"),
  };
}

/**
 * Produce a shell-safe patched OpenShell CLI invocation. The caller is
 * responsible for adding `exec` only when it owns the complete shell process.
 */
export function buildFuseCliCommand(args, env = process.env) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("buildFuseCliCommand requires a string argument array");
  }
  const { bin, gatewayEndpoint } = resolveFuseRuntimeConfig(env);
  return [
    shellQuote(bin),
    "--gateway-endpoint",
    shellQuote(gatewayEndpoint),
    ...args.map(shellQuote),
  ].join(" ");
}

export const __testing = {
  buildFuseCliCommand,
  buildFuseWslEnv,
  resolveFuseRuntimeConfig,
};
