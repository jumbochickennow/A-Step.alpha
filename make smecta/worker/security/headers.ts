const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://challenges.cloudflare.com https://plausible.io",
  'frame-src https://challenges.cloudflare.com',
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://wa.me https://api.whatsapp.com",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-XSS-Protection': '0',
} as const;

export function applySecurityHeaders(response: Response): Response {
  const hardened = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'Referrer-Policy' && hardened.headers.get(name) === 'no-referrer') continue;
    hardened.headers.set(name, value);
  }
  return hardened;
}

// The zone serves two Worker routes (wrangler.json): www.astepimmigration.space/*
// and the bare apex astepimmigration.space/* — previously the apex had no
// matching route at all and returned a Cloudflare 522. www is the single
// canonical host; the apex always redirects here.
const CANONICAL_HOST = 'www.astepimmigration.space';
const APEX_HOST = 'astepimmigration.space';

/**
 * Redirects to HTTPS and/or the canonical www host in one 308, preserving the
 * full path and query string. Returns null when the request already targets
 * https://www.astepimmigration.space (or is local dev — never redirected).
 */
export function httpsRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (local) return null;
  const isApex = url.hostname === APEX_HOST;
  if (url.protocol !== 'http:' && !isApex) return null;
  url.protocol = 'https:';
  if (isApex) url.hostname = CANONICAL_HOST;
  return Response.redirect(url.toString(), 308);
}
