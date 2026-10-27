// App-owned lifecycle for the README's paired, local FUSE control plane.
//
// The primary runtime requires the vendored CLI, gateway, and supervisor to
// agree on the default-off --fuse contract. The stock OpenShell service remains
// independent: this module installs a separately named local systemd service
// that uses only the desktop's bundled patched binaries.

import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { shellQuote } from "./fuse-runtime.mjs";
import { DISTRO_NAME, ensureDistroRunning, toWslPath, wslRun } from "./wsl.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const MANAGED_FUSE_GATEWAY_ENDPOINT = "http://127.0.0.1:18770";

const RUNTIME_NAMES = ["openshell", "openshell-gateway", "openshell-sandbox"];
const RUNTIME_DIR = "/opt/openrind-desktop/fuse-runtime";
const STATE_DIR = "/home/banker/.local/state/openrind-desktop/fuse-gateway";
const SERVICE_NAME = "openrind-desktop-fuse-gateway.service";
const SERVICE_PATH = `/etc/systemd/system/${SERVICE_NAME}`;

let startupPromise = null;

function hasRuntime(dir) {
  return RUNTIME_NAMES.every((name) => existsSync(join(dir, name)));
}

function runtimeCandidates(env = process.env) {
  const candidates = [];
  const override = env.OPENRIND_DESKTOP_FUSE_RUNTIME_DIR?.trim();
  if (override) candidates.push(override);
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, "openshell", "fuse-runtime"));
  }
  // Development source tree: electron/openshell -> desktop -> apps ->
  // openrind-desktop -> repository root.
  candidates.push(resolve(__dirname, "../../../../../vendor/openshell/target/debug"));
  candidates.push(resolve(__dirname, "../../../../../vendor/openshell/target/release"));
  return [...new Set(candidates)];
}

export function resolveManagedFuseRuntime(env = process.env) {
  const dir = runtimeCandidates(env).find(hasRuntime);
  if (!dir) {
    throw new Error(
      "The bundled OpenShell FUSE runtime is missing. Reinstall Openrind Desktop, or in development build the vendored openshell, openshell-gateway, and openshell-sandbox binaries.",
    );
  }
  return {
    dir,
    cli: join(dir, "openshell"),
    gateway: join(dir, "openshell-gateway"),
    supervisor: join(dir, "openshell-sandbox"),
  };
}

function runtimeId(runtime) {
  if (runtime.sourceId) return runtime.sourceId;
  return RUNTIME_NAMES.map((name) => {
    const stat = statSync(join(runtime.dir, name));
    return `${name}:${stat.size}:${Math.trunc(stat.mtimeMs)}`;
  }).join("|");
}

function findHostFuseRuntimeArchive() {
  const candidates = [];
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, "openshell", "fuse-runtime.tar.gz"));
  }
  candidates.push(resolve(__dirname, "../../resources/openshell/fuse-runtime.tar.gz"));
  return candidates.find((p) => existsSync(p)) ?? null;
}

function findHostFuseRuntimeDir() {
  const candidates = [];
  const override = process.env.OPENRIND_DESKTOP_FUSE_RUNTIME_DIR?.trim();
  if (override) candidates.push(override);
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, "openshell", "fuse-runtime"));
  }
  candidates.push(resolve(__dirname, "../../resources/openshell/fuse-runtime"));
  candidates.push(resolve(__dirname, "../../../../../vendor/openshell/target/debug"));
  candidates.push(resolve(__dirname, "../../../../../vendor/openshell/target/release"));
  return (
    candidates.find((dir) => existsSync(dir) && RUNTIME_NAMES.every((name) => existsSync(join(dir, name)))) ?? null
  );
}

// Packaged Windows builds carry the patched binaries inside the imported rootfs or bundled archive.
async function resolveDistroRuntime(run = wslRun) {
  const hostArchive = findHostFuseRuntimeArchive();
  const hostDir = findHostFuseRuntimeDir();

  if (hostArchive) {
    const wslArchive = toWslPath(hostArchive);
    await run(
      [
        "-d",
        DISTRO_NAME,
        "--user",
        "root",
        "--",
        "sh",
        "-c",
        `if [ ! -x ${shellQuote(`${RUNTIME_DIR}/openshell-gateway`)} ] || [ ! -f ${shellQuote(`${RUNTIME_DIR}/source-id`)} ] || (${shellQuote(`${RUNTIME_DIR}/openshell-gateway`)} --version 2>&1 | grep -q '0\\.0\\.45'); then ` +
          `mkdir -p /opt/openrind-desktop && ` +
          `tar -xzf ${shellQuote(wslArchive)} -C /opt/openrind-desktop/ 2>/dev/null && ` +
          `chmod 0755 ${shellQuote(RUNTIME_DIR)}/* 2>/dev/null || true; ` +
          `printf 'bundled-fuse-v1' > ${shellQuote(`${RUNTIME_DIR}/source-id`)} && ` +
          `ln -sf ${shellQuote(`${RUNTIME_DIR}/openshell`)} /usr/local/bin/openshell 2>/dev/null || true; ` +
        `fi`,
      ],
      { timeout: 30_000 },
    ).catch(() => {});
  } else if (hostDir) {
    const wslDir = toWslPath(hostDir);
    await run(
      [
        "-d",
        DISTRO_NAME,
        "--user",
        "root",
        "--",
        "sh",
        "-c",
        `if [ ! -x ${shellQuote(`${RUNTIME_DIR}/openshell-gateway`)} ] || [ ! -f ${shellQuote(`${RUNTIME_DIR}/source-id`)} ] || (${shellQuote(`${RUNTIME_DIR}/openshell-gateway`)} --version 2>&1 | grep -q '0\\.0\\.45'); then ` +
          `mkdir -p ${shellQuote(RUNTIME_DIR)} && ` +
          `cp -p ${shellQuote(wslDir)}/* ${shellQuote(RUNTIME_DIR)}/ 2>/dev/null && ` +
          `chmod 0755 ${shellQuote(RUNTIME_DIR)}/* 2>/dev/null || true; ` +
          `printf 'bundled-fuse-v1' > ${shellQuote(`${RUNTIME_DIR}/source-id`)} && ` +
          `ln -sf ${shellQuote(`${RUNTIME_DIR}/openshell`)} /usr/local/bin/openshell 2>/dev/null || true; ` +
        `fi`,
      ],
      { timeout: 30_000 },
    ).catch(() => {});
  }

  const result = await run(
    ["-d", DISTRO_NAME, "--", "sh", "-c", RUNTIME_NAMES.map((name) =>
      `test -x ${shellQuote(`${RUNTIME_DIR}/${name}`)}`).join(" && ") +
      ` && sha256sum ${RUNTIME_NAMES.map((name) => shellQuote(`${RUNTIME_DIR}/${name}`)).join(" ")}`],
    { timeout: 15_000 },
  );
  if (result.exitCode !== 0) throw new Error("The bundled OpenShell FUSE runtime is missing from the managed distro. Reinstall Openrind Desktop.");
  return { dir: RUNTIME_DIR, cli: `${RUNTIME_DIR}/openshell`, gateway: `${RUNTIME_DIR}/openshell-gateway`, supervisor: `${RUNTIME_DIR}/openshell-sandbox`, sourceId: result.stdout.trim() };
}

function resolvedEndpoint() {
  // OPENSHELL_GATEWAY_ENDPOINT is deliberately not consulted here. That
  // variable is written below for every FUSE invocation; accepting a stale
  // inherited value could silently route the primary runtime to stock
  // OpenShell, which does not implement --fuse. The app-owned service also
  // binds this exact endpoint, so accepting a second override would make the
  // CLI and service disagree.
  return MANAGED_FUSE_GATEWAY_ENDPOINT;
}

function activateRuntime(runtime, endpoint) {
  process.env.OPENSHELL_BIN = "/opt/openrind-desktop/fuse-runtime/openshell";
  process.env.OPENSHELL_GATEWAY_ENDPOINT = endpoint;
}

function gatewayToml(runtime) {
  return `[openshell]
version = 1

[openshell.gateway]
bind_address = "127.0.0.1:18770"
log_level = "info"
compute_drivers = ["docker"]
disable_tls = true

[openshell.gateway.auth]
allow_unauthenticated_users = true

[openshell.gateway.gateway_jwt]
signing_key_path = "${STATE_DIR}/jwt/signing.pem"
public_key_path = "${STATE_DIR}/jwt/public.pem"
kid_path = "${STATE_DIR}/jwt/kid"
gateway_id = "openrind-desktop-fuse"
ttl_secs = 0

[openshell.drivers.docker]
default_image = "openrind-shell-fuse:local"
image_pull_policy = "Never"
sandbox_namespace = "openrind-desktop-fuse"
grpc_endpoint = "http://host.openshell.internal:18770"
supervisor_bin = "/opt/openrind-desktop/fuse-runtime/openshell-sandbox"
enable_fuse = true
`;
}

function systemdUnit() {
  return `[Unit]
Description=Openrind Desktop paired OpenShell FUSE gateway
After=network.target

[Service]
Type=simple
User=root
Group=root
Environment=HOME=/home/banker
ExecStart=${RUNTIME_DIR}/openshell-gateway --config ${STATE_DIR}/gateway.toml --db-url sqlite:${STATE_DIR}/gateway.db?mode=rwc
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`;
}

async function gatewayInfo(runtime, endpoint) {
  const command = [
    shellQuote(toWslPath(runtime.cli)),
    "--gateway-endpoint",
    shellQuote(endpoint),
    "status",
  ].join(" ");
  const result = await wslRun(
    ["-d", DISTRO_NAME, "--", "bash", "-lc", `timeout 8 ${command}`],
    { timeout: 12_000 },
  ).catch((error) => ({
    exitCode: -1,
    stdout: "",
    stderr: error instanceof Error ? error.message : String(error),
  }));

  const clean = `${result.stdout}\n${result.stderr}`.replace(
    /\x1b\[[0-9;]*[a-zA-Z]/g,
    "",
  );
  if (
    result.exitCode === 0 &&
    (/Status:\s*(?:Connected|Ready|ok)/i.test(clean) ||
      /Connected|Ready/i.test(clean))
  ) {
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  }
  return {
    exitCode: -1,
    stdout: result.stdout,
    stderr: result.stderr || clean.trim() || "Gateway on 18770 is not connected",
  };
}

async function provisionManagedGateway(runtime) {
  const sourceId = runtimeId(runtime);
  const source = Object.fromEntries(
    RUNTIME_NAMES.map((name) => [name, toWslPath(join(runtime.dir, name))]),
  );
  const configPath = `${STATE_DIR}/gateway.toml`;
  const script = [
    "set -euo pipefail",
    "umask 077",
    "if ! dpkg -s libz3-4 >/dev/null 2>&1; then",
    "  (apt-get update && apt-get install -y libz3-4) || true",
    "fi",
    `install -d -m 0755 -o root -g root ${shellQuote(RUNTIME_DIR)}`,
    `install -d -m 0700 -o banker -g banker ${shellQuote(STATE_DIR)} ${shellQuote(`${STATE_DIR}/jwt`)}`,
    "changed=0",
    `if [ -f ${shellQuote(source.openshell)} ] && [ ${shellQuote(source.openshell)} != ${shellQuote(`${RUNTIME_DIR}/openshell`)} ]; then`,
    `  if [ ! -f ${shellQuote(`${RUNTIME_DIR}/source-id`)} ] || ! grep -Fqx ${shellQuote(sourceId)} ${shellQuote(`${RUNTIME_DIR}/source-id`)}; then`,
    `    install -m 0755 -o root -g root ${shellQuote(source.openshell)} ${shellQuote(`${RUNTIME_DIR}/openshell`)}`,
    `    install -m 0755 -o root -g root ${shellQuote(source["openshell-gateway"])} ${shellQuote(`${RUNTIME_DIR}/openshell-gateway`)}`,
    `    install -m 0755 -o root -g root ${shellQuote(source["openshell-sandbox"])} ${shellQuote(`${RUNTIME_DIR}/openshell-sandbox`)}`,
    `    printf '%s' ${shellQuote(sourceId)} > ${shellQuote(`${RUNTIME_DIR}/source-id`)}`,
    `    changed=1`,
    `  fi`,
    `fi`,
    `if [ ! -s ${shellQuote(`${STATE_DIR}/jwt/signing.pem`)} ]; then`,
    `  openssl genpkey -algorithm ED25519 -out ${shellQuote(`${STATE_DIR}/jwt/signing.pem`)}`,
    `  openssl pkey -in ${shellQuote(`${STATE_DIR}/jwt/signing.pem`)} -pubout -out ${shellQuote(`${STATE_DIR}/jwt/public.pem`)}`,
    `  printf '%s\\n' 'openrind-desktop-fuse' > ${shellQuote(`${STATE_DIR}/jwt/kid`)}`,
    "fi",
    `printf '%s' ${shellQuote(gatewayToml(runtime))} > ${shellQuote(configPath)}`,
    `printf '%s' ${shellQuote(systemdUnit())} > ${shellQuote(SERVICE_PATH)}`,
    `chown -R banker:banker /home/banker/.local ${shellQuote(STATE_DIR)}`,
    `chmod 777 /home/banker/.local /home/banker/.local/state ${shellQuote(STATE_DIR)}`,
    `chmod 666 ${shellQuote(`${STATE_DIR}/gateway.db`)}* 2>/dev/null || true`,
    `chmod 600 ${shellQuote(configPath)} ${shellQuote(`${STATE_DIR}/jwt/signing.pem`)}`,
    `:> ${shellQuote(`${STATE_DIR}/gateway.log`)}`,
    "service docker start 2>/dev/null || systemctl start docker 2>/dev/null || true",
    "chmod 666 /var/run/docker.sock 2>/dev/null || true",
    "systemctl daemon-reload 2>/dev/null || true",
    `systemctl enable ${shellQuote(SERVICE_NAME)} 2>/dev/null || true`,
    `if [ "$changed" -eq 1 ]; then systemctl restart ${shellQuote(SERVICE_NAME)} 2>/dev/null || true; else systemctl start ${shellQuote(SERVICE_NAME)} 2>/dev/null || true; fi`,
    `if ! (exec 3<>/dev/tcp/127.0.0.1/18770) 2>/dev/null; then`,
    `  su - banker -c 'nohup ${RUNTIME_DIR}/openshell-gateway --config ${STATE_DIR}/gateway.toml --db-url sqlite:${STATE_DIR}/gateway.db?mode=rwc >${STATE_DIR}/gateway.log 2>&1 &'`,
    `  disown -a 2>/dev/null || true`,
    `fi`,
    "sleep 1",
    `if [ -f ${shellQuote(`${STATE_DIR}/haloop-anthropic.yaml`)} ]; then`,
    `  ${RUNTIME_DIR}/openshell --gateway-endpoint http://127.0.0.1:18770 provider profile import --file ${shellQuote(`${STATE_DIR}/haloop-anthropic.yaml`)} 2>/dev/null || true`,
    `fi`,
    "sleep 1",
  ].join("\n");

  const result = await wslRun(
    ["-d", DISTRO_NAME, "--user", "root", "--", "bash", "-lc", script],
    { timeout: 60_000 },
  );
  if (result.exitCode === 0) return;

  const detail = (result.stderr || result.stdout || "no output").trim();
  throw new Error(`Could not start the managed OpenShell FUSE gateway: ${detail}`);
}

async function waitForGateway(runtime, endpoint) {
  let lastDetail = "gateway did not respond";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await gatewayInfo(runtime, endpoint);
    if (result.exitCode === 0) return;
    lastDetail = (result.stderr || result.stdout || `exit ${result.exitCode}`).trim();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  const journal = await wslRun(
    ["-d", DISTRO_NAME, "--user", "root", "--", "sh", "-c", `tail -n 30 ${STATE_DIR}/gateway.log 2>/dev/null || journalctl -u ${SERVICE_NAME} -n 20 --no-pager 2>/dev/null || true`],
    { timeout: 10_000 },
  ).catch(() => ({ stdout: "" }));
  const logTail = journal.stdout ? `\nGateway logs:\n${journal.stdout.trim()}` : "";
  throw new Error(
    `The managed OpenShell FUSE gateway at ${endpoint} did not become healthy: ${lastDetail}${logTail}`,
  );
}

/**
 * Start or reuse the app-owned paired FUSE gateway. The generated service is
 * separate from the stock `openshell-gateway.service`, so the compatibility
 * runtime remains untouched.
 */
/** @param {{ onProgress?: (progress: {phase: string, message: string}) => void, force?: boolean }} options */
export async function ensureManagedFuseGateway({ onProgress, force = false } = {}) {
  if (force) {
    startupPromise = null;
  }
  if (!startupPromise) {
    startupPromise = (async () => {
      await ensureDistroRunning();
      let runtime;
      try {
        runtime = resolveManagedFuseRuntime();
      } catch (error) {
        if (process.env.OPENRIND_DESKTOP_FUSE_RUNTIME_DIR) throw error;
        runtime = await resolveDistroRuntime();
      }
      const endpoint = resolvedEndpoint();
      activateRuntime(runtime, endpoint);

      let upToDate = false;
      if (!force) {
        const existing = await gatewayInfo(runtime, endpoint);
        if (existing.exitCode === 0) {
          const sourceId = runtimeId(runtime);
          const checkInstall = await wslRun(
            ["-d", DISTRO_NAME, "--", "sh", "-c", `cat ${RUNTIME_DIR}/source-id 2>/dev/null || true`],
            { timeout: 5000 },
          ).catch(() => null);
          if (checkInstall && checkInstall.exitCode === 0 && checkInstall.stdout.trim() === sourceId) {
            upToDate = true;
          }
        }
      }

      if (upToDate) return { endpoint, reused: true };

      onProgress?.({
        phase: "gateway",
        message: "Starting the local OpenShell FUSE gateway...",
      });
      await provisionManagedGateway(runtime);
      await waitForGateway(runtime, endpoint);
      return { endpoint, reused: false };
    })().finally(() => {
      startupPromise = null;
    });
  }
  return startupPromise;
}

export const __testing = {
  resolveDistroRuntime,
  gatewayToml,
  resolvedEndpoint,
  systemdUnit,
};

