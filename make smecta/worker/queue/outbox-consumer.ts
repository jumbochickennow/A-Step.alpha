import type { Env } from '../env';
import { sendContactEmail } from '../integrations/contact-email';
import { decryptPii } from '../security/encryption';

interface ClaimedEvent {
  id: string;
  event_type: string;
  aggregate_id: string;
  attempts: number;
  provider_message_id: string | null;
}

interface DeliveryServices {
  sendContact: typeof sendContactEmail;
}

const defaultDeliveryServices: DeliveryServices = {
  sendContact: sendContactEmail,
};

interface QueueMessageLike {
  body: { outboxId?: string };
  ack(): void;
}

export interface QueueBatchLike { messages: QueueMessageLike[] }

class DeliveryError extends Error {
  constructor(message: string, readonly attempts: number) {
    super(message);
  }
}

function validUuid(value: string | undefined): value is string {
  return Boolean(value?.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

async function contactPayload(env: Env, aggregateId: string): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare(
    `SELECT id, name_ciphertext, email_ciphertext, phone_ciphertext,
       service_interest_ciphertext, message_ciphertext, locale, created_at
       FROM contact_submissions WHERE id = ?1 LIMIT 1`,
  ).bind(aggregateId).first<Record<string, string | null>>();
  if (!row) throw new Error('outbox_record_missing');
  return {
    id: row.id,
    name: await decryptPii(row.name_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
    email: await decryptPii(row.email_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
    phone: row.phone_ciphertext ? await decryptPii(row.phone_ciphertext, env.PII_ENCRYPTION_KEY_V1) : null,
    serviceInterest: row.service_interest_ciphertext
      ? await decryptPii(row.service_interest_ciphertext, env.PII_ENCRYPTION_KEY_V1) : null,
    message: await decryptPii(row.message_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
    locale: row.locale,
    createdAt: row.created_at,
  };
}

function retryDelaySeconds(attempts: number, lastError?: string): number {
  if (lastError?.includes('THROTT') || lastError?.includes('RATE_LIMIT')) return 10 * 60;
  return Math.min(300, 5 * (2 ** Math.max(0, attempts - 1)));
}

async function claimEvent(env: Env, outboxId: string): Promise<ClaimedEvent | null> {
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(
    `UPDATE outbox_events SET
       status = 'processing', attempts = attempts + 1, locked_at = ?1, updated_at = ?2
     WHERE id = ?3 AND status IN ('pending', 'failed') AND available_at <= ?1 AND attempts < 100
     RETURNING id, event_type, aggregate_id, attempts, provider_message_id`,
  ).bind(now, new Date(now * 1000).toISOString(), outboxId).first<ClaimedEvent>();
}

export async function deliverOutboxEvent(
  env: Env,
  outboxId: string,
  services: DeliveryServices = defaultDeliveryServices,
): Promise<void> {
  const event = await claimEvent(env, outboxId);
  if (!event) return;
  try {
    let providerMessageId = event.provider_message_id;
    if (event.event_type === 'contact.created' && !providerMessageId) {
      providerMessageId = await services.sendContact(env, event.aggregate_id, await contactPayload(env, event.aggregate_id));
      await env.DB.prepare(
        `UPDATE outbox_events SET provider_message_id = ?1, updated_at = ?2
         WHERE id = ?3 AND status = 'processing'`,
      ).bind(providerMessageId, new Date().toISOString(), event.id).run();
    }

    const completedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE outbox_events SET status = 'delivered', delivered_at = ?1, locked_at = NULL,
       provider_message_id = ?2, last_error = NULL, updated_at = ?1
       WHERE id = ?3 AND status = 'processing'`,
    ).bind(completedAt, providerMessageId, event.id).run();
  } catch (error) {
    const message = (error instanceof Error
      ? `${error.name}:${error.message}`
      : 'outbox_delivery_failed').slice(0, 500);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE outbox_events SET status = 'failed', available_at = ?1, locked_at = NULL,
       last_error = ?2, updated_at = ?3 WHERE id = ?4 AND status = 'processing'`,
    ).bind(now + retryDelaySeconds(event.attempts, message), message, new Date(now * 1000).toISOString(), event.id).run();
    throw new DeliveryError(message, event.attempts);
  }
}

export async function drainOutbox(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM idempotency_keys WHERE expires_at <= ?1').bind(now),
    env.DB.prepare(
      `UPDATE outbox_events SET status = 'failed', locked_at = NULL, available_at = ?1, updated_at = ?2
       WHERE status = 'processing' AND locked_at < ?3`,
    ).bind(now, new Date(now * 1000).toISOString(), now - 600),
  ]);
  const { results } = await env.DB.prepare(
    `SELECT id FROM outbox_events
     WHERE status IN ('pending', 'failed') AND available_at <= ?1 AND attempts < 100
     ORDER BY created_at ASC LIMIT 1`,
  ).bind(now).all<{ id: string }>();
  await Promise.all(results.map((event) => env.EVENT_QUEUE.send({ outboxId: event.id })));
}

export async function consumeOutbox(batch: QueueBatchLike, env: Env): Promise<void> {
  await Promise.all(batch.messages.map(async (message) => {
    const id = message.body?.outboxId;
    if (!validUuid(id)) { message.ack(); return; }
    try {
      await deliverOutboxEvent(env, id);
      message.ack();
    } catch {
      // Delivery state and backoff are durable in D1. Acknowledge the Queue
      // message; the minute cron will re-enqueue one eligible event at a time.
      message.ack();
    }
  }));
}
