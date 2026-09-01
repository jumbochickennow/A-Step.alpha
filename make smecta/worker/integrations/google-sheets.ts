import type { Env } from '../env';

export type ArchivedEventType = 'guide_lead.created' | 'contact.created' | 'newsletter.subscribed';

interface ArchiveEvent {
  id: string;
  event_type: ArchivedEventType;
  aggregate_id: string;
}

interface AccessTokenResponse { access_token?: string; expires_in?: number }
interface SheetValuesResponse { values?: unknown[][] }

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API_ROOT = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET_BY_EVENT: Record<ArchivedEventType, string> = {
  'contact.created': 'Contacts',
  'guide_lead.created': 'Guide Leads',
  'newsletter.subscribed': 'Newsletter',
};

let cachedToken: { clientEmail: string; value: string; expiresAt: number } | undefined;

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function privateKeyBytes(pem: string): Uint8Array {
  const normalized = pem.replaceAll('\\n', '\n').trim();
  const body = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '') // secret-scan: allow-test-fixture
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  if (!body || !/^[A-Za-z0-9+/=]+$/.test(body)) throw new Error('google_private_key_invalid');
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function serviceAccountToken(env: Env, fetcher: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken?.clientEmail === env.GOOGLE_SHEETS_CLIENT_EMAIL && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: env.GOOGLE_SHEETS_CLIENT_EMAIL,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes(env.GOOGLE_SHEETS_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetcher(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`google_oauth_failed:${response.status}`);
  const token = await response.json<AccessTokenResponse>();
  if (!token.access_token) throw new Error('google_oauth_missing_token');
  cachedToken = {
    clientEmail: env.GOOGLE_SHEETS_CLIENT_EMAIL,
    value: token.access_token,
    expiresAt: now + Math.min(token.expires_in ?? 3600, 3600),
  };
  return token.access_token;
}

function field(payload: Record<string, unknown>, name: string): string {
  const value = payload[name];
  return value === null || value === undefined ? '' : String(value).slice(0, 50_000);
}

function archiveRow(event: ArchiveEvent, payload: Record<string, unknown>): string[] {
  if (event.event_type === 'contact.created') {
    return [event.id, field(payload, 'createdAt'), field(payload, 'name'), field(payload, 'email'),
      field(payload, 'phone'), field(payload, 'serviceInterest'), field(payload, 'message'),
      field(payload, 'locale'), 'Sent', event.aggregate_id];
  }
  if (event.event_type === 'guide_lead.created') {
    return [event.id, field(payload, 'createdAt'), field(payload, 'name'), field(payload, 'email'),
      field(payload, 'guideSlug'), field(payload, 'guideLanguage'), field(payload, 'targetCountry'),
      field(payload, 'locale'), event.aggregate_id];
  }
  return [event.id, field(payload, 'consentedAt'), field(payload, 'email'), field(payload, 'locale'),
    field(payload, 'consentedAt'), '', event.aggregate_id];
}

async function sheetsRequest(
  env: Env,
  fetcher: typeof fetch,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await serviceAccountToken(env, fetcher);
  const response = await fetcher(`${SHEETS_API_ROOT}/${encodeURIComponent(env.GOOGLE_SHEETS_SPREADSHEET_ID)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error(`google_sheets_failed:${response.status}`);
  return response;
}

/** Appends one stable event ID. The preflight check makes queue retries idempotent. */
export async function archiveEventToGoogleSheet(
  env: Env,
  event: ArchiveEvent,
  payload: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const sheet = SHEET_BY_EVENT[event.event_type];
  const quotedSheet = `'${sheet.replaceAll("'", "''")}'`;
  const idRange = encodeURIComponent(`${quotedSheet}!A2:A`);
  const existing = await sheetsRequest(env, fetcher, `/values/${idRange}`);
  const existingValues = await existing.json<SheetValuesResponse>();
  if (existingValues.values?.some((row) => row[0] === event.id)) return event.id;

  const appendRange = encodeURIComponent(`${quotedSheet}!A:Z`);
  await sheetsRequest(
    env,
    fetcher,
    `/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ majorDimension: 'ROWS', values: [archiveRow(event, payload)] }) },
  );
  return event.id;
}
