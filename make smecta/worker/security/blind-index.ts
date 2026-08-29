import { decodeSecretKey } from '../crypto';

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function importBlindIndexKey(secret: string): Promise<CryptoKey> {
  const bytes = decodeSecretKey(secret);
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export function normalizeBlindIndexValue(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

export async function createBlindIndex(
  value: string,
  secret: string,
  namespace = 'email',
): Promise<string> {
  const normalized = normalizeBlindIndexValue(value);
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importBlindIndexKey(secret),
    encoder.encode(`${namespace}\u0000${normalized}`),
  );
  return toHex(new Uint8Array(signature));
}
