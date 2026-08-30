import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HttpError, errorResponse } from '../worker/http';
import { SECURITY_HEADERS, applySecurityHeaders, httpsRedirect } from '../worker/security/headers';
import { verifyApiOrigin, preflightResponse } from '../worker/security/origin';
import { resolveRateLimitPolicy } from '../worker/security/rate-limit';
import { enforceRequestEnvelope } from '../worker/security/request-guard';
import { enforceUploadBoundary } from '../worker/security/upload-defense';
import { MAX_UPLOAD_BYTES } from '../worker/security/upload-limits';
import { validatedPdfBody } from '../worker/security/pdf-upload';
import { validatedImageBody } from '../worker/security/image-upload';
import { decryptPii, encryptPii } from '../worker/security/encryption';
import { verifyTurnstile } from '../worker/security/turnstile';
import { readAdminSession, signIn } from '../worker/auth/auth-api';
import {
  outboundBody,
  outboundDestination,
  outboundHeaders,
  requireSuccessfulDelivery,
} from '../worker/integrations/outbound-delivery';
import worker from '../worker/index';
import { createResourceRef, resolveResourceRef } from '../worker/security/resource-ref';

const now = Date.now();
const workerConfig = JSON.parse(readFileSync('wrangler.json', 'utf8')) as { assets?: { run_worker_first?: string[] } };
assert.deepEqual(workerConfig.assets?.run_worker_first, ['/*']);
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
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('turnstile/v0/siteverify')) return Response.json(siteverify);
  throw new Error('unexpected_mock_request');
}) as typeof fetch;

const authSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const authEnv = {
  ADMIN_PASSWORD: 'test-password-with-32-characters',
  SESSION_SECRET: authSecret,
  DB: {
    prepare() { return { bind() { return this; } }; },
    async batch() { return []; },
  },
} as never;
const loginResponse = await signIn(new Request('https://a-step.example/api/v1/auth/sign-in', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ passkey: 'test-password-with-32-characters' }),
}), authEnv);
assert.equal(loginResponse.status, 200);
assert.deepEqual(await loginResponse.clone().json(), { success: true, role: 'superadmin' });
assert.ok(!JSON.stringify(await loginResponse.clone().json()).includes('email'));
const sessionCookie = loginResponse.headers.get('Set-Cookie');
assert.match(sessionCookie ?? '', /HttpOnly; Secure; SameSite=Strict/);
const sessionIdentity = await readAdminSession(new Request('https://a-step.example/api/v1/auth/session', {
  headers: { Cookie: sessionCookie!.split(';')[0] },
}), authEnv);
assert.deepEqual(sessionIdentity, { id: 'master-password-admin', role: 'superadmin' });
await assert.rejects(() => signIn(new Request('https://a-step.example/api/v1/auth/sign-in', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passkey: 'wrong-password' }),
}), authEnv), (error) => error instanceof HttpError && error.status === 401);
await requireSuccessfulDelivery(
  new URL('https://formsubmit.co/ajax/test@example.com'),
  Response.json({ success: 'true' }),
);
await assert.rejects(() => requireSuccessfulDelivery(
  new URL('https://formsubmit.co/ajax/test@example.com'),
  Response.json({ success: 'false' }),
));
const formDestination = outboundDestination({
  OUTBOUND_WEBHOOK_URL: 'https://formsubmit.co/ajax/test@example.com',
  OUTBOUND_WEBHOOK_ALLOWED_HOSTS: 'formsubmit.co',
});
assert.equal(formDestination.pathname, '/test@example.com');
assert.match(outboundBody(formDestination, {
  id: crypto.randomUUID(), event_type: 'contact.created', aggregate_id: crypto.randomUUID(),
}, { name: 'A Step', message: 'Hello world' }), /name=A\+Step/);
assert.match(outboundHeaders(formDestination, 'event-id', 'signature').get('Content-Type') ?? '', /urlencoded/);

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
assert.ok(SECURITY_HEADERS['Content-Security-Policy'].includes('https://formsubmit.co'));
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

const allowedPdfUpload = new Request('https://a-step.example/api/v1/admin/guides/r1.ref.value/pdf/en', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(MAX_UPLOAD_BYTES) },
  body: '%PDF-1.7\npassive',
});
enforceUploadBoundary(allowedPdfUpload);
enforceRequestEnvelope(allowedPdfUpload);
assert.throws(() => enforceUploadBoundary(new Request(allowedPdfUpload.url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(MAX_UPLOAD_BYTES + 1) },
  body: 'x',
})), (error) => error instanceof HttpError && error.status === 413);
assert.equal(new TextDecoder().decode(await new Response(validatedPdfBody(allowedPdfUpload)).arrayBuffer()), '%PDF-1.7\npassive');

const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const validImage = new Request('https://a-step.example/api/v1/admin/opportunities/r1.ref.value/image', {
  method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: pngBytes,
});
enforceUploadBoundary(validImage);
enforceRequestEnvelope(validImage);
assert.deepEqual(new Uint8Array(await new Response(validatedImageBody(validImage)).arrayBuffer()), pngBytes);
await assert.rejects(async () => new Response(validatedImageBody(new Request(validImage.url, {
  method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: Uint8Array.from({ length: 12 }, () => 0),
}))).arrayBuffer(), (error) => error instanceof HttpError && error.code === 'invalid_image');

const encryptionSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const plaintext = 'private-user@example.com';
const ciphertext = await encryptPii(plaintext, encryptionSecret);
assert.match(ciphertext, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
assert.ok(!ciphertext.includes(plaintext));
assert.equal(await decryptPii(ciphertext, encryptionSecret), plaintext);
const ciphertextParts = ciphertext.split('.');
ciphertextParts[2] = `${ciphertextParts[2].startsWith('A') ? 'B' : 'A'}${ciphertextParts[2].slice(1)}`;
const tamperedCiphertext = ciphertextParts.join('.');
await assert.rejects(() => decryptPii(tamperedCiphertext, encryptionSecret),
  (error) => error instanceof HttpError && error.code === 'invalid_ciphertext');

const legacyResourceRef = await createResourceRef('q1', 'guide', 'admin-1', encryptionSecret);
assert.equal(await resolveResourceRef(legacyResourceRef, 'guide', 'admin-1', encryptionSecret), 'q1');
await assert.rejects(() => resolveResourceRef(legacyResourceRef, 'guide', 'admin-2', encryptionSecret));

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
assert.deepEqual(await shielded.json(), {
  error: { code: 'internal_error', message: 'Internal server error' }, requestId: 'request-test',
});

const cronWarnings: string[] = [];
const originalConsoleWarn = console.warn;
console.warn = (message?: unknown) => cronWarnings.push(String(message));
console.error = () => undefined;
await worker.scheduled(undefined, {} as never, { waitUntil() {} });
console.warn = originalConsoleWarn;
console.error = originalConsoleError;
assert.deepEqual(cronWarnings, ['[Cron] Outbox skipped: runtime secrets not configured']);
