import { afterAll, describe, expect, it } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { loadPluginEntryModule } from '@/core/admin/extension-installer/plugin-module-loader';

const tempDirs: string[] = [];

async function createTempPluginDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function supportsNativeDynamicImport(): Promise<boolean> {
  try {
    await new Function('return import("data:text/javascript,export const ok = true;");')();
    return true;
  } catch {
    return false;
  }
}

describe('Plugin module loader', () => {
  afterAll(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('reloads CommonJS plugin modules without using unsupported file URL query parameters', async () => {
    const pluginDir = await createTempPluginDir('plugin-loader-cjs-');
    const entryPath = path.join(pluginDir, 'index.js');

    await fs.writeFile(
      path.join(pluginDir, 'package.json'),
      JSON.stringify({ name: 'plugin-loader-cjs', version: '1.0.0' }, null, 2),
      'utf-8',
    );
    await fs.writeFile(entryPath, 'module.exports = { value: 1 };', 'utf-8');

    const firstLoad = await loadPluginEntryModule(entryPath, { version: '1.0.0' });
    expect((firstLoad.default || firstLoad).value).toBe(1);

    await fs.writeFile(entryPath, 'module.exports = { value: 2 };', 'utf-8');

    const secondLoad = await loadPluginEntryModule(entryPath, { version: '1.0.1' });
    expect((secondLoad.default || secondLoad).value).toBe(2);
  });

  it('supports ESM plugin entry modules with cache busting', async () => {
    if (!(await supportsNativeDynamicImport())) {
      return;
    }

    const pluginDir = await createTempPluginDir('plugin-loader-esm-');
    const entryPath = path.join(pluginDir, 'index.mjs');

    await fs.writeFile(
      path.join(pluginDir, 'package.json'),
      JSON.stringify({ name: 'plugin-loader-esm', version: '1.0.0', type: 'module' }, null, 2),
      'utf-8',
    );
    await fs.writeFile(entryPath, 'export const value = 1;', 'utf-8');

    const firstLoad = await loadPluginEntryModule(entryPath, { version: '1.0.0' });
    expect(firstLoad.value).toBe(1);

    await fs.writeFile(entryPath, 'export const value = 2;', 'utf-8');

    const secondLoad = await loadPluginEntryModule(entryPath, { version: '1.0.1' });
    expect(secondLoad.value).toBe(2);
  });
});
