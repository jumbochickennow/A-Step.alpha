import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { adminApi } from '../worker/admin-api';
import { readAdminSession, type AdminIdentity } from '../worker/auth/auth-api';
import { encryptPii } from '../worker/security/encryption';

const identity: AdminIdentity = { id: 'review-test-admin', role: 'superadmin' };
const request = (path: string, method = 'GET') => new Request(
  `https://www.astepimmigration.space/api/v1/admin/${path}`, { method },
);

describe('24-month data review flags', () => {
  it('surfaces old records beyond the newest 100, pages them, and keeps them private and intact', async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const old = new Date();
    old.setUTCFullYear(old.getUTCFullYear() - 3);
    const oldDate = old.toISOString();
    const recentDate = new Date().toISOString();
    const email = `review-${crypto.randomUUID()}@example.org`;
    const ciphertext = await encryptPii(email, env.PII_ENCRYPTION_KEY_V1);
    const contact = (createdAt: string) => env.DB.prepare(
      `INSERT INTO contact_submissions
       (id, name_ciphertext, email_ciphertext, email_blind_index, message_ciphertext, locale, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'en', ?6)`,
    ).bind(crypto.randomUUID(), ciphertext, ciphertext, crypto.randomUUID(), ciphertext, createdAt);
    const statements = [
      ...Array.from({ length: 21 }, () => contact(oldDate)),
      ...Array.from({ length: 101 }, () => contact(recentDate)),
    ];
    for (let index = 0; index < statements.length; index += 40) {
      await env.DB.batch(statements.slice(index, index + 40));
    }
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO guide_download_leads
         (id, name_ciphertext, email_ciphertext, email_blind_index, guide_slug, locale, created_at)
         VALUES (?1, ?2, ?3, ?4, 'test-guide', 'en', ?5)`,
      ).bind(crypto.randomUUID(), ciphertext, ciphertext, crypto.randomUUID(), oldDate),
      env.DB.prepare(
        `INSERT INTO newsletter_subscribers
         (id, email_ciphertext, email_blind_index, locale, unsubscribe_token, created_at)
         VALUES (?1, ?2, ?3, 'en', ?4, ?5)`,
      ).bind(crypto.randomUUID(), ciphertext, crypto.randomUUID(), crypto.randomUUID(), oldDate),
    ]);

    const normal = await adminApi(request('records/contact_messages'), env, identity);
    const normalItems = (await normal.json<{ items: { submittedAt: string }[] }>()).items;
    expect(normalItems).toHaveLength(100);
    expect(normalItems.every((item) => item.submittedAt === recentDate)).toBe(true);

    const metrics = await adminApi(request('metrics'), env, identity);
    expect(await metrics.json()).toMatchObject({ reviewDue: 23 });
    const first = await adminApi(request('records/review-due'), env, identity);
    const firstPage = await first.json<{ items: { id: string; recordType: string; email: string; message: string | null; guideSlug: string | null }[]; hasMore: boolean }>();
    const second = await adminApi(request('records/review-due?offset=20'), env, identity);
    const secondPage = await second.json<typeof firstPage>();
    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.items).toHaveLength(3);
    expect(secondPage.hasMore).toBe(false);
    expect([...firstPage.items, ...secondPage.items].map((item) => item.recordType).sort()).toEqual([
      ...Array.from({ length: 21 }, () => 'contact'), 'lead', 'newsletter',
    ].sort());
    expect([...firstPage.items, ...secondPage.items].every((item) => item.email === email)).toBe(true);
    expect(firstPage.items.find((item) => item.recordType === 'contact')?.message).toBe(email);
    expect([...firstPage.items, ...secondPage.items].find((item) => item.recordType === 'lead')?.guideSlug).toBe('test-guide');
    expect(firstPage.items[0].id).not.toMatch(/^[0-9a-f]{8}-/);
    await expect(adminApi(request('records/review-due'), env, { ...identity, role: 'editor' }))
      .rejects.toMatchObject({ status: 403 });
    expect(await readAdminSession(request('records/review-due'), env)).toBeNull();
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM contact_submissions').first())
      .toMatchObject({ count: 122 });
  });
});
