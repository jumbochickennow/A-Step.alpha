import type { Env } from '../env';
import { HttpError, requireMethod } from '../http';

const OBJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpe?g|webp|avif)$/i;

export async function opportunityImage(request: Request, env: Env): Promise<Response> {
  requireMethod(request, ['GET', 'HEAD']);
  const objectName = new URL(request.url).pathname.slice('/api/v1/opportunity-images/'.length);
  if (!OBJECT_NAME.test(objectName)) throw new HttpError(404, 'not_found');
  const object = await env.OPPORTUNITY_IMAGES_BUCKET.get(`opportunity-images/${objectName}`);
  if (!object) throw new HttpError(404, 'not_found');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}
