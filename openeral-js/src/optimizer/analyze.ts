import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { collectMemorySourceFiles } from '../memory/collect.js';
import { resolveProjectContext } from '../memory/resolve.js';
import type { MemorySourceFile } from '../memory/types.js';
import { buildStringcostSessionContext } from '../stringcost.js';
import type {
  AnalyzeClaudeOptimizationOptions,
  ClaudeOptimizationReport,
  OptimizationCheck,
  OptimizationCheckStatus,
  OptimizationFinding,
  OptimizationSeverity,
  OptimizationSurface,
} from './types.js';

const VOLATILE_LINE_RE = /\b(last updated|updated at|generated(?: at)?|timestamp|today|yesterday|current date|date:|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})\b/i;
const DUPLICATE_MIN_LENGTH = 18;
const HOT_FILE_TOKEN_THRESHOLD = 1200;

interface LineSample {
  normalized: string;
  raw: string;
  location: string;
}

function approxTokens(text: string): number {
  const compact = text.trim();
  if (!compact) return 0;
  return Math.max(1, Math.ceil(compact.length / 4));
}

function normalizeComparableLine(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function collectComparableLines(source: MemorySourceFile): LineSample[] {
  const samples: LineSample[] = [];
  const lines = source.content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw || raw.startsWith('```')) continue;
    const normalized = normalizeComparableLine(raw);
    if (normalized.length < DUPLICATE_MIN_LENGTH || normalized.length > 220) continue;
    samples.push({
      normalized,
      raw,
      location: `${source.relPath}:${i + 1}`,
    });
  }

  return samples;
}

function statusFromThresholds(value: number, warnAt: number, failAt: number): OptimizationCheckStatus {
  if (value >= failAt) return 'fail';
  if (value >= warnAt) return 'warn';
  return 'pass';
}

function findingSeverity(status: OptimizationCheckStatus): OptimizationSeverity {
  return status === 'fail' ? 'high' : status === 'warn' ? 'medium' : 'low';
}

export function analyzeClaudeOptimization(opts: AnalyzeClaudeOptimizationOptions): ClaudeOptimizationReport {
  const now = opts.now ?? new Date();
  const context = resolveProjectContext({
    homeDir: opts.homeDir,
    cwd: opts.cwd,
    projectRoot: opts.projectRoot,
  });

  const sources = collectMemorySourceFiles(context);
  const homeClaudePath = join(context.homeDir, 'CLAUDE.md');
  if (existsSync(homeClaudePath)) {
    const content = readFileSync(homeClaudePath, 'utf8');
    sources.push({
      absPath: homeClaudePath,
      relPath: 'home/CLAUDE.md',
      kind: 'instruction',
      content,
      mtimeMs: now.getTime(),
    });
  }

  const promptSources = sources.filter((source) => source.kind === 'instruction' || source.kind === 'memory');
  const lineSamples = promptSources.flatMap(collectComparableLines);
  const duplicateMap = new Map<string, LineSample[]>();

  for (const sample of lineSamples) {
    const bucket = duplicateMap.get(sample.normalized) ?? [];
    bucket.push(sample);
    duplicateMap.set(sample.normalized, bucket);
  }

  const duplicateEntries = [...duplicateMap.values()]
    .filter((entries) => entries.length > 1)
    .sort((a, b) => b.length - a.length || a[0]!.location.localeCompare(b[0]!.location));

  const duplicateLineCount = duplicateEntries.reduce((sum, entries) => sum + entries.length - 1, 0);
  const duplicateExamples = duplicateEntries.slice(0, 5).map((entries) => {
    const preview = entries[0]!.raw.replace(/\s+/g, ' ').slice(0, 120);
    const locations = entries.slice(0, 3).map((entry) => entry.location).join(', ');
    return `${preview} (${entries.length} copies: ${locations})`;
  });

  const volatileExamples: string[] = [];
  const volatileCounts = new Map<string, number>();

  for (const source of promptSources) {
    let count = 0;
    const lines = source.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;
      if (!VOLATILE_LINE_RE.test(line)) continue;
      count++;
      if (volatileExamples.length < 5) {
        volatileExamples.push(`${source.relPath}:${i + 1} ${line.slice(0, 120)}`);
      }
    }
    volatileCounts.set(source.absPath, count);
  }

  const duplicateCountByFile = new Map<string, number>();
  for (const entries of duplicateEntries) {
    for (const sample of entries) {
      const [relPath] = sample.location.split(':', 1);
      duplicateCountByFile.set(relPath, (duplicateCountByFile.get(relPath) ?? 0) + 1);
    }
  }

  const surfaces: OptimizationSurface[] = sources.map((source) => {
    const relDuplicateCount = duplicateCountByFile.get(source.relPath) ?? 0;
    const volatileLineCount = volatileCounts.get(source.absPath) ?? 0;
    return {
      absPath: source.absPath,
      relPath: source.relPath,
      kind: source.kind,
      approxTokens: approxTokens(source.content),
      charCount: source.content.length,
      lineCount: source.content.split(/\r?\n/).length,
      duplicateLineCount: relDuplicateCount,
      volatileLineCount,
    };
  }).sort((a, b) => b.approxTokens - a.approxTokens || a.relPath.localeCompare(b.relPath));

  const promptSurfaces = surfaces.filter((surface) => surface.kind === 'instruction' || surface.kind === 'memory');
  const instructionSurfaces = promptSurfaces.filter((surface) => surface.kind === 'instruction');
  const memorySurfaces = promptSurfaces.filter((surface) => surface.kind === 'memory');
  const hotFiles = surfaces
    .filter((surface) => surface.kind !== 'instruction' && surface.kind !== 'memory' && surface.approxTokens >= HOT_FILE_TOKEN_THRESHOLD)
    .slice(0, 5);

  const staticPromptTokens = promptSurfaces.reduce((sum, surface) => sum + surface.approxTokens, 0);
  const instructionTokens = instructionSurfaces.reduce((sum, surface) => sum + surface.approxTokens, 0);
  const memoryTokens = memorySurfaces.reduce((sum, surface) => sum + surface.approxTokens, 0);

  const promptBudgetStatus = statusFromThresholds(staticPromptTokens, 1800, 4000);
  const memoryBudgetStatus = statusFromThresholds(memoryTokens, 900, 2200);
  const duplicateStatus = statusFromThresholds(duplicateLineCount, 2, 8);
  const volatileStatus = statusFromThresholds(volatileExamples.length, 1, 4);
  const hotspotStatus = hotFiles.length > 0 ? 'warn' : 'pass';
  const hasMemoryIndex = memorySurfaces.some((surface) => surface.relPath === 'memory/MEMORY.md');
  const memoryIndexStatus: OptimizationCheckStatus = hasMemoryIndex ? 'pass' : 'warn';
  const stringcostStatus: OptimizationCheckStatus = opts.stringcostEnabled ? 'pass' : 'warn';

  const checks: OptimizationCheck[] = [
    {
      id: 'stringcost-routing',
      title: 'Stringcost routing',
      status: stringcostStatus,
      detail: opts.stringcostEnabled
        ? 'Claude traffic can be segmented in Stringcost by workspace, project, and session.'
        : 'Set STRINGCOST_API_KEY so Openeral can route Claude through Stringcost and attach optimizer metadata.',
    },
    {
      id: 'static-prompt-budget',
      title: 'Static prompt budget',
      status: promptBudgetStatus,
      detail: `Prompt surfaces add up to ~${staticPromptTokens} tokens across ${promptSurfaces.length} files.`,
    },
    {
      id: 'memory-budget',
      title: 'Memory budget',
      status: memoryBudgetStatus,
      detail: `Claude memory contributes ~${memoryTokens} tokens across ${memorySurfaces.length} files.`,
    },
    {
      id: 'duplicate-instructions',
      title: 'Duplicate instructions',
      status: duplicateStatus,
      detail: duplicateLineCount === 0
        ? 'No repeated high-signal instruction lines detected across CLAUDE memory surfaces.'
        : `${duplicateLineCount} repeated prompt lines were detected across instruction and memory files.`,
    },
    {
      id: 'cache-stability',
      title: 'Cache stability',
      status: volatileStatus,
      detail: volatileExamples.length === 0
        ? 'Prompt surfaces look stable enough for cache-friendly reuse.'
        : `${volatileExamples.length} prompt lines include volatile timestamps or time-sensitive wording.`,
    },
    {
      id: 'memory-index',
      title: 'Curated memory index',
      status: memoryIndexStatus,
      detail: hasMemoryIndex
        ? 'A MEMORY.md index already exists in the Claude project memory directory.'
        : 'No MEMORY.md index was found for the Claude project memory directory yet.',
    },
    {
      id: 'read-hotspots',
      title: 'Read hotspots',
      status: hotspotStatus,
      detail: hotFiles.length === 0
        ? 'No oversized documentation/config hotspots stood out.'
        : `${hotFiles.length} large docs/config files are likely to be reread unless they are compacted into memory.`,
    },
  ];

  const findings: OptimizationFinding[] = [];

  if (!opts.stringcostEnabled) {
    findings.push({
      id: 'stringcost-disabled',
      severity: 'medium',
      title: 'Stringcost routing is disabled',
      summary: 'This workspace is not currently attaching optimizer metadata to Stringcost because STRINGCOST_API_KEY is missing.',
      recommendation: 'Set STRINGCOST_API_KEY so every Claude session routes through the existing Stringcost integration with workspace/project/session tags.',
      evidence: ['No STRINGCOST_API_KEY was provided at analysis time.'],
    });
  }

  if (promptBudgetStatus !== 'pass') {
    findings.push({
      id: 'static-prompt-budget',
      severity: findingSeverity(promptBudgetStatus),
      title: 'Static Claude prompt surface is larger than it should be',
      summary: `Instruction and memory files currently contribute about ${staticPromptTokens} tokens before the session does any real work.`,
      recommendation: 'Trim long instruction files, move detail into on-demand docs, and regenerate curated Claude memory so the always-loaded context stays compact.',
      evidence: promptSurfaces.slice(0, 5).map((surface) => `${surface.relPath} (~${surface.approxTokens} tokens)`),
    });
  }

  if (memoryBudgetStatus !== 'pass') {
    findings.push({
      id: 'memory-budget',
      severity: findingSeverity(memoryBudgetStatus),
      title: 'Claude memory is doing too much of the lifting',
      summary: `Persisted Claude memory currently accounts for about ${memoryTokens} tokens across ${memorySurfaces.length} files.`,
      recommendation: 'Keep only the highest-signal memory files, prefer summaries over raw docs, and let Openeral rewrite the memory directory with curated optimization notes.',
      evidence: memorySurfaces.slice(0, 5).map((surface) => `${surface.relPath} (~${surface.approxTokens} tokens)`),
    });
  }

  if (duplicateStatus !== 'pass') {
    findings.push({
      id: 'duplicate-instructions',
      severity: findingSeverity(duplicateStatus),
      title: 'Prompt instructions are duplicated across files',
      summary: `${duplicateLineCount} repeated lines were found across CLAUDE-facing instructions and memory files, which wastes tokens and hurts cache efficiency.`,
      recommendation: 'Deduplicate repeated rules so Claude sees each instruction once, then reference the concise source from memory instead of repeating it.',
      evidence: duplicateExamples,
    });
  }

  if (volatileStatus !== 'pass') {
    findings.push({
      id: 'cache-stability',
      severity: findingSeverity(volatileStatus),
      title: 'Time-sensitive text is weakening cache reuse',
      summary: 'Claude-facing prompt files contain volatile timestamps or relative-time wording that make stable prompt prefixes harder to reuse.',
      recommendation: 'Move timestamps and rolling status into normal project docs, and keep CLAUDE.md plus memory files stable so caching has a better chance to stick.',
      evidence: volatileExamples,
    });
  }

  if (!hasMemoryIndex) {
    findings.push({
      id: 'missing-memory-index',
      severity: 'low',
      title: 'Claude memory has not been compacted yet',
      summary: 'No curated MEMORY.md index was found for this Claude project, so Claude is more likely to reread large project files directly.',
      recommendation: 'Run the Openeral optimizer apply flow to regenerate the Claude project memory directory with a fresh index and cost-efficiency notes.',
      evidence: [relative(context.homeDir, context.memoryDir) || '.claude/projects/<project>/memory'],
    });
  }

  if (hotFiles.length > 0) {
    findings.push({
      id: 'read-hotspots',
      severity: hotFiles.some((surface) => surface.approxTokens >= 2200) ? 'medium' : 'low',
      title: 'A few large docs are likely token hotspots',
      summary: 'Several large docs or config files are likely to be reread during sessions unless they are summarized into memory first.',
      recommendation: 'Use curated memory files and focused summaries so Claude can answer common workflow questions without reopening the full source documents each time.',
      evidence: hotFiles.map((surface) => `${surface.relPath} (~${surface.approxTokens} tokens)`),
    });
  }

  findings.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title);
  });

  const highSeverityCount = findings.filter((finding) => finding.severity === 'high').length;
  const mediumSeverityCount = findings.filter((finding) => finding.severity === 'medium').length;
  const cacheReady = promptBudgetStatus === 'pass' && duplicateStatus === 'pass' && volatileStatus === 'pass';

  return {
    generatedAt: now.toISOString(),
    context,
    surfaces,
    checks,
    findings,
    summary: {
      promptSurfaceCount: promptSurfaces.length,
      staticPromptTokens,
      instructionTokens,
      memoryTokens,
      promptFileCount: promptSurfaces.length,
      instructionFileCount: instructionSurfaces.length,
      memoryFileCount: memorySurfaces.length,
      duplicateLineCount,
      volatileLineCount: volatileExamples.length,
      cacheReady,
    },
    hotFiles,
    duplicateExamples,
    volatileExamples,
    stringcost: {
      enabled: !!opts.stringcostEnabled,
      session: buildStringcostSessionContext({
        workspaceId: opts.workspaceId,
        projectSlug: context.projectSlug,
        sessionId: opts.sessionId,
        staticPromptTokens,
        instructionTokens,
        memoryTokens,
        findingCount: findings.length,
        highSeverityCount,
        mediumSeverityCount,
        cacheReady,
      }),
    },
  };
}
