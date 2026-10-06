import { ARGIDE_PROFILE, HELPER_ORIGIN, PodError, normalizeHyperbrowser, positive, requireThat } from './contracts.mjs';

const uuid = '[a-f0-9-]{36}';
export const sessionRoute = new RegExp(`^/api/session/(${uuid})(?:/(stop|uploads|downloads-url))?$`);
export const artifactRoute = new RegExp(`^/artifacts/(${uuid})/([a-f0-9]{32})$`);

export function hyperbrowserSession(core, session) {
  const live = core.isLive(session) && session.state === 'Ready';
  const status = live ? 'active' : session.browserStoppedAt !== null ? 'closed' : 'error';
  const effective = session.options.effective;
  return { id: session.id, teamId: session.ownerId, status,
    startTime: session.createdAt, ...(session.browserStoppedAt === null ? {} : { endTime: session.browserStoppedAt }),
    createdAt: new Date(session.createdAt).toISOString(),
    updatedAt: new Date(session.browserStoppedAt ?? session.accessRevokedAt ?? session.createdAt).toISOString(),
    sessionUrl: `${HELPER_ORIGIN}/api/session/${session.id}`,
    wsEndpoint: live ? `${HELPER_ORIGIN.replace('http:', 'ws:')}/cdp/${session.attachment}` : '', token: '',
    creditsUsed: null, creditBreakdown: { creditsUsed: null, browserTimeCreditsUsed: null, proxyDataCreditsUsed: null },
    launchState: { screen: effective.screen, saveDownloads: effective.saveDownloads,
      useStealth: false, solveCaptchas: false, adblock: false, trackers: false, annoyances: false,
      enableWebRecording: false, enableVideoWebRecording: false },
    openrind: { requested: session.options.requested, effective, warnings: session.options.warnings } };
}

export function ownedHyperbrowser(core, owner, id, { live = false } = {}) {
  requireThat(owner.providers.includes('hyperbrowser'), 'PROVIDER_DENIED', 403);
  const session = core.owned(owner, id);
  requireThat(session.options.provider === 'hyperbrowser', 'SESSION_NOT_FOUND', 404);
  if (live) requireThat(core.isLive(session) && session.state === 'Ready', 'SESSION_NOT_FOUND', 404);
  return session;
}

export async function hyperbrowserRequest(core, owner, { method, url, body, requestId, signal }) {
  requireThat(owner.providers.includes('hyperbrowser'), 'PROVIDER_DENIED', 403);
  if (method === 'POST' && url.pathname === '/api/session') {
    const session = await core.create(owner, normalizeHyperbrowser(body ?? {}, owner.compatibilityProfile), { requestId, signal });
    return { status: 200, body: hyperbrowserSession(core, session) };
  }
  if (method === 'GET' && url.pathname === '/api/sessions') {
    const page = positive(Number(url.searchParams.get('page') ?? 1), 100_000);
    const perPage = positive(Number(url.searchParams.get('limit') ?? 20), 100);
    const status = url.searchParams.get('status');
    requireThat(status === null || ['active', 'closed', 'error'].includes(status), 'INVALID_STATUS');
    const { sessions, totalCount } = core.registry.listOwned(owner, { provider: 'hyperbrowser', page, perPage, status,
      now: core.clock(), generation: core.generation });
    return { status: 200, body: { sessions: sessions.map(s => hyperbrowserSession(core, s)), totalCount, page, perPage } };
  }
  const match = url.pathname.match(sessionRoute);
  if (match && method === 'GET' && !match[2]) {
    const session = ownedHyperbrowser(core, owner, match[1]);
    if (url.searchParams.has('liveViewTtlSeconds')) {
      positive(Number(url.searchParams.get('liveViewTtlSeconds')), 86_400);
      requireThat(owner.compatibilityProfile === ARGIDE_PROFILE, 'LIVE_VIEW_UNSUPPORTED');
    }
    const result = hyperbrowserSession(core, session);
    if (url.searchParams.has('liveViewTtlSeconds')) result.openrind.warnings = [...result.openrind.warnings, 'liveViewTtlSeconds:not-implemented'];
    return { status: 200, body: result };
  }
  if (match && method === 'PUT' && match[2] === 'stop') {
    ownedHyperbrowser(core, owner, match[1]);
    await core.stop(owner, match[1]);
    return { status: 200, body: { success: true } };
  }
  throw new PodError('ROUTE_NOT_FOUND', 404);
}
