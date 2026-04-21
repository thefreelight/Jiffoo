import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('installed theme version aliases', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('creates a versioned alias that resolves to the installed theme directory', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-version-alias-'));
    vi.stubEnv('EXTENSIONS_PATH', tempRoot);
    vi.resetModules();

    const { ensureInstalledThemeVersionAlias, getThemeDir, getThemeVersionAliasDir } = await import(
      '../../src/core/admin/extension-installer/utils'
    );

    const installedThemeDir = getThemeDir('shop', 'modelsfind');
    await fs.mkdir(installedThemeDir, { recursive: true });
    await fs.writeFile(path.join(installedThemeDir, 'theme.json'), '{}', 'utf8');

    await ensureInstalledThemeVersionAlias('shop', 'modelsfind', '0.1.11');

    const aliasPath = getThemeVersionAliasDir('shop', 'modelsfind', '0.1.11');
    const stat = await fs.lstat(aliasPath);
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await fs.realpath(aliasPath)).toBe(installedThemeDir);

    await fs.rm(tempRoot, { recursive: true, force: true });
  });
});
