import { randomBytes } from 'node:crypto';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const secretNames = ['PII_ENCRYPTION_KEY_V1', 'BLIND_INDEX_SECRET', 'SESSION_SECRET', 'WEBHOOK_HMAC_SECRET'];

function decodeSecret(value) {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  if (!/^[A-Za-z0-9+/_-]{43}=?$/.test(value)) throw new Error('expected 32-byte Base64/Base64URL or 64-character hex');
  const bytes = Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/'), 'base64');
  if (bytes.length !== 32) throw new Error('secret must decode to exactly 32 bytes');
  return bytes;
}

function entropy(bytes) {
  const counts = new Map();
  for (const byte of bytes) counts.set(byte, (counts.get(byte) ?? 0) + 1);
  return [...counts.values()].reduce((total, count) => {
    const probability = count / bytes.length;
    return total - probability * Math.log2(probability);
  }, 0);
}

function required(env, name, minLength = 1, maxLength = 4096) {
  const value = env[name]?.trim() ?? '';
  if (value.length < minLength || value.length > maxLength || /\s/.test(value)
    || /^(?:change-?me|placeholder|undefined|null)$/i.test(value)) throw new Error(`${name} is missing or malformed`);
  return value;
}

function secureUrl(env, name, localAllowed = false) {
  const url = new URL(required(env, name, 8, 2048));
  const localHttp = localAllowed && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) throw new Error(`${name} must be a safe HTTPS URL`);
  return url;
}

export function verifyEnvironment(env) {
  for (const name of secretNames) {
    const bytes = decodeSecret(required(env, name, 43, 64));
    if (new Set(bytes).size < 12 || entropy(bytes) < 3.5) throw new Error(`${name} does not meet entropy requirements`);
  }
  required(env, 'TURNSTILE_SECRET_KEY', 16, 512);
  required(env, 'CF_ACCESS_POLICY_AUD', 16, 256);
  const access = secureUrl(env, 'CF_ACCESS_TEAM_DOMAIN');
  if (!access.hostname.endsWith('.cloudflareaccess.com') || access.pathname !== '/') throw new Error('CF_ACCESS_TEAM_DOMAIN is invalid');

  const hosts = required(env, 'TURNSTILE_ALLOWED_HOSTNAMES', 1, 2048).split(',');
  if (hosts.some((host) => host.includes('*') || !host.trim())) throw new Error('TURNSTILE_ALLOWED_HOSTNAMES is invalid');
  const origins = required(env, 'ALLOWED_ORIGINS', 8, 4096).split(',').map((origin) => secureUrl({ origin: origin.trim() }, 'origin', true));
  if (origins.some((origin) => origin.origin !== origin.href.replace(/\/$/, ''))) throw new Error('ALLOWED_ORIGINS must contain origins only');

  const webhook = secureUrl(env, 'OUTBOUND_WEBHOOK_URL');
  if (webhook.port || webhook.pathname === '/' || webhook.search || webhook.hash) throw new Error('OUTBOUND_WEBHOOK_URL is invalid');
  const webhookHosts = new Set(required(env, 'OUTBOUND_WEBHOOK_ALLOWED_HOSTS').split(',').map((host) => host.trim().toLowerCase()));
  if (!webhookHosts.has(webhook.hostname.toLowerCase())) throw new Error('OUTBOUND_WEBHOOK_URL host is not allowlisted');
}

if (process.argv.includes('--self-test')) {
  const key = randomBytes(32).toString('base64url');
  const fixture = {
    PII_ENCRYPTION_KEY_V1: key,
    BLIND_INDEX_SECRET: randomBytes(32).toString('hex'),
    SESSION_SECRET: randomBytes(32).toString('base64'),
    WEBHOOK_HMAC_SECRET: randomBytes(32).toString('base64url'),
    TURNSTILE_SECRET_KEY: `turnstile_${randomBytes(24).toString('base64url')}`,
    TURNSTILE_ALLOWED_HOSTNAMES: 'a-step.example',
    ALLOWED_ORIGINS: 'https://a-step.example',
    CF_ACCESS_TEAM_DOMAIN: 'https://a-step.cloudflareaccess.com',
    CF_ACCESS_POLICY_AUD: randomBytes(32).toString('hex'),
    OUTBOUND_WEBHOOK_URL: 'https://hooks.example.com/a-step',
    OUTBOUND_WEBHOOK_ALLOWED_HOSTS: 'hooks.example.com',
  };
  verifyEnvironment(fixture);
  try {
    verifyEnvironment({ ...fixture, SESSION_SECRET: Buffer.alloc(32).toString('base64url') });
    throw new Error('weak secret self-test was not rejected');
  } catch (error) {
    if (error.message === 'weak secret self-test was not rejected') throw error;
  }
  process.stdout.write('Environment validator self-test passed.\n');
} else {
  verifyEnvironment(process.env);
  process.stdout.write('Runtime environment validation passed.\n');
}
