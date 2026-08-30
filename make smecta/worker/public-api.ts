import { base64UrlDecode, base64UrlEncode, randomToken, sha256, signHmac, verifyHmac } from './crypto';
import type { Env, ExecutionContextLike } from './env';
import { HttpError, json, readJson, requireIdempotencyKey, requireMethod } from './http';
import { createBlindIndex } from './security/blind-index';
import { encryptPii } from './security/encryption';
import { verifyTurnstile } from './security/turnstile';
import { seedAdminCatalog } from './catalog-seed';
import {
  contactInputSchema,
  leadInputSchema,
  newsletterInputSchema,
  unsubscribeInputSchema,
} from './validation/public';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const GRANT_TTL_SECONDS = 5 * 60;
const CONTACT_CONFIRMATION_TTL_SECONDS = 24 * 60 * 60;

interface StoredResponse { response: string | null }
interface GuideAsset {
  id: string;
  slug: string;
  object_key: string;
  r2_key_en: string | null;
  r2_key_fr: string | null;
  r2_key_ar: string | null;
}
interface Subscriber { id: string }

interface PublicGuideRow {
  id: string; slug: string; category: string; file_type: string; page_count: number;
  cover_path: string | null; published: number; sort_order: number;
  content_updated_at: string; translations: string;
  r2_key_en: string | null; r2_key_fr: string | null; r2_key_ar: string | null;
}

interface PublicOpportunityRow {
  id: string; slug: string; country: string; categories: string; image_path: string | null;
  apply_url: string | null; opens_at: string | null; deadline: string | null;
  featured: number; published: number; translations: string;
}

function catalogJson(value: string): unknown {
  try { return JSON.parse(value) as unknown; } catch { throw new HttpError(503, 'invalid_stored_data'); }
}

async function pii(value: string | undefined, env: Env): Promise<string | null> {
  return value ? encryptPii(value, env.PII_ENCRYPTION_KEY_V1) : null;
}

function enqueue(ctx: ExecutionContextLike, env: Env, eventId: string): void {
  ctx.waitUntil(env.EVENT_QUEUE.send({ outboxId: eventId }));
}

export async function listGuideAvailability(request: Request, env: Env): Promise<Response> {
  requireMethod(request, ['GET']);
  await seedAdminCatalog(env);
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.slug, g.category, g.file_type, g.page_count, g.cover_path,
     g.published, g.sort_order, g.content_updated_at, g.translations,
     COALESCE(g.r2_key_en, a.r2_key_en) AS r2_key_en,
     COALESCE(g.r2_key_fr, a.r2_key_fr) AS r2_key_fr,
     COALESCE(g.r2_key_ar, a.r2_key_ar) AS r2_key_ar
     FROM guides g LEFT JOIN guide_assets a ON a.slug = g.slug
     WHERE g.published = 1 ORDER BY g.sort_order ASC LIMIT 100`,
  ).all<PublicGuideRow>();
  return json({
    items: results.map((row) => ({
      id: row.id,
      slug: row.slug,
      category: row.category,
      filePath: null,
      fileType: row.file_type,
      pageCount: row.page_count,
      coverPath: row.cover_path,
      published: row.published === 1,
      sortOrder: row.sort_order,
      contentUpdatedAt: row.content_updated_at,
      translations: catalogJson(row.translations),
      availableLanguages: {
        en: Boolean(row.r2_key_en),
        fr: Boolean(row.r2_key_fr),
        ar: Boolean(row.r2_key_ar),
      },
    })),
  });
}

export async function listPublishedOpportunities(request: Request, env: Env): Promise<Response> {
  requireMethod(request, ['GET']);
  await seedAdminCatalog(env);
  const { results } = await env.DB.prepare(
    `SELECT id, slug, country, categories, image_path, apply_url, opens_at, deadline,
     featured, published, translations FROM opportunities
     WHERE published = 1 ORDER BY deadline IS NULL ASC, deadline ASC LIMIT 100`,
  ).all<PublicOpportunityRow>();
  return json({ items: results.map((row) => ({
    id: row.id,
    slug: row.slug,
    country: row.country,
    categories: catalogJson(row.categories),
    imagePath: row.image_path,
    applyUrl: row.apply_url,
    opensAt: row.opens_at,
    deadline: row.deadline,
    featured: row.featured === 1,
    published: row.published === 1,
    translations: catalogJson(row.translations),
  })) });
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
    `SELECT id, slug, object_key, r2_key_en, r2_key_fr, r2_key_ar
     FROM guide_assets WHERE id = ?1 LIMIT 1`,
  ).bind(input.guideId).first<GuideAsset>();
  if (!asset) throw new HttpError(404, 'guide_not_found');
  const requestedKey = input.guideLanguage === 'fr'
    ? asset.r2_key_fr
    : input.guideLanguage === 'ar' ? asset.r2_key_ar : asset.r2_key_en;
  const objectKey = requestedKey ?? asset.r2_key_en ?? asset.object_key;

  const now = Math.floor(Date.now() / 1000);
  const createdAt = new Date(now * 1000).toISOString();
  const leadId = crypto.randomUUID();
  const grantId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const grantToken = randomToken();
  const nameCiphertext = await encryptPii(input.fullName, env.PII_ENCRYPTION_KEY_V1);
  const emailCiphertext = await encryptPii(input.email, env.PII_ENCRYPTION_KEY_V1);
  const response = {
    success: true as const,
    downloadUrl: `/api/v1/download/${encodeURIComponent(grantToken)}`,
  };
  const result = await idempotentBatch(env, idempotencyKey, 'guide_lead', response, [
    env.DB.prepare(
      `INSERT INTO guide_download_leads
        (id, name_ciphertext, full_name_ciphertext, email_ciphertext, email_blind_index,
         phone_ciphertext, guide_id, guide_slug, guide_language, target_country, locale, created_at)
       VALUES (?1, ?2, ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?9, ?10)`,
    ).bind(
      leadId,
      nameCiphertext,
      emailCiphertext,
      await createBlindIndex(input.email, env.BLIND_INDEX_SECRET),
      asset.id,
      asset.slug,
      input.guideLanguage,
      input.targetCountry ?? null,
      input.locale,
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO download_grants
        (id, lead_id, token, guide_id, guide_slug, guide_language, object_key, expires_at, consumed)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)`,
    ).bind(grantId, leadId, await sha256(grantToken), asset.id, asset.slug, input.guideLanguage, objectKey, now + GRANT_TTL_SECONDS),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'guide_lead.created', ?2, 'pending', 0, ?3, ?4, ?4)`,
    ).bind(eventId, leadId, now, createdAt),
  ], now);
  if (result.created) enqueue(ctx, env, eventId);
  return json(result.value);
}

export async function createContact(request: Request, env: Env, _ctx: ExecutionContextLike): Promise<Response> {
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
  const confirmationPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    eventId,
    exp: now + CONTACT_CONFIRMATION_TTL_SECONDS,
  })));
  const confirmationToken = `${confirmationPayload}.${await signHmac(confirmationPayload, env.WEBHOOK_HMAC_SECRET)}`;
  const response = { success: true as const, delivery: 'browser' as const, confirmationToken };
  const result = await idempotentBatch(env, idempotencyKey, 'contact', response, [
    env.DB.prepare(
      `INSERT INTO contact_submissions
        (id, name_ciphertext, email_ciphertext, email_blind_index, phone_ciphertext,
         service_interest_ciphertext, message_ciphertext, locale, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(
      contactId,
      await pii(input.name, env),
      await pii(input.email, env),
      await createBlindIndex(input.email, env.BLIND_INDEX_SECRET),
      await pii(input.phone, env),
      await pii(input.serviceInterest, env),
      await pii(input.message, env),
      input.locale,
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'contact.created', ?2, 'pending', 0, ?3, ?4, ?4)`,
    ).bind(eventId, contactId, now + 5 * 60, createdAt),
  ], now);
  return json(result.value, 202);
}

export async function confirmContactDelivery(request: Request, env: Env): Promise<Response> {
  requireMethod(request, ['POST']);
  const body = await readJson(request, 4096);
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !('confirmationToken' in body)
    || typeof body.confirmationToken !== 'string' || body.confirmationToken.length > 2048) {
    throw new HttpError(400, 'invalid_delivery_confirmation');
  }
  const [payload, signature, extra] = body.confirmationToken.split('.');
  if (!payload || !signature || extra || !await verifyHmac(payload, signature, env.WEBHOOK_HMAC_SECRET)) {
    throw new HttpError(400, 'invalid_delivery_confirmation');
  }
  let confirmation: { eventId?: unknown; exp?: unknown };
  try {
    confirmation = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as typeof confirmation;
  } catch {
    throw new HttpError(400, 'invalid_delivery_confirmation');
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof confirmation.eventId !== 'string' || !/^[0-9a-f-]{36}$/i.test(confirmation.eventId)
    || typeof confirmation.exp !== 'number' || confirmation.exp <= now) {
    throw new HttpError(400, 'invalid_delivery_confirmation');
  }
  const deliveredAt = new Date(now * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE outbox_events SET status = 'delivered', delivered_at = ?1, locked_at = NULL,
     last_error = NULL, updated_at = ?1
     WHERE id = ?2 AND event_type = 'contact.created' AND status != 'delivered'`,
  ).bind(deliveredAt, confirmation.eventId).run();
  return json({ success: true });
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
