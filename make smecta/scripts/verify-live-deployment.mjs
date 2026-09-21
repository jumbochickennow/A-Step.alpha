import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const origin = 'https://www.astepimmigration.space';
const localIndex = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const builtAssets = [...localIndex.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
assert.ok(builtAssets.length >= 2, 'The local production index must reference hashed assets');
const bundles = (await readdir(new URL('../dist/assets/', import.meta.url)))
  .filter((name) => /\.(?:js|css)$/.test(name));
assert.ok(bundles.some((name) => name.startsWith('Prices-')));
assert.ok(bundles.some((name) => name.startsWith('Resources-')));

async function get(path) {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${origin}${path}${separator}deployment_check=${Date.now()}`, {
    headers: {
      'Cache-Control': 'no-cache',
      Origin: origin,
      Referer: `${origin}/`,
    },
    redirect: 'follow',
  });
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  return response;
}

const [home, prices, api] = await Promise.all([
  get('/'),
  get('/prices'),
  get('/api/v1/resources'),
]);
const [homeHtml, pricesHtml, apiBody] = await Promise.all([
  home.text(),
  prices.text(),
  api.text(),
]);

for (const asset of builtAssets) {
  assert.ok(homeHtml.includes(asset), `Live home is missing built asset ${asset}`);
  assert.ok(pricesHtml.includes(asset), `Live prices route is missing built asset ${asset}`);
}

for (const name of bundles) {
  const expected = await readFile(new URL(`../dist/assets/${name}`, import.meta.url));
  const actual = Buffer.from(await (await get(`/assets/${name}`)).arrayBuffer());
  const sha256 = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(sha256(actual), sha256(expected), `${name} does not match the local build`);
}

const resources = JSON.parse(apiBody);
assert.ok(Array.isArray(resources.items), 'Resources API did not return an items array');
assert.match(homeHtml, /A-Step/i, 'Live home does not contain the A-Step identity');

console.log(`LIVE_DEPLOYMENT_VERIFIED bundles=${bundles.length} resources=${resources.items.length}`);
