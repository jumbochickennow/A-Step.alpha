import assert from 'node:assert/strict';
const origin = process.env.RESOURCES_ORIGIN || 'http://127.0.0.1:4173';
const request = (path, init = {}) => fetch(new URL(path, origin), { ...init, signal: AbortSignal.timeout(10_000) });
for (const path of ['/.dev.vars', '/.dev.vars?raw', '/wrangler.local.json', '/wrangler.local.json?raw', '/@fs/home/djouadimounsaf/astep-prices/.dev.vars', '/@fs/home/djouadimounsaf/astep-local-admin-passkey.txt']) {
  const response = await request(path);
  assert.equal(response.status, 403, `Private file must be blocked: ${path}`);
}
assert.equal((await request('/api/v1/resources')).status, 200, 'Public catalog stays accessible');
for (const headers of [{ Origin: 'https://untrusted.example' }, { Referer: 'https://untrusted.example/' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
  assert.equal((await request('/api/v1/resources', { headers })).status, 403, 'Cross-site requests cannot inherit the proxy trusted origin');
}
assert.equal((await request('/api/v1/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'Writes require same-origin browser evidence');
assert.equal((await request('/api/v1/admin/resources', { headers: { Origin: origin } })).status, 401, 'Admin data requires authentication');
console.log('LOCAL SECURITY PASS: private files, proxy origins and unauthenticated admin access');
