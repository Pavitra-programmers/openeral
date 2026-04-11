import type { MemoryFileSpec } from '../memory/types.js';
import type { ClaudeOptimizationReport, OptimizationFinding } from './types.js';

function severityPrefix(finding: OptimizationFinding): string {
  return finding.severity.toUpperCase();
}

function checklistIcon(status: ClaudeOptimizationReport['checks'][number]['status']): string {
  switch (status) {
    case 'pass': return '[pass]';
    case 'warn': return '[warn]';
    case 'fail': return '[fail]';
  }
}

export function renderOptimizationReport(report: ClaudeOptimizationReport): string {
  const lines: string[] = [
    '# Openeral Optimizer Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: \`${report.context.contentRoot}\``,
    `Claude memory: \`${report.context.memoryDir}\``,
    '',
    '## Summary',
    `- Static prompt surface: ~${report.summary.staticPromptTokens} tokens`,
    `- Instruction files: ${report.summary.instructionFileCount} (~${report.summary.instructionTokens} tokens)`,
    `- Memory files: ${report.summary.memoryFileCount} (~${report.summary.memoryTokens} tokens)`,
    `- Duplicate prompt lines: ${report.summary.duplicateLineCount}`,
    `- Volatile prompt lines: ${report.summary.volatileLineCount}`,
    `- Cache readiness: ${report.summary.cacheReady ? 'ready' : 'needs review'}`,
    '',
    '## Checklist',
  ];

  for (const check of report.checks) {
    lines.push(`- ${checklistIcon(check.status)} ${check.title}: ${check.detail}`);
  }

  lines.push('', '## Findings');
  if (report.findings.length === 0) {
    lines.push('- No major optimization findings. The current prompt surface already looks compact and cache-friendly.');
  } else {
    for (const finding of report.findings) {
      lines.push(`- ${severityPrefix(finding)} ${finding.title}: ${finding.summary}`);
      lines.push(`  Recommendation: ${finding.recommendation}`);
      if (finding.evidence.length > 0) {
        lines.push(`  Evidence: ${finding.evidence.join('; ')}`);
      }
    }
  }

  if (report.hotFiles.length > 0) {
    lines.push('', '## Read Hotspots');
    for (const file of report.hotFiles) {
      lines.push(`- \`${file.relPath}\` (~${file.approxTokens} tokens)`);
    }
  }

  lines.push(
    '',
    '## Stringcost Session',
    `- Session ID: \`${report.stringcost.session.sessionId}\``,
    `- Tags: ${report.stringcost.session.tags.map((tag) => `\`${tag}\``).join(', ')}`,
  );

  return `${lines.join('\n')}\n`;
}

export function renderOptimizationMemoryFile(report: ClaudeOptimizationReport): MemoryFileSpec {
  const lines: string[] = [
    '---',
    'name: "Cost efficiency"',
    'description: "Stringcost-backed prompt, caching, and batching guidance for this Claude project"',
    'type: "optimization"',
    '---',
    '',
    '## Snapshot',
    `- Static prompt surface: ~${report.summary.staticPromptTokens} tokens`,
    `- Instruction files: ${report.summary.instructionFileCount} (~${report.summary.instructionTokens} tokens)`,
    `- Memory files: ${report.summary.memoryFileCount} (~${report.summary.memoryTokens} tokens)`,
    `- Duplicate prompt lines: ${report.summary.duplicateLineCount}`,
    `- Cache readiness: ${report.summary.cacheReady ? 'ready' : 'needs review'}`,
    '',
    '## What to Fix',
  ];

  if (report.findings.length === 0) {
    lines.push('- Keep the current CLAUDE memory compact. Prefer targeted reads, grouped shell commands, and concise answers.');
  } else {
    for (const finding of report.findings.slice(0, 6)) {
      lines.push(`- ${finding.title}: ${finding.recommendation}`);
    }
  }

  if (report.hotFiles.length > 0) {
    lines.push('', '## Hotspots');
    for (const file of report.hotFiles.slice(0, 5)) {
      lines.push(`- \`${file.relPath}\` (~${file.approxTokens} tokens)`);
    }
  }

  lines.push(
    '',
    '## Stringcost',
    `- Session tags: ${report.stringcost.session.tags.map((tag) => `\`${tag}\``).join(', ')}`,
    '- Prefer stable instructions, curated memory, and grouped file reads so Stringcost-tracked Claude sessions stay efficient.',
    '',
  );

  return {
    name: 'cost-efficiency.md',
    description: 'Stringcost-backed prompt, caching, and batching guidance for this Claude project',
    type: 'optimization',
    content: `${lines.join('\n').trimEnd()}\n`,
  };
}
