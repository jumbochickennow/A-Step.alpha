import { randomBytes } from 'node:crypto';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const migrations = await readD1Migrations('./migrations');
const adminTestSecrets = {
  PII_ENCRYPTION_KEY_V1: randomBytes(32).toString('base64url'),
  BLIND_INDEX_SECRET: randomBytes(32).toString('base64url'),
  RESOURCE_REF_SECRET: randomBytes(32).toString('base64url'),
  ADMIN_PASSWORD_HASH: 'hmac-sha256$v1$LJUpnr4NOIUKaMGItO0MLJa-tqx46PSnOya50iAgYLY', // secret-scan: allow-test-fixture
  ADMIN_PASSWORD_PEPPER: randomBytes(32).toString('base64url'),
};
Object.assign(process.env, adminTestSecrets);

export default defineConfig({
  plugins: [cloudflareTest({
    remoteBindings: false,
    wrangler: { configPath: './wrangler.admin.json' },
    miniflare: { bindings: { TEST_MIGRATIONS: migrations, ...adminTestSecrets } },
  })],
  test: { include: ['test/security-coordinators.test.ts', 'test/admin-worker.test.ts'] },
});
