import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import archiver from 'archiver';

export async function themePackage(forbidden = false): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((done, fail) => {
    archive.on('end', done);
    archive.on('error', fail);
  });
  archive.append(await readFile(resolve(__dirname, 'fixtures/themes/test-shop-theme/theme.json')), { name: 'theme.json' });
  if (forbidden) archive.append('console.log("not allowed")', { name: 'scripts/run.js' });
  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}
