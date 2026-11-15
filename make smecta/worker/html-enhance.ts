import type { Env } from './env';

/**
 * Per-request HTML enhancement for the SPA shell (index.html):
 *  - `<html lang dir>` follows the URL locale (/fr, /ar) so assistive tech and
 *    font fallbacks are right before JavaScript runs; `/` stays `en`/`ltr`.
 *  - Route-level `<link rel="modulepreload">` for the lazy page chunk (and its
 *    CSS), read from Vite's `route-manifest.json`, so the route code downloads
 *    in parallel with the main bundle instead of after it executes.
 *  - The consultation hero image is preloaded at the responsive size.
 */

const ROUTE_ENTRIES: Record<string, string> = {
  '/opportunities': 'src/pages/Opportunities.tsx',
  '/guides': 'src/pages/Guides.tsx',
  '/contact': 'src/pages/Contact.tsx',
  '/resources': 'src/pages/Resources.tsx',
  '/consultation': 'src/pages/Prices.tsx',
};

const CONSULTATION_HERO_PRELOAD =
  '<link rel="preload" as="image" href="/assets/prices/consultation-hero.jpg" '
  + 'imagesrcset="/assets/prices/consultation-hero-400.jpg 400w, /assets/prices/consultation-hero.jpg 660w" '
  + 'imagesizes="(max-width: 767px) calc(100vw - 40px), 640px" fetchpriority="high">';

interface ManifestChunk { file: string; css?: string[]; imports?: string[]; isEntry?: boolean }
type Manifest = Record<string, ManifestChunk>;

let manifestCache: Promise<Manifest | null> | null = null;

function loadManifest(env: Env, origin: string): Promise<Manifest | null> {
  manifestCache ??= env.ASSETS.fetch(new Request(`${origin}/route-manifest.json`))
    .then(async (response) => (response.ok ? (await response.json()) as Manifest : null))
    .catch(() => null)
    .then((manifest) => {
      // A missing manifest (older deploy, local dev) must not pin `null` for the isolate's lifetime.
      if (!manifest) manifestCache = null;
      return manifest;
    });
  return manifestCache;
}

/** Files already loaded by the entry (vendor chunks, main CSS) are not preloaded twice. */
function routePreloadTags(manifest: Manifest, routeKey: string): string[] {
  const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
  const alreadyLoaded = new Set<string>([entry?.file ?? '', ...(entry?.imports ?? []).map((key) => manifest[key]?.file ?? ''), ...(entry?.css ?? [])]);
  const tags: string[] = [];
  const visit = (key: string) => {
    const chunk = manifest[key];
    if (!chunk || alreadyLoaded.has(chunk.file)) return;
    alreadyLoaded.add(chunk.file);
    tags.push(`<link rel="modulepreload" href="/${chunk.file}">`);
    for (const css of chunk.css ?? []) {
      if (!alreadyLoaded.has(css)) { alreadyLoaded.add(css); tags.push(`<link rel="preload" as="style" href="/${css}">`); }
    }
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  visit(routeKey);
  return tags;
}

export function localeFromPathname(pathname: string): { locale: 'en' | 'fr' | 'ar'; route: string } {
  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[0] === 'fr' || segments[0] === 'ar' ? segments[0] : 'en';
  const rest = locale === 'en' ? segments : segments.slice(1);
  return { locale, route: `/${rest.join('/')}` };
}

export async function enhanceHtml(response: Response, request: Request, env: Env): Promise<Response> {
  if (typeof HTMLRewriter === 'undefined') return response;
  const url = new URL(request.url);
  const { locale, route } = localeFromPathname(url.pathname);
  const headTags: string[] = [];
  const routeKey = ROUTE_ENTRIES[route];
  if (routeKey) {
    const manifest = await loadManifest(env, url.origin);
    if (manifest) headTags.push(...routePreloadTags(manifest, routeKey));
  }
  if (route === '/consultation') headTags.push(CONSULTATION_HERO_PRELOAD);
  return new HTMLRewriter()
    .on('html', {
      element(element) {
        element.setAttribute('lang', locale);
        element.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      },
    })
    .on('head', {
      element(element) {
        if (headTags.length) element.append(headTags.join(''), { html: true });
      },
    })
    .transform(response);
}
