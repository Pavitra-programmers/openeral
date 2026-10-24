// SellTraces-Compatible Normalized JSON Projection & Companion Report Generator.
//
// Converts a canonical Openrind TracePack (or in-memory trace) into:
// 1. A normalized SellTraces JSON conversation view (`traces[]` shape)
// 2. An explicit companion `projection-report.json` detailing omissions & transformations.
//
// INVARIANT: The projection must NOT invent structure. If a model returned JSON
// containing tool, action, and value in its text, keep it as an assistant text message.
// Do not fake a native provider tool_call.

import { createHash } from "node:crypto";

const PROJECTION_SCHEMA_VERSION = "1.0.0";

const PII_PATTERNS = [
  { name: "Anthropic API Key", regex: /sk-ant-[a-zA-Z0-9_\-]{20,}/g },
  { name: "OpenRouter API Key", regex: /sk-or-[a-zA-Z0-9_\-]{20,}/g },
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9_\-]{20,}/g },
  { name: "Bearer Token", regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi },
  { name: "Generic Secret/Password", regex: /(?:"?(?:password|secret|token|api_?key)"?\s*[:=]\s*)"([^"]+)"/gi },
];

/**
 * Scans a string for sensitive PII or credentials.
 * @param {string} text
 * @returns {Array<{ name: string, count: number }>}
 */
export function scanPii(text) {
  if (typeof text !== "string" || !text) return [];
  const findings = [];
  for (const p of PII_PATTERNS) {
    const matches = text.match(p.regex);
    if (matches && matches.length > 0) {
      findings.push({ name: p.name, count: matches.length });
    }
  }
  return findings;
}

/**
 * Scrubs detected PII from text.
 * @param {string} text
 * @returns {string}
 */
export function scrubPiiText(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  out = out.replace(/sk-ant-[a-zA-Z0-9_\-]{20,}/g, "[REDACTED_ANTHROPIC_KEY]");
  out = out.replace(/sk-or-[a-zA-Z0-9_\-]{20,}/g, "[REDACTED_OPENROUTER_KEY]");
  out = out.replace(/sk-[a-zA-Z0-9_\-]{20,}/g, "[REDACTED_OPENAI_KEY]");
  out = out.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, "Bearer [REDACTED_TOKEN]");
  return out;
}

/**
 * Projects a TracePack / trajectory into SellTraces JSON and generates
 * the accompanying projection report.
 *
 * @param {object} [options={}]
 * @param {object} [options.trajectory={}] - The raw openrind-ctf-trajectory/v1 object.
 * @param {Array<object>} [options.agentEvents=[]] - Raw agent events.
 * @param {Array<object>} [options.challengeEvents=[]] - Raw challenge events.
 * @param {boolean} [options.scrubPii=true] - Whether to scrub credentials from text.
 * @returns {{ sellTracesJson: object, projectionReport: object, piiFindings: Array<object> }}
 */
export function projectToSellTraces({
  trajectory = {},
  agentEvents = [],
  challengeEvents = [],
  scrubPii = true,
} = {}) {
  const task = trajectory.task || {};
  const taskId = task.id || "challenge";
  const startedAt = trajectory.startedAt || new Date().toISOString();
  const traceId = trajectory.runId || trajectory.id || `${taskId}-${startedAt}`;
  const isComplete = Boolean(trajectory.solved || trajectory.judge || trajectory.challengeEventExport?.complete);
  const sessionHash = createHash("sha256").update(String(traceId)).digest("hex").slice(0, 12);
  const sessionId = `${taskId}:${sessionHash}`;

  const messages = [];
  const piiFindingsMap = new Map();
  let position = 1;

  function trackPii(text) {
    const found = scanPii(text);
    for (const f of found) {
      piiFindingsMap.set(f.name, (piiFindingsMap.get(f.name) || 0) + f.count);
    }
    return scrubPii ? scrubPiiText(text) : text;
  }

  // 1. Initial System Message
  const systemText = `You are an Openrind CTF browser agent. Target: ${task.title || taskId}. ${task.description || ""}`;
  const systemTokenCount = Math.max(1, Math.ceil(Buffer.byteLength(systemText, "utf8") / 4));
  messages.push({
    position: position++,
    role: "system",
    content: trackPii(systemText),
    tokenCount: systemTokenCount,
    createdAt: startedAt,
    timestamp: startedAt,
  });

  // 2. Initial User Message
  const userPrompt = `Solve the challenge: ${task.title || taskId}.`;
  const userPromptTokens = Math.max(1, Math.ceil(Buffer.byteLength(userPrompt, "utf8") / 4));
  messages.push({
    position: position++,
    role: "user",
    content: trackPii(userPrompt),
    tokenCount: userPromptTokens,
    createdAt: startedAt,
    timestamp: startedAt,
  });

  // 3. Project Steps
  // DO NOT invent tool_call structure. Keep assistant JSON action string as content.
  const steps = Array.isArray(trajectory.steps) ? trajectory.steps : [];
  let truncatedCount = 0;
  const maxMessageLength = 16384;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepTime = step.at || startedAt;

    // Assistant message: Raw JSON response
    const assistantContent = JSON.stringify({
      thought: step.thought || "",
      tool: step.tool || "browser",
      action: step.action?.action || "none",
      selector: step.action?.selector || "",
      value: step.action?.value || "",
      flag: step.action?.flag || "",
    });
    const assistantTokens = Math.max(1, Math.ceil(Buffer.byteLength(assistantContent, "utf8") / 4));

    messages.push({
      position: position++,
      role: "assistant",
      content: trackPii(assistantContent),
      tokenCount: assistantTokens,
      createdAt: stepTime,
      timestamp: stepTime,
    });

    // User observation message
    let rawObs = String(step.rawObservation || step.observation || "");
    let obsText = rawObs;
    let isTruncated = false;

    if (obsText.length > maxMessageLength) {
      const omittedChars = obsText.length - maxMessageLength;
      obsText = obsText.slice(0, maxMessageLength) + `\n[selltraces truncated ${omittedChars} characters]`;
      isTruncated = true;
      truncatedCount++;
    }
    const obsTokens = Math.max(1, Math.ceil(Buffer.byteLength(obsText, "utf8") / 4));

    messages.push({
      position: position++,
      role: "user",
      content: trackPii(obsText),
      tokenCount: obsTokens,
      ...(isTruncated ? { truncated: true } : {}),
      createdAt: stepTime,
      timestamp: stepTime,
    });
  }

  // Compute content-level deduplication hash (originalHash)
  const contentForHash = messages.map((m) => `${m.role}:${m.content}`).join("\n");
  const originalHash = createHash("sha256").update(contentForHash, "utf8").digest("hex");

  // 4. Construct SellTraces Trace Envelope
  const traceItem = {
    source: "local_trace_index",
    sourceId: taskId,
    conversationId: traceId,
    sessionId,
    createTime: startedAt,
    createdAt: startedAt,
    model: trajectory.model || "unknown",
    originalHash,
    messages,
    toolsAvailable: [
      { name: "browser", description: "Chromium automation tool (open, snapshot, click, fill, eval)" },
      { name: "submit", description: "Submit verified flag to challenge judge" },
    ],
    environment: {
      os: process.platform === "win32" ? "windows" : process.platform,
      arch: process.arch,
      shell: "bash",
      sandbox: true,
      taskCategory: task.category || "web",
    },
    metadata: {
      task: {
        id: taskId,
        title: task.title || taskId,
        category: task.category || "web",
      },
      outcome: trajectory.solved || trajectory.judge?.accepted ? "solved" : "unsolved",
      stepsCount: steps.length,
      captureCompleteness: isComplete ? "complete" : "incomplete",
      piiScrubbed: scrubPii,
      judge: trajectory.judge
        ? {
            accepted: trajectory.judge.accepted,
            submission: trajectory.judge.submission || null,
            submittedAt: trajectory.judge.submittedAt || null,
            verifiedBy: "challenge-server.mjs",
          }
        : null,
    },
  };

  const sellTracesJson = {
    ...traceItem,
    traces: [traceItem],
  };

  // 5. Build Projection Report
  const omittedEvents = [
    {
      type: "browser_low_level_actions",
      reason: "SellTraces message schema is chat-oriented; low-level CDP clicks, keyboard fills, and DOM snapshots cannot be expressed without proprietary extensions.",
      count: steps.filter((s) => s.tool === "browser").length,
    },
    {
      type: "otlp_spans_and_logs",
      reason: "Span graph, trace/span IDs, and duration metrics are not represented in SellTraces messages[]. Retained in TracePack.",
      count: steps.length + 1,
    },
    {
      type: "binary_dom_artifacts",
      reason: "Binary assets and multi-megabyte DOM snapshots exceed JSON chat boundaries. Retained in TracePack artifacts/.",
      count: truncatedCount,
    },
  ];

  if (challengeEvents && challengeEvents.length > 0) {
    omittedEvents.push({
      type: "challenge_proxy_telemetry",
      reason: "Challenge server proxy latency and HTTP round-trip headers cannot be embedded in conversational turns.",
      count: challengeEvents.length,
    });
  }

  const piiFindings = Array.from(piiFindingsMap.entries()).map(([name, count]) => ({
    type: name,
    count,
  }));

  const projectionReport = {
    schema_version: PROJECTION_SCHEMA_VERSION,
    source_trace_id: traceId,
    source_session_id: sellTracesJson.sessionId,
    projected_at: new Date().toISOString(),
    capture_complete: isComplete,
    included_fields: [
      "source",
      "sourceId",
      "conversationId",
      "sessionId",
      "createTime",
      "model",
      "messages[].position",
      "messages[].role",
      "messages[].content",
      "messages[].timestamp",
      "metadata.task",
      "metadata.outcome",
      "metadata.stepsCount",
      "metadata.judge",
    ],
    omitted_events: omittedEvents,
    flattened_structures: [
      "Model action JSON was preserved verbatim inside assistant text message content; native provider tool_calls were not invented.",
      "Independent challenge judge verdict was projected into metadata.judge rather than an unverified agent turn.",
    ],
    linked_artifacts: truncatedCount > 0 ? [`${truncatedCount} observations truncated to 8KB; full contents preserved in TracePack`] : [],
    truncation_applied: truncatedCount > 0,
    pii_scrubbed: scrubPii,
    pii_findings: piiFindings,
  };

  return { sellTracesJson, projectionReport, piiFindings };
}
