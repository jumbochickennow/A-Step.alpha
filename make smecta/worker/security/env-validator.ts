import { decodeSecretKey } from '../crypto';
import type { Env } from '../env';
import { HttpError } from '../http';

const validatedEnvironments = new WeakSet<object>();
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const REQUIRED_RUNTIME_VALUES = [
  'PII_ENCRYPTION_KEY_V1',
  'BLIND_INDEX_SECRET',
  'SESSION_SECRET',
  'WEBHOOK_HMAC_SECRET',
  'TURNSTILE_SECRET_KEY',
  'TURNSTILE_ALLOWED_HOSTNAMES',
  'ALLOWED_ORIGINS',
  'OUTBOUND_WEBHOOK_URL',
  'OUTBOUND_WEBHOOK_ALLOWED_HOSTS',
  'CF_ACCESS_TEAM_DOMAIN',
  'CF_ACCESS_POLICY_AUD',
] as const satisfies readonly (keyof Env)[];

function invalid(name?: keyof Env): never {
  if (name) console.error(`[Runtime] Invalid environment variable or secret: ${name}`);
  throw new HttpError(500, 'runtime_not_configured');
}

function required(name: keyof Env, value: string | undefined, minLength = 1, maxLength = 4096): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length < minLength || normalized.length > maxLength || /\s/.test(normalized)
    || /^(?:change-?me|placeholder|undefined|null)$/i.test(normalized)) invalid(name);
  return normalized;
}

function hasMinimumEntropy(bytes: Uint8Array): boolean {
  const counts = new Map<number, number>();
  for (const byte of bytes) counts.set(byte, (counts.get(byte) ?? 0) + 1);
  const entropy = [...counts.values()].reduce((total, count) => {
    const probability = count / bytes.length;
    return total - probability * Math.log2(probability);
  }, 0);
  return counts.size >= 12 && entropy >= 3.5;
}

function secret(name: keyof Env, value: string | undefined): void {
  try {
    if (!hasMinimumEntropy(decodeSecretKey(required(name, value, 43, 64)))) invalid(name);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    invalid(name);
  }
}

function secureUrl(name: keyof Env, value: string | undefined, allowedLocal = false): URL {
  let url: URL;
  try { url = new URL(required(name, value, 8, 2048)); } catch (error) {
    if (error instanceof HttpError) throw error;
    invalid(name);
  }
  const localHttp = allowedLocal && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) invalid(name);
  return url;
}

export function assertRuntimeEnv(env: Env): void {
  if (validatedEnvironments.has(env)) return;
  const missing = REQUIRED_RUNTIME_VALUES.filter((name) => {
    const value = env[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length) {
    console.error(`[Runtime] Missing required environment variables or secrets: ${missing.join(', ')}`);
    throw new HttpError(500, 'runtime_not_configured');
  }

  secret('PII_ENCRYPTION_KEY_V1', env.PII_ENCRYPTION_KEY_V1);
  secret('BLIND_INDEX_SECRET', env.BLIND_INDEX_SECRET);
  secret('SESSION_SECRET', env.SESSION_SECRET);
  secret('WEBHOOK_HMAC_SECRET', env.WEBHOOK_HMAC_SECRET);

  required('TURNSTILE_SECRET_KEY', env.TURNSTILE_SECRET_KEY, 16, 512);
  required('CF_ACCESS_POLICY_AUD', env.CF_ACCESS_POLICY_AUD, 16, 256);

  const access = secureUrl('CF_ACCESS_TEAM_DOMAIN', env.CF_ACCESS_TEAM_DOMAIN);
  if (!access.hostname.endsWith('.cloudflareaccess.com') || access.pathname !== '/') invalid('CF_ACCESS_TEAM_DOMAIN');

  const allowedHosts = required('TURNSTILE_ALLOWED_HOSTNAMES', env.TURNSTILE_ALLOWED_HOSTNAMES, 1, 2048).split(',');
  if (allowedHosts.some((host) => !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(host.trim()))) invalid('TURNSTILE_ALLOWED_HOSTNAMES');

  const origins = required('ALLOWED_ORIGINS', env.ALLOWED_ORIGINS, 8, 4096).split(',')
    .map((origin) => secureUrl('ALLOWED_ORIGINS', origin.trim(), true));
  if (origins.some((origin) => origin.origin !== origin.href.replace(/\/$/, ''))) invalid('ALLOWED_ORIGINS');

  const webhook = secureUrl('OUTBOUND_WEBHOOK_URL', env.OUTBOUND_WEBHOOK_URL);
  if (webhook.port || webhook.pathname === '/' || webhook.search || webhook.hash) invalid('OUTBOUND_WEBHOOK_URL');
  const webhookHosts = new Set(required('OUTBOUND_WEBHOOK_ALLOWED_HOSTS', env.OUTBOUND_WEBHOOK_ALLOWED_HOSTS, 1, 2048)
    .split(',').map((host) => host.trim().toLowerCase()));
  if (!webhookHosts.has(webhook.hostname.toLowerCase())) invalid('OUTBOUND_WEBHOOK_ALLOWED_HOSTS');
  const missingBindings = [
    typeof env.ASSETS?.fetch !== 'function' && 'ASSETS',
    typeof env.EVENT_QUEUE?.send !== 'function' && 'EVENT_QUEUE',
    typeof env.DB?.prepare !== 'function' && 'DB',
    typeof env.GUIDES_BUCKET?.get !== 'function' && 'GUIDES_BUCKET',
  ].filter((name): name is string => Boolean(name));
  if (missingBindings.length) {
    console.error(`[Runtime] Missing required bindings: ${missingBindings.join(', ')}`);
    throw new HttpError(500, 'runtime_not_configured');
  }
  validatedEnvironments.add(env);
}
