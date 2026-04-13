import extract from 'extract-zip';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildOfficialArtifacts } from '../../scripts/build-official-artifacts';

async function extractArtifact(artifactPath: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-artifact-extract-'));
  await extract(artifactPath, { dir: tempDir });
  return tempDir;
}

describe('buildOfficialArtifacts', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
    tempDirs.length = 0;
  });

  it(
    'builds official plugin and theme artifacts from repository-native source trees',
    async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-artifacts-out-'));
    tempDirs.push(outputDir);

    const result = await buildOfficialArtifacts({
      outputDir,
      slugs: ['stripe', 'i18n', 'odoo', 'esim-mall', 'yevbi'],
    });

    expect(result.items).toHaveLength(5);

    const plugin = result.items.find((item) => item.slug === 'stripe');
    const i18nPlugin = result.items.find((item) => item.slug === 'i18n');
    const odooPlugin = result.items.find((item) => item.slug === 'odoo');
    const esimTheme = result.items.find((item) => item.slug === 'esim-mall');
    const yevbiTheme = result.items.find((item) => item.slug === 'yevbi');

    expect(plugin).toBeDefined();
    expect(i18nPlugin).toBeDefined();
    expect(odooPlugin).toBeDefined();
    expect(esimTheme).toBeDefined();
    expect(yevbiTheme).toBeDefined();

    expect(plugin?.relativePath).toBe('plugins/stripe/1.0.0.jplugin');
    expect(i18nPlugin?.relativePath).toBe('plugins/i18n/1.0.0.jplugin');
    expect(odooPlugin?.relativePath).toBe('plugins/odoo/1.0.0.jplugin');
    expect(esimTheme?.relativePath).toBe('themes/esim-mall/1.0.0.jtheme');
    expect(yevbiTheme?.relativePath).toBe('themes/yevbi/1.0.0.jtheme');
    expect(plugin?.includedFiles).toContain('manifest.json');
    expect(plugin?.includedFiles).toContain('src/index.js');
    expect(i18nPlugin?.includedFiles).toContain('src/index.js');
    expect(odooPlugin?.includedFiles).toContain('dist/index.js');
    expect(odooPlugin?.includedFiles).toContain('node_modules/dotenv/package.json');
    expect(odooPlugin?.includedFiles.some((file) => file.endsWith('.map'))).toBe(false);
    expect(
      odooPlugin?.includedFiles.some(
        (file) =>
          (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.jsx')) &&
          !file.endsWith('.d.ts'),
      ),
    ).toBe(false);
    for (const theme of [esimTheme, yevbiTheme]) {
      expect(theme?.sourceDir.endsWith(path.join('theme-pack'))).toBe(true);
      expect(theme?.includedFiles).toContain('theme.json');
      expect(theme?.includedFiles).toContain('templates/home.json');
      expect(theme?.includedFiles).toContain('tokens.css');
      expect(theme?.includedFiles).toContain('schemas/settings.schema.json');
      expect(theme?.thumbnailUrl).toMatch(/\/themes\/.+\/1\.0\.0\/assets\/thumbnail\.svg$/);
      expect(theme?.includedFiles).toContain('assets/placeholder-product.svg');
    }

    await expect(
      fs.stat(path.join(outputDir, 'themes', 'esim-mall', '1.0.0', 'assets', 'thumbnail.svg')),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(outputDir, 'themes', 'yevbi', '1.0.0', 'assets', 'thumbnail.svg')),
    ).resolves.toBeDefined();

    const pluginExtracted = await extractArtifact(plugin!.filePath);
    const i18nPluginExtracted = await extractArtifact(i18nPlugin!.filePath);
    const odooPluginExtracted = await extractArtifact(odooPlugin!.filePath);
    const esimThemeExtracted = await extractArtifact(esimTheme!.filePath);
    const yevbiThemeExtracted = await extractArtifact(yevbiTheme!.filePath);
    tempDirs.push(
      pluginExtracted,
      i18nPluginExtracted,
      odooPluginExtracted,
      esimThemeExtracted,
      yevbiThemeExtracted,
    );

    const pluginManifest = JSON.parse(
      await fs.readFile(path.join(pluginExtracted, 'manifest.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(pluginManifest.slug).toBe('stripe');
    expect(pluginManifest.runtimeType).toBe('internal-fastify');
    await expect(fs.stat(path.join(pluginExtracted, 'checksums.json'))).resolves.toBeDefined();

    const i18nManifest = JSON.parse(
      await fs.readFile(path.join(i18nPluginExtracted, 'manifest.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(i18nManifest.slug).toBe('i18n');
    expect(i18nManifest.runtimeType).toBe('internal-fastify');

    const odooManifest = JSON.parse(
      await fs.readFile(path.join(odooPluginExtracted, 'manifest.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(odooManifest.slug).toBe('odoo');
    expect(odooManifest.entryModule).toBe('dist/index.js');
    await expect(fs.stat(path.join(odooPluginExtracted, 'dist', 'index.js'))).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(odooPluginExtracted, 'node_modules', 'dotenv', 'package.json')),
    ).resolves.toBeDefined();

    for (const [slug, extractedDir] of [
      ['esim-mall', esimThemeExtracted],
      ['yevbi', yevbiThemeExtracted],
    ] as const) {
      const themeManifest = JSON.parse(
        await fs.readFile(path.join(extractedDir, 'theme.json'), 'utf-8'),
      ) as Record<string, unknown>;
      expect(themeManifest.slug).toBe(slug);
      expect(themeManifest.target).toBe('shop');
      expect(themeManifest['x-jiffoo-renderer-mode']).toBe('embedded');
      expect(themeManifest['x-jiffoo-renderer-slug']).toBe(slug);

      const homeTemplate = JSON.parse(
        await fs.readFile(path.join(extractedDir, 'templates', 'home.json'), 'utf-8'),
      ) as Record<string, unknown>;
      expect(homeTemplate.page).toBe('home');
      expect(homeTemplate.blocks).toEqual([]);

      const settingsSchema = JSON.parse(
        await fs.readFile(path.join(extractedDir, 'schemas', 'settings.schema.json'), 'utf-8'),
      ) as Record<string, unknown>;
      expect(settingsSchema.type).toBe('object');
    }

    const indexJson = JSON.parse(
      await fs.readFile(path.join(outputDir, 'index.json'), 'utf-8'),
    ) as { items: Array<{ slug: string; sha256: string }> };
    expect(indexJson.items).toHaveLength(5);
    expect(indexJson.items.every((item) => typeof item.sha256 === 'string' && item.sha256.length === 64)).toBe(true);
    },
    120_000,
  );
});
