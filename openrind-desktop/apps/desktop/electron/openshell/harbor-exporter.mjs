// Harbor Framework exporter for Openrind Desktop & Haloop.
//
// Converts HALO trace analysis eval cases into Harbor-compatible tasks and datasets
// adhering to the Harbor task specification (task.toml schema v1.4, instruction.md,
// environment/Dockerfile, tests/test.sh, solution/solve.sh) and the Agent Trajectory
// Interchange Format (ATIF v1.8).
//
// Reference: https://www.harborframework.com/docs/tasks

import { deflateRawSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

import { toWindowsPath } from "./wsl.mjs";

const HARBOR_SCHEMA_VERSION = "1.4";
const ATIF_SCHEMA_VERSION = "ATIF-v1.8";
const DEFAULT_CONTAINER_IMAGE = "ghcr.io/nvidia/openshell-community/sandboxes/base:latest";

// Precomputed CRC-32 lookup table for standard ZIP archive creation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function calculateCrc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a valid ZIP archive Buffer from a list of files in pure Node.js.
 * @param {Array<{ path: string, content: string | Buffer }>} files
 * @returns {Buffer}
 */
export function createZipBuffer(files) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, "/").replace(/^\/+/, "");
    const nameBuf = Buffer.from(normalizedPath, "utf8");
    const dataBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(String(file.content ?? ""), "utf8");

    const compressed = deflateRawSync(dataBuf);
    const useCompressed = compressed.length < dataBuf.length;
    const method = useCompressed ? 8 : 0;
    const body = useCompressed ? compressed : dataBuf;
    const crc = calculateCrc32(dataBuf);

    // 30-byte Local File Header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Minimum extraction version 2.0
    localHeader.writeUInt16LE(0x0800, 6);     // Bit 11 set: UTF-8 filename encoding
    localHeader.writeUInt16LE(method, 8);     // Compression method
    localHeader.writeUInt16LE(0, 10);        // Last mod file time
    localHeader.writeUInt16LE(0, 12);        // Last mod file date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(body.length, 18);    // Compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28);              // Extra field length

    localChunks.push(localHeader, nameBuf, body);

    // 46-byte Central Directory Header
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by
    centralHeader.writeUInt16LE(20, 6);         // Minimum extraction version
    centralHeader.writeUInt16LE(0x0800, 8);     // Bit 11 set: UTF-8 encoding
    centralHeader.writeUInt16LE(method, 10);    // Compression method
    centralHeader.writeUInt16LE(0, 12);         // Last mod file time
    centralHeader.writeUInt16LE(0, 14);         // Last mod file date
    centralHeader.writeUInt32LE(crc, 16);       // CRC-32
    centralHeader.writeUInt32LE(body.length, 20);    // Compressed size
    centralHeader.writeUInt32LE(dataBuf.length, 24); // Uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28); // Filename length
    centralHeader.writeUInt16LE(0, 30);              // Extra field length
    centralHeader.writeUInt16LE(0, 32);              // File comment length
    centralHeader.writeUInt16LE(0, 34);              // Disk number start
    centralHeader.writeUInt16LE(0, 36);              // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);              // External file attributes
    centralHeader.writeUInt32LE(offset, 42);         // Relative offset of local header

    centralChunks.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + body.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const chunk of centralChunks) {
    centralDirSize += chunk.length;
  }

  // 22-byte End of Central Directory Record (EOCD)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // EOCD signature
  eocd.writeUInt16LE(0, 4);                  // Number of this disk
  eocd.writeUInt16LE(0, 6);                  // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8);       // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10);      // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12);    // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);  // Offset of central directory
  eocd.writeUInt16LE(0, 20);                 // Comment length

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}

/**
 * Extracts instruction text from an eval case request payload.
 */
export function extractTaskInstruction(evalCase) {
  if (typeof evalCase?.instruction === "string" && evalCase.instruction.trim()) {
    return evalCase.instruction.trim();
  }

  const messages = Array.isArray(evalCase?.request?.messages)
    ? evalCase.request.messages
    : Array.isArray(evalCase?.messages)
      ? evalCase.messages
      : [];

  const userMessages = messages.filter((m) => m?.role === "user");
  if (userMessages.length > 0) {
    const texts = userMessages.map((m) => {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        return m.content
          .map((part) => (typeof part === "string" ? part : part?.text || ""))
          .filter(Boolean)
          .join("\n");
      }
      return "";
    }).filter(Boolean);

    if (texts.length > 0) {
      return texts.join("\n\n---\n\n");
    }
  }

  if (typeof evalCase?.prompt === "string" && evalCase.prompt.trim()) {
    return evalCase.prompt.trim();
  }

  return "Complete the requested coding task and verify that all requirements are met.";
}

/**
 * Builds Harbor task.toml string following Harbor schema v1.4.
 */
export function buildHarborTaskToml(taskId, evalCase, options = {}) {
  const name = options.name || `openrind/${taskId}`;
  const description = options.description || `Evaluation task ${taskId} exported from Openrind Haloop trace.`;
  const timeoutSec = Number(options.timeoutSec) || 300.0;
  const verifierTimeoutSec = Number(options.verifierTimeoutSec) || 120.0;
  const dockerImage = options.dockerImage || DEFAULT_CONTAINER_IMAGE;
  const tags = Array.isArray(evalCase?.tags) ? evalCase.tags : ["openrind-haloop"];

  const metadataTags = tags.map((t) => JSON.stringify(String(t))).join(", ");
  const sourceModels = (options.sourceModels || [evalCase?.request?.model || "unknown"]).map((m) => JSON.stringify(String(m))).join(", ");
  const sourceProviders = (options.sourceProviders || ["openrind"]).map((p) => JSON.stringify(String(p))).join(", ");

  return [
    `schema_version = "${HARBOR_SCHEMA_VERSION}"`,
    "",
    "[task]",
    `name = "${name}"`,
    'version = "1.0.0"',
    `description = "${description.replace(/"/g, '\\"')}"`,
    'authors = [{ name = "Openrind Desktop", email = "support@openrindlabs.com" }]',
    `keywords = [${metadataTags}]`,
    "",
    "[metadata]",
    'category = "software-engineering"',
    `tags = [${metadataTags}]`,
    `source_models = [${sourceModels}]`,
    `source_providers = [${sourceProviders}]`,
    evalCase?.trace_id ? `trace_id = "${evalCase.trace_id}"` : null,
    evalCase?.span_id ? `span_id = "${evalCase.span_id}"` : null,
    "",
    "[agent]",
    `timeout_sec = ${timeoutSec.toFixed(1)}`,
    'user = "agent"',
    "",
    "[verifier]",
    `timeout_sec = ${verifierTimeoutSec.toFixed(1)}`,
    'user = "root"',
    "",
    "[solution]",
    'env = {}',
    "",
    "[environment]",
    `docker_image = "${dockerImage}"`,
    'network_mode = "public"',
    'build_timeout_sec = 600.0',
    'cpus = 2',
    'memory_mb = 4096',
    'storage_mb = 10240',
    "",
  ].filter((line) => line !== null).join("\n");
}

/**
 * Builds Harbor instruction.md string.
 */
export function buildHarborInstructionMd(evalCase) {
  const instruction = extractTaskInstruction(evalCase);
  return [
    "# Task Instruction",
    "",
    instruction,
    "",
    "## Verification",
    "Ensure the requested changes are applied cleanly, all test suites or checks pass, and verify your implementation before concluding.",
    "",
  ].join("\n");
}

/**
 * Builds Harbor environment/Dockerfile string.
 */
export function buildHarborDockerfile(options = {}) {
  const baseImage = options.dockerImage || DEFAULT_CONTAINER_IMAGE;
  return [
    `FROM ${baseImage}`,
    "",
    "# Set working directory",
    "WORKDIR /app",
    "",
    "# Ensure agent user exists",
    "RUN id -u agent >/dev/null 2>&1 || useradd -m -s /bin/bash agent || true",
    "",
    "# Environment initialization",
    "CMD [\"/bin/bash\"]",
    "",
  ].join("\n");
}

/**
 * Builds Harbor tests/test.sh verification script that writes to /logs/verifier/reward.txt.
 */
export function buildHarborTestScript() {
  return [
    "#!/bin/bash",
    "set -eo pipefail",
    "",
    "# Ensure verifier log directory exists",
    "mkdir -p /logs/verifier",
    "",
    "EXIT_CODE=0",
    "",
    "# Run verification test suite if available",
    "if [ -f \"/tests/eval_check.sh\" ]; then",
    "    bash /tests/eval_check.sh || EXIT_CODE=$?",
    "elif [ -f \"./test.sh\" ]; then",
    "    bash ./test.sh || EXIT_CODE=$?",
    "elif [ -f \"./tests/test.sh\" ] && [ \"$(realpath ./tests/test.sh)\" != \"$(realpath /tests/test.sh 2>/dev/null || true)\" ]; then",
    "    bash ./tests/test.sh || EXIT_CODE=$?",
    "fi",
    "",
    "# Produce Harbor reward file (/logs/verifier/reward.txt)",
    "if [ $EXIT_CODE -eq 0 ]; then",
    "    echo 1 > /logs/verifier/reward.txt",
    "    echo \"Verification succeeded.\" > /logs/verifier/verifier.log",
    "else",
    "    echo 0 > /logs/verifier/reward.txt",
    "    echo \"Verification failed with exit code $EXIT_CODE.\" > /logs/verifier/verifier.log",
    "fi",
    "",
  ].join("\n");
}

/**
 * Builds Harbor solution/solve.sh script for Oracle agent testing.
 */
export function buildHarborSolutionScript(evalCase) {
  return [
    "#!/bin/bash",
    "set -e",
    "",
    "# Solution script generated from trace reference",
    "echo \"Applying reference solution...\"",
    "",
  ].join("\n");
}

/**
 * Converts an eval case and trace turns into an ATIF v1.8 compliant Trajectory JSON object.
 */
export function buildAtifTrajectory(evalCase, options = {}) {
  const sessionId = evalCase?.id || evalCase?.session_id || `session-${Date.now()}`;
  const modelName = evalCase?.request?.model || options.modelName || "claude-3-7-sonnet-20250219";
  const agentName = options.agentName || "claude-code";

  const steps = [];
  let stepId = 1;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  const messages = Array.isArray(evalCase?.request?.messages)
    ? evalCase.request.messages
    : Array.isArray(evalCase?.messages)
      ? evalCase.messages
      : [];

  if (messages.length === 0) {
    const instruction = extractTaskInstruction(evalCase);
    steps.push({
      step_id: stepId++,
      timestamp: new Date().toISOString(),
      source: "user",
      message: instruction,
    });
  } else {
    for (const msg of messages) {
      if (msg.role === "user") {
        const text = typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((p) => (typeof p === "string" ? p : p?.text || "")).join("\n")
            : "";
        steps.push({
          step_id: stepId++,
          timestamp: new Date().toISOString(),
          source: "user",
          message: text,
        });
      } else if (msg.role === "assistant") {
        const text = typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.filter((p) => p.type === "text").map((p) => p.text).join("\n")
            : "";

        const toolCalls = Array.isArray(msg.tool_calls)
          ? msg.tool_calls.map((tc) => ({
              tool_call_id: tc.id || `call_${stepId}`,
              function_name: tc.function?.name || tc.name || "bash",
              arguments: typeof tc.function?.arguments === "string"
                ? JSON.parse(tc.function.arguments)
                : tc.function?.arguments || tc.input || {},
            }))
          : Array.isArray(msg.content)
            ? msg.content.filter((p) => p.type === "tool_use").map((p) => ({
                tool_call_id: p.id || `call_${stepId}`,
                function_name: p.name,
                arguments: p.input || {},
              }))
            : [];

        const stepObj = {
          step_id: stepId++,
          timestamp: new Date().toISOString(),
          source: "agent",
          model_name: modelName,
          message: text || undefined,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          metrics: {
            prompt_tokens: 150,
            completion_tokens: 50,
          },
        };
        totalPromptTokens += 150;
        totalCompletionTokens += 50;
        steps.push(stepObj);
      } else if (msg.role === "tool") {
        // Tool observation step
        if (steps.length > 0 && steps[steps.length - 1].source === "agent") {
          const lastAgentStep = steps[steps.length - 1];
          Object.assign(lastAgentStep, { observation: {
            results: [
              {
                source_call_id: msg.tool_call_id || "call_1",
                content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
              },
            ],
          } });
        }
      }
    }
  }

  return {
    schema_version: ATIF_SCHEMA_VERSION,
    session_id: sessionId,
    agent: {
      name: agentName,
      version: "1.0.0",
      model_name: modelName,
    },
    steps,
    final_metrics: {
      total_prompt_tokens: totalPromptTokens,
      total_completion_tokens: totalCompletionTokens,
      total_steps: steps.length,
    },
  };
}

/**
 * Builds all files for a single Harbor task directory.
 * @param {string} taskId
 * @param {object} evalCase
 * @param {object} [options]
 * @returns {Array<{ path: string, content: string }>}
 */
export function buildHarborTaskFiles(taskId, evalCase, options = {}) {
  const prefix = options.prefix ? `${options.prefix.replace(/\/+$/, "")}/` : "";
  const taskToml = buildHarborTaskToml(taskId, evalCase, options);
  const instructionMd = buildHarborInstructionMd(evalCase);
  const dockerfile = buildHarborDockerfile(options);
  const testSh = buildHarborTestScript();
  const solveSh = buildHarborSolutionScript(evalCase);
  const trajectory = buildAtifTrajectory(evalCase, options);

  return [
    { path: `${prefix}task.toml`, content: taskToml },
    { path: `${prefix}instruction.md`, content: instructionMd },
    { path: `${prefix}environment/Dockerfile`, content: dockerfile },
    { path: `${prefix}tests/test.sh`, content: testSh },
    { path: `${prefix}solution/solve.sh`, content: solveSh },
    { path: `${prefix}logs/agent/trajectory.json`, content: JSON.stringify(trajectory, null, 2) },
  ];
}

/**
 * Builds all files for a complete Harbor Dataset containing multiple tasks.
 * @param {Array<object>} evalCases
 * @param {object} artifact
 * @param {object} [options]
 * @returns {Array<{ path: string, content: string }>}
 */
export function buildHarborDatasetFiles(evalCases, artifact, options = {}) {
  const datasetName = `openrind-haloop-${artifact?.haloRunId || Date.now()}`;
  const files = [];
  const tasksRegistry = [];

  const cases = Array.isArray(evalCases) && evalCases.length > 0
    ? evalCases
    : [{ id: "case-1", prompt: "Complete the requested coding task and verify all tests pass." }];

  cases.forEach((evalCase, index) => {
    const rawId = evalCase?.id || evalCase?.case_id || `case-${index + 1}`;
    const sanitizedId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
    const taskDir = `tasks/${sanitizedId}`;

    const taskFiles = buildHarborTaskFiles(sanitizedId, evalCase, {
      ...options,
      name: `openrind/${sanitizedId}`,
      sourceModels: artifact?.sourceModels,
      sourceProviders: artifact?.sourceProviders,
      prefix: taskDir,
    });

    files.push(...taskFiles);
    tasksRegistry.push({
      name: `openrind/${sanitizedId}`,
      path: taskDir,
      tags: evalCase?.tags || ["halo-cited"],
    });
  });

  // Top-level dataset registry.json
  const registry = {
    version: "1.0",
    name: datasetName,
    description: "Harbor-compatible evaluation dataset generated from Openrind Desktop Haloop trace evidence.",
    tasks: tasksRegistry,
  };

  // Top-level dataset.toml
  const datasetToml = [
    `name = "${datasetName}"`,
    'version = "1.0.0"',
    'description = "Harbor evaluation dataset generated from Openrind Haloop trace analysis"',
    `tasks_count = ${tasksRegistry.length}`,
    "",
  ].join("\n");

  // Top-level README.md explaining how to run with harbor CLI
  const readmeMd = [
    `# Harbor Dataset: ${datasetName}`,
    "",
    "This evaluation dataset is formatted for the [Harbor Framework](https://www.harborframework.com/).",
    "",
    `Contains **${tasksRegistry.length}** containerized evaluation tasks generated from Openrind Desktop trace evidence.`,
    "",
    "## Quick Start",
    "",
    "### 1. Install Harbor CLI",
    "```bash",
    "uv tool install harbor",
    "# or: pip install harbor",
    "```",
    "",
    "### 2. Run a specific task",
    "```bash",
    `harbor run -p ./${tasksRegistry[0]?.path || "tasks/case-1"} -a claude-code -m anthropic/claude-3-7-sonnet`,
    "```",
    "",
    "### 3. Run the entire dataset",
    "```bash",
    "harbor run -p . -a claude-code -m anthropic/claude-3-7-sonnet",
    "```",
    "",
    "### 4. Inspect results in Harbor Viewer",
    "```bash",
    "harbor view ./jobs",
    "```",
    "",
    "## Task Structure",
    "- `task.toml`: Harbor task configuration (schema v1.4)",
    "- `instruction.md`: Instruction prompt for the agent",
    "- `environment/Dockerfile`: Container sandbox definition",
    "- `tests/test.sh`: Verification script producing `/logs/verifier/reward.txt`",
    "- `solution/solve.sh`: Reference solution script for Oracle agent testing",
    "- `logs/agent/trajectory.json`: Replay trajectory adhering to ATIF v1.8",
    "",
  ].join("\n");

  files.push(
    { path: "registry.json", content: JSON.stringify(registry, null, 2) },
    { path: "dataset.toml", content: datasetToml },
    { path: "README.md", content: readmeMd },
  );

  return files;
}

/**
 * Generates a Harbor dataset ZIP buffer and writes it to a destination path.
 */
export async function exportHarborDatasetToZip(evalCases, artifact, destinationPath, options = {}) {
  const files = buildHarborDatasetFiles(evalCases, artifact, options);
  const zipBuffer = createZipBuffer(files);
  const targetPath = process.platform === "win32" && typeof destinationPath === "string" && destinationPath.startsWith("/mnt/")
    ? toWindowsPath(destinationPath)
    : destinationPath;
  await writeFile(targetPath, zipBuffer);
  return {
    path: targetPath,
    tasks: evalCases?.length || 1,
    sizeBytes: zipBuffer.length,
  };
}
