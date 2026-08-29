import type { Env } from '../env';
import { HttpError } from '../http';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_REQUEST_HEADERS = new Set(['content-type', 'idempotency-key']);

export interface OriginContext {
  origin: string;
}

type OriginEnv = Pick<Env, 'ALLOWED_ORIGINS'>;

function configuredOrigins(request: Request, env: OriginEnv): Set<string> {
  const origins = new Set<string>();
  for (const value of (env.ALLOWED_ORIGINS ?? '').split(',')) {
    const candidate = value.trim();
    if (!candidate || candidate.includes('*')) continue;
    try {
      const url = new URL(candidate);
      const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      const originOnly = url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
      if ((url.protocol === 'https:' || localHttp) && originOnly) origins.add(url.origin);
    } catch {
      // Invalid configuration values are ignored; an empty policy fails closed.
    }
  }
  const requestUrl = new URL(request.url);
  if (['localhost', '127.0.0.1', '[::1]'].includes(requestUrl.hostname)) origins.add(requestUrl.origin);
  return origins;
}

function headerOrigin(value: string | null): string | null {
  if (!value || value.length > 2048 || value === 'null') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function verifyApiOrigin(request: Request, env: OriginEnv): OriginContext {
  const allowed = configuredOrigins(request, env);
  if (allowed.size === 0) throw new HttpError(503, 'origin_policy_not_configured');
  const rawOrigin = request.headers.get('Origin');
  const rawReferer = request.headers.get('Referer');
  const origin = headerOrigin(rawOrigin);
  const referer = headerOrigin(rawReferer);
  if ((rawOrigin && !origin) || (rawReferer && !referer)) throw new HttpError(403, 'origin_denied');
  if (!origin && !referer) throw new HttpError(403, 'origin_denied');
  if ((origin && !allowed.has(origin)) || (referer && !allowed.has(referer))) {
    throw new HttpError(403, 'origin_denied');
  }
  return { origin: origin ?? referer! };
}

export function applyCorsHeaders(response: Response, context: OriginContext | null): Response {
  if (!context) return response;
  const corsResponse = new Response(response.body, response);
  corsResponse.headers.set('Access-Control-Allow-Origin', context.origin);
  corsResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  const vary = corsResponse.headers.get('Vary');
  corsResponse.headers.set('Vary', vary ? `${vary}, Origin` : 'Origin');
  return corsResponse;
}

export function preflightResponse(request: Request, context: OriginContext): Response {
  const requestedMethod = request.headers.get('Access-Control-Request-Method')?.trim().toUpperCase() ?? '';
  if (requestedMethod.length > 10 || !ALLOWED_METHODS.has(requestedMethod)) {
    throw new HttpError(405, 'method_not_allowed');
  }
  const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') ?? '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some((header) => header.length > 64 || !ALLOWED_REQUEST_HEADERS.has(header))) {
    throw new HttpError(403, 'cors_headers_denied');
  }
  return applyCorsHeaders(new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': requestedMethod,
      'Access-Control-Allow-Headers': [...ALLOWED_REQUEST_HEADERS].join(', '),
      'Access-Control-Max-Age': '600',
      'Cache-Control': 'no-store',
    },
  }), context);
}
