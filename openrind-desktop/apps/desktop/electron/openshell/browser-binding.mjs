import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

// Trusted host provisioning only. Never accept endpoint, IP or identity choices
// from tool arguments or renderer-supplied browser requests.
export function browserBinding({ endpoint, bridgeAddress, bindingId }) {
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(bindingId)) throw new Error('Invalid browser binding identity');
  const url = new URL(endpoint);
  if (url.hostname !== 'host.openshell.internal' || !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/mcp' || url.username || url.password || url.search || url.hash ||
      isIP(bridgeAddress) !== 4 || !/^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(bridgeAddress)) {
    throw new Error('Browser Desktop binding requires its private bridge endpoint');
  }
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid browser endpoint port');
  const name = `browser-${createHash('sha256').update(JSON.stringify([bindingId, url.href, bridgeAddress])).digest('hex').slice(0, 24)}`;
  const rules = ['POST', 'GET', 'DELETE'].map(method => ({ allow: { method, path: '/mcp' } }));
  const route = { host: url.hostname, port, protocol: 'rest', tls: url.protocol === 'https:' ? 'terminate' : 'none',
    allowed_ips: [`${bridgeAddress}/32`], enforcement: 'enforce', rules };
  return Object.freeze({ name,
    descriptor: { protocol: 1, endpoint: url.href, requireProxy: true },
    profile: { id: name, display_name: 'Openrind browser service', category: 'other',
      credentials: [{ name: 'service_token', env_vars: ['OPENRIND_BROWSER_SERVICE_TOKEN'], required: true,
        auth_style: 'bearer', header_name: 'Authorization' }],
      discovery: { credentials: ['service_token'] }, endpoints: [route],
      binaries: ['/usr/local/bin/openrind-browser-client'] },
    networkPolicy: { name, endpoints: [route], binaries: [{ path: '/usr/local/bin/openrind-browser-client' }] },
  });
}

// Experimental provider-compatible service. Reuse the native credential profile
// shape, but grant only these routes to the dedicated helper's native parent.
export function browserPodBinding({ endpoint, bridgeAddress, bindingId }) {
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' || url.pathname !== '/' || url.search || url.hash ||
      Number(url.port || 80) === 18770) throw new Error('Browser pods require a separate private HTTP endpoint');
  const base = browserBinding({ endpoint: new URL('/mcp', url).href, bridgeAddress, bindingId });
  const route = { ...base.networkPolicy.endpoints[0],
    websocket_credential_rewrite: false, request_body_credential_rewrite: false,
    rules: [
      { allow: { method: 'POST', path: '/browsers' } },
      { allow: { method: 'DELETE', path: '/browsers/*' } },
      { allow: { method: 'GET', path: '/control' } },
      { allow: { method: 'GET', path: '/cdp/*' } },
      { allow: { method: 'POST', path: '/api/session' } },
      { allow: { method: 'GET', path: '/api/session/*' } },
      { allow: { method: 'GET', path: '/api/session/*/downloads-url' } },
      { allow: { method: 'GET', path: '/api/sessions' } },
      { allow: { method: 'PUT', path: '/api/session/*/stop' } },
      { allow: { method: 'POST', path: '/api/session/*/uploads' } },
      { allow: { method: 'GET', path: '/artifacts/*/*' } },
    ] };
  const binary = '/usr/local/bin/openrind-browser-pod-helper';
  return Object.freeze({ name: `${base.name}-pods`,
    profile: { ...base.profile, id: `${base.name}-pods`, display_name: 'Openrind browser pods (experimental)',
      credentials: [{ name: 'pod_token', env_vars: ['OPENRIND_BROWSER_POD_TOKEN'], required: true,
        auth_style: 'bearer', header_name: 'Authorization' }],
      discovery: { credentials: ['pod_token'] }, endpoints: [route], binaries: [binary] },
    networkPolicy: { name: `${base.name}-pods`, endpoints: [route], binaries: [{ path: binary }] },
  });
}
