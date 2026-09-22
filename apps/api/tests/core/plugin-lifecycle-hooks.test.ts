import { afterAll, describe, expect, it } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { executeLifecycleHook, type LifecycleContext } from '@/core/admin/plugin-management/lifecycle-hooks';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import type { PluginManifest } from '@jiffoo/shared';

describe('Plugin lifecycle hooks', () => {
  const slug = `lifecycletest${Date.now().toString(36).slice(-6)}`.slice(0, 24);
  let markerPath = path.join(os.tmpdir(), `.plugin-lifecycle-${slug}.json`);
  let pluginDir = '';

  afterAll(async () => {
    await pluginPackageStore.delete(slug);
    await fs.rm(markerPath, { force: true });
    await fs.rm(pluginDir, { recursive: true, force: true });
  });

  it('loads internal-fastify lifecycle hooks from the plugin entry module', async () => {
    pluginDir = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-lifecycle-'));
    await fs.mkdir(path.join(pluginDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'src', 'index.js'),
      `
const fs = require('fs/promises');

module.exports.__lifecycle_onEnable = async function onEnable(context) {
  await fs.writeFile(${JSON.stringify(markerPath)}, JSON.stringify(context), 'utf-8');
};
      `.trim(),
      'utf-8',
    );

    await pluginPackageStore.put(slug, pluginDir);

    const manifest: PluginManifest = {
      schemaVersion: 1,
      slug,
      name: 'Lifecycle Test Plugin',
      version: '1.0.0',
      description: 'Ensures lifecycle hooks can import plugin entry modules',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule: 'src/index.js',
      permissions: [],
      lifecycle: {
        onEnable: true,
      },
    };

    const context: LifecycleContext = {
      installationId: 'inst_test',
      pluginSlug: slug,
      instanceKey: 'default',
      config: { enabled: true },
    };

    const result = await executeLifecycleHook('onEnable', context, manifest);

    expect(result.success).toBe(true);

    const writtenContext = JSON.parse(await fs.readFile(markerPath, 'utf-8')) as LifecycleContext;
    expect(writtenContext.installationId).toBe('inst_test');
    expect(writtenContext.pluginSlug).toBe(slug);
    expect(writtenContext.config).toEqual({ enabled: true });
  });
});
