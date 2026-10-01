import archiver from 'archiver';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';

const date = new Date('1980-01-01T00:00:00.000Z');

export async function packBuiltinPlugin(root: string): Promise<{ bytes: Buffer; hash: string }> {
  const entries: { name: string; content: Buffer }[] = [];
  async function visit(directory: string, relative: string): Promise<void> {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const name = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) await visit(path.join(directory, item.name), name);
      else if (item.isFile()) entries.push({ name, content: await fs.readFile(path.join(directory, item.name)) });
      else throw new Error(`Unsupported builtin plugin file: ${name}`);
    }
  }
  await visit(root, '');
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));

  const archive = archiver('zip');
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  const completed = new Promise<void>((resolve, reject) => {
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    output.once('end', resolve);
    output.once('error', reject);
    archive.once('error', reject);
  });
  archive.pipe(output);
  for (const entry of entries) archive.append(entry.content, { name: entry.name, date, mode: 0o644, store: true });
  await archive.finalize();
  await completed;
  const bytes = Buffer.concat(chunks);
  return { bytes, hash: createHash('sha256').update(bytes).digest('hex') };
}
