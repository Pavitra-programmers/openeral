import type { MemoryFileSpec, MemoryRefreshResult, MemorySourceKind, ProjectContext } from '../memory/types.js';

export type OptimizationSeverity = 'high' | 'medium' | 'low';
export type OptimizationCheckStatus = 'pass' | 'warn' | 'fail';

export interface OptimizationSurface {
  absPath: string;
  relPath: string;
  kind: MemorySourceKind;
  approxTokens: number;
  charCount: number;
  lineCount: number;
  duplicateLineCount: number;
  volatileLineCount: number;
}

export interface OptimizationCheck {
  id: string;
  title: string;
  status: OptimizationCheckStatus;
  detail: string;
}

export interface OptimizationFinding {
  id: string;
  severity: OptimizationSeverity;
  title: string;
  summary: string;
  recommendation: string;
  evidence: string[];
}

export interface OptimizationSummary {
  promptSurfaceCount: number;
  staticPromptTokens: number;
  instructionTokens: number;
  memoryTokens: number;
  promptFileCount: number;
  instructionFileCount: number;
  memoryFileCount: number;
  duplicateLineCount: number;
  volatileLineCount: number;
  cacheReady: boolean;
}

export interface StringcostSessionContext {
  sessionId: string;
  tags: string[];
  metadata: Record<string, string | number | boolean>;
}

export interface ClaudeOptimizationReport {
  generatedAt: string;
  context: ProjectContext;
  surfaces: OptimizationSurface[];
  checks: OptimizationCheck[];
  findings: OptimizationFinding[];
  summary: OptimizationSummary;
  hotFiles: OptimizationSurface[];
  duplicateExamples: string[];
  volatileExamples: string[];
  stringcost: {
    enabled: boolean;
    session: StringcostSessionContext;
  };
}

export interface AnalyzeClaudeOptimizationOptions {
  homeDir: string;
  cwd?: string;
  projectRoot?: string;
  now?: Date;
  workspaceId?: string;
  sessionId?: string;
  stringcostEnabled?: boolean;
}

export interface ApplyClaudeOptimizationOptions extends AnalyzeClaudeOptimizationOptions {
  dryRun?: boolean;
  backup?: boolean;
}

export interface ApplyClaudeOptimizationResult {
  report: ClaudeOptimizationReport;
  memory: MemoryRefreshResult;
  extraDocs: MemoryFileSpec[];
  reportPaths: {
    markdown: string;
    json: string;
  };
  writtenPaths: string[];
}
