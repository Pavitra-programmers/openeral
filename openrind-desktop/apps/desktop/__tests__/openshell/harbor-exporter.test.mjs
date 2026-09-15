import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildAtifTrajectory,
  buildHarborDatasetFiles,
  buildHarborDockerfile,
  buildHarborInstructionMd,
  buildHarborSolutionScript,
  buildHarborTaskFiles,
  buildHarborTaskToml,
  buildHarborTestScript,
  createZipBuffer,
  exportHarborDatasetToZip,
  extractTaskInstruction,
} from "../../electron/openshell/harbor-exporter.mjs";

test("extractTaskInstruction extracts instruction from prompt, messages, and structured parts", () => {
  assert.equal(
    extractTaskInstruction({ prompt: "Do something specific." }),
    "Do something specific.",
  );

  assert.equal(
    extractTaskInstruction({
      request: {
        messages: [{ role: "user", content: "Fix bug in handler." }],
      },
    }),
    "Fix bug in handler.",
  );

  assert.equal(
    extractTaskInstruction({
      request: {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Part 1" },
              { type: "text", text: "Part 2" },
            ],
          },
        ],
      },
    }),
    "Part 1\nPart 2",
  );
});

test("buildHarborTaskToml generates Harbor schema v1.4 compliant TOML", () => {
  const toml = buildHarborTaskToml("test-task-1", {
    trace_id: "trace-xyz",
    tags: ["halo-cited", "unit-test"],
    request: { model: "claude-3-7-sonnet" },
  }, {
    name: "openrind/test-task-1",
    sourceModels: ["claude-3-7-sonnet"],
    sourceProviders: ["anthropic"],
  });

  assert.match(toml, /schema_version = "1\.4"/);
  assert.match(toml, /\[task\]\s+name = "openrind\/test-task-1"/);
  assert.match(toml, /\[metadata\]\s+category = "software-engineering"/);
  assert.match(toml, /trace_id = "trace-xyz"/);
  assert.match(toml, /\[agent\]\s+timeout_sec = 300\.0/);
  assert.match(toml, /\[verifier\]\s+timeout_sec = 120\.0/);
  assert.match(toml, /\[environment\]/);
  assert.match(toml, /network_mode = "public"/);
  assert.match(toml, /docker_image = "ghcr\.io\/nvidia\/openshell-community\/sandboxes\/base:latest"/);
});

test("buildHarborInstructionMd and buildHarborDockerfile generate task environment assets", () => {
  const instruction = buildHarborInstructionMd({ prompt: "Implement connection pooling." });
  assert.match(instruction, /# Task Instruction/);
  assert.match(instruction, /Implement connection pooling\./);
  assert.match(instruction, /## Verification/);

  const dockerfile = buildHarborDockerfile();
  assert.match(dockerfile, /FROM ghcr\.io\/nvidia\/openshell-community\/sandboxes\/base:latest/);
  assert.match(dockerfile, /WORKDIR \/app/);
  assert.match(dockerfile, /useradd -m -s \/bin\/bash agent/);
});

test("buildHarborTestScript produces valid Harbor verifier script writing to /logs/verifier/reward.txt", () => {
  const testSh = buildHarborTestScript();
  assert.match(testSh, /mkdir -p \/logs\/verifier/);
  assert.match(testSh, /echo 1 > \/logs\/verifier\/reward\.txt/);
  assert.match(testSh, /echo 0 > \/logs\/verifier\/reward\.txt/);
  assert.match(testSh, /\/logs\/verifier\/verifier\.log/);
});

test("buildAtifTrajectory produces ATIF v1.8 compliant trajectory", () => {
  const evalCase = {
    id: "eval-case-42",
    request: {
      model: "claude-3-7-sonnet",
      messages: [
        { role: "user", content: "Optimize SQL queries." },
        {
          role: "assistant",
          content: "I will inspect schema.sql.",
          tool_calls: [
            {
              id: "call_sql_1",
              function: {
                name: "bash",
                arguments: '{"command":"cat schema.sql"}',
              },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call_sql_1",
          content: "CREATE TABLE users (id SERIAL PRIMARY KEY);",
        },
      ],
    },
  };

  const trajectory = buildAtifTrajectory(evalCase, {
    agentName: "claude-code",
    modelName: "claude-3-7-sonnet",
  });

  assert.equal(trajectory.schema_version, "ATIF-v1.8");
  assert.equal(trajectory.session_id, "eval-case-42");
  assert.equal(trajectory.agent.name, "claude-code");
  assert.equal(trajectory.agent.model_name, "claude-3-7-sonnet");
  assert.equal(trajectory.steps.length, 2);

  // Step 1: User
  assert.equal(trajectory.steps[0].step_id, 1);
  assert.equal(trajectory.steps[0].source, "user");
  assert.equal(trajectory.steps[0].message, "Optimize SQL queries.");

  // Step 2: Agent with tool calls and tool observation
  assert.equal(trajectory.steps[1].step_id, 2);
  assert.equal(trajectory.steps[1].source, "agent");
  assert.equal(trajectory.steps[1].tool_calls[0].tool_call_id, "call_sql_1");
  assert.equal(trajectory.steps[1].tool_calls[0].function_name, "bash");
  assert.deepEqual(trajectory.steps[1].tool_calls[0].arguments, { command: "cat schema.sql" });
  assert.equal(trajectory.steps[1].observation.results[0].source_call_id, "call_sql_1");
  assert.match(trajectory.steps[1].observation.results[0].content, /CREATE TABLE/);

  // Final metrics
  assert.ok(trajectory.final_metrics.total_prompt_tokens > 0);
  assert.ok(trajectory.final_metrics.total_steps === 2);
});

test("buildHarborDatasetFiles packages multiple tasks with registry.json, dataset.toml, and README.md", () => {
  const evalCases = [
    {
      id: "case-001",
      tags: ["halo-cited"],
      request: { messages: [{ role: "user", content: "Task 1" }] },
    },
    {
      id: "case-002",
      tags: ["golden"],
      request: { messages: [{ role: "user", content: "Task 2" }] },
    },
  ];

  const artifact = {
    artifactId: "eval-cases-abcdef123456.jsonl",
    haloRunId: "abcdef123456",
    cases: 2,
    sourceModels: ["claude-3-7-sonnet"],
    sourceProviders: ["anthropic"],
  };

  const files = buildHarborDatasetFiles(evalCases, artifact);

  const paths = files.map((f) => f.path);
  assert.ok(paths.includes("registry.json"));
  assert.ok(paths.includes("dataset.toml"));
  assert.ok(paths.includes("README.md"));
  assert.ok(paths.includes("tasks/case-001/task.toml"));
  assert.ok(paths.includes("tasks/case-001/instruction.md"));
  assert.ok(paths.includes("tasks/case-001/environment/Dockerfile"));
  assert.ok(paths.includes("tasks/case-001/tests/test.sh"));
  assert.ok(paths.includes("tasks/case-001/solution/solve.sh"));
  assert.ok(paths.includes("tasks/case-001/logs/agent/trajectory.json"));
  assert.ok(paths.includes("tasks/case-002/task.toml"));

  const registry = JSON.parse(files.find((f) => f.path === "registry.json").content);
  assert.equal(registry.tasks.length, 2);
  assert.equal(registry.tasks[0].name, "openrind/case-001");
  assert.equal(registry.tasks[1].name, "openrind/case-002");
});

test("createZipBuffer produces a valid ZIP archive", async () => {
  const files = [
    { path: "tasks/task-1/task.toml", content: 'schema_version = "1.4"\n' },
    { path: "tasks/task-1/instruction.md", content: "# Hello Harbor\n" },
    { path: "README.md", content: "Harbor Dataset Documentation" },
  ];

  const zip = createZipBuffer(files);
  assert.ok(Buffer.isBuffer(zip));
  assert.ok(zip.length > 100);

  // Check standard ZIP signature (0x04034b50) at offset 0
  assert.equal(zip.readUInt32LE(0), 0x04034b50);

  // Check end of central directory signature (0x06054b50)
  const eocdOffset = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocdOffset > 0);
  assert.equal(zip.readUInt16LE(eocdOffset + 8), 3); // 3 total files
});

test("exportHarborDatasetToZip writes a complete zip file to destination", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "harbor-test-"));
  const zipPath = path.join(tempDir, "dataset.zip");

  try {
    const evalCases = [
      {
        id: "case-1",
        request: { messages: [{ role: "user", content: "Fix memory leak." }] },
      },
    ];
    const artifact = {
      artifactId: "eval-cases-112233445566.jsonl",
      haloRunId: "112233445566",
      cases: 1,
      sourceModels: ["claude-3-7-sonnet"],
      sourceProviders: ["anthropic"],
    };

    const result = await exportHarborDatasetToZip(evalCases, artifact, zipPath);
    assert.equal(result.path, zipPath);
    assert.equal(result.tasks, 1);
    assert.ok(result.sizeBytes > 0);

    const data = await readFile(zipPath);
    assert.equal(data.readUInt32LE(0), 0x04034b50);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
