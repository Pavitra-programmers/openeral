import { describe, expect, it } from 'vitest';
import { buildOpeneralSessionId, buildStringcostSessionContext } from './stringcost.js';

describe('Stringcost optimizer context', () => {
  it('builds stable Openeral session ids', () => {
    const sessionId = buildOpeneralSessionId('My Workspace', new Date('2026-04-11T12:34:56.000Z'));
    expect(sessionId).toBe('my-workspace-2026-04-11t12-34-56-000z');
  });

  it('attaches workspace, project, cache, and prompt tags', () => {
    const context = buildStringcostSessionContext({
      workspaceId: 'Team Alpha',
      projectSlug: '/tmp/demo/project',
      sessionId: 'custom-session',
      staticPromptTokens: 2450,
      instructionTokens: 1200,
      memoryTokens: 900,
      findingCount: 2,
      highSeverityCount: 1,
      mediumSeverityCount: 1,
      cacheReady: false,
    });

    expect(context.tags).toContain('workspace:team-alpha');
    expect(context.tags).toContain('project:tmp-demo-project');
    expect(context.tags).toContain('session:custom-session');
    expect(context.tags).toContain('cache:review');
    expect(context.tags).toContain('findings:present');
    expect(context.tags).toContain('prompt:review');
    expect(context.metadata.static_prompt_tokens_estimate).toBe(2450);
    expect(context.metadata.finding_count_high).toBe(1);
    expect(context.metadata.cache_ready).toBe(false);
  });
});
