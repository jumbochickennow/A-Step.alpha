import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminApi } from '../worker/admin-api';
import { listPublishedOpportunities } from '../worker/public-api';
import { enforceRequestEnvelope } from '../worker/security/request-guard';
import { enforceUploadBoundary } from '../worker/security/upload-defense';
import { resourceExpiry, resourceIsActive } from '../src/lib/resource-expiry';
import type { AdminIdentity } from '../worker/auth/auth-api';

const identity: AdminIdentity = { id:'resource-test-owner', role:'owner' };
const translations = { en:{title:'Session',description:'Description'}, fr:{title:'Séance',description:'Description'}, ar:{title:'جلسة',description:'وصف'} };
const input = (overrides = {}) => ({ slug:crypto.randomUUID(), country:'Resource', categories:['Resources'], applyUrl:'https://example.org/register', opensAt:null, deadline:'2099-12-31', featured:true, published:true, translations, ...overrides });
function request(path:string, method = 'GET', body?: unknown) {
 return new Request(`https://www.astepimmigration.space/api/v1/${path}`, { method, headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()}, body:body === undefined ? undefined : JSON.stringify(body) });
}
async function create(value = input()) {
 const response = await adminApi(request('admin/resources','POST',value),env,identity);
 expect(response.status).toBe(201);
 return (await response.json<{resourceId:string}>()).resourceId;
}
beforeEach(async () => { await applyD1Migrations(env.DB,env.TEST_MIGRATIONS); await env.DB.prepare('DELETE FROM resources').run(); });
describe('resource administration and expiry', () => {
 it('keeps the closing day until Algeria midnight and rejects invalid dates', () => {
  const boundary = Date.parse('2026-09-19T23:00:00Z');
  expect(resourceExpiry('2026-09-19')).toBe(boundary);
  expect(resourceIsActive({published:true,deadline:'2026-09-19'},boundary-1)).toBe(true);
  expect(resourceIsActive({published:true,deadline:'2026-09-19'},boundary)).toBe(false);
  for (const deadline of [null,'invalid','2026-02-30']) expect(resourceIsActive({published:true,deadline})).toBe(false);
 });
 it('persists edits, excludes expired/draft cards publicly, retains them for admin, and deletes', async () => {
  const value = input(); const id = await create(value);
  await create(input({deadline:'2000-01-01'}));
  await create(input({published:false}));
  const list = () => listPublishedOpportunities(request('resources'),env,'resources');
  let response = await list();
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect((await response.json<{items:unknown[]}>()).items).toHaveLength(1);
  const admin = await adminApi(request('admin/resources'),env,identity);
  expect((await admin.json<{items:unknown[]}>()).items).toHaveLength(3);
  await adminApi(request(`admin/resources/${id}`,'PUT',{...value,deadline:'2000-01-01'}),env,identity);
  response = await list();
  expect((await response.json<{items:unknown[]}>()).items).toHaveLength(0);
  await adminApi(request(`admin/resources/${id}`,'PUT',value),env,identity);
  expect((await (await list()).json<{items:unknown[]}>()).items).toHaveLength(1);
  await adminApi(request(`admin/resources/${id}`,'DELETE',{}),env,identity);
  expect((await (await list()).json<{items:unknown[]}>()).items).toHaveLength(0);
 });
 it('rejects bad dates, unsafe links, missing translations and unauthorized roles', async () => {
  for (const patch of [{deadline:null},{deadline:'2026-02-30'},{opensAt:'2026-02-30'},{applyUrl:null},{applyUrl:'javascript:alert(1)'},{translations:{...translations,fr:{title:'',description:''}}}]) {
   await expect(adminApi(request('admin/resources','POST',input(patch)),env,identity)).rejects.toMatchObject({status:400});
  }
  await expect(adminApi(request('admin/resources','POST',input()),env,{...identity,role:'analyst'})).rejects.toMatchObject({status:403});
 });
 it('uploads images through guarded resource endpoints and isolates resource IDs', async () => {
  const id = await create();
  const png = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
  const upload = new Request(`https://www.astepimmigration.space/api/v1/admin/resources/${id}/image`,{method:'PUT',headers:{'Content-Type':'image/png','Content-Length':String(png.byteLength),'Idempotency-Key':crypto.randomUUID()},body:png});
  expect(() => enforceRequestEnvelope(upload)).not.toThrow();
  expect(() => enforceUploadBoundary(upload)).not.toThrow();
  const result = await adminApi(upload,env,identity);
  const {imagePath} = await result.json<{imagePath:string}>();
  expect(imagePath).toMatch(/^\/api\/v1\/opportunity-images\//);
  expect(await env.OPPORTUNITY_IMAGES_BUCKET.get(imagePath.replace('/api/v1/',''))).not.toBeNull();
  await expect(adminApi(request(`admin/opportunities/${id}`,'PUT',input()),env,identity)).rejects.toMatchObject({status:404});
  await expect(adminApi(request(`admin/resources/${id}`,'PUT',input()),env,{...identity,id:'other-user'})).rejects.toMatchObject({status:404});
  await adminApi(request(`admin/resources/${id}`,'DELETE',{}),env,identity);
  expect(await env.OPPORTUNITY_IMAGES_BUCKET.get(imagePath.replace('/api/v1/',''))).toBeNull();
 });
});
