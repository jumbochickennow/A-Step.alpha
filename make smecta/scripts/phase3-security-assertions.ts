import assert from 'node:assert/strict';
import { HttpError, errorResponse } from '../worker/http';
import { SECURITY_HEADERS, applySecurityHeaders, httpsRedirect } from '../worker/security/headers';
import { verifyApiOrigin, preflightResponse } from '../worker/security/origin';
import { resolveRateLimitPolicy } from '../worker/security/rate-limit';
import { enforceRequestEnvelope } from '../worker/security/request-guard';
import { verifyTurnstile } from '../worker/security/turnstile';
import { verifyCloudflareAccess } from '../worker/security/access';
import worker from '../worker/index';

const now = Date.now();
let replayAccepted = true;
const statement = {
  bind() { return this; },
  async first() { return replayAccepted ? null : { present: 1 }; },
  async run() { if (!replayAccepted) throw new Error('duplicate'); return {}; },
};
const env = {
  TURNSTILE_SECRET_KEY: 'test-secret',
  TURNSTILE_ALLOWED_HOSTNAMES: 'a-step.example',
  ALLOWED_ORIGINS: 'https://a-step.example',
  CF_ACCESS_TEAM_DOMAIN: 'https://a-step.cloudflareaccess.com',
  CF_ACCESS_POLICY_AUD: 'access-audience',
  DB: {
    prepare: () => statement,
  },
};
const request = new Request('https://a-step.example/api/v1/contact', {
  method: 'POST',
  headers: {
    'CF-Connecting-IP': '203.0.113.10',
    'Content-Type': 'application/json',
    Origin: 'https://a-step.example',
  },
  body: '{}',
});

let siteverify = { success: true, challenge_ts: new Date(now).toISOString(), hostname: 'a-step.example', action: 'contact' };
const accessKeys = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
);
const accessJwk = { ...await crypto.subtle.exportKey('jwk', accessKeys.publicKey), kid: 'test-access-key' };
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('turnstile/v0/siteverify')) return Response.json(siteverify);
  if (url.includes('/cdn-cgi/access/certs')) return Response.json({ keys: [accessJwk] });
  throw new Error('unexpected_mock_request');
}) as typeof fetch;

const encodedHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: accessJwk.kid, typ: 'JWT' })).toString('base64url');
const encodedClaims = Buffer.from(JSON.stringify({
  aud: [env.CF_ACCESS_POLICY_AUD],
  email: 'admin@a-step.example',
  exp: Math.floor(now / 1000) + 300,
  iat: Math.floor(now / 1000),
  iss: env.CF_ACCESS_TEAM_DOMAIN,
  sub: 'access-user-id',
  type: 'app',
})).toString('base64url');
const accessSignature = Buffer.from(await crypto.subtle.sign(
  'RSASSA-PKCS1-v1_5',
  accessKeys.privateKey,
  new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
)).toString('base64url');
const accessToken = `${encodedHeader}.${encodedClaims}.${accessSignature}`;
const accessRequest = new Request(request.url, { headers: { 'Cf-Access-Jwt-Assertion': accessToken } });
assert.equal((await verifyCloudflareAccess(accessRequest, env)).email, 'admin@a-step.example');
const tamperedSignature = `${accessSignature.startsWith('A') ? 'B' : 'A'}${accessSignature.slice(1)}`;
const tamperedToken = `${encodedHeader}.${encodedClaims}.${tamperedSignature}`;
await assert.rejects(
  () => verifyCloudflareAccess(new Request(request.url, { headers: { 'Cf-Access-Jwt-Assertion': tamperedToken } }), env),
  (error) => error instanceof HttpError && error.status === 401,
);

await verifyTurnstile(request, env, 'valid-token', 'contact', now);
siteverify = { ...siteverify, action: 'newsletter' };
await assert.rejects(() => verifyTurnstile(request, env, 'wrong-action', 'contact', now),
  (error) => error instanceof HttpError && error.status === 403);
siteverify = { ...siteverify, action: 'contact', challenge_ts: new Date(now - 300_000).toISOString() };
await assert.rejects(() => verifyTurnstile(request, env, 'stale-token', 'contact', now),
  (error) => error instanceof HttpError && error.status === 403);
siteverify = { ...siteverify, challenge_ts: new Date(now).toISOString() };
replayAccepted = false;
await assert.rejects(() => verifyTurnstile(request, env, 'replayed-token', 'contact', now),
  (error) => error instanceof HttpError && error.code === 'challenge_replayed');

assert.equal(SECURITY_HEADERS['Strict-Transport-Security'], 'max-age=63072000; includeSubDomains; preload');
assert.ok(!SECURITY_HEADERS['Content-Security-Policy'].includes('unsafe-eval'));
assert.ok(SECURITY_HEADERS['Content-Security-Policy'].includes('https://challenges.cloudflare.com'));
assert.equal(applySecurityHeaders(new Response()).headers.get('X-Frame-Options'), 'DENY');
assert.equal(httpsRedirect(new Request('http://a-step.example/path'))?.status, 308);
assert.equal(httpsRedirect(new Request('http://localhost:5173/path')), null);

assert.deepEqual(resolveRateLimitPolicy(request), { name: 'contact', limit: 5, windowSeconds: 600 });
assert.deepEqual(resolveRateLimitPolicy(new Request('https://a-step.example/api/v1/admin/guides')),
  { name: 'admin', limit: 10, windowSeconds: 60 });
assert.deepEqual(resolveRateLimitPolicy(new Request('https://a-step.example/api/v1/auth/sign-in', { method: 'POST' })),
  { name: 'admin-sign-in', limit: 5, windowSeconds: 600 });
assert.throws(() => enforceRequestEnvelope(new Request(request.url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': '65537' },
  body: '{}',
})), (error) => error instanceof HttpError && error.status === 413);
assert.throws(() => enforceRequestEnvelope(new Request('https://a-step.example/api/v1/admin/guides', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': '524289' },
  body: '{}',
})), (error) => error instanceof HttpError && error.status === 413);
assert.throws(() => enforceRequestEnvelope(new Request(request.url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=iso-8859-1' },
  body: '{}',
})), (error) => error instanceof HttpError && error.status === 415);

const origin = verifyApiOrigin(request, env);
assert.equal(origin.origin, 'https://a-step.example');
assert.throws(() => verifyApiOrigin(new Request(request.url, { headers: { Origin: 'https://evil.example' } }), env),
  (error) => error instanceof HttpError && error.status === 403);
assert.throws(() => verifyApiOrigin(new Request(request.url, { headers: { Origin: 'null' } }), env),
  (error) => error instanceof HttpError && error.status === 403);
const preflight = preflightResponse(new Request(request.url, {
  method: 'OPTIONS',
  headers: {
    Origin: 'https://a-step.example',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type, idempotency-key',
  },
}), origin);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://a-step.example');
assert.notEqual(preflight.headers.get('Access-Control-Allow-Origin'), '*');

const originalConsoleError = console.error;
console.error = () => undefined;
const shielded = errorResponse(new Error('database password leaked'), 'request-test');
console.error = originalConsoleError;
assert.deepEqual(await shielded.json(), { error: 'Internal server error', requestId: 'request-test' });

const cronWarnings: string[] = [];
const originalConsoleWarn = console.warn;
console.warn = (message?: unknown) => cronWarnings.push(String(message));
console.error = () => undefined;
await worker.scheduled(undefined, {} as never, { waitUntil() {} });
console.warn = originalConsoleWarn;
console.error = originalConsoleError;
assert.deepEqual(cronWarnings, ['[Cron] Outbox skipped: runtime secrets not configured']);
