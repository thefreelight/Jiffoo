import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';

export async function publishTestPlugin(slug: string, source: string): Promise<string> {
  const digest = createHash('sha256');
  async function visit(directory: string, relative = ''): Promise<void> {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), name);
      else {
        digest.update(name);
        digest.update(await fs.readFile(path.join(directory, entry.name)));
      }
    }
  }
  await visit(source);
  const hash = digest.digest('hex');
  await pluginPackageStore.put(slug, hash, source);
  return hash;
}

export async function clearTestPluginCache(slug: string): Promise<void> {
  const base = process.env.EXTENSIONS_PATH || path.join(process.cwd(), 'extensions');
  await fs.rm(path.join(base, 'plugins', slug), { recursive: true, force: true });
}
