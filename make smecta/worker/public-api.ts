import { randomToken, sha256 } from './crypto';
import type { Env, ExecutionContextLike } from './env';
import { HttpError, json, readJson, requireIdempotencyKey, requireMethod } from './http';
import { createBlindIndex } from './security/blind-index';
import { encryptPii } from './security/encryption';
import { verifyTurnstile } from './security/turnstile';
import {
  contactInputSchema,
  leadInputSchema,
  newsletterInputSchema,
  unsubscribeInputSchema,
} from './validation/public';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const GRANT_TTL_SECONDS = 5 * 60;

interface StoredResponse { response: string | null }
interface GuideAsset { slug: string; object_key: string }
interface Subscriber { id: string }

async function pii(value: string | undefined, env: Env): Promise<string | null> {
  return value ? encryptPii(value, env.PII_ENCRYPTION_KEY_V1) : null;
}

function enqueue(ctx: ExecutionContextLike, env: Env, eventId: string): void {
  ctx.waitUntil(env.EVENT_QUEUE.send({ outboxId: eventId }));
}

async function storedResponse<T>(env: Env, key: string, action: string, now: number): Promise<T | null> {
  const row = await env.DB.prepare(
    'SELECT response FROM idempotency_keys WHERE key = ?1 AND action = ?2 AND expires_at > ?3',
  ).bind(key, action, now).first<StoredResponse>();
  if (!row?.response) return null;
  try { return JSON.parse(row.response) as T; } catch { throw new HttpError(503, 'service_unavailable'); }
}

async function idempotentBatch<T>(
  env: Env,
  idempotencyKey: string,
  action: string,
  response: T,
  statements: D1PreparedStatement[],
  now: number,
): Promise<{ value: T; created: boolean }> {
  const key = `${action}:${idempotencyKey}`;
  const existing = await storedResponse<T>(env, key, action, now);
  if (existing) return { value: existing, created: false };
  const createdAt = new Date(now * 1000).toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO idempotency_keys (key, action, response, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(key, action, JSON.stringify(response), createdAt, now + IDEMPOTENCY_TTL_SECONDS),
      ...statements,
    ]);
    return { value: response, created: true };
  } catch {
    const raced = await storedResponse<T>(env, key, action, now);
    if (raced) return { value: raced, created: false };
    throw new HttpError(503, 'service_unavailable');
  }
}

export async function createGuideLead(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
  requireMethod(request, ['POST']);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = leadInputSchema.safeParse(await readJson(request, 4096));
  if (!parsed.success) throw new HttpError(400, 'validation_failed');
  const input = parsed.data;
  await verifyTurnstile(request, env, input.turnstileToken, 'lead_download');

  const asset = await env.DB.prepare(
    'SELECT slug, object_key FROM guide_assets WHERE id = ?1 LIMIT 1',
  ).bind(input.targetGuideId).first<GuideAsset>();
  if (!asset) throw new HttpError(404, 'guide_not_found');

  const now = Math.floor(Date.now() / 1000);
  const createdAt = new Date(now * 1000).toISOString();
  const leadId = crypto.randomUUID();
  const grantId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const grantToken = randomToken();
  const response = { success: true as const, grantToken };
  const result = await idempotentBatch(env, idempotencyKey, 'guide_lead', response, [
    env.DB.prepare(
      `INSERT INTO guide_download_leads
        (id, name_ciphertext, email_ciphertext, email_blind_index, phone_ciphertext, guide_slug, locale, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      leadId,
      await pii(input.name, env),
      await pii(input.email, env),
      await createBlindIndex(input.email, env.BLIND_INDEX_SECRET),
      await pii(input.phone, env),
      asset.slug,
      input.locale,
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO download_grants
        (id, lead_id, token, guide_slug, object_key, expires_at, consumed)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)`,
    ).bind(grantId, leadId, await sha256(grantToken), asset.slug, asset.object_key, now + GRANT_TTL_SECONDS),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'guide_lead.created', ?2, 'pending', 0, ?3, ?4, ?4)`,
    ).bind(eventId, leadId, now, createdAt),
  ], now);
  if (result.created) enqueue(ctx, env, eventId);
  return json(result.value, 201);
}

export async function createContact(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
  requireMethod(request, ['POST']);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = contactInputSchema.safeParse(await readJson(request, 8192));
  if (!parsed.success) throw new HttpError(400, 'validation_failed');
  const input = parsed.data;
  await verifyTurnstile(request, env, input.turnstileToken, 'contact');

  const now = Math.floor(Date.now() / 1000);
  const createdAt = new Date(now * 1000).toISOString();
  const contactId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const response = { success: true as const };
  const result = await idempotentBatch(env, idempotencyKey, 'contact', response, [
    env.DB.prepare(
      `INSERT INTO contact_submissions
        (id, name_ciphertext, email_ciphertext, email_blind_index, message_ciphertext, locale, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      contactId,
      await pii(input.name, env),
      await pii(input.email, env),
      await createBlindIndex(input.email, env.BLIND_INDEX_SECRET),
      await pii(input.message, env),
      input.locale,
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'contact.created', ?2, 'pending', 0, ?3, ?4, ?4)`,
    ).bind(eventId, contactId, now, createdAt),
  ], now);
  if (result.created) enqueue(ctx, env, eventId);
  return json(result.value, 202);
}

export async function createNewsletterSubscription(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
  requireMethod(request, ['POST']);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = newsletterInputSchema.safeParse(await readJson(request, 4096));
  if (!parsed.success) throw new HttpError(400, 'validation_failed');
  const input = parsed.data;
  await verifyTurnstile(request, env, input.turnstileToken, 'newsletter');

  const now = Math.floor(Date.now() / 1000);
  const createdAt = new Date(now * 1000).toISOString();
  const blindIndex = await createBlindIndex(input.email, env.BLIND_INDEX_SECRET);
  const existing = await env.DB.prepare(
    'SELECT id FROM newsletter_subscribers WHERE email_blind_index = ?1 LIMIT 1',
  ).bind(blindIndex).first<Subscriber>();
  const subscriberId = existing?.id ?? crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const unsubscribeToken = randomToken();
  const response = { success: true as const };
  const result = await idempotentBatch(env, idempotencyKey, 'newsletter', response, [
    env.DB.prepare(
      `INSERT INTO newsletter_subscribers
        (id, email_ciphertext, email_blind_index, locale, unsubscribe_token, unsubscribed_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)
       ON CONFLICT(email_blind_index) DO UPDATE SET
         email_ciphertext = excluded.email_ciphertext,
         locale = excluded.locale,
         unsubscribe_token = excluded.unsubscribe_token,
         unsubscribed_at = NULL`,
    ).bind(
      subscriberId,
      await pii(input.email, env),
      blindIndex,
      input.locale,
      await sha256(unsubscribeToken),
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'newsletter.subscribed', ?2, 'pending', 0, ?3, ?4, ?4)`,
    ).bind(eventId, subscriberId, now, createdAt),
  ], now);
  if (result.created) enqueue(ctx, env, eventId);
  return json(result.value, 202);
}

export async function unsubscribeNewsletter(request: Request, env: Env): Promise<Response> {
  requireMethod(request, ['POST']);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = unsubscribeInputSchema.safeParse(await readJson(request, 2048));
  if (!parsed.success) throw new HttpError(400, 'validation_failed');
  const now = Math.floor(Date.now() / 1000);
  const response = { success: true as const };
  const result = await idempotentBatch(env, idempotencyKey, 'newsletter_unsubscribe', response, [
    env.DB.prepare(
      'UPDATE newsletter_subscribers SET unsubscribed_at = ?1 WHERE unsubscribe_token = ?2 AND unsubscribed_at IS NULL',
    ).bind(new Date(now * 1000).toISOString(), await sha256(parsed.data.token)),
  ], now);
  return json(result.value);
}
