#!/usr/bin/env node

/**
 * openeral CLI — run Claude Code inside an OpenShell sandbox.
 *
 * `npx openeral` launches an OpenShell sandbox from the openeral image.
 * Inside the sandbox, openeral-init runs migrations, seeds/hydrates the
 * workspace, then Claude starts through a wrapper that lazily starts the daemon.
 *
 * Usage:
 *   npx openeral                      # interactive Claude Code (published image)
 *   npx openeral --dev                # interactive Claude Code (local dev image)
 *   npx openeral -d                   # same as --dev (short flag)
 *   npx openeral -- -p 'hello'        # non-interactive
 *   npx openeral --workspace myid     # custom workspace ID
 *   npx openeral optimize stats       # show optimization stats
 *
 * Auth:
 *   OpenShell providers inject credential placeholders into each sandbox
 *   process. StringCost presigns are created inside the sandbox so raw keys
 *   remain inside OpenShell's credential boundary.
 *
 * Optional env:
 *   DATABASE_URL            Required by the FUSE dev runtime; optional in compatibility mode
 *   OPENERAL_WORKSPACE_ID   Workspace ID (default: openeral-claude, normalized to lowercase)
 *   OPENERAL_SANDBOX_IMAGE  Override sandbox image (default: ghcr.io/sandys/openeral/sandbox:just-bash)
 *   OPENERAL_DEV_IMAGE      Override the Dockerfile/image used with --dev
 *   OPENSHELL_BIN            OpenShell CLI path (use the vendored build for FUSE)
 *   OPENSHELL_GATEWAY_ENDPOINT  Direct patched gateway endpoint
 *
 * Requires OpenShell >= 0.0.59 and a configured, reachable gateway.
 */

import { spawn, spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dbUrlFileForMarker,
  dataDirForMarker,
  initMarkerMatches,
  stateDirForMarker,
  workspaceIdForMarker,
  writeInitMarker,
} from './init-marker.js';

const OPENSHELL_BIN = process.env.OPENSHELL_BIN?.trim() || 'openshell';
const OPENSHELL_GLOBAL_ARGS = process.env.OPENSHELL_GATEWAY_ENDPOINT?.trim()
  ? ['--gateway-endpoint', process.env.OPENSHELL_GATEWAY_ENDPOINT.trim()]
  : [];

function openShellArgs(args: string[]): string[] {
  return [...OPENSHELL_GLOBAL_ARGS, ...args];
}

// ---------------------------------------------------------------------------
// Presign persistence — store one permanent presign in ~/.config/openeral/
// ---------------------------------------------------------------------------

interface StoredPresign {
  /** Full URL as returned by StringCost (e.g. .../t/{JWT}/v1/messages) */
  url: string;
  createdAt: string;
  /** StringCost API key stored so skill downloads work without the env var */
  stringcostApiKey?: string;
}

function getPresignConfigPath(): string {
  return join(homedir(), '.config', 'openeral', 'presign.json');
}

function loadStoredPresign(): StoredPresign | null {
  const path = getPresignConfigPath();
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as StoredPresign;
    if (data?.url) return data;
    return null;
  } catch {
    return null;
  }
}

function saveStoredPresign(url: string, apiKey?: string): void {
  const configDir = join(homedir(), '.config', 'openeral');
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  const presignPath = getPresignConfigPath();
  const data: StoredPresign = { url, createdAt: new Date().toISOString() };
  if (apiKey) data.stringcostApiKey = apiKey;
  writeFileSync(presignPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  // Ensure restrictive permissions (covers cases where mode is ignored)
  try {
    chmodSync(presignPath, 0o600);
  } catch {
    // Ignore chmod errors on platforms that don't support it
  }
}

function stringCostProxyBaseUrl(presignUrl: string): string {
  const url = new URL(presignUrl.trim());
  url.pathname = url.pathname.replace(/\/v1\/.*$/, '');
  url.search = '';
  url.hash = '';
  const normalized = url.toString().replace(/\/$/, '');
  if (!/^https:\/\/proxy\.stringcost\.com\/stringcost-proxy\/t\/[^/]+$/.test(normalized)) {
    throw new Error('Unexpected StringCost presign URL shape');
  }
  return normalized;
}

/**
 * Create a new StringCost presign: never expires, unlimited uses, $10 cost cap.
 * Returns the full presign URL as returned by StringCost.
 */
async function createPresignUrl(anthropicKey: string, stringcostKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch('https://app.stringcost.com/v1/presign', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stringcostKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'anthropic',
        client_api_key: anthropicKey,
        path: ['/v1/messages'],
        expires_in: -1,
        max_uses: -1,
        cost_limit: 10000000, // $10 in micro-dollars
        tags: ['openeral'],
        metadata: { source: 'openeral' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`StringCost presign failed (${response.status}): ${text}`);
    }

    const data = await response.json() as { url: string };
    if (!data?.url) throw new Error('StringCost presign returned no URL');
    return data.url;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('StringCost presign request timed out after 30 seconds');
    }
    throw err;
  }
}


type ParsedArgs = 
  | { kind: 'launch'; workspaceId: string; claudeArgs: string[] }
  | { kind: 'memory-refresh'; workspaceId: string; projectRoot: string; query: string; dryRun: boolean; backup: boolean }
  | { kind: 'help' };

export function parseCliArgs(args: string[]): ParsedArgs {
  // Check for help
  if (args.includes('--help') || args.includes('-h')) {
    const dashIdx = args.indexOf('--');
    const helpIdx = Math.max(args.indexOf('--help'), args.indexOf('-h'));
    if (dashIdx === -1 || helpIdx < dashIdx) {
      return { kind: 'help' };
    }
  }

  // Check for memory refresh command
  if (args[0] === 'memory' && args[1] === 'refresh') {
    let workspaceId = process.env.OPENERAL_WORKSPACE_ID || 'openeral-claude';
    let projectRoot = '';
    let query = '';
    let dryRun = false;
    let backup = true;

    for (let i = 2; i < args.length; i++) {
      if ((args[i] === '--workspace' || args[i] === '-w') && args[i + 1]) {
        workspaceId = args[++i];
      } else if (args[i] === '--project-root' && args[i + 1]) {
        projectRoot = args[++i];
      } else if (args[i] === '--query' && args[i + 1]) {
        query = args[++i];
      } else if (args[i] === '--dry-run') {
        dryRun = true;
      } else if (args[i] === '--no-backup') {
        backup = false;
      }
    }

    // Normalize workspace ID to be Kubernetes-compliant
    const originalId = workspaceId;
    workspaceId = workspaceId.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
    
    // Prevent empty workspace ID
    if (workspaceId.length === 0) {
      workspaceId = 'openeral-claude';
      process.stderr.write(`\x1b[33mwarning: workspace ID "${originalId}" normalized to empty string, using default: ${workspaceId}\x1b[0m\n`);
    }

    return { kind: 'memory-refresh', workspaceId, projectRoot, query, dryRun, backup };
  }

  // Default: launch mode
  let workspaceId = process.env.OPENERAL_WORKSPACE_ID || 'openeral-claude';
  let claudeArgs: string[] = [];

  const dashIdx = args.indexOf('--');
  const ownArgs = dashIdx >= 0 ? args.slice(0, dashIdx) : args;
  claudeArgs = dashIdx >= 0 ? args.slice(dashIdx + 1) : [];

  for (let i = 0; i < ownArgs.length; i++) {
    if ((ownArgs[i] === '--workspace' || ownArgs[i] === '-w') && ownArgs[i + 1]) {
      workspaceId = ownArgs[++i];
    }
  }

  // Normalize workspace ID to be Kubernetes-compliant (lowercase, alphanumeric + hyphens)
  const originalId = workspaceId;
  workspaceId = workspaceId.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  
  // Prevent empty workspace ID
  if (workspaceId.length === 0) {
    workspaceId = 'openeral-claude';
    process.stderr.write(`\x1b[33mwarning: workspace ID "${originalId}" normalized to empty string, using default: ${workspaceId}\x1b[0m\n`);
  }

  return { kind: 'launch', workspaceId, claudeArgs };
}

function printHelp(): void {
  console.log(`Usage:
  openeral [options] [-- claude-args]    Launch Claude Code (published image)
  openeral --dev [options] [-- args]     Launch Claude Code (local dev image)
  openeral presign                        Show the current StringCost presign
  openeral presign renew                  Create and store a new StringCost presign
  openeral init [--ensure]                Initialize or verify sandbox state
  openeral init --check-marker            Internal: exit 0 if sandbox init marker is current
  openeral init --write-marker            Internal: write the current sandbox init marker
  openeral stats [options]                Show API usage statistics
  openeral analyze [options]              Analyze session history and suggest optimizations
  openeral apply [options]                Apply optimization suggestions to project files
  openeral memory refresh [options]       Refresh memory system

Launch Options:
  --workspace, -w <id>    Workspace ID (default: openeral-claude)
  --dev, -d               Use local dev image instead of published image
  --help, -h              Show this help

Stats / Analyze / Apply Options:
  --workspace, -w <id>    Workspace ID (default: hostname)
  --days <n>              Number of days to look back (default: 7)
  --project-root <p>      Project root directory (analyze/apply only)
  --dry-run               Preview changes without applying (apply only)
  --proposal <id>         Apply a specific proposal by ID (apply only)
  --json                  Output as JSON (analyze only)

Memory Refresh Options:
  --workspace, -w <id>    Workspace ID
  --project-root <path>   Project root directory
  --query <text>          Search query
  --dry-run               Preview changes without applying
  --no-backup             Skip backup creation

Auth:
  ANTHROPIC_API_KEY is resolved through the OpenShell Claude provider.
  If STRINGCOST_API_KEY is set, OpenShell also resolves it and creates the
  StringCost presign inside the sandbox. Raw provider keys are not uploaded.

Optional env:
  DATABASE_URL             Required by --dev FUSE; optional for the compatibility image
  OPENERAL_WORKSPACE_ID    Default workspace ID (will be normalized to lowercase)
  OPENERAL_SANDBOX_IMAGE   Override prod sandbox image (default: ghcr.io/sandys/openeral/sandbox:just-bash)
  OPENERAL_DEV_IMAGE       Override the Dockerfile/image used with --dev/-d
  OPENSHELL_BIN             OpenShell CLI path (vendored patched build for FUSE)
  OPENSHELL_GATEWAY_ENDPOINT  Direct gateway endpoint

Features:
  - OpenShell-managed credentials and default-deny network policy
  - OpenShell-owned /sandbox home; no host filesystem injection
  - Full PostgreSQL-backed FUSE workspace in --dev mode
  - Scoped PostgreSQL/PGlite persistence in the published compatibility image
  - API usage statistics and optimization suggestions

Notes:
  - Presign stored in ~/.config/openeral/presign.json (mode 600, expires_in=-1, max_uses=-1, cost_limit=$10)
  - Workspace IDs are automatically normalized to be Kubernetes-compliant
  - OpenShell >= 0.0.59 and a selected gateway are required
  - Claude CLI comes from the OpenShell Community base image
  - Existing sandboxes with the same name will be cleaned up automatically
`);
}

// ---------------------------------------------------------------------------
// StringCost org skills
// ---------------------------------------------------------------------------

/**
 * Fetch the org skills bundle from StringCost and return only the validated entries.
 *
 * Handles timeout, HTTP errors, and slug validation.
 * Slugs are validated against `[a-z0-9][a-z0-9-]*` to prevent path traversal.
 *
 * Throws on network/HTTP failure — callers decide whether to propagate or warn.
 */
export async function fetchOrgSkills(apiKey: string): Promise<Array<{ slug: string; content: string }>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch('https://app.stringcost.com/v2/skills/bundle', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { skills: Array<{ slug: string; content: string }> };

  return (data.skills ?? []).filter(s => /^[a-z0-9][a-z0-9-]*$/.test(s.slug));
}

/**
 * Download org skills from StringCost and write them into `homeDir/.claude/skills/`.
 *
 * Each skill is a directory named by its slug with a `SKILL.md` file inside.
 *
 * Returns the number of skills written.
 */
export async function downloadOrgSkills(homeDir: string, apiKey: string): Promise<number> {
  const skills = await fetchOrgSkills(apiKey);

  const skillsDir = join(homeDir, '.claude', 'skills');
  mkdirSync(skillsDir, { recursive: true });

  for (const skill of skills) {
    const skillDir = join(skillsDir, skill.slug);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), skill.content);
  }

  return skills.length;
}

function refreshClaudeProxySettings(): void {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (!baseUrl) return;

  const home = process.env.OPENERAL_HOME || process.env.HOME || '/sandbox';
  const settingsPath = join(home, '.claude', 'settings.json');
  mkdirSync(dirname(settingsPath), { recursive: true });

  let settings: Record<string, any> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, any>;
    } catch {
      settings = {};
    }
  }
  settings.env = settings.env && typeof settings.env === 'object' ? settings.env : {};
  settings.env.ANTHROPIC_BASE_URL = baseUrl;
  delete settings.env.ANTHROPIC_API_KEY;
  delete settings.env.ANTHROPIC_AUTH_TOKEN;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

async function cmdInit(args: string[]): Promise<void> {
  if (args.includes('--check-marker')) {
    process.exit(initMarkerMatches() ? 0 : 1);
  }

  if (args.includes('--write-marker')) {
    writeInitMarker();
    return;
  }

  const ensure = args.includes('--ensure');
  if (ensure && initMarkerMatches()) {
    refreshClaudeProxySettings();
    process.stderr.write('\x1b[2mopeneral: init already complete\x1b[0m\n');
    return;
  }

  const setupPath = '/opt/openeral/setup.sh';
  if (!existsSync(setupPath)) {
    if (ensure) {
      throw new Error(`init marker is missing or stale, and ${setupPath} is not available`);
    }
    throw new Error(`${setupPath} is required for in-sandbox init`);
  }

  const result = spawnSync(setupPath, [], {
    stdio: 'inherit',
    env: {
      ...process.env,
      HOME: process.env.HOME || '/sandbox',
      OPENERAL_HOME: process.env.OPENERAL_HOME || '/sandbox',
      OPENERAL_STATE_DIR: stateDirForMarker(),
      OPENERAL_DATA_DIR: dataDirForMarker(),
      OPENERAL_DB_URL_FILE: dbUrlFileForMarker(),
      WORKSPACE_ID: workspaceIdForMarker(),
    },
  });

  if (result.error) throw result.error;
  const status = result.status ?? 1;
  if (status !== 0) process.exit(status);
}

// ---------------------------------------------------------------------------
// OpenShell sandbox launch
// ---------------------------------------------------------------------------

const MIN_OPENSHELL_VERSION = [0, 0, 59] as const;

function parseOpenShellVersion(output: string): [number, number, number] | null {
  const match = output.match(/(?:^|\s)v?(\d+)\.(\d+)\.(\d+)(?:\s|$)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function versionAtLeast(
  actual: readonly number[],
  minimum: readonly number[],
): boolean {
  for (let i = 0; i < Math.max(actual.length, minimum.length); i++) {
    const current = actual[i] ?? 0;
    const required = minimum[i] ?? 0;
    if (current !== required) return current > required;
  }
  return true;
}

function requireCurrentOpenShell(requireFuse = false): void {
  const versionResult = spawnSync(OPENSHELL_BIN, ['--version'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (versionResult.error) {
    const code = (versionResult.error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(
        `OpenShell is not installed or executable at ${OPENSHELL_BIN}. Install OpenShell first: https://docs.nvidia.com/openshell/latest`,
      );
    }
    throw versionResult.error;
  }
  if (versionResult.status !== 0) {
    throw new Error('openshell --version failed');
  }

  const versionText = `${versionResult.stdout ?? ''} ${versionResult.stderr ?? ''}`;
  const version = parseOpenShellVersion(versionText);
  if ((!version || !versionAtLeast(version, MIN_OPENSHELL_VERSION)) && !requireFuse) {
    throw new Error(
      `OpenShell >= ${MIN_OPENSHELL_VERSION.join('.')} is required; found ${versionText.trim() || 'an unknown version'}`,
    );
  }

  const gateway = spawnSync(OPENSHELL_BIN, openShellArgs(['gateway', 'info']), {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 15_000,
  });
  if (gateway.error || gateway.status !== 0) {
    throw new Error(
      'no reachable OpenShell gateway is selected. Configure one or set OPENSHELL_GATEWAY_ENDPOINT.',
    );
  }

  if (requireFuse) {
    const help = spawnSync(OPENSHELL_BIN, openShellArgs(['sandbox', 'create', '--help']), {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 15_000,
    });
    const output = `${help.stdout ?? ''}\n${help.stderr ?? ''}`;
    if (help.error || help.status !== 0 || !output.includes('--fuse')) {
      throw new Error(
        'this OpenEral image requires an OpenShell build with the policy-gated --fuse capability',
      );
    }
  }
}

/**
 * Walk up from the compiled file's directory to find the repository root.
 *
 * Looks for `sandboxes/openeral/Dockerfile` as a landmark file so the
 * result is correct regardless of where in the build output the CLI ends up.
 */
export function findRepoRoot(maxLevels = 6): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < maxLevels; i++) {
    if (existsSync(join(dir, 'sandboxes', 'openeral', 'Dockerfile'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function ensureGenericProvider(name: string, credentialKey: string): void {
  const existing = spawnSync(OPENSHELL_BIN, openShellArgs(['provider', 'get', name]), {
    stdio: 'ignore',
    timeout: 15_000,
  });
  const args = existing.status === 0
    ? ['provider', 'update', name, '--credential', credentialKey]
    : ['provider', 'create', '--name', name, '--type', 'generic', '--credential', credentialKey];
  const result = spawnSync(OPENSHELL_BIN, openShellArgs(args), {
    stdio: 'inherit',
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`failed to register OpenShell provider ${name}`);
  }
}

function removeExistingSandbox(name: string): void {
  const existing = spawnSync(OPENSHELL_BIN, openShellArgs(['sandbox', 'get', name]), {
    stdio: 'ignore',
    timeout: 15_000,
  });
  if (existing.status !== 0) return;

  process.stderr.write(`\x1b[2mopeneral: replacing existing sandbox ${name}...\x1b[0m\n`);
  const removed = spawnSync(OPENSHELL_BIN, openShellArgs(['sandbox', 'delete', name]), {
    stdio: 'inherit',
    timeout: 120_000,
  });
  if (removed.error) throw removed.error;
  if (removed.status !== 0) {
    throw new Error(`failed to delete existing sandbox ${name}`);
  }
}

// ---------------------------------------------------------------------------
// presign commands
// ---------------------------------------------------------------------------

/**
 * `npx openeral presign` — show the currently stored StringCost presign.
 */
async function cmdPresignShow(): Promise<void> {
  const stored = loadStoredPresign();
  if (!stored) {
    console.log('No presign stored.');
    console.log('');
    console.log('Set STRINGCOST_API_KEY and ANTHROPIC_API_KEY, then run:');
    console.log('  npx openeral presign renew');
    return;
  }

  const { decodePresignUrl } = await import('./optimize/stringcost-api.js');
  const decoded = decodePresignUrl(stored.url);

  console.log('StringCost presign (currently in use):');
  console.log(`  Proxy URL:  ${stored.url.replace(/\/v1\/.*$/, '')}`);
  console.log(`  Full URL:   ${stored.url}`);
  console.log(`  Created:    ${new Date(stored.createdAt).toLocaleString()}`);
  if (decoded.sessionId) console.log(`  Session ID: ${decoded.sessionId}`);
  if (stored.stringcostApiKey) {
    const k = stored.stringcostApiKey;
    const masked = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '****';
    console.log(`  StringCost API Key: ${masked}  (stored — used for automatic skill downloads)`);
  } else {
    console.log(`  StringCost API Key: not stored — run \`npx openeral presign renew\` to save it`);
  }
  console.log('');
  console.log('Settings: expires_in=-1  max_uses=-1  cost_limit=10$  (all infinite, never exhausts)');
}

/**
 * `npx openeral presign renew` — create a new StringCost presign and persist it.
 *
 * Prompts for ANTHROPIC_API_KEY and STRINGCOST_API_KEY if not set in env.
 * Writes the new presign to:
 *   - ~/.config/openeral/presign.json  (openeral's own cache)
 *   - ~/.claude/settings.json          (Claude Code picks this up automatically)
 */
async function cmdPresignRenew(): Promise<void> {
  let anthropicKey = (process.env.ANTHROPIC_API_KEY ?? '').replace('@anthropic_api_key', '').trim();
  let stringcostKey = (process.env.STRINGCOST_API_KEY ?? '').replace('@stringcost_api_key', '').trim();

  if (!anthropicKey || !stringcostKey) {
    if (!process.stdin.isTTY) {
      process.stderr.write(
        '\x1b[31merror: ANTHROPIC_API_KEY and STRINGCOST_API_KEY must be set\x1b[0m\n',
      );
      process.exit(1);
    }

    const { createInterface } = await import('node:readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const question = (prompt: string): Promise<string> =>
      new Promise(resolve => rl.question(prompt, resolve));

    try {
      if (!anthropicKey) {
        anthropicKey = (await question('Anthropic API key: ')).trim();
      }
      if (!stringcostKey) {
        stringcostKey = (await question('StringCost API key: ')).trim();
      }
    } finally {
      rl.close();
    }
  }

  if (!anthropicKey || !stringcostKey) {
    process.stderr.write('\x1b[31merror: both API keys are required\x1b[0m\n');
    process.exit(1);
  }

  console.log('Creating new presign (expires_in=-1, max_uses=-1, cost_limit=10$)...');

  try {
    const fullUrl = await createPresignUrl(anthropicKey, stringcostKey);
    const baseUrl = stringCostProxyBaseUrl(fullUrl);

    // 1. Store in openeral's own config (include the API key so skill downloads
    //    work automatically on future runs without the env var being set)
    saveStoredPresign(fullUrl, stringcostKey);
    console.log(`\x1b[32m✓ Stored in ${getPresignConfigPath()}\x1b[0m`);

    // 2. Write into host Claude Code settings so Claude picks it up automatically
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    try {
      mkdirSync(join(homedir(), '.claude'), { recursive: true });
      let settings: Record<string, unknown> = {};
      if (existsSync(settingsPath)) {
        try {
          settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
        } catch { /* corrupt/empty — start fresh */ }
      }
      const env = (settings.env ?? {}) as Record<string, string>;
      env.ANTHROPIC_BASE_URL = baseUrl;
      env.ANTHROPIC_AUTH_TOKEN = 'dummy';
      settings.env = env;
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`\x1b[32m✓ Written to ${settingsPath}\x1b[0m`);
    } catch (err) {
      process.stderr.write(
        `\x1b[33mwarning: could not write to ~/.claude/settings.json: ${(err as Error).message}\x1b[0m\n`,
      );
    }

    console.log('');
    console.log(`\x1b[32m✓ Presign created and stored\x1b[0m`);
    console.log(`  Proxy URL: ${baseUrl}`);
    console.log('');
    console.log('This presign will be reused for all future sessions (never expires).');
    console.log('Run "npx openeral presign" to view it, or "npx openeral presign renew" to replace it.');
  } catch (err) {
    process.stderr.write(`\x1b[31merror: ${(err as Error).message}\x1b[0m\n`);
    process.exit(1);
  }
}
/**
 * Launch Claude Code through the public OpenShell CLI contract.
 *
 * The create-time command performs one-shot initialization and exits. Claude is
 * then started with sandbox exec; its wrapper owns lazy daemon startup and the
 * post-session persistence flush.
 */
async function launchViaSandbox(workspaceId: string, claudeArgs: string[], devMode = false): Promise<void> {
  const repoRoot = devMode ? findRepoRoot() : null;
  const sandboxSource = devMode
    ? (process.env.OPENERAL_DEV_IMAGE
      ?? (repoRoot ? join(repoRoot, 'Dockerfile.openeral') : null))
    : (process.env.OPENERAL_SANDBOX_IMAGE
      ?? 'ghcr.io/sandys/openeral/sandbox:just-bash');
  if (!sandboxSource) {
    throw new Error('could not locate Dockerfile.openeral; set OPENERAL_DEV_IMAGE explicitly');
  }
  const fuseRuntime = devMode
    || process.env.OPENERAL_FUSE === '1'
    || /(?:^|[:/])fuse(?:-|$)/.test(sandboxSource);
  requireCurrentOpenShell(fuseRuntime);

  removeExistingSandbox(workspaceId);

  const storedPresign = loadStoredPresign();
  const stringcostKey = (process.env.STRINGCOST_API_KEY ?? '')
    .replace('@stringcost_api_key', '')
    .trim();
  if (!storedPresign && stringcostKey) {
    ensureGenericProvider('stringcost', 'STRINGCOST_API_KEY');
  }

  const temporaryPaths: string[] = [];
  const sandboxArgs: string[] = [
    'sandbox', 'create',
    '--name', workspaceId,
    '--from', sandboxSource,
    '--no-tty',
  ];
  if (fuseRuntime) sandboxArgs.push('--fuse');

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (fuseRuntime && !dbUrl) {
    throw new Error('DATABASE_URL is required by the FUSE runtime; use the compatibility image for PGlite');
  }
  if (dbUrl) {
    const dbUploadPath = join(tmpdir(), `openeral-db-url-${process.pid}-${Date.now()}`);
    writeFileSync(dbUploadPath, dbUrl, { mode: 0o600 });
    chmodSync(dbUploadPath, 0o600);
    temporaryPaths.push(dbUploadPath);
    sandboxArgs.push('--upload', `${dbUploadPath}:/sandbox/db-url`);
  }

  if (storedPresign) {
    const presignUploadPath = join(tmpdir(), `openeral-presign-${process.pid}-${Date.now()}.json`);
    writeFileSync(
      presignUploadPath,
      JSON.stringify({ url: storedPresign.url }, null, 2),
      { mode: 0o600 },
    );
    chmodSync(presignUploadPath, 0o600);
    temporaryPaths.push(presignUploadPath);
    sandboxArgs.push('--upload', `${presignUploadPath}:/sandbox/stringcost-presign`);
  } else {
    sandboxArgs.push('--provider', 'claude');
    if (stringcostKey) sandboxArgs.push('--provider', 'stringcost');
    sandboxArgs.push('--auto-providers');
  }

  sandboxArgs.push(
    '--env', `WORKSPACE_ID=${workspaceId}`,
    '--',
    'openeral-init',
  );

  let skillsRoot: string | undefined;
  const skillsKey = stringcostKey || storedPresign?.stringcostApiKey?.trim() || '';
  if (skillsKey) {
    try {
      const skills = await fetchOrgSkills(skillsKey);
      if (skills.length > 0) {
        skillsRoot = join(tmpdir(), `openeral-skills-${process.pid}-${Date.now()}`);
        const skillsDir = join(skillsRoot, 'skills');
        for (const skill of skills) {
          const skillDir = join(skillsDir, skill.slug);
          mkdirSync(skillDir, { recursive: true });
          writeFileSync(join(skillDir, 'SKILL.md'), skill.content);
        }
        temporaryPaths.push(skillsRoot);
        process.stderr.write(
          `\x1b[32m✓ Downloaded ${skills.length} StringCost org skill${skills.length === 1 ? '' : 's'}\x1b[0m\n`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `\x1b[33mwarning: StringCost skill download failed: ${message}\x1b[0m\n`,
      );
    }
  }

  process.stderr.write(
    `\x1b[2mopeneral: creating OpenShell sandbox ${workspaceId} from ${sandboxSource}...\x1b[0m\n`,
  );

  try {
    const created = spawnSync(OPENSHELL_BIN, openShellArgs(sandboxArgs), {
      stdio: 'inherit',
      timeout: 15 * 60_000,
    });
    if (created.error) throw created.error;
    if (created.status !== 0) {
      throw new Error(`openshell sandbox create failed with exit code ${created.status ?? 1}`);
    }

    if (skillsRoot) {
      const uploaded = spawnSync(
        OPENSHELL_BIN,
        openShellArgs([
          'sandbox', 'upload', workspaceId, join(skillsRoot, 'skills'),
          fuseRuntime ? '/sandbox/work/.claude/' : '/sandbox/.claude/',
        ]),
        { stdio: 'inherit', timeout: 120_000 },
      );
      if (uploaded.error) throw uploaded.error;
      if (uploaded.status !== 0) {
        process.stderr.write(
          '\x1b[33mwarning: StringCost org skills could not be uploaded\x1b[0m\n',
        );
      }
    }
  } finally {
    for (const path of temporaryPaths) {
      try { rmSync(path, { recursive: true, force: true }); } catch {}
    }
  }

  process.stderr.write(
    `\x1b[2mopeneral: starting Claude Code in ${workspaceId}...\x1b[0m\n`,
  );
  const child = spawn(
    OPENSHELL_BIN,
    openShellArgs([
      'sandbox', 'exec', '--name', workspaceId,
      '--workdir', fuseRuntime ? '/sandbox/work' : '/sandbox',
      '--', 'claude', ...claudeArgs,
    ]),
    { stdio: 'inherit' },
  );

  const forwarders = new Map<NodeJS.Signals, () => void>();
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    const forward = () => child.kill(signal);
    forwarders.set(signal, forward);
    process.on(signal, forward);
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code !== null) {
        resolve(code);
      } else {
        resolve(signal === 'SIGINT' ? 130 : 1);
      }
    });
  }).finally(() => {
    for (const [signal, forward] of forwarders) {
      process.off(signal, forward);
    }
  });

  if (exitCode !== 0) process.exitCode = exitCode;
}

export async function main() {
  const rawArgs = process.argv.slice(2);

  // Separate openeral's own args from claude passthrough args (after --)
  const dashIdx = rawArgs.indexOf('--');
  const ownRawArgs = dashIdx >= 0 ? rawArgs.slice(0, dashIdx) : rawArgs;
  const passthroughPart = dashIdx >= 0 ? rawArgs.slice(dashIdx) : [];

  // Extract --dev/-d flag (must happen before subcommand dispatch so
  // `npx openeral --dev presign` works — the flag can appear anywhere before --)
  const devMode = ownRawArgs.some(a => a === '--dev' || a === '-d' || a === '-dev');
  const ownArgs = ownRawArgs.filter(a => a !== '--dev' && a !== '-d' && a !== '-dev');
  const args = [...ownArgs, ...passthroughPart];

  // presign show / renew
  if (ownArgs[0] === 'presign') {
    if (ownArgs[1] === 'renew') {
      await cmdPresignRenew();
    } else {
      await cmdPresignShow();
    }
    return;
  }

  if (ownArgs[0] === 'init') {
    try {
      await cmdInit(ownArgs.slice(1));
    } catch (err: any) {
      process.stderr.write(`\x1b[31mopeneral: init failed: ${err?.message || err}\x1b[0m\n`);
      process.exit(1);
    }
    return;
  }

  // stats / analyze / apply — forward to optimize CLI, passing stored presign URL via env
  if (ownArgs[0] === 'stats' || ownArgs[0] === 'analyze' || ownArgs[0] === 'apply') {
    const { fileURLToPath } = await import('node:url');
    const optimizeCliPath = fileURLToPath(new URL('./optimize/cli.js', import.meta.url));
    const env: NodeJS.ProcessEnv = { ...process.env };
    const stored = loadStoredPresign();
    if (stored) env['OPENERAL_PRESIGN_URL'] = stored.url;
    const child = spawn('node', [optimizeCliPath, ...ownArgs], { stdio: 'inherit', env });
    child.on('exit', (code) => process.exit(code ?? 0));
    return;
  }

  // optimize <subcommand> — backwards compatibility alias
  if (ownArgs[0] === 'optimize') {
    const { fileURLToPath } = await import('node:url');
    const optimizeCliPath = fileURLToPath(new URL('./optimize/cli.js', import.meta.url));
    const env: NodeJS.ProcessEnv = { ...process.env };
    const stored = loadStoredPresign();
    if (stored) env['OPENERAL_PRESIGN_URL'] = stored.url;
    const child = spawn('node', [optimizeCliPath, ...ownArgs.slice(1)], { stdio: 'inherit', env });
    child.on('exit', (code) => process.exit(code ?? 0));
    return;
  }

  const parsed = parseCliArgs(args);

  if (parsed.kind === 'help') {
    printHelp();
    return;
  }

  if (parsed.kind === 'memory-refresh') {
    const { refreshClaudeMemory } = await import('./memory/refresh.js');
    try {
      const result = await refreshClaudeMemory({
        homeDir: process.env.OPENERAL_HOME || process.env.HOME || '/sandbox',
        cwd: process.cwd(),
        projectRoot: parsed.projectRoot || undefined,
        query: parsed.query || undefined,
        dryRun: parsed.dryRun,
        backup: parsed.backup,
      });
      process.stderr.write(
        `\x1b[2mopeneral: memory ${result.mode} mode (project: ${result.context.projectSlug})\x1b[0m\n`,
      );
      process.stderr.write(
        `\x1b[2mopeneral: memory dir  ${result.context.memoryDir}\x1b[0m\n`,
      );
      if (result.backupDir) {
        process.stderr.write(`\x1b[2mopeneral: backup      ${result.backupDir}\x1b[0m\n`);
      }
      for (const f of result.writtenFiles) {
        process.stderr.write(`\x1b[32m  wrote\x1b[0m ${f}\n`);
      }
      if (result.dryRun && result.plannedFiles.length > 0) {
        process.stderr.write('\x1b[2m(dry-run — no files written; planned:)\x1b[0m\n');
        for (const f of result.plannedFiles) {
          process.stderr.write(`  plan  ${f}\n`);
        }
      }
      return;
    } catch (err: any) {
      process.stderr.write(`\x1b[31mopeneral: memory refresh failed: ${err?.message || err}\x1b[0m\n`);
      if (err?.stack) process.stderr.write(err.stack + '\n');
      process.exit(1);
    }
  }

  const { workspaceId, claudeArgs } = parsed;

  process.stderr.write(`\x1b[2mopeneral: workspace  ${workspaceId}\x1b[0m\n`);
  if (devMode) {
    const devImage = process.env.OPENERAL_DEV_IMAGE ?? 'Dockerfile.openeral';
    process.stderr.write(`\x1b[2mopeneral: mode       dev (${devImage})\x1b[0m\n`);
  }
  await launchViaSandbox(workspaceId, claudeArgs, devMode);
}
