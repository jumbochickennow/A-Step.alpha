import { sha256 } from '../crypto';
import type { Env } from '../env';
import { HttpError, readJson, requireMethod } from '../http';
import { downloadGrantInputSchema } from '../validation/public';

interface GrantRow {
  id: string;
  guide_slug: string;
  guide_language: 'en' | 'fr' | 'ar';
  r2_key_en: string | null;
  r2_key_fr: string | null;
  r2_key_ar: string | null;
}

function safeObjectKey(value: string): boolean {
  return value.length <= 512
    && /^[a-z0-9][a-z0-9._/-]*\.pdf$/.test(value)
    && !value.includes('..')
    && !value.startsWith('/')
    && !value.includes('//');
}

export async function downloadGrant(request: Request, env: Env): Promise<Response> {
  requireMethod(request, ['POST']);
  const parsed = downloadGrantInputSchema.safeParse(await readJson(request, 2048));
  if (!parsed.success) throw new HttpError(400, 'validation_failed');

  const now = Math.floor(Date.now() / 1000);
  const tokenHash = await sha256(parsed.data.grantToken);
  const grant = await env.DB.prepare(
    `SELECT dg.id, dg.guide_slug, dg.guide_language,
       ga.r2_key_en, ga.r2_key_fr, ga.r2_key_ar
     FROM download_grants dg
     JOIN guide_assets ga ON ga.id = dg.guide_id
     WHERE dg.token = ?1 AND dg.guide_slug = ?2 AND dg.expires_at > ?3 AND dg.consumed = 0
     LIMIT 1`,
  ).bind(tokenHash, parsed.data.guideSlug, now).first<GrantRow>();
  if (!grant) throw new HttpError(404, 'not_found');
  const requestedKey = grant.guide_language === 'fr'
    ? grant.r2_key_fr
    : grant.guide_language === 'ar' ? grant.r2_key_ar : grant.r2_key_en;
  const targetKey = requestedKey ?? grant.r2_key_en;
  if (!targetKey || !safeObjectKey(targetKey)) throw new HttpError(404, 'not_found');

  const object = await env.GUIDES_BUCKET.get(targetKey);
  if (!object) throw new HttpError(404, 'not_found');

  const consumed = await env.DB.prepare(
    `UPDATE download_grants SET consumed = 1, consumed_at = ?1
     WHERE id = ?2 AND token = ?3 AND expires_at > ?4 AND consumed = 0
     RETURNING id`,
  ).bind(new Date().toISOString(), grant.id, tokenHash, now).first<{ id: string }>();
  if (!consumed) throw new HttpError(404, 'not_found');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `attachment; filename="${grant.guide_slug}-${grant.guide_language}.pdf"`);
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, no-transform, max-age=3600');
  return new Response(object.body, { status: 200, headers });
}
