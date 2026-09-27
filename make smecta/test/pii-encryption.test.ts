import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode } from '../worker/crypto';
import { decryptPii, encryptPii } from '../worker/security/encryption';

describe('personal data encryption', () => {
  const key = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const otherKey = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));

  it('round-trips UTF-8 data with a fresh IV for each encryption', async () => {
    const personalData = 'ليلى — léa@example.com';
    const first = await encryptPii(personalData, key);
    const second = await encryptPii(personalData, key);

    expect(first).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain(personalData);
    expect(await decryptPii(first, key)).toBe(personalData);
    expect(await decryptPii(second, key)).toBe(personalData);
  });

  it('rejects a wrong key and a changed ciphertext', async () => {
    const encrypted = await encryptPii('private message', key);
    const [version, iv, ciphertext] = encrypted.split('.');
    const bytes = base64UrlDecode(ciphertext);
    bytes[0] ^= 1;
    const changed = `${version}.${iv}.${base64UrlEncode(bytes)}`;

    await expect(decryptPii(encrypted, otherKey)).rejects.toThrow();
    await expect(decryptPii(changed, key)).rejects.toThrow();
  });
});
