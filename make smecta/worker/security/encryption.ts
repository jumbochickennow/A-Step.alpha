import { base64UrlDecode, base64UrlEncode, decodeSecretKey } from '../crypto';
import { HttpError } from '../http';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const KEY_CONTEXT = encoder.encode('a-step:pii:v1:aes-256-gcm');
const KEY_SALT = encoder.encode('a-step:pii:key-derivation:v1');

async function deriveEncryptionKey(secret: string): Promise<CryptoKey> {
  const secretBytes = decodeSecretKey(secret);
  const keyMaterial = await crypto.subtle.importKey('raw', secretBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: KEY_SALT, info: KEY_CONTEXT },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptPii(value: string, versionedSecret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: KEY_CONTEXT },
    await deriveEncryptionKey(versionedSecret),
    encoder.encode(value),
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

export async function decryptPii(value: string, versionedSecret: string): Promise<string> {
  const [version, encodedIv, encodedCiphertext, extra] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedCiphertext || extra) {
    throw new HttpError(500, 'invalid_ciphertext');
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlDecode(encodedIv), additionalData: KEY_CONTEXT },
      await deriveEncryptionKey(versionedSecret),
      base64UrlDecode(encodedCiphertext),
    );
    return decoder.decode(plaintext);
  } catch {
    throw new HttpError(500, 'invalid_ciphertext');
  }
}
