/**
 * Pre-build translation validator.
 *
 * Audits src/locales/{en,fr,ar}.json for:
 *  - missing keys relative to the English baseline schema;
 *  - orphan keys that exist outside the baseline;
 *  - empty or whitespace-only translation values;
 *  - mismatched {{interpolation}} variables across locales;
 *  - literal t('…') usages across TypeScript sources that resolve to no known key.
 *
 * Exits 0 with a sync summary table when everything matches, or 1 with a
 * descriptive, colored report of every finding.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const localesDir = resolve('src', 'locales');
const sourceDir = resolve('src');
const locales = ['en', 'fr', 'ar'];
const baselineLocale = 'en';

const supportsColor = process.stdout.isTTY !== false;
const c = {
  red: (text) => (supportsColor ? `\x1b[31m${text}\x1b[0m` : text),
  green: (text) => (supportsColor ? `\x1b[32m${text}\x1b[0m` : text),
  yellow: (text) => (supportsColor ? `\x1b[33m${text}\x1b[0m` : text),
  cyan: (text) => (supportsColor ? `\x1b[36m${text}\x1b[0m` : text),
  dim: (text) => (supportsColor ? `\x1b[2m${text}\x1b[0m` : text),
  bold: (text) => (supportsColor ? `\x1b[1m${text}\x1b[0m` : text),
};

/** Recursively extracts dotted key paths paired with their string leaf values. */
function flattenLeaves(value, prefix = '', out = []) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenLeaves(child, path, out);
    } else {
      out.push([path, typeof child === 'string' ? child : String(child ?? '')]);
    }
  }
  return out;
}

const INTERPOLATION_PATTERN = /\{\{\s*([\w$]+)\s*\}\}/g;

/** Extracts the set of {{variable}} names used inside a translation string. */
function extractVariables(text) {
  return new Set([...String(text).matchAll(INTERPOLATION_PATTERN)].map((match) => match[1]));
}

async function loadLocaleCatalog(locale) {
  const file = resolve('src', 'locales', `${locale}.json`);
  try {
    const json = JSON.parse(await readFile(file, 'utf8'));
    const entries = flattenLeaves(json);
    return { locale, keys: new Set(entries.map(([path]) => path)), values: new Map(entries) };
  } catch (error) {
    console.error(c.red(`✖ ${locale}.json could not be parsed as JSON: ${error.message}`));
    process.exit(1);
  }
}

const catalogs = await Promise.all(locales.map(loadLocaleCatalog));
const byLocale = new Map(catalogs.map((catalog) => [catalog.locale, catalog]));
const base = byLocale.get(baselineLocale);

if (!base) {
  console.error(c.red(`✖ Baseline catalog ${baselineLocale}.json is missing.`));
  process.exit(1);
}

const failures = [];

function reportFailure(locale, category, detail) {
  failures.push({ locale, category, detail });
  console.error(c.red(`  ✖ [${locale}] ${category}: `) + c.dim(detail));
}

console.log(c.bold(`\ni18n audit — baseline: ${c.cyan(`${baselineLocale}.json`)} (${base.keys.size} keys)\n`));

/* ------------------------------------------------------------------ */
/* 1. Key parity: missing + orphan keys                                */
/* ------------------------------------------------------------------ */

for (const catalog of catalogs) {
  if (catalog.locale === baselineLocale) continue;
  const missing = [...base.keys].filter((key) => !catalog.keys.has(key));
  const orphan = [...catalog.keys].filter((key) => !base.keys.has(key));

  console.log(c.cyan(`▸ ${catalog.locale}.json`));
  if (missing.length) {
    reportFailure(catalog.locale, 'missing keys', missing.join(', '));
    console.error(c.yellow(`    ${missing.length} key(s) present in ${baselineLocale} but absent here.`));
  }
  if (orphan.length) {
    reportFailure(catalog.locale, 'orphan keys', orphan.join(', '));
    console.error(c.yellow(`    ${orphan.length} key(s) not present in the ${baselineLocale} baseline.`));
  }
  if (!missing.length && !orphan.length) {
    console.log(c.green(`    ✔ key parity with ${baselineLocale}.json`));
  }
}

/* ------------------------------------------------------------------ */
/* 2. Empty / whitespace-only values                                   */
/* ------------------------------------------------------------------ */

for (const catalog of catalogs) {
  const empties = [...catalog.values].filter(([, text]) => text.trim().length === 0).map(([path]) => path);
  if (empties.length) reportFailure(catalog.locale, 'empty values', empties.join(', '));
}
if (!failures.some((failure) => failure.category === 'empty values')) {
  console.log(c.green('✔ no empty or whitespace-only values'));
}

/* ------------------------------------------------------------------ */
/* 3. Interpolation variable consistency                               */
/* ------------------------------------------------------------------ */

let interpolationChecked = 0;
for (const [key, baseText] of base.values) {
  const baseVars = extractVariables(baseText);
  if (baseVars.size === 0) continue;
  interpolationChecked += 1;
  for (const catalog of catalogs) {
    if (catalog.locale === baselineLocale) continue;
    const localizedText = catalog.values.get(key);
    if (localizedText === undefined) continue; // already reported as missing
    const localeVars = extractVariables(localizedText);
    const differences = [
      ...[...baseVars].filter((name) => !localeVars.has(name)).map((name) => `{{${name}}} missing`),
      ...[...localeVars].filter((name) => !baseVars.has(name)).map((name) => `{{${name}}} unexpected`),
    ];
    if (differences.length) {
      reportFailure(catalog.locale, 'interpolation mismatch', `${key} → ${differences.join('; ')}`);
    }
  }
}
if (!failures.some((failure) => failure.category.startsWith('interpolation'))) {
  console.log(c.green(`✔ interpolation variables consistent (${interpolationChecked} parameterized keys)`));
}

/* ------------------------------------------------------------------ */
/* 4. Literal t('…') usage resolves to a known key                     */
/* ------------------------------------------------------------------ */

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const unresolvedKeys = new Set();
for (const file of await sourceFiles(sourceDir)) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
    if (!base.keys.has(match[1])) unresolvedKeys.add(match[1]);
  }
}
if (unresolvedKeys.size) {
  reportFailure(baselineLocale, 'unresolved t() literals', [...unresolvedKeys].join(', '));
} else {
  console.log(c.green(`✔ all literal t('…') calls resolve to known keys`));
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

console.log('');
console.log(c.bold('Summary'));
for (const catalog of catalogs) {
  const localeIssues = failures.filter((failure) => failure.locale === catalog.locale).length;
  const marker = catalog.locale === baselineLocale ? c.dim(' (baseline)') : '';
  const status = localeIssues ? c.red(`${localeIssues} issue(s)`) : c.green('in sync');
  console.log(`  ${c.cyan(catalog.locale.padEnd(4))} ${String(catalog.keys.size).padStart(4)} keys — ${status}${marker}`);
}
console.log('');

if (failures.length > 0) {
  console.error(c.red(`✖ Translation audit failed with ${failures.length} issue(s). Fix them before building.`));
  process.exit(1);
}

console.log(c.green(c.bold(`✔ All catalogs are in 100% sync (${base.keys.size} keys × ${locales.length} locales).`)));
process.exit(0);
