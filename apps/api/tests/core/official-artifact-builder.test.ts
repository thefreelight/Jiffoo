import extract from 'extract-zip';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildOfficialArtifacts,
  OFFICIAL_PLUGIN_SOURCE_CONFIG,
} from '../../scripts/build-official-artifacts';

async function extractArtifact(artifactPath: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-artifact-extract-'));
  await extract(artifactPath, { dir: tempDir });
  return tempDir;
}

// Check if the required MVP plugin source trees exist in the repo
const REPO_ROOT = path.resolve(__dirname, '../../../..');
async function sourceTreesExist(): Promise<boolean> {
  const requiredPaths = [
    'extensions/plugins/google-auth/manifest.json',
    'extensions/plugins/apple-auth/manifest.json',
    'extensions/plugins/stripe/manifest.json',
    'extensions/plugins/i18n/manifest.json',
  ];
  for (const relPath of requiredPaths) {
    try {
      await fs.access(path.join(REPO_ROOT, relPath));
    } catch {
      return false;
    }
  }
  return true;
}

describe('buildOfficialArtifacts', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
    tempDirs.length = 0;
  });

  it('vendors SMTP runtime dependencies and generates its Prisma client', () => {
    expect(OFFICIAL_PLUGIN_SOURCE_CONFIG['smtp-email']).toEqual({
      includeNodeModules: true,
      prepareCommands: [
        'npm install --no-package-lock --ignore-scripts --workspaces=false',
        'npm prune --omit=dev --no-package-lock --ignore-scripts --workspaces=false',
        'npx prisma generate --schema prisma/schema.prisma',
      ],
    });
  });

  it(
    'builds Bokmoo MVP official plugin artifacts from repository-native source trees',
    async () => {
    // Skip if the required source trees don't exist in the repo
    if (!(await sourceTreesExist())) {
      console.log('Skipping: required plugin source trees not found in extensions/plugins/');
      return;
    }

    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-artifacts-out-'));
    tempDirs.push(outputDir);

    const result = await buildOfficialArtifacts({
      outputDir,
      slugs: ['google-auth', 'apple-auth', 'stripe', 'i18n'],
    });

    expect(result.items).toHaveLength(4);

    const googlePlugin = result.items.find((item) => item.slug === 'google-auth');
    const applePlugin = result.items.find((item) => item.slug === 'apple-auth');
    const plugin = result.items.find((item) => item.slug === 'stripe');
    const i18nPlugin = result.items.find((item) => item.slug === 'i18n');

    expect(googlePlugin).toBeDefined();
    expect(applePlugin).toBeDefined();
    expect(plugin).toBeDefined();
    expect(i18nPlugin).toBeDefined();

    expect(googlePlugin?.relativePath).toBe('plugins/google-auth/1.0.0.jplugin');
    expect(applePlugin?.relativePath).toBe('plugins/apple-auth/0.0.1.jplugin');
    expect(plugin?.relativePath).toBe('plugins/stripe/1.0.1.jplugin');
    expect(i18nPlugin?.relativePath).toBe('plugins/i18n/1.0.0.jplugin');
    expect(googlePlugin?.includedFiles).toContain('manifest.json');
    expect(googlePlugin?.includedFiles).toContain('dist/index.js');
    expect(applePlugin?.includedFiles).toContain('manifest.json');
    expect(applePlugin?.includedFiles).toContain('dist/index.js');
    expect(plugin?.includedFiles).toContain('manifest.json');
    expect(plugin?.includedFiles).toContain('dist/index.js');
    expect(i18nPlugin?.includedFiles).toContain('manifest.json');
    expect(i18nPlugin?.includedFiles).toContain('dist/index.js');
    expect(
      result.items.every((item) =>
        !item.includedFiles.some(
          (file) =>
            (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.jsx')) &&
            !file.endsWith('.d.ts'),
        ),
      ),
    ).toBe(true);

    const googlePluginExtracted = await extractArtifact(googlePlugin!.filePath);
    const applePluginExtracted = await extractArtifact(applePlugin!.filePath);
    const pluginExtracted = await extractArtifact(plugin!.filePath);
    const i18nPluginExtracted = await extractArtifact(i18nPlugin!.filePath);
    tempDirs.push(
      googlePluginExtracted,
      applePluginExtracted,
      pluginExtracted,
      i18nPluginExtracted,
    );

    const googleManifest = JSON.parse(
      await fs.readFile(path.join(googlePluginExtracted, 'manifest.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(googleManifest.slug).toBe('google-auth');
    expect(googleManifest.runtimeType).toBe('internal-fastify');
    await expect(fs.stat(path.join(googlePluginExtracted, 'checksums.json'))).resolves.toBeDefined();

    const appleManifest = JSON.parse(
      await fs.readFile(path.join(applePluginExtracted, 'manifest.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(appleManifest.slug).toBe('apple-auth');
    expect(appleManifest.runtimeType).toBe('internal-fastify');
    await expect(fs.stat(path.join(applePluginExtracted, 'checksums.json'))).resolves.toBeDefined();

    const pluginManifest = JSON.parse(
      await fs.readFile(path.join(pluginExtracted, 'manifest.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(pluginManifest.slug).toBe('stripe');
    expect(pluginManifest.version).toBe('1.0.1');
    expect(pluginManifest.runtimeType).toBe('internal-fastify');
    await expect(fs.stat(path.join(pluginExtracted, 'checksums.json'))).resolves.toBeDefined();

    const i18nManifest = JSON.parse(
      await fs.readFile(path.join(i18nPluginExtracted, 'manifest.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(i18nManifest.slug).toBe('i18n');
    expect(i18nManifest.runtimeType).toBe('internal-fastify');
    await expect(fs.stat(path.join(i18nPluginExtracted, 'checksums.json'))).resolves.toBeDefined();

    const indexJson = JSON.parse(
      await fs.readFile(path.join(outputDir, 'index.json'), 'utf-8'),
    ) as { items: Array<{ slug: string; sha256: string }> };
    expect(indexJson.items).toHaveLength(4);
    expect(indexJson.items.every((item) => typeof item.sha256 === 'string' && item.sha256.length === 64)).toBe(true);
    },
    120_000,
  );
});
