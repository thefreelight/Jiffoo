import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';

describe('theme version storage', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-theme-storage-'));
    process.env.EXTENSIONS_PATH = root;
  });

  afterEach(async () => {
    delete process.env.EXTENSIONS_PATH;
    await fs.rm(root, { recursive: true, force: true });
  });

  it('publishes an immutable version snapshot and keeps the legacy active path', async () => {
    const { ensureThemeVersionSnapshot, getThemeVersionDir } = await import(
      '@/core/admin/theme-management/storage'
    );
    const source = path.join(root, 'themes', 'shop', 'bokmoo');
    await fs.mkdir(path.join(source, 'assets'), { recursive: true });
    await fs.writeFile(path.join(source, 'theme.json'), JSON.stringify({ slug: 'bokmoo', version: '1.1.3' }));
    await fs.writeFile(path.join(source, 'assets', 'hero.svg'), '<svg/>');

    const snapshot = await ensureThemeVersionSnapshot('shop', 'bokmoo', '1.1.3');

    expect(snapshot).toBe(getThemeVersionDir('shop', 'bokmoo', '1.1.3'));
    await expect(fs.readFile(path.join(snapshot, 'assets', 'hero.svg'), 'utf-8')).resolves.toBe('<svg/>');
    await expect(fs.readFile(path.join(source, 'theme.json'), 'utf-8')).resolves.toContain('1.1.3');
  });

  it('does not overwrite an existing version snapshot', async () => {
    const { ensureThemeVersionSnapshot } = await import('@/core/admin/theme-management/storage');
    const source = path.join(root, 'themes', 'shop', 'bokmoo');
    await fs.mkdir(source, { recursive: true });
    await fs.writeFile(path.join(source, 'theme.json'), '{}');
    await fs.writeFile(path.join(source, 'marker.txt'), 'first');
    const snapshot = await ensureThemeVersionSnapshot('shop', 'bokmoo', '1.1.3');
    await fs.writeFile(path.join(source, 'marker.txt'), 'second');

    await ensureThemeVersionSnapshot('shop', 'bokmoo', '1.1.3');

    await expect(fs.readFile(path.join(snapshot, 'marker.txt'), 'utf-8')).resolves.toBe('first');
  });

  it('rejects unsafe slug and version path segments', async () => {
    const { getThemeVersionDir } = await import('@/core/admin/theme-management/storage');
    expect(() => getThemeVersionDir('shop', '../bokmoo', '1.1.3')).toThrow('Invalid theme slug');
    expect(() => getThemeVersionDir('shop', 'bokmoo', '../1.1.3')).toThrow('Invalid theme version');
  });
});
