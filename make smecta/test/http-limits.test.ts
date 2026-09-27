import { describe, expect, it } from 'vitest';
import { readJson } from '../worker/http';
import { aboutRedirect, applySecurityHeaders, consultationRedirect } from '../worker/security/headers';

describe('bounded JSON input', () => {
  it('cancels oversized streaming bodies without buffering the remaining input', async () => {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(32)); },
      cancel() { cancelled = true; },
    });
    const request = new Request('https://example.org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream });
    await expect(readJson(request, 48)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(3);
  });
  it('decodes UTF-8 characters split across chunks at the exact byte limit', async () => {
    const bytes = new TextEncoder().encode('{"title":"جلسة"}');
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    } });
    const request = new Request('https://example.org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream });
    await expect(readJson(request, bytes.length)).resolves.toEqual({ title: 'جلسة' });
  });
  it('rejects malformed lengths and malformed JSON', async () => {
    for (const length of ['-1', 'NaN', '1.5']) {
      const request = new Request('https://example.org', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': length }, body: '{}' });
      await expect(readJson(request, 100)).rejects.toMatchObject({ status: 400 });
    }
    await expect(readJson(new Request('https://example.org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), 100)).rejects.toMatchObject({ status: 400 });
  });
  it('preserves the stricter download referrer policy', () => {
    expect(applySecurityHeaders(new Response('', { headers: { 'Referrer-Policy': 'no-referrer' } })).headers.get('Referrer-Policy')).toBe('no-referrer');
  });
  it('redirects old prices URLs to consultation without losing locale or query', () => {
    for (const path of ['/prices', '/fr/prices/', '/ar/prices']) {
      const oldUrl = `https://www.astepimmigration.space${path}?ref=bookmark`;
      const response = consultationRedirect(new Request(oldUrl));
      expect(response?.status).toBe(308);
      expect(response?.headers.get('Location')).toBe(oldUrl.replace(/prices\/?\?/, 'consultation?'));
    }
    expect(consultationRedirect(new Request('https://www.astepimmigration.space/consultation'))).toBeNull();
    expect(consultationRedirect(new Request('https://www.astepimmigration.space/prices', { method: 'POST' }))).toBeNull();
  });
  it('redirects old About URLs to the matching homepage story section', () => {
    for (const [path, destination] of [
      ['/about', '/?ref=bookmark#about'],
      ['/fr/about/', '/fr/?ref=bookmark#about'],
      ['/ar/about', '/ar/?ref=bookmark#about'],
    ]) {
      const response = aboutRedirect(new Request(`https://www.astepimmigration.space${path}?ref=bookmark`));
      expect(response?.status).toBe(308);
      expect(response?.headers.get('Location')).toBe(`https://www.astepimmigration.space${destination}`);
    }
    expect(aboutRedirect(new Request('https://www.astepimmigration.space/about-us'))).toBeNull();
    expect(aboutRedirect(new Request('https://www.astepimmigration.space/about', { method: 'POST' }))).toBeNull();
  });
});
