import { sha256 } from '../crypto';
import { HttpError, json } from '../http';

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

interface DefaultCacheStorage {
  default: Cache;
}

export function resolveRateLimitPolicy(request: Request): RateLimitPolicy | null {
  if (request.method === 'OPTIONS') return null;
  const pathname = new URL(request.url).pathname;
  if (request.method === 'POST' && pathname === '/api/v1/contact') return { name: 'contact', limit: 5, windowSeconds: 600 };
  if (request.method === 'POST' && pathname === '/api/v1/leads') return { name: 'leads', limit: 5, windowSeconds: 600 };
  if (request.method === 'POST' && pathname === '/api/v1/newsletter') return { name: 'newsletter', limit: 3, windowSeconds: 600 };
  if (request.method === 'POST' && pathname === '/api/v1/auth/sign-in') return { name: 'admin-sign-in', limit: 5, windowSeconds: 600 };
  if (pathname.startsWith('/api/v1/admin/')) return { name: 'admin', limit: 10, windowSeconds: 60 };
  return null;
}

export async function checkRateLimit(request: Request, now = Date.now()): Promise<RateLimitResult | null> {
  const policy = resolveRateLimitPolicy(request);
  if (!policy) return null;
  const ip = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
  const actor = await sha256(ip);
  const key = new Request(`https://rate-limit.invalid/${policy.name}/${actor}`);
  const edgeCache = (caches as unknown as DefaultCacheStorage).default;

  try {
    const cached = await edgeCache.match(key);
    const previous = cached ? await cached.json() as unknown : [];
    const cutoff = now - policy.windowSeconds * 1000;
    const timestamps = Array.isArray(previous)
      ? previous.filter((value): value is number => Number.isSafeInteger(value) && value > cutoff && value <= now)
      : [];
    if (timestamps.length >= policy.limit) {
      return {
        ...policy,
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((timestamps[0] + policy.windowSeconds * 1000 - now) / 1000)),
      };
    }

    timestamps.push(now);
    await edgeCache.put(key, new Response(JSON.stringify(timestamps), {
      headers: {
        'Cache-Control': `max-age=${policy.windowSeconds}`,
        'Content-Type': 'application/json',
      },
    }));
    return {
      ...policy,
      allowed: true,
      remaining: policy.limit - timestamps.length,
      retryAfter: 0,
    };
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
