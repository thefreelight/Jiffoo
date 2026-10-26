import { promises as fs } from 'fs';
import path from 'path';
import { themeTestBarrier } from './theme-test-hooks';
import { randomUUID } from 'node:crypto';
import { isPluginAssetPath } from '@jiffoo/shared';

const PUBLISH_ATTEMPTS = 5;

async function renameWithRetry(source: string, target: string): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await fs.rename(source, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(code || '') || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** (attempt - 1)));
    }
  }
}

async function pathExists(target: string): Promise<boolean> {
  return await fs.access(target).then(() => true, () => false);
}

/**
 * A staging directory belongs to the publish that created it. The identity
 * tells a publish apart from another publish that later reused the same path.
 */
interface StagedDirectory {
  directory: string;
  identity: { dev: number; ino: number } | null;
}

async function stagedIdentity(directory: string): Promise<{ dev: number; ino: number } | null> {
  try {
    const info = await fs.stat(directory);
    if (!info.ino) return null;
    return { dev: info.dev, ino: info.ino };
  } catch {
    return null;
  }
}

export interface PluginPackage {
  getEntryPath(relativePath: string): string;
  readText(relativePath: string): Promise<string>;
  readBinary(relativePath: string): Promise<Buffer>;
  exists(relativePath?: string): Promise<boolean>;
  stat(): Promise<{ birthtime: Date; mtime: Date }>;
}

export interface PluginPackageDeployment {
  package: PluginPackage;
  published?: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface PluginPackageStore {
  put(slug: string, zipHash: string, sourceDirectory: string): Promise<PluginPackageDeployment>;
  get(slug: string, zipHash: string): Promise<PluginPackage | null>;
  list(): Promise<string[]>;
  findSlugByFilePath(filePath: string): Promise<string | null>;
  ensureRoot(): Promise<void>;
  createTemporaryDirectory(prefix: string): Promise<string>;
  createTemporaryFile(prefix: string, fileName: string): Promise<{ directory: string; filePath: string }>;
}

class LocalPluginPackage implements PluginPackage {
  constructor(private readonly directory: string) {}

  getEntryPath(relativePath: string): string {
    return path.join(this.directory, relativePath);
  }

  async readText(relativePath: string): Promise<string> {
    return fs.readFile(this.getEntryPath(relativePath), 'utf-8');
  }

  async readBinary(relativePath: string): Promise<Buffer> {
    if (!isPluginAssetPath(relativePath)) throw new Error('Invalid package asset path');
    let current = this.directory;
    const segments = relativePath.split('/');
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const info = await fs.lstat(current);
      if (info.isSymbolicLink() || (index === segments.length - 1 ? !info.isFile() : !info.isDirectory()))
        throw new Error('Invalid package asset file');
    }
    return fs.readFile(current);
  }

  async exists(relativePath?: string): Promise<boolean> {
    try {
      await fs.access(relativePath ? this.getEntryPath(relativePath) : this.directory);
      return true;
    } catch {
      return false;
    }
  }

  async stat(): Promise<{ birthtime: Date; mtime: Date }> {
    return fs.stat(this.directory);
  }
}

class LocalPluginPackageStore implements PluginPackageStore {
  private readonly root: string;

  constructor(private readonly kind: 'plugins' | 'themes' = 'plugins') {
    const configuredRoot = process.env.EXTENSIONS_PATH || 'extensions';
    const extensionsRoot = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.join(process.cwd(), configuredRoot);
    this.root = path.join(extensionsRoot, kind);
  }

  async put(slug: string, zipHash: string, sourceDirectory: string): Promise<PluginPackageDeployment> {
    this.assertHash(zipHash);
    const targetDirectory = path.join(this.root, slug, zipHash);
    const temporaryRoot = path.join(this.root, '.tmp');
    const marker = this.marker(slug, zipHash);
    await fs.mkdir(path.dirname(targetDirectory), { recursive: true });
    await fs.mkdir(temporaryRoot, { recursive: true });
    // Every staging directory belongs to one publish. An overlapping publish of
    // the same package stages into its own directory, and a publish never
    // removes a staging directory another publish is using.
    const staged: StagedDirectory[] = [];
    let staging: StagedDirectory | null = null;
    let published = false;
    try {
      for (let attempt = 1; attempt <= PUBLISH_ATTEMPTS; attempt += 1) {
        if (!staging) {
          staging = await this.stage(sourceDirectory, temporaryRoot, slug, marker);
          staged.push(staging);
          if (attempt === 1) {
            if (this.kind === 'themes') await themeTestBarrier('publish', slug, zipHash);
            if (this.kind === 'plugins' && process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_PUBLISH_BARRIER === '1' && process.send) {
              process.send({ kind: 'plugin-publish-ready', slug, zipHash });
              await new Promise<void>((resolve) => {
                const release = (message: unknown) => {
                  if ((message as { kind?: string })?.kind !== 'plugin-publish-release') return;
                  process.off('message', release);
                  resolve();
                };
                process.on('message', release);
              });
            }
          }
        }
        // The published copy is immutable: a publish of a package that is
        // already published is a no-op instead of a failed rename.
        if (await this.isComplete(targetDirectory, marker)) break;
        try {
          await renameWithRetry(staging.directory, targetDirectory);
          published = true;
          break;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code ?? '';
          // Another publish of the same package won the race.
          if (await this.isComplete(targetDirectory, marker)) break;
          if (code === 'ENOENT' && attempt < PUBLISH_ATTEMPTS) {
            // The published parent or the staged package was removed under this
            // publish. Recreate the parent and retry; a staged package that is
            // gone is staged again from the source, and the staging directory
            // of another publish is never touched.
            await fs.mkdir(path.dirname(targetDirectory), { recursive: true });
            if (!await pathExists(staging.directory)) staging = null;
            continue;
          }
          if (await pathExists(targetDirectory)) {
            // Only incomplete caches are quarantined; valid old hash directories stay untouched.
            await renameWithRetry(targetDirectory, path.join(temporaryRoot, `incomplete-${randomUUID()}`));
            if (attempt < PUBLISH_ATTEMPTS) continue;
          }
          throw error;
        }
      }
    } finally {
      for (const entry of staged) await this.removeStagedDirectory(entry);
    }

    return {
      package: new LocalPluginPackage(targetDirectory),
      published,
      commit: async () => {},
      rollback: async () => {},
    };
  }

  private async stage(sourceDirectory: string, temporaryRoot: string, slug: string, marker: string): Promise<StagedDirectory> {
    const directory = await fs.mkdtemp(path.join(temporaryRoot, `publish-${slug}-`));
    await fs.cp(sourceDirectory, directory, { recursive: true });
    await fs.writeFile(path.join(directory, '.complete.json'), marker, 'utf8');
    return { directory, identity: await stagedIdentity(directory) };
  }

  private async removeStagedDirectory(staging: StagedDirectory): Promise<void> {
    if (staging.identity) {
      const current = await stagedIdentity(staging.directory);
      // The directory is gone, or another publish took the path over: either
      // way it is not the directory this publish staged.
      if (!current || current.dev !== staging.identity.dev || current.ino !== staging.identity.ino) return;
    }
    await fs.rm(staging.directory, { recursive: true, force: true });
  }

  /**
   * The published package of a slug and hash, or null when there is none the
   * runtime could load. A package counts as published only when its completion
   * marker is there, so this is the one question every publisher asks: a
   * directory left behind by an interrupted publish is not a package.
   */
  async get(slug: string, zipHash: string): Promise<PluginPackage | null> {
    this.assertHash(zipHash);
    const directory = path.join(this.root, slug, zipHash);
    return await this.isComplete(directory, this.marker(slug, zipHash))
      ? new LocalPluginPackage(directory) : null;
  }

  async list(): Promise<string[]> {
    await fs.mkdir(this.root, { recursive: true });
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name);
  }

  async findSlugByFilePath(filePath: string): Promise<string | null> {
    const resolvedPath = path.resolve(filePath);
    const rootPath = path.resolve(this.root);
    const relativePath = path.relative(rootPath, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
    const [slug, hash] = relativePath.split(path.sep);
    if (!slug || !hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
    return (await this.get(slug, hash)) ? slug : null;
  }

  async ensureRoot(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
  }

  async createTemporaryDirectory(prefix: string): Promise<string> {
    const temporaryRoot = path.join(this.root, '.tmp');
    await fs.mkdir(temporaryRoot, { recursive: true });
    return fs.mkdtemp(path.join(temporaryRoot, `${prefix}-`));
  }

  async createTemporaryFile(prefix: string, fileName: string): Promise<{ directory: string; filePath: string }> {
    const directory = await this.createTemporaryDirectory(prefix);
    return { directory, filePath: path.join(directory, fileName) };
  }

  private assertHash(hash: string): void {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid plugin package hash');
  }

  private marker(slug: string, hash: string): string {
    return JSON.stringify(this.kind === 'themes' ? { slug, packageHash: hash } : { slug, zipHash: hash });
  }

  private async isComplete(directory: string, marker: string): Promise<boolean> {
    try {
      return await fs.readFile(path.join(directory, '.complete.json'), 'utf8') === marker;
    } catch {
      return false;
    }
  }
}

export const pluginPackageStore: PluginPackageStore = new LocalPluginPackageStore();

export const themePackageStore: PluginPackageStore = new LocalPluginPackageStore('themes');
