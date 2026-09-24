import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../worker/env';
import { createNewsletterSubscription } from '../worker/public-api';
import { createBlindIndex } from '../worker/security/blind-index';
import { encryptPii } from '../worker/security/encryption';

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({
    success: true,
    hostname: 'www.astepimmigration.space',
    action: 'newsletter',
    challenge_ts: new Date().toISOString(),
  })));
});
afterEach(() => vi.unstubAllGlobals());

const request = (email: string) => new Request('https://www.astepimmigration.space/api/v1/newsletter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
  body: JSON.stringify({ email, locale: 'fr', turnstileToken: crypto.randomUUID() }),
});

describe('newsletter opt-out integrity', () => {
  it('does not let a public signup undo an existing unsubscribe', async () => {
    const email = `${crypto.randomUUID()}@example.org`;
    const blindIndex = await createBlindIndex(email, env.BLIND_INDEX_SECRET);
    const unsubscribedAt = '2026-01-01T00:00:00.000Z';
    const originalCiphertext = await encryptPii(email, env.PII_ENCRYPTION_KEY_V1);
    await env.DB.prepare(
      `INSERT INTO newsletter_subscribers
       (id, email_ciphertext, email_blind_index, locale, unsubscribe_token, unsubscribed_at, created_at)
       VALUES (?1, ?2, ?3, 'en', ?4, ?5, ?6)`,
    ).bind(crypto.randomUUID(), originalCiphertext, blindIndex, crypto.randomUUID(), unsubscribedAt, unsubscribedAt).run();

    const send = vi.fn(async () => {});
    const localEnv = { ...env, EVENT_QUEUE: { send } } as unknown as Env;
    const response = await createNewsletterSubscription(request(email.toUpperCase()), localEnv, { waitUntil() {} });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ success: true });
    expect(await env.DB.prepare(
      'SELECT email_ciphertext, locale, unsubscribed_at FROM newsletter_subscribers WHERE email_blind_index = ?1',
    ).bind(blindIndex).first()).toMatchObject({
      email_ciphertext: originalCiphertext, locale: 'en', unsubscribed_at: unsubscribedAt,
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM newsletter_subscribers').first())
      .toMatchObject({ count: 1 });

    const newEmail = `${crypto.randomUUID()}@example.org`;
    expect((await createNewsletterSubscription(request(newEmail), localEnv, { waitUntil() {} })).status).toBe(202);
    expect(await env.DB.prepare(
      'SELECT unsubscribed_at FROM newsletter_subscribers WHERE email_blind_index = ?1',
    ).bind(await createBlindIndex(newEmail, env.BLIND_INDEX_SECRET)).first()).toMatchObject({ unsubscribed_at: null });
  });
});
