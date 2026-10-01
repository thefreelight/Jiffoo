import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { createHash } from 'node:crypto';

describe('Plugin package store rename', () => {
  const slug = `rename-${randomUUID().slice(0, 12)}`;

  afterAll(async () => {
    await clearTestPluginCache(slug);
  });

  it('publishes a complete immutable copy while a source file is open', async () => {
    const source = await pluginPackageStore.createTemporaryDirectory('rename-test');
    const file = `${source}/entry.js`;
    await fs.writeFile(file, 'module.exports = {}');
    const handle = await fs.open(file, 'r');
    try {
      const hash = createHash('sha256').update('module.exports = {}').digest('hex');
      const deployment = await pluginPackageStore.put(slug, hash, source);
      expect(await deployment.package.readText('entry.js')).toBe('module.exports = {}');
      expect(await deployment.package.readText('.complete.json')).toBe(JSON.stringify({ slug, zipHash: hash }));
      await deployment.commit();
    } finally {
      await handle.close();
      await fs.rm(source, { recursive: true, force: true });
    }
  });
});
