import { basename } from 'node:path';
import type { MemoryFileSpec, RankedMemoryChunk } from './types.js';

export type MemorySection = 'facts' | 'commands' | 'files' | 'pitfalls';

export interface MemoryDocumentTemplate {
  filename: string;
  name: string;
  description: string;
  type: string;
  sectionOrder?: MemorySection[];
  limits?: Partial<Record<MemorySection, number>>;
}

function trimSentence(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function summarizeChunk(chunk: RankedMemoryChunk): string {
  const lines = chunk.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== '---' && !line.startsWith('```') && !line.startsWith('#'));
  const summary = trimSentence(lines.slice(0, 2).join(' '));
  return summary || trimSentence(chunk.excerpt) || trimSentence(chunk.title);
}

function extractCommands(chunks: RankedMemoryChunk[]): string[] {
  const commands = new Set<string>();
  const matcher = /^(?:\$ )?(?:pnpm\b|npm\b|npx\b|node(?:\s|$)|docker\b|git\b|openshell\b|psql\b|claude(?:\s|$)|DATABASE_URL=|OPENERAL_)[^\r\n]*$/;

  for (const chunk of chunks) {
    for (const line of chunk.content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 180) continue;
      if (matcher.test(trimmed)) {
        commands.add(trimmed.replace(/^\$ /, ''));
      }
    }
  }

  return [...commands].slice(0, 8);
}

function limited(items: string[], limit = 4): string[] {
  return items.slice(0, limit);
}

function extractPitfalls(chunks: RankedMemoryChunk[]): string[] {
  const pitfalls = new Set<string>();
  const matcher = /\b(must|never|required|do not|don't|warning|fail|cannot|should not|always)\b/i;

  for (const chunk of chunks) {
    for (const rawLine of chunk.content.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/^[-*]\s*/, '');
      if (!line || line.length > 220) continue;
      if (line.startsWith('query:') || line.startsWith('type:')) continue;
      if (matcher.test(line)) {
        pitfalls.add(trimSentence(line));
      }
    }
  }

  return [...pitfalls].slice(0, 8);
}

function extractFiles(chunks: RankedMemoryChunk[]): string[] {
  const files = new Set<string>();
  for (const chunk of chunks) {
    files.add(chunk.relPath);
  }
  return [...files].slice(0, 8);
}

function extractFacts(chunks: RankedMemoryChunk[]): string[] {
  const facts = new Set<string>();
  for (const chunk of chunks) {
    const pathLabel = chunk.relPath || basename(chunk.absPath);
    const summary = summarizeChunk(chunk);
    if (!summary) continue;
    facts.add(`\`${pathLabel}\` — ${summary}`);
  }
  return [...facts].slice(0, 8);
}

function yamlValue(value: string): string {
  return JSON.stringify(value);
}

function section(title: string, items: string[], formatter?: (item: string) => string): string[] {
  if (items.length === 0) return [];
  const lines = [`## ${title}`];
  for (const item of items) {
    lines.push(formatter ? formatter(item) : `- ${item}`);
  }
  lines.push('');
  return lines;
}

export function slugifyQuery(query: string): string {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'query';
}

export function renderTopicFile(
  template: MemoryDocumentTemplate,
  chunks: RankedMemoryChunk[],
  opts?: { query?: string },
): MemoryFileSpec | undefined {
  const sectionOrder = template.sectionOrder ?? ['facts', 'commands', 'pitfalls'];
  const facts = limited(extractFacts(chunks), template.limits?.facts ?? 3);
  const commands = limited(extractCommands(chunks), template.limits?.commands ?? 4);
  const files = limited(extractFiles(chunks), template.limits?.files ?? 3);
  const pitfalls = limited(extractPitfalls(chunks), template.limits?.pitfalls ?? 4);

  if (facts.length === 0 && commands.length === 0 && files.length === 0 && pitfalls.length === 0) {
    if (!opts?.query) return undefined;
    facts.push(`No strong matches found yet for query: \`${opts.query}\`.`);
  }

  const body: string[] = [
    '---',
    `name: ${yamlValue(template.name)}`,
    `description: ${yamlValue(template.description)}`,
    `type: ${yamlValue(template.type)}`,
    '---',
    '',
  ];

  if (opts?.query) {
    body.push(`Query: \`${opts.query}\``, '');
  }

  for (const sectionName of sectionOrder) {
    if (sectionName === 'facts') {
      body.push(...section('Key Facts', facts));
    } else if (sectionName === 'commands') {
      body.push(...section('Commands', commands, (item) => `- \`${item}\``));
    } else if (sectionName === 'files') {
      body.push(...section('Files', files, (item) => `- \`${item}\``));
    } else if (sectionName === 'pitfalls') {
      body.push(...section('Pitfalls', pitfalls));
    }
  }

  return {
    name: template.filename,
    description: template.description,
    type: template.type,
    content: `${body.join('\n').trimEnd()}\n`,
  };
}

export function renderMemoryIndex(
  files: Array<Pick<MemoryFileSpec, 'name' | 'description'>>,
  opts?: { query?: string },
): string {
  const lines: string[] = [];

  if (opts?.query) {
    lines.push(`- Focus query: \`${opts.query}\``);
  } else {
    lines.push('- Curated memory index refreshed by OpenEral');
  }

  for (const file of files) {
    lines.push(`- [${file.name}](${file.name}) — ${file.description}`);
  }

  return `${lines.join('\n')}\n`;
}
