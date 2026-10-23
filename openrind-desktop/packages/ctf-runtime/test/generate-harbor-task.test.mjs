import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildHarborTaskFilesFromCtf,
  createTarGzBuffer,
  createZipBuffer,
  generateHarborTaskFromTrajectory,
  obfuscateClientSideFlags,
} from "../bin/generate-harbor-task.mjs";

test("obfuscateClientSideFlags obfuscates plaintext flag tokens in client assets", () => {
  const files = [
    {
      path: "environment/workspace/site/app.js",
      content: 'const secret = "flag{super_secret_123}";',
    },
    {
      path: "environment/workspace/chall/server.py",
      content: 'FLAG = "flag{super_secret_123}"',
    },
  ];

  obfuscateClientSideFlags(files, "flag{super_secret_123}");

  // Client-side JS is obfuscated with atob
  assert.match(files[0].content, /atob\(/);
  assert.ok(!files[0].content.includes("flag{super_secret_123}"));

  // Backend Python code is untouched
  assert.equal(files[1].content, 'FLAG = "flag{super_secret_123}"');
});

test("buildHarborTaskFilesFromCtf generates leak-free, anti-cheat Harbor 1.5 task files", async () => {
  const mockTrajectory = {
    task: {
      id: "cookie-clicker",
      title: "Cookie Clicker",
      description: "My record is 10,000,000 cookies. Can you beat it?",
      sitePath: "/",
    },
    judge: {
      accepted: true,
      submission: "utflag{c00k13_cl1ck3r_m4st3r}",
    },
    steps: [],
  };

  const files = await buildHarborTaskFilesFromCtf(mockTrajectory);
  const filePaths = files.map((f) => f.path);

  // 1. Invariant: NO HARBOR-RESULTS.md or logs/ in task package
  assert.ok(!filePaths.includes("HARBOR-RESULTS.md"), "Task package must not include HARBOR-RESULTS.md");
  assert.ok(!filePaths.some((p) => p.startsWith("logs/")), "Task package must not include logs/");

  // 2. Invariant: instruction.md must NOT leak the flag
  const instructionFile = files.find((f) => f.path === "instruction.md");
  assert.ok(instructionFile, "instruction.md must exist");
  assert.ok(
    !instructionFile.content.includes("utflag{c00k13_cl1ck3r_m4st3r}"),
    "instruction.md must not contain the flag string"
  );
  assert.match(instructionFile.content, /utflag\{\.\.\.\}/, "instruction.md should specify flag format");

  // 3. Invariant: verify.py must include anti-cheat log checks
  const verifyFile = files.find((f) => f.path === "tests/verify.py");
  assert.ok(verifyFile, "tests/verify.py must exist");
  assert.match(verifyFile.content, /web-service\.log/, "verify.py must include anti-cheat log verification");
  assert.match(verifyFile.content, /ANTI-CHEAT/, "verify.py must label anti-cheat failure");

  // 4. Invariant: task.toml must adhere to schema 1.5
  const taskTomlFile = files.find((f) => f.path === "task.toml");
  assert.ok(taskTomlFile, "task.toml must exist");
  assert.match(taskTomlFile.content, /schema_version = "1\.5"/);
  assert.match(taskTomlFile.content, /network_mode = "no-network"/);
});

test("generateHarborTaskFromTrajectory creates valid zip and tar.gz packages", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "harbor-gen-test-"));
  const zipPath = join(tempDir, "task.zip");
  const tarPath = join(tempDir, "task.tar.gz");

  try {
    const mockTrajectory = {
      task: {
        id: "flag-command",
        title: "Flag Command",
        description: "Find hidden commands.",
      },
      judge: {
        accepted: true,
        submission: "flag{test_flag_123}",
      },
      steps: [],
    };

    const zipRes = await generateHarborTaskFromTrajectory({
      trajectory: mockTrajectory,
      outPath: zipPath,
    });
    assert.ok(zipRes.ok);
    assert.ok(zipRes.size > 0);

    const tarRes = await generateHarborTaskFromTrajectory({
      trajectory: mockTrajectory,
      outPath: tarPath,
    });
    assert.ok(tarRes.ok);
    assert.ok(tarRes.size > 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
