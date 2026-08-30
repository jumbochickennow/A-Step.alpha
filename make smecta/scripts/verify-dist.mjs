import { readFile, readdir } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const forbiddenText = /(?:TURNSTILE_SECRET_KEY|PII_ENCRYPTION_KEY_V1|BLIND_INDEX_SECRET|SESSION_SECRET|WEBHOOK_HMAC_SECRET|ADMIN_PASSWORD|CF_ACCESS_POLICY_AUD|\.dev\.vars|sourceMappingURL|import\.meta\.env\.DEV|\b(?:TODO|FIXME|@internal)\b|https?:\/\/(?:localhost|127\.0\.0\.1)(?=[:/]))/;

async function walk(directory, prefix = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await walk(new URL(`${entry.name}/`, directory), relative));
    else if (entry.isFile()) output.push({ relative, url: new URL(entry.name, directory) });
  }
  return output;
}

const files = await walk(dist);
if (files.length === 0) throw new Error('dist is empty');
if (files.some((file) => file.relative.endsWith('.map'))) throw new Error('production source map detected');

const generated = files.filter((file) => /^assets\/.*\.(?:js|css)$/i.test(file.relative));
if (generated.length === 0) throw new Error('no generated JS/CSS assets found');
for (const file of generated) {
  if (!/-[A-Za-z0-9_-]{8}\.(?:js|css)$/i.test(file.relative)) throw new Error(`unversioned generated asset: ${file.relative}`);
}

const chunks = new Set(generated.filter((file) => file.relative.endsWith('.js'))
  .map((file) => file.relative.replace(/^assets\//, '').replace(/-[A-Za-z0-9_-]{8}\.js$/, '')));
for (const expected of ['admin-portal', 'vendor-react', 'vendor-i18n', 'vendor-ui']) {
  if (!chunks.has(expected)) throw new Error(`optimized chunk missing: ${expected}`);
}

for (const file of files.filter((entry) => /\.(?:html|js|css|json|webmanifest|xml|txt)$/i.test(entry.relative))) {
  const content = await readFile(file.url, 'utf8');
  if (forbiddenText.test(content)) throw new Error(`development/internal marker detected in ${file.relative}`);
}

const index = await readFile(new URL('index.html', dist), 'utf8');
const references = [...index.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)["?#]/g)].map((match) => match[1]);
if (references.length === 0) throw new Error('index.html contains no versioned asset references');
for (const reference of references) {
  if (!/-[A-Za-z0-9_-]{8}\.(?:js|css)$/i.test(reference)) throw new Error(`index references unversioned bundle: ${reference}`);
}
process.stdout.write(`Production output verified: ${files.length} files, ${generated.length} hashed bundles, no source maps or internal markers.\n`);
