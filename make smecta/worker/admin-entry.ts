import type { Env, ExecutionContextLike } from './env';
import { readAdminSession, sessionStatus, signIn, signOut } from './auth/auth-api';
import { adminApi } from './admin-api';
import { attachRequestId, errorResponse, HttpError } from './http';
import { opportunityImage } from './routes/opportunity-image';
import { enforceUploadBoundary } from './security/upload-defense';
import { attachRateLimitHeaders, checkRateLimit, rateLimitResponse } from './security/rate-limit';
import { enforceRequestEnvelope } from './security/request-guard';
import { applySecurityHeaders, httpsRedirect } from './security/headers';
import { applyCorsHeaders, preflightResponse, verifyApiOrigin, type OriginContext } from './security/origin';
import { assertRuntimeEnv } from './security/env-validator';
import { createRemoteJWKSet, jwtVerify } from 'jose';
export { AdminSecurityCoordinator, AtomicRateLimiter } from './security/security-coordinators';

interface AdminContext extends ExecutionContextLike {
  access?: { getIdentity(): Promise<{ email?: string } | null> };
}

function harden(response: Response, requestId: string): Response {
  const result = applySecurityHeaders(attachRequestId(response, requestId));
  result.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  result.headers.set('Cache-Control', 'private, no-store');
  return result;
}

const ACCESS_ISSUER = 'https://broad-bread-bf03.cloudflareaccess.com';
const ACCESS_JWKS = createRemoteJWKSet(new URL(`${ACCESS_ISSUER}/cdn-cgi/access/certs`));

async function requireAccess(request: Request, ctx: AdminContext, env: Env): Promise<void> {
  let email: string | undefined;
  if (ctx.access) {
    email = (await ctx.access.getIdentity())?.email;
  } else {
    // Static assets run behind Cloudflare's internal router, which does not pass ctx.access.
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || !env.ADMIN_ACCESS_AUD) throw new HttpError(403, 'access_required');
    try {
      const { payload } = await jwtVerify(token, ACCESS_JWKS, {
        issuer: ACCESS_ISSUER,
        audience: env.ADMIN_ACCESS_AUD.split(','),
      });
      email = typeof payload.email === 'string' ? payload.email : undefined;
    } catch {
      throw new HttpError(403, 'access_denied');
    }
  }
  if (!env.ADMIN_ACCESS_EMAIL || email?.toLowerCase() !== env.ADMIN_ACCESS_EMAIL.toLowerCase()) {
    throw new HttpError(403, 'access_denied');
  }
}

async function authenticateAdmin(request: Request, env: Env) {
  const session = await readAdminSession(request, env);
  if (!session) throw new HttpError(401, 'unauthorized');
  return session;
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/v1/opportunity-images/')) return opportunityImage(request, env);
  if (path === '/api/v1/auth/sign-in') return signIn(request, env);
  if (path === '/api/v1/auth/sign-out') return signOut(request, env);
  if (path.startsWith('/api/v1/admin/') || path === '/api/v1/auth/session') {
    const session = await authenticateAdmin(request, env);
    if (path.startsWith('/api/v1/admin/')) return adminApi(request, env, session);
    return sessionStatus(request, session);
  }
  throw new HttpError(404, 'not_found');
}

export default {
  async fetch(request: Request, env: Env, ctx: AdminContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    let originContext: OriginContext | null = null;
    try {
      await requireAccess(request, ctx, env);
      assertRuntimeEnv(env, 'admin');
      const redirect = httpsRedirect(request);
      if (redirect) return harden(redirect, requestId);
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/v1/')) {
        originContext = verifyApiOrigin(request, env);
        if (request.method === 'OPTIONS') {
          return harden(preflightResponse(request, originContext), requestId);
        }
        enforceUploadBoundary(request);
        enforceRequestEnvelope(request);
        const rateLimit = await checkRateLimit(request, env);
        if (rateLimit && !rateLimit.allowed) {
          return harden(applyCorsHeaders(rateLimitResponse(rateLimit, requestId), originContext), requestId);
        }
        const response = attachRateLimitHeaders(await routeApi(request, env), rateLimit);
        return harden(applyCorsHeaders(response, originContext), requestId);
      }
      if (url.pathname === '/') return harden(Response.redirect(new URL('/admin', url), 302), requestId);
      if (url.pathname === '/admin/dashboard' || url.pathname.startsWith('/admin/dashboard/')) {
        await authenticateAdmin(request, env);
      }
      if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')
        && !url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/fonts/')) {
        throw new HttpError(404, 'not_found');
      }
      const asset = await env.ASSETS.fetch(request);
      return harden(new Response(asset.body, asset), requestId);
    } catch (error) {
      return harden(applyCorsHeaders(errorResponse(error, requestId), originContext), requestId);
    }
  },
};
