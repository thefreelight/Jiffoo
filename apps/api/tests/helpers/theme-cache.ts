import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function clearTestThemeCache(slug: string): Promise<void> {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new Error('Unsafe theme cache slug');
  const root = path.resolve(process.env.EXTENSIONS_PATH || 'extensions', 'themes');
  const target = path.resolve(root, slug);
  if (!target.startsWith(root + path.sep)) throw new Error('Unsafe theme cache path');
  await fs.rm(target, { recursive: true, force: true });
}
