// Linux CI counterpart of the WSL development builder. Never publishes until
// both image contracts and the Desktop-pinned version have been checked.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  HALOOP_IMAGE_VERSION, HALOOP_PACKAGED_IMAGE, HALOOP_PACKAGED_COLLECTOR_IMAGE,
  HALOOP_IMAGE_CONTRACT, HALOOP_COLLECTOR_IMAGE_CONTRACT,
} from "../electron/openshell/haloop-runtime.mjs";

let dockerConfig;
function docker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, ...(dockerConfig ? { DOCKER_CONFIG: dockerConfig } : {}) } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed.`);
  return result.stdout.trim();
}
const images = [
  [HALOOP_PACKAGED_IMAGE, "com.openrind.desktop.haloop-contract", HALOOP_IMAGE_CONTRACT],
  [HALOOP_PACKAGED_COLLECTOR_IMAGE, "com.openrind.desktop.haloop-collector-contract", HALOOP_COLLECTOR_IMAGE_CONTRACT],
];
if (process.argv[2] === "--verify-public") {
  dockerConfig = mkdtempSync(resolve(tmpdir(), "openrind-public-images-"));
  try {
    for (const [image] of images) docker(["manifest", "inspect", image]);
    docker(["manifest", "inspect", "ghcr.io/openrind/openrind-shell/sandbox:fuse"]);
  } finally {
    // Only the exact empty configuration directory created above is removed.
    rmSync(dockerConfig, { recursive: true, force: true });
  }
  console.log("All required images are anonymously accessible.");
} else {
  if (!process.argv[2]) throw new Error("A reviewed Haloop source checkout is required.");
  const source = resolve(process.argv[2]);
  docker(["build", "-f", resolve(source, "Dockerfile"), "-t", HALOOP_PACKAGED_IMAGE, source]);
  docker(["build", "--target", "openrind-desktop-collector", "-f", resolve(source, "halo-loop/Dockerfile"), "-t", HALOOP_PACKAGED_COLLECTOR_IMAGE, source]);
  for (const [image, label, contract] of images) {
    const actual = docker(["image", "inspect", image, "--format", `{{index .Config.Labels "${label}"}}|{{index .Config.Labels "com.openrind.desktop.haloop-version"}}`]);
    if (actual !== `${contract}|${HALOOP_IMAGE_VERSION}`) throw new Error(`Image contract/version mismatch: ${image}`);
  }
  for (const [image] of images) docker(["push", image]);
}
