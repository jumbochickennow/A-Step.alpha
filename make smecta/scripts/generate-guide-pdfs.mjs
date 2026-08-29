/**
 * Generates the static guide PDF assets served from `public/assets/guides/`
 * and wires every seeded guide in `src/data/content.json` to its asset path.
 *
 * Usage: node scripts/generate-guide-pdfs.mjs
 *
 * Each produced file is a branded one-page placeholder so downloads always
 * deliver a real PDF. Replace individual files with final documents at any
 * time — filenames are `<slug>.pdf` and never change.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const outDir = resolve(root, 'public', 'assets', 'guides');
const contentPath = resolve(root, 'src', 'data', 'content.json');
const fallbackPath = resolve(root, 'src', 'data', 'fallback.ts');

const asciiOnly = (text) => text.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
const escapePdf = (text) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Builds a minimal, valid one-page PDF document with the given text lines. */
function buildPdf(lines) {
  const parts = [];
  let y = 740;
  const writeLine = (text, size) => {
    const clean = asciiOnly(text);
    if (!clean) return;
    parts.push(`BT /F1 ${size} Tf 56 ${y} Td (${escapePdf(clean)}) Tj ET`);
    y -= size > 14 ? 28 : 22;
  };

  writeLine('A-Step Immigration Space', 18);
  y -= 8;
  writeLine('----------------------------------------------------------------', 11);
  for (const line of lines) writeLine(line, 12);

  const stream = parts.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const humanize = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

await mkdir(outDir, { recursive: true });

// Collect slugs (+ English titles where available) from the canonical seed.
const content = JSON.parse(await readFile(contentPath, 'utf8'));
const entries = new Map();
for (const guide of content.guides) {
  entries.set(guide.slug, [`${guide.translations.en.title}`, 'A free resource prepared by the A-Step team.', 'Visit astep.dz for the latest version of this guide.']);
}

// Include any extra slugs defined in the typed fallback dataset (guides only).
const fallbackSource = (await readFile(fallbackPath, 'utf8')).split('fallbackOpportunities')[0];
for (const match of fallbackSource.matchAll(/slug:\s*'([^']+)'/g)) {
  if (!entries.has(match[1])) entries.set(match[1], [humanize(match[1]), 'A free resource prepared by the A-Step team.', 'Visit astep.dz for the latest version of this guide.']);
}

let generated = 0;
for (const [slug, lines] of entries) {
  const target = resolve(outDir, `${slug}.pdf`);
  await writeFile(target, buildPdf([lines[0], '', ...lines.slice(1)]));
  generated += 1;
  console.log(`created public/assets/guides/${slug}.pdf`);
}

// Wire every seeded guide to its static asset path.
let wired = 0;
const updatedLines = [];
for (const line of (await readFile(contentPath, 'utf8')).split('\n')) {
  let output = line;
  for (const slug of entries.keys()) {
    if (line.includes(`"slug": "${slug}"`) && line.includes('"filePath": null')) {
      output = line.replace('"filePath": null', `"filePath": "/assets/guides/${slug}.pdf"`);
      wired += 1;
      break;
    }
  }
  updatedLines.push(output);
}
if (wired > 0) await writeFile(contentPath, updatedLines.join('\n'));

console.log(`\nDone: ${generated} PDFs generated, ${wired} seed entries wired.`);
