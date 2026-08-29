/**
 * Pre-deployment asset & route integrity audit.
 *
 * Validates that every PDF, image and font referenced by the bundled content
 * datasets (content.json + fallback.ts), index.html and the PWA manifest
 * physically exists under public/ — and that the sitemap matches the real
 * public route table without leaking secret admin paths.
 *
 * Exit 0 = 100% intact · Exit 1 = explicit missing/broken paths listed.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const publicRoot = resolve(projectRoot, 'public');

const supportsColor = process.stdout.isTTY !== false;
const c = {
  red: (t) => (supportsColor ? `\x1b[31m${t}\x1b[0m` : t),
  green: (t) => (supportsColor ? `\x1b[32m${t}\x1b[0m` : t),
  yellow: (t) => (supportsColor ? `\x1b[33m${t}\x1b[0m` : t),
  cyan: (t) => (supportsColor ? `\x1b[36m${t}\x1b[0m` : t),
  dim: (t) => (supportsColor ? `\x1b[2m${t}\x1b[0m` : t),
  bold: (t) => (supportsColor ? `\x1b[1m${t}\x1b[0m` : t),
};

/** Every quoted root-relative static asset path found in a source text. */
function extractAssetPaths(text) {
  const paths = new Set();
  const pattern = /['"](\/(?:assets|og|fonts)\/[^'"\s)<>]+?\.(?:pdf|png|jpe?g|webp|svg|woff2?))['"]/g;
  for (const match of String(text).matchAll(pattern)) paths.add(match[1]);
  return paths;
}

function checkExists(path) {
  return existsSync(resolve(publicRoot, path.replace(/^\//, '')));
}

/* ------------------------------------------------------------------ */
/* 1. Collect referenced assets                                        */
/* ------------------------------------------------------------------ */

const references = new Map(); // path → [sources]

function addReference(path, source) {
  if (!path || !path.startsWith('/')) return; // external URLs & null sentinels skip
  if (!/\.(pdf|png|jpe?g|webp|svg|woff2?)$/i.test(path)) return;
  const list = references.get(path) ?? [];
  list.push(source);
  references.set(path, list);
}

try {
  const content = JSON.parse(await readFile(resolve(projectRoot, 'src/data/content.json'), 'utf8'));
  for (const guide of content.guides ?? []) {
    for (const field of ['filePath', 'coverPath']) {
      if (typeof guide[field] === 'string') addReference(guide[field], `content.json#${guide.slug}.${field}`);
    }
  }
  for (const opportunity of content.opportunities ?? []) {
    if (typeof opportunity.imagePath === 'string') {
      addReference(opportunity.imagePath, `content.json#${opportunity.slug}.imagePath`);
    }
  }
} catch (error) {
  console.error(c.red(`✖ content.json unreadable: ${error.message}`));
  process.exit(1);
}

try {
  const fallbackSource = await readFile(resolve(projectRoot, 'src/data/fallback.ts'), 'utf8');
  let fallbackIndex = 0;
  for (const path of extractAssetPaths(fallbackSource)) {
    fallbackIndex += 1;
    addReference(path, `fallback.ts#${fallbackIndex}`);
  }
} catch (error) {
  console.error(c.red(`✖ fallback.ts unreadable: ${error.message}`));
  process.exit(1);
}

try {
  const html = await readFile(resolve(projectRoot, 'index.html'), 'utf8');
  let index = 0;
  for (const path of extractAssetPaths(html)) {
    index += 1;
    addReference(path, `index.html#${index}`);
  }
  const manifest = JSON.parse(await readFile(resolve(publicRoot, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons ?? []) addReference(icon.src, 'manifest.webmanifest');
} catch (error) {
  console.error(c.red(`✖ index.html / manifest read failed: ${error.message}`));
}

/* ------------------------------------------------------------------ */
/* 2. Verify existence                                                 */
/* ------------------------------------------------------------------ */

const sortedPaths = [...references.keys()].sort();
const missing = sortedPaths.filter((path) => !checkExists(path));

console.log(c.bold('\nAsset integrity'));
for (const path of sortedPaths) {
  const ok = checkExists(path);
  const sources = references.get(path).join(', ');
  console.log(`  ${ok ? c.green('✔') : c.red('✖')} ${path}  ${c.dim(`(${sources})`)}`);
}
if (missing.length) {
  console.error(c.red(`\n✖ ${missing.length} referenced asset(s) missing under public/:`));
  for (const path of missing) console.error(c.red(`   - ${path}`));
} else {
  console.log(c.green(`✔ ${sortedPaths.length} referenced assets all present under public/`));
}

/* ------------------------------------------------------------------ */
/* 3. Route ↔ sitemap parity                                           */
/* ------------------------------------------------------------------ */

const PUBLIC_PAGES = ['', 'guides', 'opportunities', 'about', 'contact', 'privacy', 'terms'];
const PUBLIC_PREFIXES = ['', 'fr/', 'ar/'];
const expectedRoutes = new Set(
  PUBLIC_PREFIXES.flatMap((prefix) => PUBLIC_PAGES.map((page) => `/${prefix}${page}`.replace(/\/+$/, '/') || '/')),
);

let sitemapLocs = [];
try {
  const sitemapRaw = await readFile(resolve(publicRoot, 'sitemap.xml'), 'utf8');
  sitemapLocs = [...sitemapRaw.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
} catch (error) {
  console.error(c.red(`✖ sitemap.xml unreadable: ${error.message}`));
  process.exit(1);
}

const SECRET_FRAGMENTS = ['/adminspace', '/astep-control-vault', '/admin'];
const leakedSecrets = sitemapLocs.filter((route) => SECRET_FRAGMENTS.some((secret) => route.includes(secret)));
const unknownInSitemap = sitemapLocs.filter((route) => !expectedRoutes.has(route));
const missingFromSitemap = [...expectedRoutes].filter((route) => !sitemapLocs.includes(route));

console.log(c.bold('\nRoute & sitemap parity'));
let routeIssues = 0;
if (leakedSecrets.length) {
  routeIssues += leakedSecrets.length;
  console.error(c.red(`  ✖ admin paths exposed in sitemap: ${leakedSecrets.join(', ')}`));
}
for (const route of unknownInSitemap) {
  routeIssues += 1;
  console.error(c.red(`  ✖ sitemap lists non-public route: ${route}`));
}
for (const route of missingFromSitemap) {
  routeIssues += 1;
  console.error(c.red(`  ✖ public route missing from sitemap: ${route}`));
}
if (routeIssues === 0) {
  console.log(c.green(`  ✔ ${sitemapLocs.length} sitemap entries exactly match the ${expectedRoutes.size} public routes; no admin paths exposed`));
}

/* ------------------------------------------------------------------ */
/* Verdict                                                             */
/* ------------------------------------------------------------------ */

const totalIssues = missing.length + routeIssues;
console.log('');
if (totalIssues > 0) {
  console.error(c.bold(c.red(`✖ Health audit failed with ${totalIssues} issue(s).`)));
  process.exit(1);
}
console.log(c.green(c.bold('✔ Pre-deployment health audit passed — assets, routes and sitemap are 100% intact.')));
process.exit(0);
