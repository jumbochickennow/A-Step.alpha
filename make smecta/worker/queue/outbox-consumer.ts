import { decodeSecretKey } from '../crypto';
import type { Env } from '../env';
import { HttpError } from '../http';
import {
  outboundBody,
  outboundDestination,
  outboundHeaders,
  requireSuccessfulDelivery,
  type OutboundEventType,
} from '../integrations/outbound-delivery';
import { decryptPii } from '../security/encryption';

const encoder = new TextEncoder();
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

interface ClaimedEvent {
  id: string;
  event_type: OutboundEventType;
  aggregate_id: string;
  attempts: number;
}

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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array {
  if (value.length !== 64 || !/^[0-9a-f]{64}$/.test(value)) throw new HttpError(401, 'invalid_webhook_signature');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

async function importWebhookKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const bytes = decodeSecretKey(secret);
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

async function signWebhookPayload(body: string, timestamp: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importWebhookKey(secret, ['sign']),
    encoder.encode(`${timestamp}.${body}`),
  );
  return toHex(new Uint8Array(signature));
}

/** Receiver-side verifier for the documented signature envelope and replay window. */
export async function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!signatureHeader || signatureHeader.length !== 80) return false;
  const match = /^t=(\d{10}),v1=([0-9a-f]{64})$/.exec(signatureHeader);
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;
  try {
    return crypto.subtle.verify(
      'HMAC',
      await importWebhookKey(secret, ['verify']),
      fromHex(match[2]),
      encoder.encode(`${match[1]}.${body}`),
    );
  } catch {
    return false;
  }
}

async function eventPayload(env: Env, event: ClaimedEvent): Promise<Record<string, unknown>> {
  if (event.event_type === 'guide_lead.created') {
    const row = await env.DB.prepare(
      `SELECT id, full_name_ciphertext, email_ciphertext, guide_slug, guide_language,
       target_country, locale, created_at
       FROM guide_download_leads WHERE id = ?1 LIMIT 1`,
    ).bind(event.aggregate_id).first<Record<string, string | null>>();
    if (!row) throw new Error('outbox_record_missing');
    return {
      id: row.id,
      name: await decryptPii(row.full_name_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(row.email_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      guideSlug: row.guide_slug,
      guideLanguage: row.guide_language,
      targetCountry: row.target_country,
      locale: row.locale,
      createdAt: row.created_at,
    };
  }
  if (event.event_type === 'contact.created') {
    const row = await env.DB.prepare(
      `SELECT id, name_ciphertext, email_ciphertext, phone_ciphertext,
       service_interest_ciphertext, message_ciphertext, locale, created_at
       FROM contact_submissions WHERE id = ?1 LIMIT 1`,
    ).bind(event.aggregate_id).first<Record<string, string | null>>();
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
  if (event.event_type === 'newsletter.subscribed') {
    const row = await env.DB.prepare(
      `SELECT id, email_ciphertext, locale, created_at
       FROM newsletter_subscribers WHERE id = ?1 LIMIT 1`,
    ).bind(event.aggregate_id).first<Record<string, string | null>>();
    if (!row) throw new Error('outbox_record_missing');
    return {
      id: row.id,
      email: await decryptPii(row.email_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale,
      consentedAt: row.created_at,
    };
  }
  throw new Error('unsupported_outbox_event');
}

function retryDelaySeconds(attempts: number, lastError?: string): number {
  if (lastError === 'webhook_http_429') return 10 * 60;
  return Math.min(300, 5 * (2 ** Math.max(0, attempts - 1)));
}

async function claimEvent(env: Env, outboxId: string): Promise<ClaimedEvent | null> {
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(
    `UPDATE outbox_events SET
       status = 'processing', attempts = attempts + 1, locked_at = ?1, updated_at = ?2
     WHERE id = ?3 AND status IN ('pending', 'failed') AND available_at <= ?1 AND attempts < 100
     RETURNING id, event_type, aggregate_id, attempts`,
  ).bind(now, new Date(now * 1000).toISOString(), outboxId).first<ClaimedEvent>();
}

export async function deliverOutboxEvent(env: Env, outboxId: string): Promise<void> {
  const event = await claimEvent(env, outboxId);
  if (!event) return;
  try {
    const url = outboundDestination(env);
    const body = outboundBody(url, event, await eventPayload(env, event));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signWebhookPayload(body, timestamp, env.WEBHOOK_HMAC_SECRET);
    const headers = outboundHeaders(url, event.id, `t=${timestamp},v1=${signature}`);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
    await requireSuccessfulDelivery(url, response);
    const completedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE outbox_events SET status = 'delivered', delivered_at = ?1, locked_at = NULL,
       last_error = NULL, updated_at = ?1 WHERE id = ?2 AND status = 'processing'`,
    ).bind(completedAt, event.id).run();
  } catch (error) {
    const message = (error instanceof Error ? error.message : 'webhook_failed').slice(0, 500);
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
