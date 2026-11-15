import { describe, expect, it } from 'vitest';
import { enhanceHtml, localeFromPathname } from '../worker/html-enhance';
import type { Env } from '../worker/env';

const SHELL = '<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>x</title></head><body></body></html>';
const MANIFEST = {
  'index.html': { file: 'assets/index-abc.js', isEntry: true, imports: ['_vendor-react.js'], css: ['assets/index-abc.css'] },
  '_vendor-react.js': { file: 'assets/vendor-react-abc.js' },
  '_vendor-ui.js': { file: 'assets/vendor-ui-abc.js' },
  'src/pages/Prices.tsx': { file: 'assets/Prices-abc.js', css: ['assets/Prices-abc.css'], imports: ['_vendor-react.js', '_vendor-ui.js', 'index.html'] },
};

function envWithAssets(): Env {
  return {
    ASSETS: {
      fetch: async (input: Request | string) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        if (url.pathname === '/route-manifest.json') return new Response(JSON.stringify(MANIFEST), { headers: { 'Content-Type': 'application/json' } });
        return new Response(SHELL, { headers: { 'Content-Type': 'text/html' } });
      },
    },
  } as unknown as Env;
}

const html = (response: Response) => response.text();
const shell = () => new Response(SHELL, { headers: { 'Content-Type': 'text/html' } });

describe('HTML shell enhancement', () => {
  it('maps locale prefixes and keeps / as English', () => {
    expect(localeFromPathname('/')).toEqual({ locale: 'en', route: '/' });
    expect(localeFromPathname('/guides')).toEqual({ locale: 'en', route: '/guides' });
    expect(localeFromPathname('/ar/guides/')).toEqual({ locale: 'ar', route: '/guides' });
    expect(localeFromPathname('/fr')).toEqual({ locale: 'fr', route: '/' });
  });

  it('sets lang/dir from the URL and leaves / as en/ltr', async () => {
    const env = envWithAssets();
    expect(await html(await enhanceHtml(shell(), new Request('https://www.astepimmigration.space/'), env))).toContain('<html lang="en" dir="ltr">');
    expect(await html(await enhanceHtml(shell(), new Request('https://www.astepimmigration.space/ar/guides'), env))).toContain('<html lang="ar" dir="rtl">');
    expect(await html(await enhanceHtml(shell(), new Request('https://www.astepimmigration.space/fr/contact'), env))).toContain('<html lang="fr" dir="ltr">');
  });

  it('preloads only the route chunk, its CSS and non-entry imports, plus the consultation hero', async () => {
    const out = await html(await enhanceHtml(shell(), new Request('https://www.astepimmigration.space/fr/consultation'), envWithAssets()));
    expect(out).toContain('<link rel="modulepreload" href="/assets/Prices-abc.js">');
    expect(out).toContain('<link rel="preload" as="style" href="/assets/Prices-abc.css">');
    expect(out).toContain('<link rel="modulepreload" href="/assets/vendor-ui-abc.js">');
    expect(out).not.toContain('vendor-react-abc.js');
    expect(out).not.toContain('index-abc.js');
    expect(out).toContain('consultation-hero-400.jpg 400w');
    const home = await html(await enhanceHtml(shell(), new Request('https://www.astepimmigration.space/'), envWithAssets()));
    expect(home).not.toContain('modulepreload');
    expect(home).not.toContain('consultation-hero');
  });
});
