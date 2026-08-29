import { base64UrlDecode } from '../crypto';
import type { Env } from '../env';
import { HttpError } from '../http';

interface AccessHeader { alg?: string; kid?: string }
export interface AccessClaims {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
  type?: string;
}
type AccessJwk = JsonWebKey & { kid?: string };
interface Jwks { keys?: AccessJwk[] }
type AccessEnv = Pick<Env, 'CF_ACCESS_TEAM_DOMAIN' | 'CF_ACCESS_POLICY_AUD'>;

const encoder = new TextEncoder();
const jwksCache = new Map<string, { keys: Map<string, CryptoKey>; expiresAt: number }>();

function parsePart<T>(part: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T;
  } catch {
    throw new HttpError(401, 'unauthorized');
  }
}

function teamDomain(value: string): string {
  let url: URL;
  try {
    url = new URL(value.startsWith('https://') ? value : `https://${value}`);
  } catch {
    throw new HttpError(500, 'access_not_configured');
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudflareaccess.com')) {
    throw new HttpError(500, 'access_not_configured');
  }
  return url.origin;
}

async function verificationKey(domain: string, kid: string): Promise<CryptoKey> {
  let cached = jwksCache.get(domain);
  if (!cached || cached.expiresAt <= Date.now()) {
    const response = await fetch(`${domain}/cdn-cgi/access/certs`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!response.ok) throw new HttpError(503, 'access_key_unavailable');
    const jwks = await response.json() as Jwks;
    const keys = new Map<string, CryptoKey>();
    for (const jwk of jwks.keys ?? []) {
      if (!jwk.kid || jwk.kty !== 'RSA') continue;
      keys.set(jwk.kid, await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      ));
    }
    cached = { keys, expiresAt: Date.now() + 5 * 60_000 };
    jwksCache.set(domain, cached);
  }
  const key = cached.keys.get(kid);
  if (!key) throw new HttpError(401, 'unauthorized');
  return key;
}

export async function verifyCloudflareAccess(request: Request, env: AccessEnv): Promise<AccessClaims> {
  if (!env.CF_ACCESS_POLICY_AUD) throw new HttpError(500, 'access_not_configured');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16_384) throw new HttpError(401, 'unauthorized');
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'unauthorized');
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = parsePart<AccessHeader>(encodedHeader);
  const claims = parsePart<AccessClaims>(encodedClaims);
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'unauthorized');

  const domain = teamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== domain
    || !audiences.includes(env.CF_ACCESS_POLICY_AUD)
    || claims.type !== 'app'
    || typeof claims.exp !== 'number'
    || claims.exp <= now - 60
    || (typeof claims.nbf === 'number' && claims.nbf > now + 60)
    || (typeof claims.iat === 'number' && claims.iat > now + 60)
  ) {
    throw new HttpError(401, 'unauthorized');
  }

  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    await verificationKey(domain, header.kid),
    base64UrlDecode(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedClaims}`),
  );
  if (!valid) throw new HttpError(401, 'unauthorized');
  return claims;
}
