// Build the source-checkout FUSE image in the dedicated OpenShell
// WSL Docker daemon. Building it in Docker Desktop's host daemon is not
// sufficient because the managed gateway and sandboxes use this isolated
// engine.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DISTRO_NAME = "openrind-desktop-openshell";
const FUSE_IMAGE = "openrind-shell-fuse:local";
const FUSE_CONTRACT = "fuse-haloop-required-v29-browser-client";
const OPENSHELL_BASE_IMAGE = "ghcr.io/nvidia/openshell-community/sandboxes/base:latest";
const CLAUDE_CODE_PACKAGE = "@anthropic-ai/claude-code";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(desktopRoot, "../../..");

function fail(message) {
  throw new Error(`[runtime-images] ${message}`);
}

function toWslPath(value) {
  const absolute = path.resolve(value);
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(absolute);
  if (!match) fail(`Expected an absolute Windows path, received ${JSON.stringify(absolute)}.`);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function runWsl(args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("wsl.exe", ["-d", DISTRO_NAME, "--", ...args], {
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    const stdout = [];
    const stderr = [];
    if (capture) {
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
    }
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

async function requireSuccess(args, label, options) {
  const result = await runWsl(args, options);
  if (result.exitCode !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    fail(`${label} failed${detail ? `: ${detail}` : ` with exit ${result.exitCode}`}`);
  }
  return result;
}

async function verifyImage(image, labelName, expectedContract) {
  const fields = [
    "{{.Id}}",
    `{{ index .Config.Labels ${JSON.stringify(labelName)} }}`,
  ];
  const result = await requireSuccess(
    ["docker", "image", "inspect", image, "--format", fields.join("|")],
    `Inspecting ${image}`,
    { capture: true },
  );
  const [imageId, contract] = result.stdout.trim().split("|");
  if (contract !== expectedContract) {
    fail(`${image} has contract ${JSON.stringify(contract)}; expected ${expectedContract}.`);
  }
  console.log(
    `[runtime-images] verified ${image} ${imageId}`,
  );
  return { imageId };
}

async function resolveLatestClaudeCodeVersion() {
  const envVersion = process.env.CLAUDE_CODE_VERSION?.trim();
  if (envVersion) {
    if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(envVersion)) {
      fail(`CLAUDE_CODE_VERSION ${JSON.stringify(envVersion)} is not a valid semantic version.`);
    }
    return envVersion;
  }
  try {
    const result = await requireSuccess(
      [
        "docker",
        "run",
        "--rm",
        "--entrypoint",
        "npm",
        OPENSHELL_BASE_IMAGE,
        "view",
        `${CLAUDE_CODE_PACKAGE}@latest`,
        "version",
      ],
      "Resolving the latest Claude Code version",
      { capture: true },
    );
    const version = result.stdout.trim();
    if (/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
      return version;
    }
    fail(`npm returned an invalid Claude Code version ${JSON.stringify(version)}.`);
  } catch (err) {
    console.warn(`[runtime-images] Note: Could not resolve latest Claude Code via npm in container, falling back to 2.1.280 (${err.message}).`);
  }
  return "2.1.280";
}

const flags = new Set(process.argv.slice(2));
for (const flag of flags) {
  if (!["--verify-only"].includes(flag)) {
    fail(`Unknown option ${flag}. Use --verify-only.`);
  }
}
const verifyOnly = flags.has("--verify-only");

await requireSuccess(
  ["docker", "info", "--format", "{{.ServerVersion}}"],
  `Connecting to Docker in ${DISTRO_NAME}`,
  { capture: true },
);

if (!verifyOnly) {
  const dockerfile = path.join(repositoryRoot, "Dockerfile.openrind-shell");
  if (!existsSync(dockerfile)) fail(`FUSE Dockerfile not found at ${dockerfile}.`);
  const claudeCodeVersion = await resolveLatestClaudeCodeVersion();
  console.log(`[runtime-images] latest Claude Code is ${claudeCodeVersion}.`);
  console.log(`[runtime-images] building ${FUSE_IMAGE} in ${DISTRO_NAME}...`);
  await requireSuccess(
    [
      "docker",
      "build",
      "--pull=false",
      "--build-arg",
      `CLAUDE_CODE_VERSION=${claudeCodeVersion}`,
      "-f",
      toWslPath(dockerfile),
      "-t",
      FUSE_IMAGE,
      toWslPath(repositoryRoot),
    ],
    `Building ${FUSE_IMAGE}`,
  );
}

await verifyImage(
  FUSE_IMAGE,
  "com.openrind.desktop.fuse-contract",
  FUSE_CONTRACT,
);

console.log("[runtime-images] required source-checkout images are ready in the OpenShell WSL daemon.");
