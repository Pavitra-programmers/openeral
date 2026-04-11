import type { StringcostSessionContext } from './optimizer/types.js';

export interface BuildStringcostContextInput {
  workspaceId?: string;
  projectSlug: string;
  sessionId?: string;
  staticPromptTokens: number;
  instructionTokens: number;
  memoryTokens: number;
  findingCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  cacheReady: boolean;
}

function sanitizeTagComponent(value: string): string {
  const compact = value
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return compact || 'unknown';
}

export function buildOpeneralSessionId(workspaceId?: string, now = new Date()): string {
  const prefix = sanitizeTagComponent(workspaceId ?? 'default');
  return `${prefix}-${now.toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
}

export function buildStringcostSessionContext(input: BuildStringcostContextInput): StringcostSessionContext {
  const sessionId = input.sessionId ?? buildOpeneralSessionId(input.workspaceId);
  const workspaceTag = sanitizeTagComponent(input.workspaceId ?? 'default');
  const projectTag = sanitizeTagComponent(input.projectSlug);
  const cacheTag = input.cacheReady ? 'cache:ready' : 'cache:review';
  const findingTag = input.findingCount === 0 ? 'findings:none' : 'findings:present';
  const promptTag = input.staticPromptTokens >= 4000 ? 'prompt:high' : input.staticPromptTokens >= 1800 ? 'prompt:review' : 'prompt:ok';

  return {
    sessionId,
    tags: [
      'openeral',
      'claude-code',
      'optimizer',
      `workspace:${workspaceTag}`,
      `project:${projectTag}`,
      `session:${sanitizeTagComponent(sessionId)}`,
      cacheTag,
      findingTag,
      promptTag,
    ],
    metadata: {
      source: 'openeral',
      product: 'claude-code',
      workspace_id: input.workspaceId ?? 'default',
      project_slug: input.projectSlug,
      session_id: sessionId,
      optimizer_enabled: true,
      static_prompt_tokens_estimate: input.staticPromptTokens,
      instruction_tokens_estimate: input.instructionTokens,
      memory_tokens_estimate: input.memoryTokens,
      finding_count: input.findingCount,
      finding_count_high: input.highSeverityCount,
      finding_count_medium: input.mediumSeverityCount,
      cache_ready: input.cacheReady,
    },
  };
}
