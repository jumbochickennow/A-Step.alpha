import { sha256 } from '../crypto';
import type { Env } from '../env';
import { HttpError, readJson, requireMethod } from '../http';
import { downloadGrantInputSchema } from '../validation/public';

interface GrantRow {
  id: string;
  object_key: string;
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
    `SELECT id, object_key FROM download_grants
     WHERE token = ?1 AND guide_slug = ?2 AND expires_at > ?3 AND consumed = 0
     LIMIT 1`,
  ).bind(tokenHash, parsed.data.guideSlug, now).first<GrantRow>();
  if (!grant || !safeObjectKey(grant.object_key)) throw new HttpError(404, 'not_found');

  const object = await env.GUIDES_BUCKET.get(grant.object_key);
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
  headers.set('Content-Disposition', `attachment; filename="${parsed.data.guideSlug}.pdf"`);
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return new Response(object.body, { status: 200, headers });
}
