import { z } from 'zod';
import type { AdminIdentity } from './auth/auth-api';
import { decryptPii } from './security/encryption';
import { createResourceRef, resolveResourceRef } from './security/resource-ref';
import type { Env } from './env';
import { HttpError, json, readJson, requireIdempotencyKey, requireMethod } from './http';
import { imageExtensionForRequest, validatedImageBody } from './security/image-upload';
import { validatedPdfBytes } from './security/pdf-upload';
import { seedAdminCatalog } from './catalog-seed';

const copySchema = z.object({ title: z.string().trim().min(1).max(180), description: z.string().trim().min(1).max(4000) }).strict();
const translationsSchema = z.object({ en: copySchema, fr: copySchema, ar: copySchema }).strict();
const draftCopySchema = z.object({ title: z.string().trim().max(180), description: z.string().trim().max(4000) }).strict();
const draftTranslationsSchema = z.object({ en: draftCopySchema, fr: draftCopySchema, ar: draftCopySchema }).strict();
const nullableGuidePath = z.string().trim().max(512).regex(/^[a-z0-9][a-z0-9._/-]*\.pdf$/)
  .refine((value) => !value.includes('..') && !value.includes('//')).nullable();
const resourceRefSchema = z.string().min(64).max(768).regex(/^r2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
const CONTENT_ROLES = new Set<AdminIdentity['role']>(['superadmin', 'admin', 'owner', 'editor']);
const DATA_ROLES = new Set<AdminIdentity['role']>(['superadmin', 'admin', 'owner', 'analyst']);

function requireRole(identity: AdminIdentity, allowed: ReadonlySet<AdminIdentity['role']>): void {
  if (!allowed.has(identity.role)) throw new HttpError(403, 'forbidden');
}

const guideSchema = z.object({
  id: resourceRefSchema.optional(),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  category: z.string().trim().min(1).max(80),
  filePath: nullableGuidePath,
  r2KeyEn: nullableGuidePath,
  r2KeyFr: nullableGuidePath,
  r2KeyAr: nullableGuidePath,
  fileType: z.literal('PDF'),
  pageCount: z.number().int().min(1).max(2000),
  coverPath: z.string().max(512).regex(/^\/assets\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif)$/).nullable(),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
  contentUpdatedAt: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/),
  translations: translationsSchema,
}).strict();

const opportunitySchema = z.object({
  id: resourceRefSchema.optional(),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  country: z.string().trim().min(1).max(80),
  categories: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  // Legacy clients may include this server-owned pointer. It is deliberately ignored.
  imagePath: z.unknown().optional(),
  applyUrl: z.string().url().refine((value) => value.startsWith('https://')).nullable(),
  opensAt: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deadline: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  featured: z.boolean(),
  published: z.boolean(),
  translations: draftTranslationsSchema,
}).strict().superRefine((value, context) => {
  if (!value.published) return;
  for (const locale of ['en', 'fr', 'ar'] as const) {
    for (const field of ['title', 'description'] as const) {
      if (!value.translations[locale][field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'translation_required',
          path: ['translations', locale, field],
        });
      }
    }
  }
});

function opportunityValidationCode(error: z.ZodError): string {
  if (error.issues.some((issue) => issue.path[0] === 'translations')) return 'translation_required';
  if (error.issues.some((issue) => issue.path[0] === 'applyUrl')) return 'invalid_opportunity_url';
  return 'invalid_opportunity_details';
}

interface GuideRow {
  id: string; slug: string; category: string; storage_object_path: string | null; file_type: string;
  r2_key_en: string | null; r2_key_fr: string | null; r2_key_ar: string | null;
  page_count: number; cover_path: string | null; published: number; sort_order: number;
  content_updated_at: string; translations: string;
}

interface OpportunityRow {
  id: string; slug: string; country: string; categories: string; image_path: string | null;
  apply_url: string | null; opens_at: string | null; deadline: string | null; featured: number;
  published: number; translations: string;
}

function parsedJson<T>(value: string, schema: z.ZodType<T>): T {
  try { return schema.parse(JSON.parse(value)); } catch { throw new HttpError(503, 'invalid_stored_data'); }
}

async function mutate(statement: D1PreparedStatement): Promise<void> {
  try {
    const result = await statement.run();
    if (result.meta.changes !== 1) throw new HttpError(404, 'not_found');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw new HttpError(409, 'conflict');
    throw new HttpError(503, 'service_unavailable');
  }
}

async function deterministicUploadId(scope: string, idempotencyKey: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`a-step:upload:v1\0${scope}\0${idempotencyKey}`),
  ));
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function guideFromRow(row: GuideRow, env: Env, identity: AdminIdentity) {
  return {
    id: await createResourceRef(row.id, 'guide', identity.id, env.RESOURCE_REF_SECRET),
    slug: row.slug,
    category: row.category,
    filePath: row.storage_object_path,
    r2KeyEn: row.r2_key_en,
    r2KeyFr: row.r2_key_fr,
    r2KeyAr: row.r2_key_ar,
    availableLanguages: { en: Boolean(row.r2_key_en), fr: Boolean(row.r2_key_fr), ar: Boolean(row.r2_key_ar) },
    fileType: row.file_type,
    pageCount: row.page_count,
    coverPath: row.cover_path,
    published: row.published === 1,
    sortOrder: row.sort_order,
    contentUpdatedAt: row.content_updated_at,
    translations: parsedJson(row.translations, translationsSchema),
  };
}

async function opportunityFromRow(row: OpportunityRow, env: Env, identity: AdminIdentity) {
  return {
    id: await createResourceRef(row.id, 'opportunity', identity.id, env.RESOURCE_REF_SECRET),
    slug: row.slug,
    country: row.country,
    categories: parsedJson(row.categories, z.array(z.string())),
    imagePath: row.image_path,
    applyUrl: row.apply_url,
    opensAt: row.opens_at,
    deadline: row.deadline,
    featured: row.featured === 1,
    published: row.published === 1,
    translations: parsedJson(row.translations, draftTranslationsSchema),
  };
}

async function guides(request: Request, env: Env, identity: AdminIdentity, id?: string): Promise<Response> {
  if (request.method === 'GET' && !id) {
    await seedAdminCatalog(env);
    const { results } = await env.DB.prepare(
      `SELECT g.id, g.slug, g.category, g.storage_object_path,
       COALESCE(g.r2_key_en, a.r2_key_en) AS r2_key_en,
       COALESCE(g.r2_key_fr, a.r2_key_fr) AS r2_key_fr,
       COALESCE(g.r2_key_ar, a.r2_key_ar) AS r2_key_ar,
       g.file_type, g.page_count, g.cover_path, g.published, g.sort_order,
       g.content_updated_at, g.translations
       FROM guides g LEFT JOIN guide_assets a ON a.slug = g.slug
       ORDER BY g.sort_order ASC LIMIT 100`,
    ).all<GuideRow>();
    return json({ items: await Promise.all(results.map((row) => guideFromRow(row, env, identity))) });
  }
  if (id && !resourceRefSchema.safeParse(id).success) throw new HttpError(404, 'not_found');
  if (request.method === 'POST' && !id) {
    const parsed = guideSchema.safeParse(await readJson(request, 65_536));
    if (!parsed.success || parsed.data.id) throw new HttpError(400, 'validation_failed');
    const input = parsed.data;
    const databaseId = crypto.randomUUID();
    const now = new Date().toISOString();
    await mutate(env.DB.prepare(
      `INSERT INTO guides
        (id, user_id, slug, category, storage_object_path, r2_key_en, r2_key_fr, r2_key_ar,
         file_type, page_count, cover_path, published, sort_order, content_updated_at,
         translations, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)`,
    ).bind(
      databaseId, identity.id, input.slug, input.category, null,
      null, null, null, input.fileType, input.pageCount,
      input.coverPath, input.published ? 1 : 0, input.sortOrder, input.contentUpdatedAt,
      JSON.stringify(input.translations), now,
    ));
    return json({
      success: true,
      resourceId: await createResourceRef(databaseId, 'guide', identity.id, env.RESOURCE_REF_SECRET),
    }, 201);
  }
  if (request.method === 'PUT' && id) {
    const parsed = guideSchema.safeParse(await readJson(request, 65_536));
    if (!parsed.success || (parsed.data.id && parsed.data.id !== id)) throw new HttpError(400, 'validation_failed');
    const input = parsed.data;
    const databaseId = await resolveResourceRef(id, 'guide', identity.id, env.RESOURCE_REF_SECRET);
    await mutate(env.DB.prepare(
      `UPDATE guides SET slug = ?1, category = ?2, file_type = ?3,
       page_count = ?4, cover_path = ?5, published = ?6, sort_order = ?7,
       content_updated_at = ?8, translations = ?9, updated_at = ?10
       WHERE id = ?11`,
    ).bind(
      input.slug, input.category, input.fileType, input.pageCount, input.coverPath,
      input.published ? 1 : 0, input.sortOrder, input.contentUpdatedAt,
      JSON.stringify(input.translations), new Date().toISOString(), databaseId,
    ));
    return json({ success: true });
  }
  if (request.method === 'DELETE' && id) {
    const databaseId = await resolveResourceRef(id, 'guide', identity.id, env.RESOURCE_REF_SECRET);
    const stored = await env.DB.prepare(
      `SELECT g.storage_object_path, g.r2_key_en, g.r2_key_fr, g.r2_key_ar,
       a.object_key, a.r2_key_en AS asset_key_en, a.r2_key_fr AS asset_key_fr,
       a.r2_key_ar AS asset_key_ar
       FROM guides g LEFT JOIN guide_assets a ON a.id = g.id WHERE g.id = ?1 LIMIT 1`,
    ).bind(databaseId).first<Record<string, string | null>>();
    if (!stored) throw new HttpError(404, 'not_found');
    const [deleted] = await env.DB.batch([
      env.DB.prepare('DELETE FROM guides WHERE id = ?1').bind(databaseId),
      env.DB.prepare('DELETE FROM guide_assets WHERE id = ?1').bind(databaseId),
    ]);
    if (deleted.meta.changes !== 1) throw new HttpError(404, 'not_found');
    const objectKeys = [...new Set(Object.values(stored).filter((value): value is string => Boolean(value)))];
    if (objectKeys.length > 0) await env.GUIDES_BUCKET.delete(objectKeys);
    return json({ success: true });
  }
  throw new HttpError(405, 'method_not_allowed');
}

async function uploadGuidePdf(
  request: Request,
  env: Env,
  identity: AdminIdentity,
  id: string,
  languageValue: string,
): Promise<Response> {
  requireMethod(request, ['PUT']);
  if (!resourceRefSchema.safeParse(id).success) throw new HttpError(404, 'not_found');
  const language = z.enum(['en', 'fr', 'ar']).safeParse(languageValue);
  if (!language.success) throw new HttpError(404, 'not_found');
  const databaseId = await resolveResourceRef(id, 'guide', identity.id, env.RESOURCE_REF_SECRET);
  const idempotencyKey = requireIdempotencyKey(request);
  const column = { en: 'r2_key_en', fr: 'r2_key_fr', ar: 'r2_key_ar' }[language.data];
  const guide = await env.DB.prepare(
    `SELECT slug, ${column} AS previous_key FROM guides WHERE id = ?1 LIMIT 1`,
  ).bind(databaseId).first<{ slug: string; previous_key: string | null }>();
  if (!guide) throw new HttpError(404, 'not_found');

  const bytes = await validatedPdfBytes(request);
  const objectId = await deterministicUploadId(`guide:${databaseId}:${language.data}`, idempotencyKey);
  const objectKey = `a-step-guides/${databaseId}/${language.data}/${objectId}.pdf`;
  let createdObject = false;
  try {
    const stored = await env.GUIDES_BUCKET.put(objectKey, bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: {
        contentType: 'application/pdf',
        contentDisposition: `attachment; filename="${guide.slug}-${language.data}.pdf"`,
      },
      customMetadata: { guideId: databaseId, language: language.data },
    });
    createdObject = stored !== null;
  } catch (error) {
    console.error('[Upload] Guide R2 write failed', {
      guideId: databaseId,
      language: language.data,
      type: error instanceof Error ? error.name : 'unknown',
      detail: error instanceof Error ? error.message : 'unknown',
    });
    throw new HttpError(503, 'upload_storage_failed');
  }

  const now = new Date().toISOString();
  try {
    const [updated] = await env.DB.batch([
      env.DB.prepare(
        `UPDATE guides SET ${column} = ?1,
         storage_object_path = CASE WHEN ?2 = 'en' THEN ?1 ELSE storage_object_path END,
         updated_at = ?3 WHERE id = ?4 AND ${column} IS ?5`,
      ).bind(objectKey, language.data, now, databaseId, guide.previous_key),
      env.DB.prepare(
        `INSERT INTO guide_assets
          (id, slug, object_key, r2_key_en, r2_key_fr, r2_key_ar, created_at)
         SELECT ?1, ?2, ?3,
           CASE WHEN ?4 = 'en' THEN ?3 ELSE NULL END,
           CASE WHEN ?4 = 'fr' THEN ?3 ELSE NULL END,
           CASE WHEN ?4 = 'ar' THEN ?3 ELSE NULL END, ?5
         WHERE EXISTS (SELECT 1 FROM guides WHERE id = ?1 AND ${column} = ?3)
         ON CONFLICT(id) DO UPDATE SET
           slug = excluded.slug,
           ${column} = ?3,
           object_key = CASE WHEN ?4 = 'en' THEN ?3 ELSE guide_assets.object_key END`,
      ).bind(databaseId, guide.slug, objectKey, language.data, now),
    ]);
    if (updated.meta.changes !== 1) throw new HttpError(409, 'upload_conflict');
  } catch (error) {
    if (createdObject) await env.GUIDES_BUCKET.delete(objectKey);
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'upload_metadata_failed');
  }
  if (guide.previous_key && guide.previous_key !== objectKey) {
    await env.GUIDES_BUCKET.delete(guide.previous_key).catch(() => undefined);
  }
  return json({ success: true, objectKey });
}

async function opportunities(request: Request, env: Env, identity: AdminIdentity, id?: string): Promise<Response> {
  if (request.method === 'GET' && !id) {
    await seedAdminCatalog(env);
    const { results } = await env.DB.prepare(
      `SELECT id, slug, country, categories, image_path, apply_url, opens_at, deadline,
       featured, published, translations FROM opportunities
       ORDER BY deadline IS NULL ASC, deadline ASC LIMIT 100`,
    ).all<OpportunityRow>();
    return json({ items: await Promise.all(results.map((row) => opportunityFromRow(row, env, identity))) });
  }
  if (id && !resourceRefSchema.safeParse(id).success) throw new HttpError(404, 'not_found');
  if (request.method === 'POST' && !id) {
    const parsed = opportunitySchema.safeParse(await readJson(request, 65_536));
    if (!parsed.success) throw new HttpError(400, opportunityValidationCode(parsed.error));
    if (parsed.data.id) throw new HttpError(400, 'invalid_opportunity_details');
    const input = parsed.data;
    const databaseId = crypto.randomUUID();
    const now = new Date().toISOString();
    await mutate(env.DB.prepare(
      `INSERT INTO opportunities
        (id, user_id, slug, country, categories, image_path, apply_url, opens_at, deadline,
         featured, published, translations, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`,
    ).bind(
      databaseId, identity.id, input.slug, input.country, JSON.stringify(input.categories),
      null, input.applyUrl, input.opensAt, input.deadline, input.featured ? 1 : 0,
      input.published ? 1 : 0, JSON.stringify(input.translations), now,
    ));
    return json({
      success: true,
      resourceId: await createResourceRef(databaseId, 'opportunity', identity.id, env.RESOURCE_REF_SECRET),
    }, 201);
  }
  if (request.method === 'PUT' && id) {
    const parsed = opportunitySchema.safeParse(await readJson(request, 65_536));
    if (!parsed.success) throw new HttpError(400, opportunityValidationCode(parsed.error));
    if (parsed.data.id && parsed.data.id !== id) throw new HttpError(400, 'invalid_opportunity_details');
    const input = parsed.data;
    const databaseId = await resolveResourceRef(id, 'opportunity', identity.id, env.RESOURCE_REF_SECRET);
    await mutate(env.DB.prepare(
      `UPDATE opportunities SET slug = ?1, country = ?2, categories = ?3,
       apply_url = ?4, opens_at = ?5, deadline = ?6, featured = ?7, published = ?8,
       translations = ?9, updated_at = ?10 WHERE id = ?11`,
    ).bind(
      input.slug, input.country, JSON.stringify(input.categories), input.applyUrl,
      input.opensAt, input.deadline, input.featured ? 1 : 0, input.published ? 1 : 0,
      JSON.stringify(input.translations), new Date().toISOString(), databaseId,
    ));
    return json({ success: true });
  }
  if (request.method === 'DELETE' && id) {
    const databaseId = await resolveResourceRef(id, 'opportunity', identity.id, env.RESOURCE_REF_SECRET);
    const current = await env.DB.prepare('SELECT image_path FROM opportunities WHERE id = ?1 LIMIT 1')
      .bind(databaseId).first<{ image_path: string | null }>();
    if (!current) throw new HttpError(404, 'not_found');
    await mutate(env.DB.prepare('DELETE FROM opportunities WHERE id = ?1').bind(databaseId));
    const objectKey = opportunityObjectKey(current.image_path);
    if (objectKey) await env.OPPORTUNITY_IMAGES_BUCKET.delete(objectKey);
    return json({ success: true });
  }
  throw new HttpError(405, 'method_not_allowed');
}

function opportunityObjectKey(imagePath: string | null): string | null {
  const match = /^\/api\/v1\/opportunity-images\/([0-9a-f-]{36}\.(?:png|jpe?g|webp|avif))$/i.exec(imagePath ?? '');
  return match ? `opportunity-images/${match[1]}` : null;
}

async function uploadOpportunityImage(
  request: Request,
  env: Env,
  identity: AdminIdentity,
  id: string,
): Promise<Response> {
  requireMethod(request, ['PUT']);
  if (!resourceRefSchema.safeParse(id).success) throw new HttpError(404, 'not_found');
  const databaseId = await resolveResourceRef(id, 'opportunity', identity.id, env.RESOURCE_REF_SECRET);
  const idempotencyKey = requireIdempotencyKey(request);
  const current = await env.DB.prepare(
    'SELECT image_path FROM opportunities WHERE id = ?1 LIMIT 1',
  ).bind(databaseId).first<{ image_path: string | null }>();
  if (!current) throw new HttpError(404, 'not_found');

  const extension = imageExtensionForRequest(request);
  const objectId = await deterministicUploadId(`opportunity:${databaseId}`, idempotencyKey);
  const objectName = `${objectId}.${extension}`;
  const objectKey = `opportunity-images/${objectName}`;
  const imagePath = `/api/v1/opportunity-images/${objectName}`;
  const contentType = request.headers.get('Content-Type')!.toLowerCase();
  let createdObject = false;
  try {
    const validated = await validatedImageBody(request);
    const [storageResult, validationResult] = await Promise.allSettled([
      env.OPPORTUNITY_IMAGES_BUCKET.put(objectKey, validated.body, {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
        customMetadata: { opportunityId: databaseId },
      }),
      validated.completion,
    ]);
    createdObject = storageResult.status === 'fulfilled' && storageResult.value !== null;
    if (validationResult.status === 'rejected') {
      if (createdObject) await env.OPPORTUNITY_IMAGES_BUCKET.delete(objectKey);
      if (validationResult.reason instanceof HttpError) throw validationResult.reason;
      throw new HttpError(503, 'upload_storage_failed');
    }
    if (storageResult.status === 'rejected') throw storageResult.reason;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('[Upload] Opportunity image R2 write failed', {
      opportunityId: databaseId,
      type: error instanceof Error ? error.name : 'unknown',
      detail: error instanceof Error ? error.message : 'unknown',
    });
    throw new HttpError(503, 'upload_storage_failed');
  }

  try {
    await mutate(env.DB.prepare(
      'UPDATE opportunities SET image_path = ?1, updated_at = ?2 WHERE id = ?3 AND image_path IS ?4',
    ).bind(imagePath, new Date().toISOString(), databaseId, current.image_path));
  } catch (error) {
    if (createdObject) await env.OPPORTUNITY_IMAGES_BUCKET.delete(objectKey);
    if (error instanceof HttpError && error.status === 404) throw new HttpError(409, 'upload_conflict');
    if (error instanceof HttpError) throw new HttpError(503, 'upload_metadata_failed');
    throw error;
  }

  const oldObjectKey = opportunityObjectKey(current.image_path);
  if (oldObjectKey && oldObjectKey !== objectKey) await env.OPPORTUNITY_IMAGES_BUCKET.delete(oldObjectKey);
  return json({ success: true, imagePath });
}

async function adminRecords(env: Env, identity: AdminIdentity, table: string): Promise<Response> {
  if (table === 'guide_download_leads') {
    const { results } = await env.DB.prepare(
      `SELECT id, full_name_ciphertext, email_ciphertext, guide_slug, guide_language,
       target_country, locale, created_at
       FROM guide_download_leads ORDER BY created_at DESC LIMIT 100`,
    ).all<Record<string, string | null>>();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id!, 'lead', identity.id, env.RESOURCE_REF_SECRET),
      submittedAt: row.created_at,
      name: await decryptPii(row.full_name_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(row.email_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      guideSlug: row.guide_slug,
      guideLanguage: row.guide_language,
      targetCountry: row.target_country,
      locale: row.locale,
    })));
    return json({ items });
  }
  if (table === 'contact_messages') {
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.name_ciphertext, c.email_ciphertext, c.phone_ciphertext,
       c.service_interest_ciphertext, c.message_ciphertext, c.locale, c.created_at,
       e.status AS delivery_status, e.attempts AS delivery_attempts,
       e.delivered_at, e.last_error AS delivery_error
       FROM contact_submissions c
       LEFT JOIN outbox_events e
         ON e.aggregate_id = c.id AND e.event_type = 'contact.created'
       ORDER BY c.created_at DESC LIMIT 100`,
    ).all<Record<string, string | number | null>>();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(String(row.id), 'contact', identity.id, env.RESOURCE_REF_SECRET),
      submittedAt: row.created_at,
      name: await decryptPii(String(row.name_ciphertext), env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(String(row.email_ciphertext), env.PII_ENCRYPTION_KEY_V1),
      phone: row.phone_ciphertext ? await decryptPii(String(row.phone_ciphertext), env.PII_ENCRYPTION_KEY_V1) : null,
      serviceInterest: row.service_interest_ciphertext
        ? await decryptPii(String(row.service_interest_ciphertext), env.PII_ENCRYPTION_KEY_V1) : null,
      message: await decryptPii(String(row.message_ciphertext), env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale,
      deliveryStatus: row.delivery_status,
      deliveryAttempts: row.delivery_attempts,
      deliveredAt: row.delivered_at,
      deliveryError: row.delivery_error,
    })));
    return json({ items });
  }
  if (table === 'newsletter_subscribers') {
    const { results } = await env.DB.prepare(
      `SELECT id, email_ciphertext, locale, created_at, unsubscribed_at
       FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 100`,
    ).all<Record<string, string | null>>();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id!, 'newsletter', identity.id, env.RESOURCE_REF_SECRET),
      email: await decryptPii(row.email_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale,
      subscribedAt: row.created_at,
      unsubscribedAt: row.unsubscribed_at,
    })));
    return json({ items });
  }
  throw new HttpError(404, 'not_found');
}

async function metrics(env: Env): Promise<Response> {
  const [downloadRow, emailRow] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS total FROM guide_download_leads').first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM newsletter_subscribers WHERE unsubscribed_at IS NULL').first<{ total: number }>(),
  ]);
  const downloads = downloadRow?.total ?? 0;
  const emails = emailRow?.total ?? 0;
  return json({ downloads, emails, prospectRatio: emails ? Math.round((downloads / emails) * 100) : 0 });
}

async function charts(env: Env): Promise<Response> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT guide_slug, created_at FROM guide_download_leads
     WHERE created_at >= ?1 ORDER BY created_at DESC LIMIT 500`,
  ).bind(since).all<{ guide_slug: string; created_at: string }>();
  const counts = new Map<string, number>();
  const days = new Map<string, number>();
  for (const row of results) {
    counts.set(row.guide_slug, (counts.get(row.guide_slug) ?? 0) + 1);
    const day = row.created_at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  const mostVisited = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, value]) => ({ label, value }));
  const total = mostVisited.reduce((sum, item) => sum + item.value, 0) || 1;
  const visitShare = mostVisited.map((item) => ({ label: item.label, value: Math.round((item.value / total) * 100) }));
  const history = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.now() - (29 - index) * 86_400_000).toISOString().slice(0, 10);
    return { date, value: days.get(date) ?? 0 };
  });
  return json({ mostVisited, visitShare, history });
}

export async function adminApi(request: Request, env: Env, identity: AdminIdentity): Promise<Response> {
  const path = new URL(request.url).pathname.slice('/api/v1/admin/'.length).split('/').filter(Boolean);
  if (path[0] === 'guides' && path[2] === 'pdf' && path.length === 4) {
    requireRole(identity, CONTENT_ROLES);
    return uploadGuidePdf(request, env, identity, path[1], path[3]);
  }
  if (path[0] === 'guides' && path.length <= 2) {
    if (request.method !== 'GET') requireRole(identity, CONTENT_ROLES);
    return guides(request, env, identity, path[1]);
  }
  if (path[0] === 'opportunities' && path[2] === 'image' && path.length === 3) {
    requireRole(identity, CONTENT_ROLES);
    return uploadOpportunityImage(request, env, identity, path[1]);
  }
  if (path[0] === 'opportunities' && path.length <= 2) {
    if (request.method !== 'GET') requireRole(identity, CONTENT_ROLES);
    return opportunities(request, env, identity, path[1]);
  }
  if (path[0] === 'records' && path.length === 2) {
    requireMethod(request, ['GET']);
    requireRole(identity, DATA_ROLES);
    return adminRecords(env, identity, path[1]);
  }
  if (path[0] === 'metrics' && path.length === 1) {
    requireMethod(request, ['GET']);
    requireRole(identity, DATA_ROLES);
    return metrics(env);
  }
  if (path[0] === 'charts' && path.length === 1) {
    requireMethod(request, ['GET']);
    requireRole(identity, DATA_ROLES);
    return charts(env);
  }
  throw new HttpError(404, 'not_found');
}
