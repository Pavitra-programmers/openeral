import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { refreshClaudeMemory } from '../memory/refresh.js';
import { analyzeClaudeOptimization } from './analyze.js';
import { renderOptimizationMemoryFile, renderOptimizationReport } from './render.js';
import type { ApplyClaudeOptimizationOptions, ApplyClaudeOptimizationResult } from './types.js';

function reportReplacer(_key: string, value: unknown): unknown {
  return value;
}

export async function applyClaudeOptimization(
  opts: ApplyClaudeOptimizationOptions,
): Promise<ApplyClaudeOptimizationResult> {
  const preApplyReport = analyzeClaudeOptimization(opts);
  const extraDocs = [renderOptimizationMemoryFile(preApplyReport)];
  const memory = await refreshClaudeMemory({
    homeDir: opts.homeDir,
    cwd: opts.cwd,
    projectRoot: opts.projectRoot,
    backup: opts.backup,
    dryRun: opts.dryRun,
    extraDocs,
  });

  const reportDir = join(opts.homeDir, '.openeral', 'optimizer');
  const reportPaths = {
    markdown: join(reportDir, 'latest.md'),
    json: join(reportDir, 'latest.json'),
  };
  const report = opts.dryRun ? preApplyReport : analyzeClaudeOptimization(opts);

  const writtenPaths = [
    ...memory.writtenFiles.map((name) => join(report.context.memoryDir, name)),
  ];

  if (!opts.dryRun) {
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(reportPaths.markdown, renderOptimizationReport(report));
    writeFileSync(reportPaths.json, JSON.stringify(report, reportReplacer, 2));
    writtenPaths.push(reportPaths.markdown, reportPaths.json);
  }

  return {
    report,
    memory,
    extraDocs,
    reportPaths,
    writtenPaths,
  };
}
