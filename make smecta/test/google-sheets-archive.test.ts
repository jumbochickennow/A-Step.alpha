import { describe, expect, it } from 'vitest';
import type { Env } from '../worker/env';
import { archiveEventToGoogleSheet } from '../worker/integrations/google-sheets';

function pem(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  const base64 = btoa(binary).match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`; // secret-scan: allow-test-fixture
}

describe('Google Sheets archive', () => {
  it('authenticates server-side, appends the expected row, and suppresses a retry duplicate', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );
    const env = {
      GOOGLE_SHEETS_CLIENT_EMAIL: 'archive@example-project.iam.gserviceaccount.com',
      GOOGLE_SHEETS_PRIVATE_KEY: pem(await crypto.subtle.exportKey('pkcs8', pair.privateKey)),
      GOOGLE_SHEETS_SPREADSHEET_ID: 'test-spreadsheet-id-123456789',
    } as unknown as Env;
    const event = {
      id: crypto.randomUUID(),
      event_type: 'contact.created' as const,
      aggregate_id: crypto.randomUUID(),
    };
    let existing = false;
    let tokenCalls = 0;
    let appendCalls = 0;
    let appended: unknown;
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com/token')) {
        tokenCalls += 1;
        return Response.json({ access_token: 'test-access-token', expires_in: 3600 });
      }
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-access-token' });
      if (init?.method === 'POST') {
        appendCalls += 1;
        appended = JSON.parse(String(init.body));
        existing = true;
        return Response.json({ updates: { updatedRows: 1 } });
      }
      return Response.json({ values: existing ? [[event.id]] : [] });
    };

    const payload = {
      createdAt: '2026-09-01T10:00:00.000Z',
      name: 'Archive Test',
      email: 'archive@example.com',
      phone: '+213555000000',
      serviceInterest: 'Study abroad',
      message: 'Please contact me',
      locale: 'en',
    };
    expect(await archiveEventToGoogleSheet(env, event, payload, fetcher as typeof fetch)).toBe(event.id);
    expect(await archiveEventToGoogleSheet(env, event, payload, fetcher as typeof fetch)).toBe(event.id);
    expect(tokenCalls).toBe(1);
    expect(appendCalls).toBe(1);
    expect(appended).toEqual({
      majorDimension: 'ROWS',
      values: [[event.id, payload.createdAt, payload.name, payload.email, payload.phone,
        payload.serviceInterest, payload.message, payload.locale, 'Sent', event.aggregate_id]],
    });
  });
});
