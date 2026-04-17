import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function createZipBuffer(files: Record<string, string>): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-installer-upgrade-zip-'));
  const zipPath = path.join(tempDir, 'artifact.zip');

  try {
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);

      for (const [name, content] of Object.entries(files)) {
        archive.append(content, { name });
      }

      archive.finalize().catch(reject);
    });

    return await fs.readFile(zipPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function createThemeZipBuffer(version: string, primaryColor: string): Promise<Buffer> {
  return createZipBuffer({
    'theme.json': JSON.stringify(
      {
        schemaVersion: 1,
        slug: 'modelsfind',
        name: 'ModelsFind',
        version,
        target: 'shop',
        description: 'Official market storefront theme package',
        author: 'Jiffoo',
        category: 'storefront',
        entry: {
          tokensCSS: 'tokens.css',
          templatesDir: 'templates',
        },
        defaultConfig: {
          colors: {
            primary: primaryColor,
          },
        },
        'x-jiffoo-renderer-mode': 'embedded',
        'x-jiffoo-renderer-slug': 'modelsfind',
      },
      null,
      2,
    ),
    'tokens.css': `:root { --brand-primary: ${primaryColor}; }`,
    'templates/home.json': JSON.stringify(
      {
        schemaVersion: 1,
        page: 'home',
        blocks: [],
      },
      null,
      2,
    ),
  });
}

describe('ThemeInstaller upgrade path', () => {
  let extensionsRoot = '';

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    extensionsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-installer-upgrade-ext-'));
    process.env.EXTENSIONS_PATH = extensionsRoot;

    vi.doMock('@/core/admin/extension-installer/signature-verifier', () => ({
      verifyPackageFromFiles: vi.fn().mockResolvedValue({
        verified: true,
        signedBy: 'test',
      }),
      getSignatureVerifyMode: vi.fn().mockReturnValue('optional'),
    }));

    vi.doMock('@/core/cache/service', () => ({
      CacheService: {
        delete: vi.fn().mockResolvedValue(true),
      },
    }));
  });

  afterEach(async () => {
    delete process.env.EXTENSIONS_PATH;
    await fs.rm(extensionsRoot, { recursive: true, force: true });
  });

  it('replaces an older installed theme pack when a newer version is installed', async () => {
    const { ThemeInstaller } = await import('@/core/admin/extension-installer/theme-installer');
    const installer = new ThemeInstaller();

    const oldZip = await createThemeZipBuffer('0.1.3', '#111111');
    const latestZip = await createThemeZipBuffer('0.1.4', '#ff2d8f');

    const oldInstalled = await installer.install('shop', Readable.from(oldZip));
    const latestInstalled = await installer.install('shop', Readable.from(latestZip));

    expect(oldInstalled.version).toBe('0.1.3');
    expect(latestInstalled.version).toBe('0.1.4');
    expect(latestInstalled.installedAt).toEqual(oldInstalled.installedAt);

    const themeDir = path.join(extensionsRoot, 'themes', 'shop', 'modelsfind');
    const manifest = JSON.parse(await fs.readFile(path.join(themeDir, 'theme.json'), 'utf-8')) as { version: string };
    const installedMeta = JSON.parse(await fs.readFile(path.join(themeDir, '.installed.json'), 'utf-8')) as { version: string };

    expect(manifest.version).toBe('0.1.4');
    expect(installedMeta.version).toBe('0.1.4');
  });
});
