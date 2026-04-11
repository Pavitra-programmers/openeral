import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeClaudeOptimization } from './analyze.js';

const tempRoots: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('analyzeClaudeOptimization', () => {
  it('finds duplicated and volatile prompt surfaces', () => {
    const homeDir = makeTempDir('openeral-opt-home');
    const projectRoot = makeTempDir('openeral-opt-project');

    mkdirSync(join(projectRoot, '.claude', 'rules'), { recursive: true });
    mkdirSync(join(homeDir, '.claude', 'projects'), { recursive: true });

    const repeated = '- Always keep responses concise and targeted.';
    writeFileSync(join(projectRoot, 'CLAUDE.md'), [
      '# Project Rules',
      repeated,
      repeated,
      'Last updated 2026-04-11',
      'Use focused summaries before reopening large docs.',
    ].join('\n'));
    writeFileSync(join(projectRoot, '.claude', 'rules', 'workflow.md'), [
      '# Workflow',
      repeated,
      'Generated at 2026-04-11 12:00 UTC',
    ].join('\n'));
    writeFileSync(join(projectRoot, 'README.md'), 'A'.repeat(8000));

    const report = analyzeClaudeOptimization({
      homeDir,
      projectRoot,
      workspaceId: 'demo-workspace',
      sessionId: 'demo-session',
      stringcostEnabled: true,
    });

    expect(report.summary.staticPromptTokens).toBeGreaterThan(0);
    expect(report.summary.duplicateLineCount).toBeGreaterThan(0);
    expect(report.summary.volatileLineCount).toBeGreaterThan(0);
    expect(report.findings.some((finding) => finding.id === 'duplicate-instructions')).toBe(true);
    expect(report.findings.some((finding) => finding.id === 'cache-stability')).toBe(true);
    expect(report.hotFiles.some((file) => file.relPath === 'README.md')).toBe(true);
    expect(report.stringcost.session.tags).toContain('workspace:demo-workspace');
  });
});
