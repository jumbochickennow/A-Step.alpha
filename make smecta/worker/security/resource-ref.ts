import { base64UrlDecode, base64UrlEncode } from '../crypto';
import { HttpError } from '../http';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const KEY_SALT = encoder.encode('a-step:resource-ref:key-derivation:v2');
const KEY_CONTEXT = encoder.encode('a-step:resource-ref:v2');
const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 30 * 60;
const RECORD_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{1,64})$/i;

export type ResourceType = 'guide' | 'opportunity' | 'resource' | 'lead' | 'contact' | 'newsletter';

interface ResourceRefPayload {
  v: 2;
  type: ResourceType;
  id: string;
  actor: string;
  iat: number;
  exp: number;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const bytes = base64UrlDecode(secret);
  if (bytes.byteLength < 32) throw new HttpError(500, 'invalid_server_key');
  const material = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: KEY_SALT, info: KEY_CONTEXT },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createResourceRef(
  recordId: string,
  type: ResourceType,
  userId: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  if (!RECORD_ID.test(recordId) || !userId || !Number.isSafeInteger(now)
    || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new HttpError(500, 'invalid_resource_ref_input');
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload: ResourceRefPayload = {
    v: 2,
    type,
    id: recordId,
    actor: userId,
    iat: now,
    exp: now + ttlSeconds,
  };
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: KEY_CONTEXT },
    await deriveKey(secret),
    encoder.encode(JSON.stringify(payload)),
  );
  return `r2.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

export async function resolveResourceRef(
  resourceRef: string,
  expectedType: ResourceType,
  userId: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const [version, encodedIv, encodedCiphertext, extra] = resourceRef.split('.');
  if (version !== 'r2' || !encodedIv || !encodedCiphertext || extra || resourceRef.length > 768) {
    throw new HttpError(404, 'not_found');
  }
  try {
    const iv = base64UrlDecode(encodedIv);
    const ciphertext = base64UrlDecode(encodedCiphertext);
    if (iv.byteLength !== 12 || ciphertext.byteLength < 17 || ciphertext.byteLength > 2048) throw new Error();
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: KEY_CONTEXT },
      await deriveKey(secret),
      ciphertext,
    );
    const payload = JSON.parse(decoder.decode(plaintext)) as Partial<ResourceRefPayload>;
    if (payload.v !== 2 || payload.type !== expectedType || payload.actor !== userId
      || typeof payload.id !== 'string' || !RECORD_ID.test(payload.id)
      || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)
      || payload.iat! > now + 60 || payload.exp! <= now
      || payload.exp! <= payload.iat! || payload.exp! - payload.iat! > MAX_TTL_SECONDS) {
      throw new Error('invalid_resource_ref');
    }
    return payload.id;
  } catch {
    throw new HttpError(404, 'not_found');
  }
}
