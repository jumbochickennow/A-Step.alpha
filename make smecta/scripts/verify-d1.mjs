import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('wrangler.json', root), 'utf8'));
const database = config.d1_databases?.find((entry) => entry.binding === 'DB');
const bucket = config.r2_buckets?.find((entry) => entry.binding === 'GUIDES_BUCKET');
if (!database?.database_name || !database?.database_id) throw new Error('DB binding is missing');
if (!bucket?.bucket_name) throw new Error('GUIDES_BUCKET binding is missing');

const expectedTables = [
  'admin_users',
  'contact_submissions',
  'guide_download_leads',
  'newsletter_subscribers',
  'idempotency_keys',
  'download_grants',
  'guide_assets',
  'guides',
  'opportunities',
  'outbox_events',
];
const remote = process.argv.includes('--remote');
const wranglerEntrypoint = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));

function wrangler(args, json = false) {
  const result = spawnSync(process.execPath, [wranglerEntrypoint, ...args], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'Wrangler command failed');
  if (!json) return result.stdout;
  try { return JSON.parse(result.stdout); } catch { throw new Error('Wrangler returned malformed JSON'); }
}

const names = expectedTables.map((name) => `'${name}'`).join(',');
const output = wrangler([
  'd1', 'execute', database.database_name, remote ? '--remote' : '--local', '--json',
  '--command', `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${names}) ORDER BY name`,
], true);
const rows = Array.isArray(output) ? output.flatMap((result) => result.results ?? []) : [];
const found = new Set(rows.map((row) => row.name));
const missing = expectedTables.filter((name) => !found.has(name));
if (missing.length) throw new Error(`D1 schema is missing: ${missing.join(', ')}`);

if (remote) wrangler(['r2', 'bucket', 'info', bucket.bucket_name]);
process.stdout.write(
  `${remote ? 'Remote' : 'Local'} D1 schema verified (${expectedTables.length} tables); `
  + `${remote ? 'R2 bucket connectivity verified' : 'R2 binding configuration verified'}.\n`,
);
