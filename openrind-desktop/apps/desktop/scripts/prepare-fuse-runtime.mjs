// Stage the paired Linux FUSE control-plane binaries beside the packaged
// OpenShell rootfs. They are built on Linux (release CI or a developer's WSL)
// and copied verbatim; the Windows Electron process starts them inside WSL.

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, "..");
const outputDir = resolve(desktopRoot, "resources", "openshell", "fuse-runtime");
const names = ["openshell", "openshell-gateway", "openshell-sandbox"];

const candidates = [
  process.env.OPENRIND_DESKTOP_FUSE_RUNTIME_DIR?.trim(),
  resolve(scriptDir, "../../../../vendor/openshell/target/release"),
  resolve(scriptDir, "../../../../vendor/openshell/target/debug"),
].filter(Boolean);

const sourceDir = candidates.find((candidate) =>
  names.every((name) => existsSync(resolve(candidate, name))),
);

if (!sourceDir) {
  throw new Error(
    "Patched OpenShell FUSE binaries were not found. Build vendor/openshell " +
      "(openshell-cli, openshell-server, openshell-sandbox) on Linux, or set " +
      "OPENRIND_DESKTOP_FUSE_RUNTIME_DIR to their directory before packaging.",
  );
}

mkdirSync(outputDir, { recursive: true });
for (const name of names) {
  const source = resolve(sourceDir, name);
  const destination = resolve(outputDir, name);
  copyFileSync(source, destination);
  const { mode } = statSync(source);
  // Preserve executable bits when staging onto a Windows checkout as well.
  if (mode & 0o111) {
    try {
      // Node accepts POSIX-style modes on all package hosts.
      (await import("node:fs")).chmodSync(destination, 0o755);
    } catch {
      // electron-builder preserves the source executable mode on Linux. This
      // fallback is only for Windows staging hosts where chmod is advisory.
    }
  }
}

process.stdout.write(
  `${JSON.stringify({ ok: true, sourceDir, outputDir, binaries: names })}\\n`,
);

