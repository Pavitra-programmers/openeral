import http from 'node:http';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MAX_JSON, PodError, requireThat } from './contracts.mjs';

export function byteLimit(max) {
  let bytes = 0;
  return new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length;
    callback(bytes > max ? new PodError('BODY_TOO_LARGE', 413) : null, chunk);
  } });
}

// Transport only. Do not forward vendor keys, redirects, cookies, or host paths.
export function requestStream(url, { method, agent, headers = {}, body, maxBytes = MAX_JSON, signal }) {
  const length = headers['content-length'];
  requireThat(length === undefined || (/^\d+$/.test(String(length)) && Number(length) <= maxBytes), 'BODY_TOO_LARGE', 413);
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, agent, headers, signal });
    let limiter;
    const fail = error => { request.destroy(); reject(error); };
    request.on('error', error => reject(error instanceof PodError ? error : new PodError('BACKEND_UNAVAILABLE')));
    request.once('response', response => { response.on('error', () => {}); resolve(response); });
    if (body) {
      limiter = byteLimit(maxBytes);
      limiter.on('error', fail); body.once('error', fail);
      body.pipe(limiter).pipe(request);
      request.once('close', () => { body.unpipe(limiter); limiter.destroy(); body.off('error', fail); });
    } else request.end();
  });
}

export async function readJsonResponse(response) {
  const parts = []; let size = 0;
  try {
    for await (const chunk of response) { size += chunk.length; requireThat(size <= MAX_JSON, 'POD_RESPONSE_TOO_LARGE'); parts.push(chunk); }
    const value = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const code = value?.code;
      throw new PodError(typeof code === 'string' && /^[A-Z_]{1,80}$/.test(code) ? code : 'POD_ARTIFACT_FAILED', response.statusCode);
    }
    return value;
  } finally { response.destroy(); }
}

export async function relayHttp(req, res, { url, agent, headers, timeoutMs = 65_000,
  maxRequest = MAX_JSON, maxResponse = MAX_JSON, signal }) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const deadline = setTimeout(abort, timeoutMs);
  res.once('close', abort); req.once('aborted', abort); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let upstream;
  try {
    upstream = await requestStream(url, { method: req.method, agent, headers,
      body: ['POST', 'PUT'].includes(req.method) ? req : undefined, maxBytes: maxRequest, signal: controller.signal });
    requireThat(![301, 302, 303, 307, 308].includes(upstream.statusCode), 'REDIRECT_DENIED');
    const length = upstream.headers['content-length'];
    requireThat(length === undefined || (/^\d+$/.test(length) && Number(length) <= maxResponse), 'RESPONSE_TOO_LARGE');
    res.writeHead(upstream.statusCode, { 'content-type': upstream.headers['content-type'] ?? 'application/octet-stream',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      ...(length === undefined ? {} : { 'content-length': length }) });
    await pipeline(upstream, byteLimit(maxResponse), res);
  } finally {
    clearTimeout(deadline); res.off('close', abort); req.off('aborted', abort);
    signal?.removeEventListener('abort', abort); upstream?.destroy(); controller.abort();
  }
}
