import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createGuideLead } from '../worker/public-api';
import { downloadGrant } from '../worker/routes/download-grant';
import { seedAdminCatalog } from '../worker/catalog-seed';

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await seedAdminCatalog(env);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, hostname: 'www.astepimmigration.space', action: 'lead_download', challenge_ts: new Date().toISOString() })));
});
afterEach(() => vi.unstubAllGlobals());
const localEnv = () => ({ ...env, EVENT_QUEUE: { send: vi.fn(async () => {}) } } as unknown as typeof env);
const lead = () => new Request('https://www.astepimmigration.space/api/v1/leads', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
  body: JSON.stringify({ fullName: 'Test Reader', email: 'reader@example.org', guideId: 'q1', guideLanguage: 'en', locale: 'en', turnstileToken: crypto.randomUUID() }),
});
const ctx = { waitUntil: (_promise: Promise<unknown>) => {} };

describe('guide publication and download grants', () => {
  it('refuses to issue grants for drafts', async () => {
    await env.DB.prepare('UPDATE guides SET published = 0 WHERE id = ?1').bind('q1').run();
    await expect(createGuideLead(lead(), localEnv(), ctx)).rejects.toMatchObject({ status: 404 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM download_grants').first()).toMatchObject({ count: 0 });
  });
  it('blocks a previously issued grant after unpublishing and preserves single-use downloads', async () => {
    await env.DB.prepare('UPDATE guides SET published = 1 WHERE id = ?1').bind('q1').run();
    const response = await createGuideLead(lead(), localEnv(), ctx);
    const { downloadUrl } = await response.json<{ downloadUrl: string }>();
    const request = () => new Request(`https://www.astepimmigration.space${downloadUrl}`);
    await env.GUIDES_BUCKET.put('list-of-italian-universities.pdf', '%PDF-test');
    await env.DB.prepare('UPDATE guides SET published = 0 WHERE id = ?1').bind('q1').run();
    await expect(downloadGrant(request(), env)).rejects.toMatchObject({ status: 404 });
    await env.DB.prepare('UPDATE guides SET published = 1 WHERE id = ?1').bind('q1').run();
    const download = await downloadGrant(request(), env);
    expect(download.status).toBe(200);
    expect(download.headers.get('Cache-Control')).toContain('no-store');
    expect(await download.text()).toBe('%PDF-test');
    await expect(downloadGrant(request(), env)).rejects.toMatchObject({ status: 404 });
  });
});
