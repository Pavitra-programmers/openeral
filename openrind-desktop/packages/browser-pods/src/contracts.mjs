import { createHash } from 'node:crypto';

export const HELPER_ORIGIN = 'http://127.0.0.1:19300';
export const MAX_JSON = 1024 * 1024;
export const MAX_CDP = 64 * 1024 * 1024;
export const MAX_LIFETIME_MS = 2 * 60 * 60 * 1000;
export const ARGIDE_PROFILE = 'argide-0.91-browser-pods-v1';

export class PodError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}

export function requireThat(condition, code = 'INVALID_REQUEST', status = 400) {
  if (!condition) throw new PodError(code, status);
}

export function object(value, allowed) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value));
  requireThat(Object.keys(value).every(key => allowed.includes(key)), 'UNSUPPORTED_OPTION');
}

export function positive(value, max) {
  requireThat(Number.isSafeInteger(value) && value > 0 && value <= max);
  return value;
}

export function normalizeKernel(body) {
  object(body, ['headless', 'stealth', 'timeout_seconds', 'profile']);
  requireThat(body.headless === undefined || body.headless === true, 'HEADED_UNSUPPORTED');
  requireThat(body.stealth === undefined || body.stealth === false, 'STEALTH_UNSUPPORTED');
  requireThat(!Object.hasOwn(body, 'profile'), 'PROFILE_UNSUPPORTED');
  const idleMs = positive(body.timeout_seconds ?? 300, MAX_LIFETIME_MS / 1000) * 1000;
  return { provider: 'kernel', requested: body, effective: {
    headless: true, stealth: false, idleMs, lifetimeMs: MAX_LIFETIME_MS,
    screen: { width: 1280, height: 720 }, saveDownloads: false,
  }, warnings: [] };
}

// The option contract is shared with the later Hyperbrowser HTTP adapter.
export function normalizeHyperbrowser(body, profile) {
  const noops = ['enableWebRecording', 'enableVideoWebRecording', 'useStealth',
    'adblock', 'trackers', 'annoyances'];
  object(body, ['region', 'screen', 'timeoutMinutes', 'saveDownloads', 'solveCaptchas', ...noops]);
  requireThat(body.solveCaptchas === undefined || body.solveCaptchas === false, 'CAPTCHA_UNSUPPORTED');
  const warnings = [];
  for (const key of noops) {
    requireThat(body[key] === undefined || typeof body[key] === 'boolean');
    if (body[key] === true) {
      requireThat(profile === ARGIDE_PROFILE, 'UNSUPPORTED_OPTION');
      warnings.push(`${key}:not-implemented`);
    }
  }
  if (body.region !== undefined) {
    requireThat(typeof body.region === 'string' && body.region.length > 0 && body.region.length <= 64);
    requireThat(profile === ARGIDE_PROFILE, 'REGION_UNSUPPORTED');
    warnings.push('region:gateway-local');
  }
  const screen = body.screen ?? { width: 1280, height: 720 };
  object(screen, ['width', 'height']);
  positive(screen.width, 8192); positive(screen.height, 8192);
  requireThat(body.saveDownloads === undefined || typeof body.saveDownloads === 'boolean');
  return { provider: 'hyperbrowser', requested: body, effective: {
    headless: true, stealth: false, screen, saveDownloads: body.saveDownloads ?? false,
    idleMs: 15 * 60 * 1000, lifetimeMs: positive(body.timeoutMinutes ?? 60, 120) * 60 * 1000,
  }, warnings };
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const digest = value => createHash('sha256').update(value).digest('hex');

export function parseProbeResult(bytes) {
  let message;
  try { message = JSON.parse(bytes.toString()); }
  catch { throw new PodError('INVALID_CONTROL_MESSAGE', 400); }
  requireThat(message !== null && typeof message === 'object' && !Array.isArray(message) &&
    message.type === 'probe-result' && typeof message.requestId === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(message.requestId) &&
    typeof message.ok === 'boolean', 'INVALID_CONTROL_MESSAGE', 400);
  return { type: message.type, requestId: message.requestId, ok: message.ok };
}

export function validateOwner(owner) {
  for (const key of ['id', 'generation', 'workspaceId']) {
    requireThat(typeof owner?.[key] === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(owner[key]), 'INVALID_OWNER');
  }
  requireThat(owner.helperOrigin === HELPER_ORIGIN, 'INVALID_HELPER_ORIGIN');
  requireThat(Array.isArray(owner.providers) && owner.providers.length > 0 &&
    owner.providers.every(value => ['kernel', 'hyperbrowser'].includes(value)), 'INVALID_OWNER');
  return structuredClone(owner);
}

export const sameOwner = (session, owner) => session.ownerId === owner.id &&
  session.ownerGeneration === owner.generation && session.workspaceId === owner.workspaceId;

export function errorResponse(error) {
  const safe = error instanceof PodError ? error : new PodError('BACKEND_UNAVAILABLE');
  return { status: safe.status, body: { error: { code: safe.code, message: safe.code } } };
}

export async function deadline(promise, ms, code = 'DEADLINE_EXCEEDED') {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new PodError(code, 504)), ms);
    })]);
  } finally { clearTimeout(timer); }
}
