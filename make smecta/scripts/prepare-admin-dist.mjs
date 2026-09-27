import { copyFile, unlink } from 'node:fs/promises';

const source = new URL('../dist-admin/admin.html', import.meta.url);
const destination = new URL('../dist-admin/index.html', import.meta.url);
await copyFile(source, destination);
await unlink(source);
process.stdout.write('Admin HTML entry prepared.\n');
