import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { sendContactEmail } from '../worker/integrations/contact-email';
import { verifyAdminPassword } from '../worker/auth/auth-api';

const HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PASSWORD_PEPPER = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc';
const PASSWORD_HASH = 'hmac-sha256$v1$LJUpnr4NOIUKaMGItO0MLJa-tqx46PSnOya50iAgYLY'; // secret-scan: allow-test-fixture

describe('password hashing', () => {
  it('verifies the keyed password MAC in the Workers runtime', async () => {
    expect(await verifyAdminPassword('worker-test-password', PASSWORD_HASH, PASSWORD_PEPPER)).toBe(true);
    expect(await verifyAdminPassword('wrong-password', PASSWORD_HASH, PASSWORD_PEPPER)).toBe(false);
  });
});

describe('AdminSecurityCoordinator', () => {
  it('atomically limits parallel attempts from one IP', async () => {
    const stub = env.ADMIN_SECURITY.getByName(`parallel-ip-${crypto.randomUUID()}`);
    const results = await Promise.all(Array.from(
      { length: 25 },
      () => stub.beginLogin(HASH, 1_800_000_000),
    ));
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(20);
    expect(results.filter((result) => !result.allowed).every((result) => result.retryAfter === 900)).toBe(true);
  });

  it('atomically applies the account limit across distinct IPs', async () => {
    const stub = env.ADMIN_SECURITY.getByName(`parallel-account-${crypto.randomUUID()}`);
    const ips = Array.from({ length: 30 }, (_, index) => `${index.toString().padStart(2, '0')}${HASH.slice(2)}`);
    const results = await Promise.all(ips.map((ip) => stub.beginLogin(ip, 1_800_000_000)));
    expect(results.filter((result) => result.allowed)).toHaveLength(8);
    expect(results.filter((result) => !result.allowed)).toHaveLength(22);
  });

  it('stores, validates, and revokes opaque session hashes', async () => {
    const stub = env.ADMIN_SECURITY.getByName(`sessions-${crypto.randomUUID()}`);
    await stub.beginLogin(HASH, 1_800_000_000);
    await stub.completeLogin(
      HASH,
      true,
      HASH,
      { id: 'master-password-admin', role: 'superadmin' },
      1_800_000_900,
      1_800_000_000,
    );
    expect(await stub.validateSession(HASH, 1_800_000_001)).toMatchObject({ role: 'superadmin' });
    await stub.revokeSession(HASH, 1_800_000_002);
    expect(await stub.validateSession(HASH, 1_800_000_003)).toBeNull();
  });

  it('rejects expired sessions and supports account-wide revocation', async () => {
    const stub = env.ADMIN_SECURITY.getByName(`session-expiry-${crypto.randomUUID()}`);
    const secondHash = `B${HASH.slice(1)}`;
    await stub.beginLogin(HASH, 1_800_000_000);
    await stub.completeLogin(
      HASH, true, HASH, { id: 'master-password-admin', role: 'superadmin' }, 1_800_000_100, 1_800_000_000,
    );
    expect(await stub.validateSession(HASH, 1_800_000_100)).toBeNull();
    await stub.beginLogin(HASH, 1_800_000_200);
    await stub.completeLogin(
      HASH, true, secondHash, { id: 'master-password-admin', role: 'superadmin' }, 1_800_001_000, 1_800_000_200,
    );
    await stub.revokeAllSessions(1_800_000_201);
    expect(await stub.validateSession(secondHash, 1_800_000_202)).toBeNull();
  });

  it('escalates cooldown after a second failed-attempt window', async () => {
    const stub = env.ADMIN_SECURITY.getByName(`cooldown-${crypto.randomUUID()}`);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await stub.beginLogin(HASH, 1_800_000_000)).allowed).toBe(true);
    }
    expect(await stub.beginLogin(HASH, 1_800_000_000)).toMatchObject({ allowed: false, retryAfter: 900 });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await stub.beginLogin(HASH, 1_800_000_900)).allowed).toBe(true);
    }
    expect(await stub.beginLogin(HASH, 1_800_000_900)).toMatchObject({ allowed: false, retryAfter: 3600 });
  });
});

describe('AtomicRateLimiter', () => {
  it('does not permit parallel requests beyond the configured limit', async () => {
    const stub = env.RATE_LIMITER.getByName(`parallel-${crypto.randomUUID()}`);
    const results = await Promise.all(Array.from({ length: 20 }, () => stub.check(3, 60, 1_800_000_000)));
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(17);
  });
});

describe('server-side email delivery', () => {
  it('uses the restricted destination and escapes user HTML', async () => {
    let sent: EmailMessageBuilder | undefined;
    const deliveryEnv = {
      CONTACT_EMAIL: {
        async send(message: EmailMessageBuilder) {
          sent = message;
          return { messageId: 'provider-message-1' };
        },
      },
    };
    const messageId = await sendContactEmail(deliveryEnv as never, 'submission-1', {
      name: '<script>alert(1)</script>',
      email: 'person@example.com',
      message: 'Hello',
    });
    expect(messageId).toBe('provider-message-1');
    expect(sent?.to).toBe('contact@astepimmigration.space');
    expect(sent?.from).toEqual({ email: 'contact@astepimmigration.space', name: 'A-Step website' });
    expect(sent?.replyTo).toBe('person@example.com');
    expect(sent?.html).not.toContain('<script>');
    expect(sent?.html).toContain('&lt;script&gt;');
  });
});
