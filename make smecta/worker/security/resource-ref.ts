import { base64UrlDecode, base64UrlEncode } from '../crypto';
import { HttpError } from '../http';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const KEY_SALT = encoder.encode('a-step:resource-ref:key-derivation:v1');
const KEY_CONTEXT = encoder.encode('a-step:resource-ref:v1');

export type ResourceType = 'guide' | 'opportunity' | 'lead' | 'contact' | 'newsletter';

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
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(`${type}\u0000${userId}\u0000${recordId}`);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: KEY_CONTEXT },
    await deriveKey(secret),
    plaintext,
  );
  return `r1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

export async function resolveResourceRef(
  resourceRef: string,
  expectedType: ResourceType,
  userId: string,
  secret: string,
): Promise<string> {
  const [version, encodedIv, encodedCiphertext, extra] = resourceRef.split('.');
  if (version !== 'r1' || !encodedIv || !encodedCiphertext || extra) throw new HttpError(404, 'not_found');
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlDecode(encodedIv), additionalData: KEY_CONTEXT },
      await deriveKey(secret),
      base64UrlDecode(encodedCiphertext),
    );
    const [type, ownerId, recordId, unexpected] = decoder.decode(plaintext).split('\u0000');
    if (unexpected || type !== expectedType || ownerId !== userId || recordId.length !== 36 || !/^[0-9a-f-]{36}$/i.test(recordId)) {
      throw new Error('invalid_resource_ref');
    }
    return recordId;
  } catch {
    throw new HttpError(404, 'not_found');
  }
}
