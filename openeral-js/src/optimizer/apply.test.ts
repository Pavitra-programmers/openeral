import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveProjectContext } from '../memory/resolve.js';
import { applyClaudeOptimization } from './apply.js';

const tempRoots: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe('applyClaudeOptimization', () => {
  it('writes optimizer reports and a cost-efficiency memory file', async () => {
    const homeDir = makeTempDir('openeral-apply-home');
    const projectRoot = makeTempDir('openeral-apply-project');

    writeFileSync(join(projectRoot, 'CLAUDE.md'), [
      '# Project Rules',
      '- Always use focused reads.',
      '- Always use focused reads.',
      'Last updated 2026-04-11',
    ].join('\n'));
    writeFileSync(join(projectRoot, 'README.md'), [
      '# Demo',
      '',
      'Use pnpm install and pnpm check for verification.',
      '',
      'This README is intentionally long enough to create a hotspot.',
      'B'.repeat(6000),
    ].join('\n'));

    const result = await applyClaudeOptimization({
      homeDir,
      projectRoot,
      workspaceId: 'workspace-apply',
      sessionId: 'session-apply',
      stringcostEnabled: true,
    });
    const second = await applyClaudeOptimization({
      homeDir,
      projectRoot,
      workspaceId: 'workspace-apply',
      sessionId: 'session-apply-2',
      stringcostEnabled: true,
    });

    const context = resolveProjectContext({ homeDir, projectRoot });
    const memoryIndexPath = join(context.memoryDir, 'MEMORY.md');
    const costPath = join(context.memoryDir, 'cost-efficiency.md');

    expect(existsSync(memoryIndexPath)).toBe(true);
    expect(existsSync(costPath)).toBe(true);
    expect(existsSync(result.reportPaths.markdown)).toBe(true);
    expect(existsSync(result.reportPaths.json)).toBe(true);
    expect(result.report.summary.memoryFileCount).toBeGreaterThan(0);
    expect(result.report.summary.memoryTokens).toBeLessThan(2200);
    expect(second.report.summary.memoryTokens).toBeLessThanOrEqual(result.report.summary.memoryTokens + 50);
    expect(second.report.summary.duplicateLineCount).toBeLessThanOrEqual(result.report.summary.duplicateLineCount + 2);
    expect(readFileSync(costPath, 'utf8')).toContain('## Stringcost');
    expect(readFileSync(result.reportPaths.markdown, 'utf8')).toContain('## Findings');
    expect(readFileSync(result.reportPaths.markdown, 'utf8')).toContain('Memory files:');
    expect(readFileSync(memoryIndexPath, 'utf8')).toContain('cost-efficiency.md');
  });
});
