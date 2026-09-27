import { decodeSecretKey } from '../crypto';
import type { Env } from '../env';
import { HttpError } from '../http';

const validatedPublicEnvironments = new WeakSet<object>();
const validatedAdminEnvironments = new WeakSet<object>();
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SHARED_RUNTIME_VALUES = [
  'PII_ENCRYPTION_KEY_V1',
  'BLIND_INDEX_SECRET',
  'RESOURCE_REF_SECRET',
] as const satisfies readonly (keyof Env)[];
const PUBLIC_RUNTIME_VALUES = [
  'TURNSTILE_SECRET_KEY',
  'TURNSTILE_ALLOWED_HOSTNAMES',
  'ALLOWED_ORIGINS',
] as const satisfies readonly (keyof Env)[];
const ADMIN_RUNTIME_VALUES = [
  'ADMIN_PASSWORD_HASH',
  'ADMIN_PASSWORD_PEPPER',
  'ADMIN_ACCESS_EMAIL',
  'ADMIN_ACCESS_AUD',
  'ALLOWED_ORIGINS',
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

export function assertRuntimeEnv(env: Env, target: 'public' | 'admin' = 'public'): void {
  const validated = target === 'admin' ? validatedAdminEnvironments : validatedPublicEnvironments;
  if (validated.has(env)) return;
  const requiredValues = [...SHARED_RUNTIME_VALUES, ...(target === 'admin' ? ADMIN_RUNTIME_VALUES : PUBLIC_RUNTIME_VALUES)];
  const missing = requiredValues.filter((name) => {
    const value = env[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length) {
    console.error(`[Runtime] Missing required environment variables or secrets: ${missing.join(', ')}`);
    throw new HttpError(500, 'runtime_not_configured');
  }

  secret('PII_ENCRYPTION_KEY_V1', env.PII_ENCRYPTION_KEY_V1);
  secret('BLIND_INDEX_SECRET', env.BLIND_INDEX_SECRET);
  secret('RESOURCE_REF_SECRET', env.RESOURCE_REF_SECRET);
  if (target === 'admin') {
    secret('ADMIN_PASSWORD_PEPPER', env.ADMIN_PASSWORD_PEPPER);
    if (!/^hmac-sha256\$v1\$[A-Za-z0-9_-]{43}$/.test(env.ADMIN_PASSWORD_HASH ?? '')) invalid('ADMIN_PASSWORD_HASH');
    const email = required('ADMIN_ACCESS_EMAIL', env.ADMIN_ACCESS_EMAIL, 6, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('ADMIN_ACCESS_EMAIL');
    if (!/^[a-f0-9]{64}(?:,[a-f0-9]{64})?$/.test(required('ADMIN_ACCESS_AUD', env.ADMIN_ACCESS_AUD, 64, 129))) invalid('ADMIN_ACCESS_AUD');
  } else {
    required('TURNSTILE_SECRET_KEY', env.TURNSTILE_SECRET_KEY, 16, 512);
    const allowedHosts = required('TURNSTILE_ALLOWED_HOSTNAMES', env.TURNSTILE_ALLOWED_HOSTNAMES, 1, 2048).split(',');
    if (allowedHosts.some((host) => !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(host.trim()))) invalid('TURNSTILE_ALLOWED_HOSTNAMES');
  }

  const origins = required('ALLOWED_ORIGINS', env.ALLOWED_ORIGINS, 8, 4096).split(',')
    .map((origin) => secureUrl('ALLOWED_ORIGINS', origin.trim(), true));
  if (origins.some((origin) => origin.origin !== origin.href.replace(/\/$/, ''))) invalid('ALLOWED_ORIGINS');

  const missingBindings = [
    typeof env.ASSETS?.fetch !== 'function' && 'ASSETS',
    typeof env.DB?.prepare !== 'function' && 'DB',
    typeof env.GUIDES_BUCKET?.get !== 'function' && 'GUIDES_BUCKET',
    typeof env.OPPORTUNITY_IMAGES_BUCKET?.get !== 'function' && 'OPPORTUNITY_IMAGES_BUCKET',
    typeof env.RATE_LIMITER?.getByName !== 'function' && 'RATE_LIMITER',
    target === 'admin' && typeof env.ADMIN_SECURITY?.getByName !== 'function' && 'ADMIN_SECURITY',
    target === 'public' && typeof env.EVENT_QUEUE?.send !== 'function' && 'EVENT_QUEUE',
    target === 'public' && typeof env.CONTACT_EMAIL?.send !== 'function' && 'CONTACT_EMAIL',
  ].filter((name): name is string => Boolean(name));
  if (missingBindings.length) {
    console.error(`[Runtime] Missing required bindings: ${missingBindings.join(', ')}`);
    throw new HttpError(500, 'runtime_not_configured');
  }
  validated.add(env);
}
