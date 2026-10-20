#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DISTRO_NAME = "openrind-desktop-openshell";
const CHROMIUM_VERSION = "154.0.8037.92-1~deb12u1";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function toWslPath(winPath) {
  const abs = path.resolve(winPath);
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(abs);
  if (!m) throw new Error(`Not an absolute Windows path: ${abs}`);
  return `/mnt/${m[1].toLowerCase()}/${m[2].replaceAll("\\", "/")}`;
}

const dockerfilePath = toWslPath(path.join(rootDir, "sandboxes", "browser-pod", "Dockerfile"));
const contextPath = toWslPath(path.join(rootDir, "sandboxes", "browser-pod"));

console.log(`[rebuild-browser-pod] Target WSL distro: ${DISTRO_NAME}`);
console.log(`[rebuild-browser-pod] Dockerfile: ${dockerfilePath}`);
console.log(`[rebuild-browser-pod] Context: ${contextPath}`);
console.log(`[rebuild-browser-pod] Building openrind-browser-pod:e2e and openrind-browser-pod:latest...`);

const args = [
  "-d",
  DISTRO_NAME,
  "--",
  "docker",
  "build",
  "--pull=false",
  "-f",
  dockerfilePath,
  "--build-arg",
  `CHROMIUM_VERSION=${CHROMIUM_VERSION}`,
  "-t",
  "openrind-browser-pod:e2e",
  "-t",
  "openrind-browser-pod:latest",
  contextPath,
];

const child = spawn("wsl.exe", args, {
  stdio: "inherit",
  windowsHide: false,
});

child.on("close", (code) => {
  if (code === 0) {
    console.log("\n[rebuild-browser-pod] Successfully built openrind-browser-pod:e2e and openrind-browser-pod:latest!");
  } else {
    console.error(`\n[rebuild-browser-pod] Build failed with exit code ${code}`);
    process.exit(code ?? 1);
  }
});

child.on("error", (err) => {
  console.error(`[rebuild-browser-pod] Failed to spawn wsl.exe: ${err.message}`);
  process.exit(1);
});
