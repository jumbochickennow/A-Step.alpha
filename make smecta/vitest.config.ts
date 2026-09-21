import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const migrations = await readD1Migrations('./migrations');
const workerTestSecrets = {
  TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
  TURNSTILE_ALLOWED_HOSTNAMES: 'www.astepimmigration.space',
  ALLOWED_ORIGINS: 'https://www.astepimmigration.space',
  PII_ENCRYPTION_KEY_V1: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE', // secret-scan: allow-test-fixture
  BLIND_INDEX_SECRET: '02'.repeat(32), // secret-scan: allow-test-fixture
  ADMIN_PASSWORD_HASH: 'hmac-sha256$v1$LJUpnr4NOIUKaMGItO0MLJa-tqx46PSnOya50iAgYLY', // secret-scan: allow-test-fixture
  ADMIN_PASSWORD_PEPPER: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
  RESOURCE_REF_SECRET: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM', // secret-scan: allow-test-fixture
};
Object.assign(process.env, workerTestSecrets);

export default defineConfig({
  plugins: [cloudflareTest({
    remoteBindings: false,
    wrangler: { configPath: './wrangler.json' },
    miniflare: {
      bindings: {
        TEST_MIGRATIONS: migrations,
        ...workerTestSecrets,
      },
    },
  })],
  test: {
    include: ['test/**/*.test.ts'],
  },
});
