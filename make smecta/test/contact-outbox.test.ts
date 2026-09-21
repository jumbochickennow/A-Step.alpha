import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../worker/env';
import { deliverOutboxEvent } from '../worker/queue/outbox-consumer';
import { encryptPii } from '../worker/security/encryption';

const ENCRYPTION_KEY = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('contact delivery integrity', () => {
  it('keeps provider failures retryable and marks delivery only after provider success', async () => {
    const contactId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO contact_submissions
         (id, name_ciphertext, email_ciphertext, email_blind_index, phone_ciphertext,
          service_interest_ciphertext, message_ciphertext, locale, created_at)
         VALUES (?1, ?2, ?3, ?4, NULL, NULL, ?5, 'en', ?6)`,
      ).bind(
        contactId,
        await encryptPii('Contact Test', ENCRYPTION_KEY),
        await encryptPii('contact@example.com', ENCRYPTION_KEY),
        'test-blind-index',
        await encryptPii('Test message', ENCRYPTION_KEY),
        createdAt,
      ),
      env.DB.prepare(
        `INSERT INTO outbox_events
         (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
         VALUES (?1, 'contact.created', ?2, 'pending', 0, 0, ?3, ?3)`,
      ).bind(eventId, contactId, createdAt),
    ]);

    let emailCalls = 0;
    let providerFails = true;
    const deliveryEnv = {
      DB: env.DB,
      PII_ENCRYPTION_KEY_V1: ENCRYPTION_KEY,
    } as Env;
    const services = {
      async sendContact(_env: Env, submissionId: string, payload: Record<string, unknown>) {
        emailCalls += 1;
        expect(submissionId).toBe(contactId);
        expect(payload.email).toBe('contact@example.com');
        if (providerFails) throw new Error('provider unavailable');
        return 'provider-message-success';
      },
    };

    await expect(deliverOutboxEvent(deliveryEnv, eventId, services as never)).rejects.toThrow('provider unavailable');
    expect(await env.DB.prepare(
      `SELECT status, attempts, delivered_at, provider_message_id
       FROM outbox_events WHERE id = ?1`,
    ).bind(eventId).first()).toMatchObject({
      status: 'failed', attempts: 1, delivered_at: null, provider_message_id: null,
    });

    providerFails = false;
    await env.DB.prepare('UPDATE outbox_events SET available_at = 0 WHERE id = ?1').bind(eventId).run();
    await deliverOutboxEvent(deliveryEnv, eventId, services as never);
    expect(await env.DB.prepare(
      `SELECT status, attempts, delivered_at, provider_message_id
       FROM outbox_events WHERE id = ?1`,
    ).bind(eventId).first()).toMatchObject({
      status: 'delivered', attempts: 2, provider_message_id: 'provider-message-success',
    });

    await deliverOutboxEvent(deliveryEnv, eventId, services as never);
    expect(emailCalls).toBe(2);
  });

  it('completes a stored newsletter event without Google or email credentials', async () => {
    const eventId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO outbox_events
       (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'newsletter.subscribed', ?2, 'pending', 0, 0, ?3, ?3)`,
    ).bind(eventId, crypto.randomUUID(), createdAt).run();
    await deliverOutboxEvent({ DB: env.DB } as Env, eventId, {
      async sendContact() { throw new Error('unexpected email'); },
    });
    expect(await env.DB.prepare(
      'SELECT status, attempts, delivered_at FROM outbox_events WHERE id = ?1',
    ).bind(eventId).first()).toMatchObject({ status: 'delivered', attempts: 1 });
  });
});
