import type { Env, ExecutionContextLike } from './env';
import { authenticateAccessAdmin, sessionStatus, signIn, signOut } from './auth/auth-api';
import { adminApi } from './admin-api';
import { attachRequestId, errorResponse, HttpError, json } from './http';
import { verifyCloudflareAccess } from './security/access';
import { downloadGrant } from './routes/download-grant';
import { enforceUploadBoundary } from './security/upload-defense';
import { attachRateLimitHeaders, checkRateLimit, rateLimitResponse } from './security/rate-limit';
import { enforceRequestEnvelope } from './security/request-guard';
import { applySecurityHeaders, httpsRedirect } from './security/headers';
import { applyCorsHeaders, preflightResponse, verifyApiOrigin, type OriginContext } from './security/origin';
import { assertRuntimeEnv } from './security/env-validator';
import { consumeOutbox, drainOutbox, type QueueBatchLike } from './queue/outbox-consumer';
import {
  createContact,
  createGuideLead,
  createNewsletterSubscription,
  listGuideAvailability,
  unsubscribeNewsletter,
} from './public-api';

async function routeApi(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/v1/contact') return createContact(request, env, ctx);
  if (pathname === '/api/v1/guides') return listGuideAvailability(request, env);
  if (pathname === '/api/v1/leads') return createGuideLead(request, env, ctx);
  if (pathname === '/api/v1/newsletter') return createNewsletterSubscription(request, env, ctx);
  if (pathname === '/api/v1/newsletter/unsubscribe') return unsubscribeNewsletter(request, env);
  if (pathname === '/api/v1/download-grant') return downloadGrant(request, env);
  if (pathname.startsWith('/api/v1/admin/') || pathname.startsWith('/api/v1/auth/')) {
    const identity = await authenticateAccessAdmin(env, await verifyCloudflareAccess(request, env));
    if (pathname.startsWith('/api/v1/admin/')) return adminApi(request, env, identity);
    if (pathname === '/api/v1/auth/sign-in') return signIn(request, identity);
    if (pathname === '/api/v1/auth/session') return sessionStatus(request, identity);
    if (pathname === '/api/v1/auth/sign-out') return signOut(request);
  }
  throw new HttpError(404, 'not_found');
}

function isAdminPage(pathname: string): boolean {
  return pathname === '/astep-control-vault'
    || pathname.startsWith('/astep-control-vault/')
    || pathname === '/admin'
    || pathname.startsWith('/admin/');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
    const requestId = crypto.randomUUID();
    let originContext: OriginContext | null = null;
    try {
      assertRuntimeEnv(env);
      const redirect = httpsRedirect(request);
      if (redirect) return applySecurityHeaders(attachRequestId(redirect, requestId));
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/v1/')) {
        originContext = verifyApiOrigin(request, env);
        if (request.method === 'OPTIONS') {
          return applySecurityHeaders(attachRequestId(preflightResponse(request, originContext), requestId));
        }
        enforceUploadBoundary(request);
        enforceRequestEnvelope(request);
        const rateLimit = await checkRateLimit(request);
        if (rateLimit && !rateLimit.allowed) {
          const rejected = applyCorsHeaders(rateLimitResponse(rateLimit, requestId), originContext);
          return applySecurityHeaders(attachRequestId(rejected, requestId));
        }
        const response = attachRateLimitHeaders(await routeApi(request, env, ctx), rateLimit);
        return applySecurityHeaders(attachRequestId(applyCorsHeaders(response, originContext), requestId));
      }
      if (isAdminPage(url.pathname)) {
        await authenticateAccessAdmin(env, await verifyCloudflareAccess(request, env));
      }
      return applySecurityHeaders(attachRequestId(await env.ASSETS.fetch(request), requestId));
    } catch (error) {
      const shielded = applyCorsHeaders(errorResponse(error, requestId), originContext);
      return applySecurityHeaders(attachRequestId(shielded, requestId));
    }
  },

  async scheduled(_controller: unknown, env: Env, _ctx: ExecutionContextLike): Promise<void> {
    try {
      assertRuntimeEnv(env);
      await drainOutbox(env);
    } catch (error) {
      if (error instanceof HttpError && error.code === 'runtime_not_configured') {
        console.warn('[Cron] Outbox skipped: runtime secrets not configured');
        return;
      }
      console.error('[Cron] Outbox processing failed', error);
      throw error;
    }
  },

  async queue(batch: QueueBatchLike, env: Env, _ctx: ExecutionContextLike): Promise<void> {
    assertRuntimeEnv(env);
    await consumeOutbox(batch, env);
  },
};

export { json };
