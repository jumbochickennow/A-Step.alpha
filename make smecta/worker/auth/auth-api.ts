import type { Env } from '../env';
import { HttpError, json, requireMethod } from '../http';
import type { AccessClaims } from '../security/access';

export interface AdminIdentity {
  id: string;
  email: string;
  role: 'admin' | 'owner' | 'editor' | 'analyst';
}

interface AdminRow extends AdminIdentity {}

export async function authenticateAccessAdmin(env: Env, claims: AccessClaims): Promise<AdminIdentity> {
  const id = claims.sub?.trim() ?? '';
  const email = claims.email?.trim().toLowerCase() ?? '';
  if (
    id.length < 1 || id.length > 255
    || email.length < 3 || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) throw new HttpError(401, 'unauthorized');

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO admin_users (id, email, role, created_at, last_authenticated_at)
       VALUES (?1, ?2, 'admin', ?3, ?3)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         last_authenticated_at = excluded.last_authenticated_at`,
    ).bind(id, email, now).run();
    const admin = await env.DB.prepare(
      'SELECT id, email, role FROM admin_users WHERE id = ?1 LIMIT 1',
    ).bind(id).first<AdminRow>();
    if (!admin) throw new Error('admin_audit_missing');
    return admin;
  } catch {
    throw new HttpError(503, 'authentication_store_unavailable');
  }
}

export function signIn(request: Request, identity: AdminIdentity): Response {
  requireMethod(request, ['POST']);
  return json({ success: true, email: identity.email, role: identity.role });
}

export function sessionStatus(request: Request, identity: AdminIdentity): Response {
  requireMethod(request, ['GET']);
  return json({ success: true, email: identity.email, role: identity.role });
}

export function signOut(request: Request): Response {
  requireMethod(request, ['POST']);
  return json({ success: true, logoutUrl: '/cdn-cgi/access/logout' });
}
