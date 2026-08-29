import { z } from 'zod';
import type { AdminIdentity } from './auth/auth-api';
import { decryptPii } from './security/encryption';
import { createResourceRef, resolveResourceRef } from './security/resource-ref';
import type { Env } from './env';
import { HttpError, json, readJson, requireMethod } from './http';
import { validatedPdfBody } from './security/pdf-upload';
import { seedAdminCatalog } from './catalog-seed';

const copySchema = z.object({ title: z.string().trim().min(1).max(180), description: z.string().trim().min(1).max(4000) }).strict();
const translationsSchema = z.object({ en: copySchema, fr: copySchema, ar: copySchema }).strict();
const nullableGuidePath = z.string().trim().max(512).regex(/^[a-z0-9][a-z0-9._/-]*\.pdf$/)
  .refine((value) => !value.includes('..') && !value.includes('//')).nullable();
const nullableImagePath = z.string().max(512).regex(/^\/assets\/opportunities\/[a-z0-9._-]+\.(?:png|jpe?g|webp|avif)$/).nullable();
const resourceRefSchema = z.string().min(64).max(512).regex(/^r1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

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
  imagePath: nullableImagePath,
  applyUrl: z.string().url().refine((value) => value.startsWith('https://')).nullable(),
  opensAt: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deadline: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  featured: z.boolean(),
  published: z.boolean(),
  translations: translationsSchema,
}).strict();

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

async function guideFromRow(row: GuideRow, env: Env, identity: AdminIdentity) {
  return {
    id: await createResourceRef(row.id, 'guide', identity.id, env.SESSION_SECRET),
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
    id: await createResourceRef(row.id, 'opportunity', identity.id, env.SESSION_SECRET),
    slug: row.slug,
    country: row.country,
    categories: parsedJson(row.categories, z.array(z.string())),
    imagePath: row.image_path,
    applyUrl: row.apply_url,
    opensAt: row.opens_at,
    deadline: row.deadline,
    featured: row.featured === 1,
    published: row.published === 1,
    translations: parsedJson(row.translations, translationsSchema),
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
      databaseId, identity.id, input.slug, input.category, input.r2KeyEn ?? input.filePath,
      input.r2KeyEn, input.r2KeyFr, input.r2KeyAr, input.fileType, input.pageCount,
      input.coverPath, input.published ? 1 : 0, input.sortOrder, input.contentUpdatedAt,
      JSON.stringify(input.translations), now,
    ));
    return json({
      success: true,
      resourceId: await createResourceRef(databaseId, 'guide', identity.id, env.SESSION_SECRET),
    }, 201);
  }
  if (request.method === 'PUT' && id) {
    const parsed = guideSchema.safeParse(await readJson(request, 65_536));
    if (!parsed.success || (parsed.data.id && parsed.data.id !== id)) throw new HttpError(400, 'validation_failed');
    const input = parsed.data;
    const databaseId = await resolveResourceRef(id, 'guide', identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare(
      `UPDATE guides SET slug = ?1, category = ?2, storage_object_path = ?3,
       r2_key_en = ?4, r2_key_fr = ?5, r2_key_ar = ?6, file_type = ?7,
       page_count = ?8, cover_path = ?9, published = ?10, sort_order = ?11,
       content_updated_at = ?12, translations = ?13, updated_at = ?14
       WHERE id = ?15`,
    ).bind(
      input.slug, input.category, input.r2KeyEn ?? input.filePath, input.r2KeyEn,
      input.r2KeyFr, input.r2KeyAr, input.fileType, input.pageCount, input.coverPath,
      input.published ? 1 : 0, input.sortOrder, input.contentUpdatedAt,
      JSON.stringify(input.translations), new Date().toISOString(), databaseId,
    ));
    return json({ success: true });
  }
  if (request.method === 'DELETE' && id) {
    const databaseId = await resolveResourceRef(id, 'guide', identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare('DELETE FROM guides WHERE id = ?1').bind(databaseId));
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
  const databaseId = await resolveResourceRef(id, 'guide', identity.id, env.SESSION_SECRET);
  const guide = await env.DB.prepare(
    'SELECT slug FROM guides WHERE id = ?1 LIMIT 1',
  ).bind(databaseId).first<{ slug: string }>();
  if (!guide) throw new HttpError(404, 'not_found');

  const objectKey = `a-step-guides/${guide.slug}-${language.data}.pdf`;
  await env.GUIDES_BUCKET.put(objectKey, validatedPdfBody(request), {
    httpMetadata: {
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename="${guide.slug}-${language.data}.pdf"`,
    },
    customMetadata: { guideId: databaseId, language: language.data },
  });

  const column = { en: 'r2_key_en', fr: 'r2_key_fr', ar: 'r2_key_ar' }[language.data];
  const now = new Date().toISOString();
  const [updated] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE guides SET ${column} = ?1,
       storage_object_path = CASE WHEN ?2 = 'en' THEN ?1 ELSE storage_object_path END,
       updated_at = ?3 WHERE id = ?4`,
    ).bind(objectKey, language.data, now, databaseId),
    env.DB.prepare(
      `INSERT INTO guide_assets
        (id, slug, object_key, r2_key_en, r2_key_fr, r2_key_ar, created_at)
       VALUES (?1, ?2, ?3,
         CASE WHEN ?4 = 'en' THEN ?3 ELSE NULL END,
         CASE WHEN ?4 = 'fr' THEN ?3 ELSE NULL END,
         CASE WHEN ?4 = 'ar' THEN ?3 ELSE NULL END, ?5)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         ${column} = ?3,
         object_key = CASE WHEN ?4 = 'en' THEN ?3 ELSE guide_assets.object_key END`,
    ).bind(databaseId, guide.slug, objectKey, language.data, now),
  ]);
  if (updated.meta.changes !== 1) throw new HttpError(404, 'not_found');
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
    if (!parsed.success || parsed.data.id) throw new HttpError(400, 'validation_failed');
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
      input.imagePath, input.applyUrl, input.opensAt, input.deadline, input.featured ? 1 : 0,
      input.published ? 1 : 0, JSON.stringify(input.translations), now,
    ));
    return json({
      success: true,
      resourceId: await createResourceRef(databaseId, 'opportunity', identity.id, env.SESSION_SECRET),
    }, 201);
  }
  if (request.method === 'PUT' && id) {
    const parsed = opportunitySchema.safeParse(await readJson(request, 65_536));
    if (!parsed.success || (parsed.data.id && parsed.data.id !== id)) throw new HttpError(400, 'validation_failed');
    const input = parsed.data;
    const databaseId = await resolveResourceRef(id, 'opportunity', identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare(
      `UPDATE opportunities SET slug = ?1, country = ?2, categories = ?3, image_path = ?4,
       apply_url = ?5, opens_at = ?6, deadline = ?7, featured = ?8, published = ?9,
       translations = ?10, updated_at = ?11 WHERE id = ?12`,
    ).bind(
      input.slug, input.country, JSON.stringify(input.categories), input.imagePath, input.applyUrl,
      input.opensAt, input.deadline, input.featured ? 1 : 0, input.published ? 1 : 0,
      JSON.stringify(input.translations), new Date().toISOString(), databaseId,
    ));
    return json({ success: true });
  }
  if (request.method === 'DELETE' && id) {
    const databaseId = await resolveResourceRef(id, 'opportunity', identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare('DELETE FROM opportunities WHERE id = ?1').bind(databaseId));
    return json({ success: true });
  }
  throw new HttpError(405, 'method_not_allowed');
}

async function adminRecords(env: Env, identity: AdminIdentity, table: string): Promise<Response> {
  if (table === 'guide_download_leads') {
    const { results } = await env.DB.prepare(
      `SELECT id, full_name_ciphertext, email_ciphertext, guide_slug, guide_language,
       target_country, locale, created_at
       FROM guide_download_leads ORDER BY created_at DESC LIMIT 100`,
    ).all<Record<string, string | null>>();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id!, 'lead', identity.id, env.SESSION_SECRET),
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
      `SELECT id, name_ciphertext, email_ciphertext, message_ciphertext, locale, created_at
       FROM contact_submissions ORDER BY created_at DESC LIMIT 100`,
    ).all<Record<string, string | null>>();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id!, 'contact', identity.id, env.SESSION_SECRET),
      submittedAt: row.created_at,
      name: await decryptPii(row.name_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(row.email_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      message: await decryptPii(row.message_ciphertext!, env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale,
    })));
    return json({ items });
  }
  if (table === 'newsletter_subscribers') {
    const { results } = await env.DB.prepare(
      `SELECT id, email_ciphertext, locale, created_at, unsubscribed_at
       FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 100`,
    ).all<Record<string, string | null>>();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id!, 'newsletter', identity.id, env.SESSION_SECRET),
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
    return uploadGuidePdf(request, env, identity, path[1], path[3]);
  }
  if (path[0] === 'guides' && path.length <= 2) return guides(request, env, identity, path[1]);
  if (path[0] === 'opportunities' && path.length <= 2) return opportunities(request, env, identity, path[1]);
  if (path[0] === 'records' && path.length === 2) {
    requireMethod(request, ['GET']);
    return adminRecords(env, identity, path[1]);
  }
  if (path[0] === 'metrics' && path.length === 1) {
    requireMethod(request, ['GET']);
    return metrics(env);
  }
  if (path[0] === 'charts' && path.length === 1) {
    requireMethod(request, ['GET']);
    return charts(env);
  }
  throw new HttpError(404, 'not_found');
}
