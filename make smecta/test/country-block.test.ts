import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../worker/index';

const ctx = { waitUntil: (_promise: Promise<unknown>) => {} };
const secret = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

function request(path: string, country?: string): Request {
  return new Request(`https://www.astepimmigration.space${path}`, {
    cf: country ? { country } : undefined,
  });
}

describe('country access restriction', () => {
  it('blocks every requested country before pages, assets, or API routes are served', async () => {
    for (const country of ['IN', 'RU', 'UA', 'IL', 'PK', 'MA', 'NG']) {
      for (const path of ['/', '/assets/logo/logo-blue.webp', '/api/v1/opportunities']) {
        const response = await worker.fetch(request(path, country), env, ctx);
        expect(response.status, `${country} ${path}`).toBe(403);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
      }
    }
  });

  it('does not block an allowed or unknown country', async () => {
    const runtimeEnv = {
      ...env,
      PII_ENCRYPTION_KEY_V1: secret(),
      BLIND_INDEX_SECRET: secret(),
      RESOURCE_REF_SECRET: secret(),
      ADMIN_PASSWORD_PEPPER: secret(),
    };
    expect((await worker.fetch(request('/', 'DZ'), runtimeEnv, ctx)).status).toBe(200);
    expect((await worker.fetch(request('/'), runtimeEnv, ctx)).status).toBe(200);
  });
});
