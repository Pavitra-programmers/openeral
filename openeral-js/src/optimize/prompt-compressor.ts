/**
 * Compress prompts to reduce token usage.
 * Headroom-inspired: live-zone preservation + content-type-aware compression.
 *
 * Strategy:
 *   - "Live zone"  — the most-recent N messages are never touched (active context).
 *   - "Frozen zone" — older messages are compressed by content type:
 *       code blocks  → truncate middle, keep head + tail
 *       JSON arrays  → keep first 3 + last 2 items
 *       diffs        → keep changed lines + 2-line context, drop pure context hunks
 *       log output   → collapse consecutive similar lines
 *       prose        → whitespace normalisation only
 */

import type { APIRequest, Message } from './types.js';

// Number of most-recent messages that are NEVER compressed (the "live zone").
const LIVE_ZONE_SIZE = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Public API (all original exports kept; new ones added)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compress a prompt by removing redundant whitespace and content.
 * Uses live-zone preservation: only the frozen zone (older messages) is compressed.
 * Drop-in replacement for the old compressPrompt — same signature, smarter internals.
 */
export function compressPrompt(request: APIRequest): APIRequest {
  const compressed = { ...request };

  // Compress messages using live-zone logic
  compressed.messages = compressMessages(request.messages);

  // Compress system prompt (always small; full compression is fine)
  if (typeof compressed.system === 'string') {
    compressed.system = compressText(compressed.system);
  }

  return compressed;
}

/**
 * Compress a message array with live-zone preservation.
 * The most-recent `liveZone` messages are never compressed.
 * Only the "frozen zone" (older messages) is compressed.
 */
export function compressMessages(messages: Message[], liveZone = LIVE_ZONE_SIZE): Message[] {
  if (messages.length <= liveZone) {
    return messages; // Everything is live — nothing to compress
  }
  const frozenCount = messages.length - liveZone;
  const frozen = messages.slice(0, frozenCount).map(compressMessage);
  const live   = messages.slice(frozenCount);
  return [...frozen, ...live];
}

/**
 * Compress a single message's text content.
 * Non-text blocks (image, tool_use, etc.) are left untouched.
 */
function compressMessage(message: Message): Message {
  if (typeof message.content === 'string') {
    return { ...message, content: compressText(message.content) };
  }

  return {
    ...message,
    content: (message.content as any[]).map((block: any) => {
      // Plain text block
      if (block.type === 'text' && typeof block.text === 'string') {
        return { ...block, text: compressText(block.text) };
      }
      // Tool result — often carries large file contents or command output
      if (block.type === 'tool_result') {
        if (typeof block.content === 'string') {
          return { ...block, content: compressText(block.content) };
        }
        if (Array.isArray(block.content)) {
          return {
            ...block,
            content: block.content.map((inner: any) =>
              inner.type === 'text' && typeof inner.text === 'string'
                ? { ...inner, text: compressText(inner.text) }
                : inner
            ),
          };
        }
      }
      return block;
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Content-type detection + dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compress a text string based on its detected content type.
 * Falls back to prose normalisation when detection is inconclusive.
 * Returns the original string unchanged for short content (<400 chars).
 */
export function compressText(text: string): string {
  if (text.length < 400) return text; // Short — skip overhead

  const head = text.slice(0, 300);

  // Code blocks (fenced ```)
  if (/```[\s\S]/.test(text)) {
    return compressCodeBlocks(text);
  }

  // Bare JSON arrays
  const trimmed = text.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const result = compressJsonArray(trimmed);
    if (result !== trimmed) return result;
  }

  // Unified diffs
  if (/^(---|\+\+\+|@@|diff --git)/m.test(head)) {
    return compressDiff(text);
  }

  // Log / structured output (timestamps, level keywords)
  if (/(\bERROR\b|\bWARN\b|\bDEBUG\b|\bINFO\b|\d{4}-\d{2}-\d{2})/i.test(head)) {
    return compressLogLines(text);
  }

  return compressProse(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Prose compression (whitespace cleanup)
// ─────────────────────────────────────────────────────────────────────────────

function compressProse(text: string): string {
  let out = text;
  out = out.replace(/\n{3,}/g, '\n\n');   // 3+ newlines → 2
  out = out.replace(/  +/g, ' ');          // 2+ spaces → 1
  out = out.replace(/[ \t]+$/gm, '');      // trailing whitespace per line
  // Still compress any code fences embedded in prose
  out = compressCodeBlocks(out);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code block compression
// ─────────────────────────────────────────────────────────────────────────────

const CODE_BLOCK_MAX_LINES = 300; // Lower than old 500 — matches Headroom practice
const CODE_BLOCK_HEAD      = 100;
const CODE_BLOCK_TAIL      = 100;

function compressCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split('\n');
    if (lines.length <= CODE_BLOCK_MAX_LINES) return match;

    const header  = lines.slice(0, 2);                        // fence + language tag
    const first   = lines.slice(2, 2 + CODE_BLOCK_HEAD);
    const last    = lines.slice(-(CODE_BLOCK_TAIL + 1), -1);  // exclude closing fence
    const closing = lines[lines.length - 1];
    const omitted = lines.length - 2 - CODE_BLOCK_HEAD - CODE_BLOCK_TAIL;

    return [
      ...header,
      ...first,
      `// ... [${omitted} lines omitted] ...`,
      ...last,
      closing,
    ].join('\n');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON array compression
// ─────────────────────────────────────────────────────────────────────────────

const JSON_ARRAY_HEAD = 3;
const JSON_ARRAY_TAIL = 2;
const JSON_ARRAY_MIN  = JSON_ARRAY_HEAD + JSON_ARRAY_TAIL + 2; // minimum count before compressing

function compressJsonArray(text: string): string {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr) || arr.length <= JSON_ARRAY_MIN) return text;

    const kept = [
      ...arr.slice(0, JSON_ARRAY_HEAD),
      `... [${arr.length - JSON_ARRAY_HEAD - JSON_ARRAY_TAIL} items omitted] ...`,
      ...arr.slice(-JSON_ARRAY_TAIL),
    ];
    return JSON.stringify(kept, null, 2);
  } catch {
    return text; // Not valid JSON — return unchanged
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff compression (keep changed lines + 2-line context, drop pure context)
// ─────────────────────────────────────────────────────────────────────────────

const DIFF_CONTEXT_LINES = 2;

function compressDiff(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= 40) return text; // Short diffs need no compression

  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isKey = line.startsWith('+') || line.startsWith('-') ||
                  line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++') ||
                  line.startsWith('diff ');

    if (isKey) {
      result.push(line);
      continue;
    }

    // Context line — keep only if near an upcoming change
    const nearChange = lines
      .slice(i + 1, i + 1 + DIFF_CONTEXT_LINES + 1)
      .some(l => l.startsWith('+') || l.startsWith('-'));

    if (nearChange) result.push(line);
  }

  const compressed = result.join('\n');
  return compressed.length < text.length ? compressed : text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Log line compression (collapse consecutive repeated patterns)
// ─────────────────────────────────────────────────────────────────────────────

const LOG_MIN_REPEAT = 3; // Minimum consecutive similar lines before collapsing

function compressLogLines(text: string): string {
  const lines = text.split('\n');
  if (lines.length < LOG_MIN_REPEAT * 2) return text;

  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const cur = normaliseLogLine(lines[i]);
    let j = i + 1;

    while (j < lines.length && areSimilarLogLines(cur, normaliseLogLine(lines[j]))) {
      j++;
    }

    const repeatCount = j - i;
    result.push(lines[i]); // Keep first representative line

    if (repeatCount >= LOG_MIN_REPEAT) {
      result.push(`... [repeated ${repeatCount - 1} more times] ...`);
    } else {
      // Not enough repeats — keep the rest verbatim
      for (let k = i + 1; k < j; k++) result.push(lines[k]);
    }

    i = j;
  }

  const compressed = result.join('\n');
  return compressed.length < text.length ? compressed : text;
}

function normaliseLogLine(line: string): string {
  return line.replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim();
}

function areSimilarLogLines(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 60) return false;
  if (a === b) return true;
  // Prefix similarity check — fast, no LCS needed
  const minLen = Math.min(a.length, b.length, 80);
  if (minLen < 10) return false;
  const threshold = Math.floor(minLen * 0.7);
  let common = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) common++;
  }
  return common >= threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unchanged public helpers (existing callers preserved)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate token savings from compression.
 */
export function calculateTokenSavings(original: string, compressed: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  const originalTokens  = Math.ceil(original.length / 4);
  const compressedTokens = Math.ceil(compressed.length / 4);
  return Math.max(0, originalTokens - compressedTokens);
}

/**
 * Estimate total tokens in a request.
 */
export function estimateRequestTokens(request: APIRequest): number {
  let total = 0;

  // System prompt
  if (typeof request.system === 'string') {
    total += Math.ceil(request.system.length / 4);
  } else if (Array.isArray(request.system)) {
    total += request.system.reduce((sum, msg) => sum + Math.ceil(msg.text.length / 4), 0);
  }

  // Messages
  for (const msg of request.messages) {
    if (typeof msg.content === 'string') {
      total += Math.ceil(msg.content.length / 4);
    } else {
      total += (msg.content as any[]).reduce((sum: number, block: any) => {
        return sum + (typeof block.text === 'string' ? Math.ceil(block.text.length / 4) : 0);
      }, 0);
    }
  }

  return total;
}
