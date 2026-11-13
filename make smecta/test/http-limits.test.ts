import { describe, expect, it } from 'vitest';
import { readJson } from '../worker/http';
import { applySecurityHeaders } from '../worker/security/headers';

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
});
