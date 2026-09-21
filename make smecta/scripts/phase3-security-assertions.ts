import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { verifyAdminPassword } from '../worker/auth/auth-api';
import { decryptPii, encryptPii } from '../worker/security/encryption';
import { SECURITY_HEADERS, applySecurityHeaders, httpsRedirect } from '../worker/security/headers';
import { validatedImageBody } from '../worker/security/image-upload';
import { verifyApiOrigin, preflightResponse } from '../worker/security/origin';
import { validatedPdfBytes } from '../worker/security/pdf-upload';
import { resolveRateLimitPolicy } from '../worker/security/rate-limit';
import { enforceRequestEnvelope } from '../worker/security/request-guard';
import { createResourceRef, resolveResourceRef } from '../worker/security/resource-ref';
import { verifyTurnstile } from '../worker/security/turnstile';
import { enforceUploadBoundary } from '../worker/security/upload-defense';
import { MAX_UPLOAD_BYTES } from '../worker/security/upload-limits';
import { errorResponse, HttpError } from '../worker/http';

const now = Date.now();
const productionOrigin = 'https://www.astepimmigration.space';
const config = JSON.parse(readFileSync('wrangler.json', 'utf8')) as Record<string, unknown> & {
  workers_dev?: boolean;
  routes?: Array<{ pattern?: string; zone_name?: string }>;
  assets?: { run_worker_first?: string[] };
  vars?: Record<string, string>;
  secrets?: { required?: string[] };
  send_email?: Array<Record<string, unknown>>;
};
assert.equal(config.workers_dev, false);
assert.deepEqual(config.routes, [
  { pattern: 'www.astepimmigration.space/*', zone_name: 'astepimmigration.space' },
  { pattern: 'astepimmigration.space/*', zone_name: 'astepimmigration.space' },
]);
assert.deepEqual(config.assets?.run_worker_first, ['/*']);
assert.ok(config.secrets?.required?.includes('ADMIN_PASSWORD_HASH'));
assert.ok(config.secrets?.required?.includes('RESOURCE_REF_SECRET'));
assert.ok(!config.secrets?.required?.includes('ADMIN_PASSWORD'));
assert.deepEqual(config.send_email?.[0]?.destination_address, 'contact@astepimmigration.space');
assert.ok(!config.secrets?.required?.some((name) => name.startsWith('GOOGLE_SHEETS_')));

const clientContactCode = readFileSync('src/services/email.service.ts', 'utf8');
const workerIndexCode = readFileSync('worker/index.ts', 'utf8');
const publicApiCode = readFileSync('worker/public-api.ts', 'utf8');
const outboxCode = readFileSync('worker/queue/outbox-consumer.ts', 'utf8');
assert.ok(!clientContactCode.includes('formsubmit'));
assert.ok(!clientContactCode.includes('delivery-confirmation'));
assert.ok(!workerIndexCode.includes('delivery-confirmation'));
assert.ok(!publicApiCode.includes("status = 'delivered'"));
assert.ok(outboxCode.includes("status = 'delivered'"));

let replayAccepted = true;
const statement = {
  bind() { return this; },
  async first() { return replayAccepted ? null : { present: 1 }; },
  async run() { if (!replayAccepted) throw new Error('duplicate'); return {}; },
};
const env = {
  TURNSTILE_SECRET_KEY: 'test-secret',
  TURNSTILE_ALLOWED_HOSTNAMES: 'www.astepimmigration.space',
  ALLOWED_ORIGINS: productionOrigin,
  DB: { prepare: () => statement },
};
const request = new Request(`${productionOrigin}/api/v1/contact`, {
  method: 'POST',
  headers: {
    'CF-Connecting-IP': '203.0.113.10',
    'Content-Type': 'application/json',
    Origin: productionOrigin,
  },
  body: '{}',
});
let siteverify = {
  success: true,
  challenge_ts: new Date(now).toISOString(),
  hostname: 'www.astepimmigration.space',
  action: 'contact',
};
globalThis.fetch = (async (input: RequestInfo | URL) => {
  if (String(input).includes('turnstile/v0/siteverify')) return Response.json(siteverify);
  throw new Error('unexpected_mock_request');
}) as typeof fetch;
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
assert.ok(!SECURITY_HEADERS['Content-Security-Policy'].includes('formsubmit'));
assert.equal(existsSync('public/_headers'), false);
assert.equal(applySecurityHeaders(new Response()).headers.get('X-Frame-Options'), 'DENY');
assert.equal(httpsRedirect(new Request('http://www.astepimmigration.space/path'))?.status, 308);
assert.equal(httpsRedirect(new Request('http://localhost:5173/path')), null);
// The bare apex must redirect to the canonical www host, preserving path + query, in one hop.
assert.equal(
  httpsRedirect(new Request('https://astepimmigration.space/guides?country=china'))?.headers.get('location'),
  'https://www.astepimmigration.space/guides?country=china',
);
assert.equal(
  httpsRedirect(new Request('http://astepimmigration.space/'))?.headers.get('location'),
  'https://www.astepimmigration.space/',
);
assert.equal(httpsRedirect(new Request('https://www.astepimmigration.space/guides')), null);

assert.deepEqual(resolveRateLimitPolicy(request), { name: 'contact', limit: 5, windowSeconds: 600 });
assert.deepEqual(resolveRateLimitPolicy(new Request(`${productionOrigin}/api/v1/admin/guides`)),
  { name: 'admin-api', limit: 60, windowSeconds: 60 });
assert.equal(resolveRateLimitPolicy(new Request(`${productionOrigin}/api/v1/auth/sign-in`, { method: 'POST' })), null);
assert.deepEqual(resolveRateLimitPolicy(new Request(`${productionOrigin}/api/v1/download/token`)),
  { name: 'guide-download', limit: 20, windowSeconds: 60 });

assert.throws(() => enforceRequestEnvelope(new Request(request.url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': '65537' },
  body: '{}',
})), (error) => error instanceof HttpError && error.status === 413);
const uploadUrl = `${productionOrigin}/api/v1/admin/guides/r2.ref.value/pdf/en`;
const boundaryRequest = new Request(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(MAX_UPLOAD_BYTES) },
  body: 'x',
});
enforceUploadBoundary(boundaryRequest);
enforceRequestEnvelope(boundaryRequest);
assert.throws(() => enforceUploadBoundary(new Request(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(MAX_UPLOAD_BYTES + 1) },
  body: 'x',
})), (error) => error instanceof HttpError && error.status === 413);

const passive = await PDFDocument.create();
passive.addPage();
const passiveBytes = await passive.save();
assert.deepEqual(await validatedPdfBytes(new Request(uploadUrl, {
  method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: passiveBytes,
})), passiveBytes);
await assert.rejects(() => validatedPdfBytes(new Request(uploadUrl, {
  method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: '%PDF-1.7\nmalformed',
})), (error) => error instanceof HttpError && error.code === 'invalid_pdf');
const active = await PDFDocument.create();
active.addPage();
active.catalog.set(PDFName.of('OpenAction'), active.context.obj({ S: 'JavaScript' }));
const activeBytes = await active.save({ useObjectStreams: false });
await assert.rejects(() => validatedPdfBytes(new Request(uploadUrl, {
  method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: activeBytes,
})), (error) => error instanceof HttpError && error.code === 'unsafe_pdf');

const escapedActive = await PDFDocument.create();
const escapedPage = escapedActive.addPage();
const escapedAction = escapedActive.context.obj({ S: PDFName.of('J#61vaScript') });
const directWidget = escapedActive.context.obj({ Subtype: PDFName.of('Widget'), AA: escapedAction });
escapedPage.node.set(PDFName.of('Annots'), escapedActive.context.obj([directWidget]));
const escapedActiveBytes = await escapedActive.save({ useObjectStreams: false });
await assert.rejects(() => validatedPdfBytes(new Request(uploadUrl, {
  method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: escapedActiveBytes,
})), (error) => error instanceof HttpError && error.code === 'unsafe_pdf');

const compressedActive = await PDFDocument.create();
compressedActive.addPage();
const compressedAction = compressedActive.context.register(
  compressedActive.context.obj({ S: PDFName.of('JavaScript') }),
);
compressedActive.catalog.set(PDFName.of('PieceInfo'), compressedAction);
const compressedActiveBytes = await compressedActive.save({ useObjectStreams: true });
await assert.rejects(() => validatedPdfBytes(new Request(uploadUrl, {
  method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: compressedActiveBytes,
})), (error) => error instanceof HttpError && error.code === 'unsafe_pdf');

const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const imageUrl = `${productionOrigin}/api/v1/admin/opportunities/r2.ref.value/image`;
const validImage = new Request(imageUrl, {
  method: 'PUT', headers: { 'Content-Type': 'image/png', 'Content-Length': String(pngBytes.byteLength) }, body: pngBytes,
});
enforceUploadBoundary(validImage);
enforceRequestEnvelope(validImage);
const validatedImage = await validatedImageBody(validImage);
assert.deepEqual(new Uint8Array(await new Response(validatedImage.body).arrayBuffer()), pngBytes);
await validatedImage.completion;
await assert.rejects(() => validatedImageBody(new Request(imageUrl, {
  method: 'PUT', headers: { 'Content-Type': 'image/png', 'Content-Length': 'invalid' }, body: pngBytes,
})), (error) => error instanceof HttpError && error.code === 'invalid_content_length');

const encryptionSecret = randomBytes(32).toString('base64url');
const plaintext = 'private-user@example.com';
const ciphertext = await encryptPii(plaintext, encryptionSecret);
assert.ok(!ciphertext.includes(plaintext));
assert.equal(await decryptPii(ciphertext, encryptionSecret), plaintext);
const ciphertextParts = ciphertext.split('.');
ciphertextParts[2] = `${ciphertextParts[2].startsWith('A') ? 'B' : 'A'}${ciphertextParts[2].slice(1)}`;
await assert.rejects(() => decryptPii(ciphertextParts.join('.'), encryptionSecret),
  (error) => error instanceof HttpError && error.code === 'invalid_ciphertext');

const issuedAt = 1_800_000_000;
const resourceRef = await createResourceRef('q1', 'guide', 'admin-1', encryptionSecret, issuedAt, 60);
assert.match(resourceRef, /^r2\./);
assert.equal(await resolveResourceRef(resourceRef, 'guide', 'admin-1', encryptionSecret, issuedAt + 1), 'q1');
await assert.rejects(() => resolveResourceRef(resourceRef, 'guide', 'admin-1', randomBytes(32).toString('base64url'), issuedAt + 1));
await assert.rejects(() => resolveResourceRef(resourceRef, 'guide', 'admin-2', encryptionSecret, issuedAt + 1));
await assert.rejects(() => resolveResourceRef(resourceRef, 'opportunity', 'admin-1', encryptionSecret, issuedAt + 1));
await assert.rejects(() => resolveResourceRef(resourceRef, 'guide', 'admin-1', encryptionSecret, issuedAt + 60));
await assert.rejects(() => resolveResourceRef(resourceRef.replace(/^r2/, 'r1'), 'guide', 'admin-1', encryptionSecret, issuedAt + 1));

const passwordPepper = randomBytes(32);
const expected = createHmac('sha256', passwordPepper).update('a-step:admin-password:v1\0correct passphrase').digest('base64url');
const passwordHash = `hmac-sha256$v1$${expected}`;
assert.equal(await verifyAdminPassword('correct passphrase', passwordHash, passwordPepper.toString('base64url')), true);
assert.equal(await verifyAdminPassword('wrong passphrase', passwordHash, passwordPepper.toString('base64url')), false);

const origin = verifyApiOrigin(request, env);
assert.equal(origin.origin, productionOrigin);
assert.throws(() => verifyApiOrigin(new Request(request.url, { headers: { Origin: 'https://evil.example' } }), env),
  (error) => error instanceof HttpError && error.status === 403);
const preflight = preflightResponse(new Request(request.url, {
  method: 'OPTIONS',
  headers: {
    Origin: productionOrigin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type, idempotency-key',
  },
}), origin);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), productionOrigin);

const originalConsoleError = console.error;
console.error = () => undefined;
const shielded = errorResponse(new Error('database password leaked'), 'request-test');
console.error = originalConsoleError;
assert.deepEqual(await shielded.json(), {
  error: { code: 'internal_error', message: 'Internal server error' }, requestId: 'request-test',
});

process.stdout.write('Security assertions passed.\n');
