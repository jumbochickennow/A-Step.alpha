import { decodeSecretKey } from '../crypto';
import type { Env } from '../env';
import { HttpError } from '../http';

const validatedEnvironments = new WeakSet<object>();
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const REQUIRED_RUNTIME_VALUES = [
  'PII_ENCRYPTION_KEY_V1',
  'BLIND_INDEX_SECRET',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_PASSWORD_PEPPER',
  'RESOURCE_REF_SECRET',
  'TURNSTILE_SECRET_KEY',
  'TURNSTILE_ALLOWED_HOSTNAMES',
  'ALLOWED_ORIGINS',
  'GOOGLE_SHEETS_CLIENT_EMAIL',
  'GOOGLE_SHEETS_PRIVATE_KEY',
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
  secret('RESOURCE_REF_SECRET', env.RESOURCE_REF_SECRET);
  secret('ADMIN_PASSWORD_PEPPER', env.ADMIN_PASSWORD_PEPPER);
  const adminPasswordHash = env.ADMIN_PASSWORD_HASH ?? '';
  if (!/^hmac-sha256\$v1\$[A-Za-z0-9_-]{43}$/.test(adminPasswordHash)) {
    invalid('ADMIN_PASSWORD_HASH');
  }

  required('TURNSTILE_SECRET_KEY', env.TURNSTILE_SECRET_KEY, 16, 512);
  const allowedHosts = required('TURNSTILE_ALLOWED_HOSTNAMES', env.TURNSTILE_ALLOWED_HOSTNAMES, 1, 2048).split(',');
  if (allowedHosts.some((host) => !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(host.trim()))) invalid('TURNSTILE_ALLOWED_HOSTNAMES');

  const origins = required('ALLOWED_ORIGINS', env.ALLOWED_ORIGINS, 8, 4096).split(',')
    .map((origin) => secureUrl('ALLOWED_ORIGINS', origin.trim(), true));
  if (origins.some((origin) => origin.origin !== origin.href.replace(/\/$/, ''))) invalid('ALLOWED_ORIGINS');

  const spreadsheetId = required('GOOGLE_SHEETS_SPREADSHEET_ID', env.GOOGLE_SHEETS_SPREADSHEET_ID, 20, 128);
  if (!/^[A-Za-z0-9_-]+$/.test(spreadsheetId)) invalid('GOOGLE_SHEETS_SPREADSHEET_ID');
  const serviceAccountEmail = required(
    'GOOGLE_SHEETS_CLIENT_EMAIL', env.GOOGLE_SHEETS_CLIENT_EMAIL, 20, 320,
  );
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(serviceAccountEmail)) {
    invalid('GOOGLE_SHEETS_CLIENT_EMAIL');
  }
  const privateKey = env.GOOGLE_SHEETS_PRIVATE_KEY?.replaceAll('\\n', '\n').trim() ?? '';
  if (privateKey.length < 800 || privateKey.length > 8192
    || !/^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----$/.test(privateKey)) { // secret-scan: allow-test-fixture
    invalid('GOOGLE_SHEETS_PRIVATE_KEY');
  }

  const missingBindings = [
    typeof env.ASSETS?.fetch !== 'function' && 'ASSETS',
    typeof env.EVENT_QUEUE?.send !== 'function' && 'EVENT_QUEUE',
    typeof env.DB?.prepare !== 'function' && 'DB',
    typeof env.GUIDES_BUCKET?.get !== 'function' && 'GUIDES_BUCKET',
    typeof env.OPPORTUNITY_IMAGES_BUCKET?.get !== 'function' && 'OPPORTUNITY_IMAGES_BUCKET',
    typeof env.ADMIN_SECURITY?.getByName !== 'function' && 'ADMIN_SECURITY',
    typeof env.RATE_LIMITER?.getByName !== 'function' && 'RATE_LIMITER',
    typeof env.CONTACT_EMAIL?.send !== 'function' && 'CONTACT_EMAIL',
  ].filter((name): name is string => Boolean(name));
  if (missingBindings.length) {
    console.error(`[Runtime] Missing required bindings: ${missingBindings.join(', ')}`);
    throw new HttpError(500, 'runtime_not_configured');
  }
  validatedEnvironments.add(env);
}
