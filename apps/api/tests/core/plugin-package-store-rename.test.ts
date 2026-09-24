import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';

describe('Plugin package store rename', () => {
  const slug = `rename-${randomUUID().slice(0, 12)}`;

  afterAll(async () => {
    await pluginPackageStore.delete(slug);
  });

  it('installs a package after an open source file handle is released', async () => {
    const source = await pluginPackageStore.createTemporaryDirectory('rename-test');
    const file = `${source}/entry.js`;
    await fs.writeFile(file, 'module.exports = {}');
    const handle = await fs.open(file, 'r');
    const release = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        handle.close().then(resolve, reject);
      }, 200);
    });
    try {
      const deployment = await pluginPackageStore.put(slug, source);
      await release;
      expect(await deployment.package.readText('entry.js')).toBe('module.exports = {}');
      await deployment.commit();
    } finally {
      await release;
      await fs.rm(source, { recursive: true, force: true });
    }
  });
});
