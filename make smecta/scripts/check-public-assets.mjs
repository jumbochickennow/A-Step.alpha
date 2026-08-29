import { readFile, readdir } from 'node:fs/promises';

const roots = [new URL('../public/', import.meta.url), new URL('../dist/', import.meta.url)];
const forbiddenName = /(?:^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|[^/]+\.(?:pdf|map|pem|key|p12|pfx|jks|sql|dump|bak))$/i;

async function files(directory, prefix = '') {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const output = [];
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) output.push(...await files(new URL(`${entry.name}/`, directory), relative));
      else if (entry.isFile()) output.push({ relative, url: new URL(entry.name, directory) });
    }
    return output;
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

let scanned = 0;
for (const root of roots) {
  for (const file of await files(root)) {
    scanned += 1;
    if (forbiddenName.test(file.relative)) throw new Error(`Forbidden public artifact: ${file.relative}`);
    const content = await readFile(file.url);
    if (content.subarray(0, 5).toString('ascii') === '%PDF-') throw new Error(`PDF payload detected in public output: ${file.relative}`);
    if (content.includes(Buffer.from('-----BEGIN PRIVATE KEY-----'))) throw new Error(`Private key detected: ${file.relative}`);
  }
}

const content = await readFile(new URL('../src/data/content.json', import.meta.url), 'utf8');
if (/\/assets\/guides\/[^"']+\.pdf/i.test(content)) throw new Error('Direct public guide URL detected in content.json');
process.stdout.write(`Public asset security audit passed for ${scanned} files.\n`);
