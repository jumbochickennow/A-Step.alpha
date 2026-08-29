import { HttpError } from './http';

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(500, 'invalid_server_key');
  }
}

export function decodeSecretKey(value: string): Uint8Array {
  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  }
  if (!/^[A-Za-z0-9+/_-]{43}=?$/.test(value)) throw new HttpError(500, 'invalid_server_key');
  const bytes = base64UrlDecode(value);
  if (bytes.byteLength !== 32) throw new HttpError(500, 'invalid_server_key');
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const bytes = decodeSecretKey(secret);
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signHmac(value: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await importHmacKey(secret), encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function sha256(value: string): Promise<string> {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export function randomToken(bytes = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}
