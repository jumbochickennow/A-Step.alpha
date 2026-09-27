import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../worker/index';

const secret = () => crypto.getRandomValues(new Uint8Array(32)).reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '');
const runtimeEnv = {
  ...env,
  PII_ENCRYPTION_KEY_V1: secret(),
  BLIND_INDEX_SECRET: secret(),
  RESOURCE_REF_SECRET: secret(),
};
const ctx = { waitUntil() {} };

describe('public Worker isolation', () => {
  it('does not serve admin pages or authentication and administration APIs', async () => {
    for (const path of ['/admin', '/admin/dashboard']) {
      const response = await worker.fetch(new Request(`https://www.astepimmigration.space${path}`), runtimeEnv, ctx);
      expect(response.status, path).toBe(404);
    }
    for (const path of ['/api/v1/auth/sign-in', '/api/v1/auth/session', '/api/v1/admin/guides']) {
      const response = await worker.fetch(new Request(`https://www.astepimmigration.space${path}`, {
        headers: { Origin: 'https://www.astepimmigration.space' },
      }), runtimeEnv, ctx);
      expect(response.status, path).toBe(404);
    }
  });
});
