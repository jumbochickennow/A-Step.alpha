import { randomToken, sha256, verifyHmac } from '../crypto';
import type { Env } from '../env';
import { HttpError, json, readJson, requireMethod } from '../http';
import type {
  AdminSecurityCoordinator,
  LoginPermit,
  StoredAdminSession,
} from '../security/security-coordinators';

export interface AdminIdentity {
  id: string;
  role: 'superadmin' | 'admin' | 'owner' | 'editor' | 'analyst';
}

type AdminSecurityStub = Pick<
  AdminSecurityCoordinator,
  'beginLogin' | 'completeLogin' | 'validateSession' | 'revokeSession' | 'revokeAllSessions'
>;

const SESSION_COOKIE = 'astep_admin_session';
const SESSION_TTL_SECONDS = 15 * 60;
const MASTER_ADMIN: AdminIdentity = { id: 'master-password-admin', role: 'superadmin' };
const AUTH_COORDINATOR_NAME = 'master-password-admin:v5';
// Internal, non-login database sentinel required by the existing schema.
const MASTER_ADMIN_RECORD_EMAIL = 'password-only-admin@internal.invalid';
const PASSWORD_HASH = /^hmac-sha256\$v1\$([A-Za-z0-9_-]{43})$/;
const PASSWORD_CONTEXT = 'a-step:admin-password:v1\u0000';

function securityStub(env: Pick<Env, 'ADMIN_SECURITY'>): AdminSecurityStub {
  return env.ADMIN_SECURITY.getByName(AUTH_COORDINATOR_NAME) as unknown as AdminSecurityStub;
}

function cookieValue(request: Request, name: string): string | null {
  for (const item of (request.headers.get('Cookie') ?? '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return null;
}

function sessionCookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`;
}

/** Verifies the versioned keyed password MAC without loading a plaintext server password. */
export async function verifyAdminPassword(passkey: string, encodedHash: string, pepper: string): Promise<boolean> {
  const match = PASSWORD_HASH.exec(encodedHash);
  if (!match) throw new HttpError(503, 'admin_password_not_configured');
  return verifyHmac(`${PASSWORD_CONTEXT}${passkey}`, match[1], pepper);
}

async function provisionMasterAdmin(env: Env): Promise<void> {
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admins (id, email, role, status, created_at, updated_at)
         VALUES (?1, ?2, 'superadmin', 'active', ?3, ?3)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           role = 'superadmin', status = 'active', updated_at = excluded.updated_at`,
      ).bind(MASTER_ADMIN.id, MASTER_ADMIN_RECORD_EMAIL, now),
      env.DB.prepare(
        `INSERT INTO admin_users (id, email, role, created_at, last_authenticated_at)
         VALUES (?1, ?2, 'owner', ?3, ?3)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           role = 'owner',
           last_authenticated_at = excluded.last_authenticated_at`,
      ).bind(MASTER_ADMIN.id, MASTER_ADMIN_RECORD_EMAIL, now),
    ]);
  } catch (error) {
    console.error('[Auth] Master admin provisioning failed', {
      type: error instanceof Error ? error.name : 'unknown',
    });
    throw new HttpError(503, 'db_error');
  }
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
}

export async function readAdminSession(
  request: Request,
  env: Pick<Env, 'ADMIN_SECURITY'>,
): Promise<AdminIdentity | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || token.length !== 43 || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const session: StoredAdminSession | null = await securityStub(env).validateSession(
      await sha256(token),
      Math.floor(Date.now() / 1000),
    );
    return session ? { id: session.id, role: session.role } : null;
  } catch {
    throw new HttpError(503, 'authentication_unavailable');
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

  const now = Math.floor(Date.now() / 1000);
  const ipHash = await sha256(clientIp(request));
  const coordinator = securityStub(env);
  let permit: LoginPermit;
  try {
    permit = await coordinator.beginLogin(ipHash, now);
  } catch {
    throw new HttpError(503, 'authentication_unavailable');
  }
  if (!permit.allowed) {
    return json(
      { error: 'Too many sign-in attempts' },
      429,
      { 'Retry-After': String(permit.retryAfter), 'RateLimit-Remaining': '0' },
    );
  }

  const valid = await verifyAdminPassword(body.passkey, env.ADMIN_PASSWORD_HASH, env.ADMIN_PASSWORD_PEPPER);
  if (!valid) {
    await coordinator.completeLogin(ipHash, false, null, null, null, now);
    throw new HttpError(401, 'invalid_passkey');
  }

  await provisionMasterAdmin(env);
  const token = randomToken();
  const expiresAt = now + SESSION_TTL_SECONDS;
  try {
    await coordinator.completeLogin(ipHash, true, await sha256(token), MASTER_ADMIN, expiresAt, now);
  } catch {
    throw new HttpError(503, 'authentication_unavailable');
  }
  return json(
    { success: true, role: MASTER_ADMIN.role },
    200,
    { 'Set-Cookie': sessionCookie(request, token, SESSION_TTL_SECONDS) },
  );
}

export function sessionStatus(request: Request, identity: AdminIdentity): Response {
  requireMethod(request, ['GET']);
  return json({ success: true, role: identity.role });
}

export async function signOut(request: Request, env: Pick<Env, 'ADMIN_SECURITY'>): Promise<Response> {
  requireMethod(request, ['POST']);
  const token = cookieValue(request, SESSION_COOKIE);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await securityStub(env).revokeSession(await sha256(token), Math.floor(Date.now() / 1000));
  }
  return json(
    { success: true, logoutUrl: '/' },
    200,
    { 'Set-Cookie': sessionCookie(request, '', 0) },
  );
}
