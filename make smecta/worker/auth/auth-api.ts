import { base64UrlDecode, base64UrlEncode, signHmac, verifyHmac } from '../crypto';
import type { Env } from '../env';
import { HttpError, json, readJson, requireMethod } from '../http';

export interface AdminIdentity {
  id: string;
  role: 'superadmin' | 'admin' | 'owner' | 'editor' | 'analyst';
}

interface AdminSession extends AdminIdentity {
  exp: number;
  iat: number;
}

const SESSION_COOKIE = 'astep_admin_session';
const SESSION_TTL_SECONDS = 15 * 60;
const VALID_ROLES = new Set<AdminIdentity['role']>(['superadmin', 'admin', 'owner', 'editor', 'analyst']);
const MASTER_ADMIN: AdminIdentity = {
  id: 'master-password-admin',
  role: 'superadmin',
};
const MASTER_ADMIN_RECORD_EMAIL = 'admin@a-step.org';
const encoder = new TextEncoder();

function cookieValue(request: Request, name: string): string | null {
  for (const item of (request.headers.get('Cookie') ?? '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return null;
}

async function createSession(identity: AdminIdentity, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    ...identity,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  } satisfies AdminSession)));
  return `${payload}.${await signHmac(payload, secret)}`;
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function authenticatePasskeyAdmin(env: Env, passkey: string): Promise<AdminIdentity> {
  const expected = env.ADMIN_PASSWORD ?? '';
  if (expected.length < 16 || expected.length > 256) {
    throw new HttpError(503, 'admin_password_not_configured');
  }
  if (!await constantTimeEqual(passkey, expected)) throw new HttpError(401, 'invalid_passkey');

  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admins (id, email, role, status, created_at, updated_at)
         VALUES (?1, ?2, 'superadmin', 'active', ?3, ?3)
         ON CONFLICT(email) DO UPDATE SET
           role = 'superadmin', status = 'active', updated_at = excluded.updated_at`,
      ).bind(MASTER_ADMIN.id, MASTER_ADMIN_RECORD_EMAIL, now),
      env.DB.prepare(
        `INSERT INTO admin_users (id, email, role, created_at, last_authenticated_at)
         VALUES (?1, ?2, 'owner', ?3, ?3)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           last_authenticated_at = excluded.last_authenticated_at`,
      ).bind(MASTER_ADMIN.id, MASTER_ADMIN_RECORD_EMAIL, now),
    ]);
  } catch (error) {
    console.error('[Auth] Master admin provisioning failed', {
      type: error instanceof Error ? error.name : 'unknown',
    });
    throw new HttpError(503, 'db_error');
  }
  return MASTER_ADMIN;
}

export async function readAdminSession(request: Request, env: Pick<Env, 'SESSION_SECRET'>): Promise<AdminIdentity | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || token.length > 4096) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || !await verifyHmac(payload, signature, env.SESSION_SECRET)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Partial<AdminSession>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof session.id !== 'string' || !session.id
      || !VALID_ROLES.has(session.role as AdminIdentity['role'])
      || typeof session.iat !== 'number' || session.iat > now + 60
      || typeof session.exp !== 'number' || session.exp <= now
    ) return null;
    return { id: session.id, role: session.role as AdminIdentity['role'] };
  } catch {
    return null;
  }
}

export async function signIn(request: Request, env: Env): Promise<Response> {
  requireMethod(request, ['POST']);
  const body = await readJson(request, 2048);
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !('passkey' in body)
    || typeof body.passkey !== 'string' || body.passkey.length < 1 || body.passkey.length > 256) {
    throw new HttpError(400, 'invalid_sign_in_request');
  }
  const identity = await authenticatePasskeyAdmin(env, body.passkey);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return json(
    { success: true, role: identity.role },
    200,
    { 'Set-Cookie': `${SESSION_COOKIE}=${await createSession(identity, env.SESSION_SECRET)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}` },
  );
}

export function sessionStatus(request: Request, identity: AdminIdentity): Response {
  requireMethod(request, ['GET']);
  return json({ success: true, role: identity.role });
}

export function signOut(request: Request): Response {
  requireMethod(request, ['POST']);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return json(
    { success: true, logoutUrl: '/' },
    200,
    { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0` },
  );
}
