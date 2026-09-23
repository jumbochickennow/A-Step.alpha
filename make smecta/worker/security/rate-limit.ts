import { sha256 } from '../crypto';
import type { Env } from '../env';
import { HttpError, json } from '../http';
import type { AtomicRateLimiter } from './security-coordinators';

interface RateLimitPolicy {
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult extends RateLimitPolicy {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

type RateLimiterStub = Pick<AtomicRateLimiter, 'check'>;

export function resolveRateLimitPolicy(request: Request): RateLimitPolicy | null {
  if (request.method === 'OPTIONS') return null;
  const pathname = new URL(request.url).pathname;
  if (request.method === 'POST' && pathname === '/api/v1/contact') return { name: 'contact', limit: 5, windowSeconds: 600 };
  if (request.method === 'POST' && pathname === '/api/v1/leads') return { name: 'leads', limit: 5, windowSeconds: 600 };
  if (request.method === 'POST' && pathname === '/api/v1/newsletter') return { name: 'newsletter', limit: 3, windowSeconds: 600 };
  if (request.method === 'POST' && pathname === '/api/v1/newsletter/unsubscribe') return { name: 'unsubscribe', limit: 5, windowSeconds: 600 };
  // Failed sign-ins are governed by the account-wide coordinator after password verification.
  if (request.method === 'POST' && pathname === '/api/v1/auth/sign-in') return null;
  if (pathname.startsWith('/api/v1/auth/')) return { name: 'admin-authenticated-auth', limit: 30, windowSeconds: 60 };
  if (pathname.startsWith('/api/v1/admin/')) {
    const upload = request.method === 'PUT' && request.headers.get('Content-Type') !== 'application/json';
    return upload
      ? { name: 'admin-upload', limit: 10, windowSeconds: 60 }
      : { name: 'admin-api', limit: 60, windowSeconds: 60 };
  }
  if (pathname.startsWith('/api/v1/download/')) return { name: 'guide-download', limit: 20, windowSeconds: 60 };
  if (pathname.startsWith('/api/v1/opportunity-images/')) return { name: 'opportunity-image', limit: 120, windowSeconds: 60 };
  if (pathname === '/api/v1/guides' || pathname === '/api/v1/opportunities') {
    return { name: 'public-catalog', limit: 120, windowSeconds: 60 };
  }
  if (pathname.startsWith('/api/v1/')) return { name: 'api-default', limit: 60, windowSeconds: 60 };
  return null;
}

export async function checkRateLimit(
  request: Request,
  env: Pick<Env, 'RATE_LIMITER'>,
  nowMilliseconds = Date.now(),
): Promise<RateLimitResult | null> {
  const policy = resolveRateLimitPolicy(request);
  if (!policy) return null;
  const ip = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
  const actor = await sha256(ip);
  const stub = env.RATE_LIMITER.getByName(`${policy.name}:${actor}`) as unknown as RateLimiterStub;
  try {
    const result = await stub.check(policy.limit, policy.windowSeconds, Math.floor(nowMilliseconds / 1000));
    return { ...policy, ...result };
  } catch {
    throw new HttpError(503, 'rate_limiter_unavailable');
  }
}

export function rateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers({
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
  });
  if (!result.allowed) headers.set('Retry-After', String(result.retryAfter));
  return headers;
}

export function rateLimitResponse(result: RateLimitResult, requestId: string): Response {
  return json({ error: 'Too many requests', requestId }, 429, rateLimitHeaders(result));
}

export function attachRateLimitHeaders(response: Response, result: RateLimitResult | null): Response {
  if (!result) return response;
  const hardened = new Response(response.body, response);
  rateLimitHeaders(result).forEach((value, key) => hardened.headers.set(key, value));
  return hardened;
}
