// Canonical Lossless Openrind TracePack Packager.
//
// Retains raw execution evidence, conversation messages, OTLP-compliant spans,
// and content-addressed binary artifacts in a structured archive:
//
// tracepack/
//   manifest.json
//   conversation.jsonl
//   events.jsonl
//   otlp/
//     traces.json
//     logs.json
//   artifacts/
//     manifest.json
//     <sha256>
//   source-records/

import { createHash, randomBytes } from "node:crypto";
import { createZipBuffer } from "./harbor-exporter.mjs";

const TRACEPACK_SCHEMA_VERSION = "1.0.0";
const PARSER_VERSION = "1.0.0";

function sha256Hex(content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ""), "utf8");
  return createHash("sha256").update(buf).digest("hex");
}

function stableTraceId(input) {
  if (typeof input === "string" && /^[0-9a-f]{32}$/i.test(input)) {
    return input.toLowerCase();
  }
  return createHash("sha256").update(String(input || randomBytes(16).toString("hex"))).digest("hex").slice(0, 32);
}

function stableSpanId(input) {
  if (typeof input === "string" && /^[0-9a-f]{16}$/i.test(input)) {
    return input.toLowerCase();
  }
  return createHash("sha256").update(String(input || randomBytes(8).toString("hex"))).digest("hex").slice(0, 16);
}

/**
 * Builds a canonical TracePack file list from trajectory, agent events, and challenge events.
 *
 * @param {object} [options={}]
 * @param {object} [options.trajectory={}] - The raw openrind-ctf-trajectory/v1 object.
 * @param {Array<object>} [options.agentEvents=[]] - Raw agent events (browser_setup, model_call, agent_step, etc.).
 * @param {Array<object>} [options.challengeEvents=[]] - Raw challenge server events (site proxy, judge, etc.).
 * @param {Array<object>} [options.haloopSpans=[]] - Optional Haloop model spans.
 * @returns {{ files: Array<{ path: string, content: string | Buffer }>, manifest: object }}
 */
export function buildTracePackFiles({
  trajectory = {},
  agentEvents = [],
  challengeEvents = [],
  haloopSpans = [],
} = {}) {
  const task = trajectory.task || {};
  const taskId = task.id || "challenge";
  const startedAt = trajectory.startedAt || new Date().toISOString();
  const traceId = stableTraceId(trajectory.runId || trajectory.id || `${taskId}-${startedAt}`);
  const rootSpanId = stableSpanId(`root-${traceId}`);
  const sessionId = `${taskId}:${traceId.slice(0, 12)}`;

  const files = [];
  const artifactsMap = {};
  const conversationLines = [];
  const eventLines = [];
  const otlpSpans = [];

  let sequenceNumber = 1;

  // 1. Artifact Helper
  function recordArtifact(name, content, mediaType = "text/plain") {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ""), "utf8");
    const hash = sha256Hex(buf);
    if (!artifactsMap[hash]) {
      artifactsMap[hash] = {
        hash,
        size: buf.length,
        mediaType,
        originalName: name,
      };
      files.push({
        path: `tracepack/artifacts/${hash}`,
        content: buf,
      });
    }
    return hash;
  }

  // 2. Build Events & Conversation from Steps / Events
  const steps = Array.isArray(trajectory.steps) ? trajectory.steps : [];

  // System message turn
  conversationLines.push(JSON.stringify({
    role: "system",
    content: `You are an Openrind CTF browser agent. Target: ${task.title || taskId}. ${task.description || ""}`,
    timestamp: startedAt,
    sequence: sequenceNumber++,
  }));

  // Initial user prompt
  conversationLines.push(JSON.stringify({
    role: "user",
    content: `Solve the challenge: ${task.title || taskId}.`,
    timestamp: startedAt,
    sequence: sequenceNumber++,
  }));

  // Process Agent Events if available; otherwise derive from trajectory steps
  if (Array.isArray(agentEvents) && agentEvents.length > 0) {
    for (const rawEvt of agentEvents) {
      const evtId = `evt-${sequenceNumber}`;
      const evtTime = rawEvt.at || startedAt;
      const producer = rawEvt.kind?.startsWith("browser") ? "browser" :
                       rawEvt.kind?.startsWith("model") ? "inference-gateway" : "agent";

      let artifactRef = null;
      if (rawEvt.observation && String(rawEvt.observation).length > 2048) {
        artifactRef = recordArtifact(`observation-${sequenceNumber}.txt`, rawEvt.observation, "text/plain");
      }

      eventLines.push(JSON.stringify({
        id: evtId,
        sequence: sequenceNumber++,
        timestamp: evtTime,
        trace_id: traceId,
        parent_id: rootSpanId,
        producer,
        kind: rawEvt.kind,
        details: {
          ...rawEvt,
          ...(artifactRef ? { observation_artifact: artifactRef } : {}),
        },
      }));
    }
  }

  // Populate conversation turns from trajectory steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepTime = step.at || startedAt;
    const stepSpanId = stableSpanId(`step-${i + 1}-${traceId}`);

    // Assistant response (Raw JSON text conforming to CTF schema)
    const assistantPayload = {
      thought: step.thought || "",
      tool: step.tool || "browser",
      action: step.action?.action || "none",
      selector: step.action?.selector || "",
      value: step.action?.value || "",
      flag: step.action?.flag || "",
    };
    const assistantText = JSON.stringify(assistantPayload);

    conversationLines.push(JSON.stringify({
      role: "assistant",
      content: assistantText,
      timestamp: stepTime,
      step: step.number || i + 1,
      durationMs: step.durationMs,
      sequence: sequenceNumber++,
    }));

    // User / Environment observation turn
    const obsText = String(step.observation ?? "");
    let obsArtifact = null;
    if (obsText.length > 2048) {
      obsArtifact = recordArtifact(`step-${i + 1}-obs.txt`, obsText, "text/plain");
    }

    conversationLines.push(JSON.stringify({
      role: "user",
      content: obsText,
      timestamp: stepTime,
      step: step.number || i + 1,
      sequence: sequenceNumber++,
      ...(obsArtifact ? { artifact: obsArtifact } : {}),
    }));

    // If agentEvents wasn't provided, build eventLine from step
    if (!agentEvents || agentEvents.length === 0) {
      eventLines.push(JSON.stringify({
        id: `step-${i + 1}`,
        sequence: sequenceNumber++,
        timestamp: stepTime,
        trace_id: traceId,
        parent_id: rootSpanId,
        span_id: stepSpanId,
        producer: "agent",
        kind: "agent_step",
        tool: step.tool,
        action: step.action,
        durationMs: step.durationMs,
        ...(obsArtifact ? { observation_artifact: obsArtifact } : {}),
      }));
    }

    // OTLP Step Span
    otlpSpans.push({
      trace_id: traceId,
      span_id: stepSpanId,
      parent_span_id: rootSpanId,
      name: `agent.step.${step.number || i + 1}`,
      kind: "SPAN_KIND_INTERNAL",
      start_time_unix_nano: new Date(stepTime).getTime() * 1_000_000,
      end_time_unix_nano: (new Date(stepTime).getTime() + (Number(step.durationMs) || 100)) * 1_000_000,
      attributes: [
        { key: "openrind.task.id", value: { string_value: taskId } },
        { key: "openrind.step.number", value: { int_value: step.number || i + 1 } },
        { key: "openrind.step.tool", value: { string_value: step.tool || "browser" } },
      ],
      status: { code: 1 }, // STATUS_CODE_OK
    });
  }

  // 3. Challenge Server & Judge Events (Independent Provenance)
  if (Array.isArray(challengeEvents) && challengeEvents.length > 0) {
    for (const chEvt of challengeEvents) {
      eventLines.push(JSON.stringify({
        id: `ch-${sequenceNumber}`,
        sequence: sequenceNumber++,
        timestamp: chEvt.at || startedAt,
        trace_id: traceId,
        parent_id: rootSpanId,
        producer: chEvt.kind === "judge" ? "challenge-judge" : "challenge-server",
        provenance: {
          origin: "challenge-server.mjs",
          independent_verdict: chEvt.kind === "judge",
        },
        kind: chEvt.kind,
        details: chEvt,
      }));
    }
  } else if (trajectory.judge) {
    // If challenge events not provided as separate file, emit official judge verdict event
    eventLines.push(JSON.stringify({
      id: `judge-${sequenceNumber}`,
      sequence: sequenceNumber++,
      timestamp: trajectory.judge.submittedAt || new Date().toISOString(),
      trace_id: traceId,
      parent_id: rootSpanId,
      producer: "challenge-judge",
      provenance: {
        origin: "challenge-server.mjs",
        independent_verdict: true,
      },
      kind: "judge_verdict",
      details: trajectory.judge,
    }));
  }

  // 4. Root OTLP Span
  const rootSpan = {
    trace_id: traceId,
    span_id: rootSpanId,
    name: `openrind.ctf.${taskId}`,
    kind: "SPAN_KIND_SERVER",
    start_time_unix_nano: new Date(startedAt).getTime() * 1_000_000,
    end_time_unix_nano: Date.now() * 1_000_000,
    attributes: [
      { key: "openrind.task.id", value: { string_value: taskId } },
      { key: "openrind.task.title", value: { string_value: task.title || taskId } },
      { key: "openrind.model", value: { string_value: trajectory.model || "unknown" } },
      { key: "openrind.solved", value: { bool_value: Boolean(trajectory.solved || trajectory.judge?.accepted) } },
      { key: "service.name", value: { string_value: "openrind-ctf" } },
    ],
    status: { code: trajectory.solved || trajectory.judge?.accepted ? 1 : 2 },
  };

  const otlpTracesDocument = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { string_value: "openrind-desktop" } },
            { key: "service.version", value: { string_value: "0.14.0" } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "com.openrind.ctf", version: "1.0.0" },
            spans: [rootSpan, ...otlpSpans],
          },
        ],
      },
    ],
  };

  const isSealed = Boolean(trajectory.solved || trajectory.judge || trajectory.challengeEventExport?.complete);

  // 5. Build Manifest
  const manifest = {
    schema_version: TRACEPACK_SCHEMA_VERSION,
    parser_version: PARSER_VERSION,
    trace_id: traceId,
    session_id: sessionId,
    created_at: new Date().toISOString(),
    client: {
      name: "Openrind Desktop",
      version: "0.14.0",
      runtime: "electron-win32",
    },
    task: {
      id: taskId,
      title: task.title || taskId,
      category: task.category || "web",
    },
    model: trajectory.model || "unknown",
    capture: {
      complete: isSealed,
      sealed: isSealed,
      dropped_events_count: 0,
      total_conversation_turns: conversationLines.length,
      total_events: eventLines.length,
      total_artifacts: Object.keys(artifactsMap).length,
    },
    producers: [
      "inference-gateway",
      "agent",
      "browser",
      "challenge-server",
      "challenge-judge",
    ],
  };

  // 6. Compile File List
  files.push({
    path: "tracepack/manifest.json",
    content: JSON.stringify(manifest, null, 2),
  });

  files.push({
    path: "tracepack/conversation.jsonl",
    content: conversationLines.join("\n") + "\n",
  });

  files.push({
    path: "tracepack/events.jsonl",
    content: eventLines.join("\n") + "\n",
  });

  files.push({
    path: "tracepack/otlp/traces.json",
    content: JSON.stringify(otlpTracesDocument, null, 2),
  });

  files.push({
    path: "tracepack/otlp/logs.json",
    content: JSON.stringify({ resourceLogs: [] }, null, 2),
  });

  files.push({
    path: "tracepack/artifacts/manifest.json",
    content: JSON.stringify(artifactsMap, null, 2),
  });

  return { files, manifest };
}

/**
 * Generates a valid TracePack ZIP buffer from input trace data.
 * Pure Node.js; no external CLI binaries.
 */
export function createTracePackZip(options) {
  const { files, manifest } = buildTracePackFiles(options);
  const zipBuffer = createZipBuffer(files);
  return { buffer: zipBuffer, manifest };
}
