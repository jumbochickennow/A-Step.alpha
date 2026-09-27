import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../worker/admin-entry';

const url = (path: string) => `https://admin.astepimmigration.space${path}`;
const approved = { waitUntil() {}, access: { getIdentity: async () => ({ email: 'belabbesbadibac@gmail.com' }) } };

describe('admin Worker isolation', () => {
  it('fails closed without verified Access context or with another identity', async () => {
    const noAccess = await worker.fetch(new Request(url('/admin')), env, { waitUntil() {} });
    expect(noAccess.status).toBe(403);
    const wrongIdentity = await worker.fetch(new Request(url('/admin')), env, {
      waitUntil() {}, access: { getIdentity: async () => ({ email: 'stranger@example.test' }) },
    });
    expect(wrongIdentity.status).toBe(403);
  });

  it('requires the existing app session after Access for dashboard and APIs', async () => {
    const login = await worker.fetch(new Request(url('/admin')), env, approved);
    expect(login.status).toBe(200);
    expect(login.headers.get('X-Robots-Tag')).toContain('noindex');
    const dashboard = await worker.fetch(new Request(url('/admin/dashboard')), env, approved);
    expect(dashboard.status).toBe(401);
    const api = await worker.fetch(new Request(url('/api/v1/admin/guides'), {
      headers: { Origin: url('') },
    }), env, approved);
    expect(api.status).toBe(401);
  });

  it('does not expose public submission APIs', async () => {
    const response = await worker.fetch(new Request(url('/api/v1/contact'), {
      headers: { Origin: url('') },
    }), env, approved);
    expect(response.status).toBe(404);
  });
});
