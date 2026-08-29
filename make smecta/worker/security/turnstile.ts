import { sha256 } from '../crypto';
import type { Env } from '../env';
import { HttpError } from '../http';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TOKEN_MAX_AGE_MS = 300_000;

export type TurnstileAction = 'contact' | 'lead_download' | 'newsletter';

interface ReplayStatement {
  bind(...values: unknown[]): ReplayStatement;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<unknown>;
}

type TurnstileEnv = Pick<Env, 'TURNSTILE_SECRET_KEY' | 'TURNSTILE_ALLOWED_HOSTNAMES'> & {
  DB: { prepare(query: string): ReplayStatement };
};

interface SiteverifyResult {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

function allowedHostnames(request: Request, env: TurnstileEnv): Set<string> {
  const configured = (env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  const requestHostname = new URL(request.url).hostname.toLowerCase();
  if (requestHostname === 'localhost' || requestHostname === '127.0.0.1' || requestHostname === '[::1]') {
    configured.push('localhost', '127.0.0.1', '[::1]');
  }
  return new Set(configured);
}

export async function verifyTurnstile(
  request: Request,
  env: TurnstileEnv,
  token: string,
  expectedAction: TurnstileAction,
  now = Date.now(),
): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) throw new HttpError(503, 'challenge_not_configured');
  if (!token || token.length > 2048) throw new HttpError(400, 'challenge_required');

  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  form.set('idempotency_key', crypto.randomUUID());
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.set('remoteip', remoteIp);

  let result: SiteverifyResult;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('siteverify_failed');
    result = await response.json() as SiteverifyResult;
  } catch {
    throw new HttpError(403, 'challenge_failed');
  }

  const challengeTime = Date.parse(result.challenge_ts ?? '');
  const age = now - challengeTime;
  const hosts = allowedHostnames(request, env);
  if (
    result.success !== true
    || hosts.size === 0
    || !result.hostname
    || !hosts.has(result.hostname.toLowerCase())
    || result.action !== expectedAction
    || !Number.isFinite(challengeTime)
    || age < -30_000
    || age >= TOKEN_MAX_AGE_MS
  ) {
    throw new HttpError(403, 'challenge_failed');
  }

  const nowSeconds = Math.floor(now / 1000);
  const replayKey = `turnstile:${await sha256(token)}`;
  try {
    await env.DB.prepare('DELETE FROM idempotency_keys WHERE key = ?1 AND expires_at <= ?2')
      .bind(replayKey, nowSeconds).run();
    await env.DB.prepare(
      'INSERT INTO idempotency_keys (key, action, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)',
    ).bind(replayKey, `turnstile:${expectedAction}`, new Date(now).toISOString(), nowSeconds + 300).run();
  } catch {
    const replayed = await env.DB.prepare(
      'SELECT 1 AS present FROM idempotency_keys WHERE key = ?1 AND expires_at > ?2 LIMIT 1',
    ).bind(replayKey, nowSeconds).first();
    if (replayed) throw new HttpError(403, 'challenge_replayed');
    throw new HttpError(503, 'challenge_store_unavailable');
  }
}
