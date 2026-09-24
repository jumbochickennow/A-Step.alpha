import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContact } from '../worker/public-api';
import type { Env } from '../worker/env';
import { createBlindIndex } from '../worker/security/blind-index';

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({
    success: true,
    hostname: 'www.astepimmigration.space',
    action: 'contact',
    challenge_ts: new Date().toISOString(),
  })));
});
afterEach(() => vi.unstubAllGlobals());

const ctx = { waitUntil: (_promise: Promise<unknown>) => {} };
const submissionCount = async (email: string) => env.DB.prepare(
  'SELECT COUNT(*) AS count FROM contact_submissions WHERE email_blind_index = ?1',
).bind(await createBlindIndex(email, env.BLIND_INDEX_SECRET)).first();
const request = (email: string, ip: string, key = crypto.randomUUID()) => new Request('https://www.astepimmigration.space/api/v1/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'CF-Connecting-IP': ip },
  body: JSON.stringify({
    name: 'Test Person', email, phone: '+213555123456', serviceInterest: 'Study',
    message: 'Please contact me about my application.', locale: 'en', turnstileToken: crypto.randomUUID(),
  }),
});

describe('contact cooldown', () => {
  it('blocks the same normalized email across IPs without storing or emailing a duplicate', async () => {
    const send = vi.fn(async () => {});
    const localEnv = { ...env, EVENT_QUEUE: { send } } as unknown as Env;
    const email = `${crypto.randomUUID()}@example.org`;

    expect((await createContact(request(email, '192.0.2.1'), localEnv, ctx)).status).toBe(202);
    const blocked = await createContact(request(email.toUpperCase(), '192.0.2.2'), localEnv, ctx);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await blocked.json()).toMatchObject({ error: { code: 'contact_cooldown' } });
    expect(await submissionCount(email)).toMatchObject({ count: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect((await createContact(request(`${crypto.randomUUID()}@example.org`, '192.0.2.2'), localEnv, ctx)).status).toBe(202);
  });

  it('stores only one of several simultaneous submissions for the same email', async () => {
    const send = vi.fn(async () => {});
    const localEnv = { ...env, EVENT_QUEUE: { send } } as unknown as Env;
    const email = `${crypto.randomUUID()}@example.org`;
    const responses = await Promise.all(Array.from({ length: 6 }, (_, index) =>
      createContact(request(email, `198.51.100.${index + 1}`), localEnv, ctx)));
    expect(responses.filter((response) => response.status === 202)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(5);
    expect(await submissionCount(email)).toMatchObject({ count: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns the original success response for an idempotent retry', async () => {
    const send = vi.fn(async () => {});
    const localEnv = { ...env, EVENT_QUEUE: { send } } as unknown as Env;
    const email = `${crypto.randomUUID()}@example.org`;
    const key = crypto.randomUUID();
    const first = await createContact(request(email, '192.0.2.1', key), localEnv, ctx);
    const retried = await createContact(request(email, '192.0.2.2', key), localEnv, ctx);
    expect(retried.status).toBe(202);
    expect(await retried.json()).toEqual(await first.json());
    expect(await submissionCount(email)).toMatchObject({ count: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('allows only one concurrent reservation and releases it after 15 minutes', async () => {
    const stub = env.RATE_LIMITER.getByName(`contact-cooldown-test:${crypto.randomUUID()}`);
    const now = 1_800_000_000;
    const results = await Promise.all(Array.from({ length: 12 }, () => stub.check(1, 900, now)));
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toHaveLength(11);
    expect(results.find((result) => !result.allowed)?.retryAfter).toBe(900);
    expect((await stub.check(1, 900, now + 899)).allowed).toBe(false);
    expect((await stub.check(1, 900, now + 900)).allowed).toBe(true);
  });
});
