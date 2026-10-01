import { promises as fs } from 'fs';
import path from 'path';

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

export interface PluginPackage {
  getEntryPath(relativePath: string): string;
  readText(relativePath: string): Promise<string>;
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

  constructor(kind: 'plugins' | 'themes' = 'plugins') {
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
    await fs.mkdir(path.dirname(targetDirectory), { recursive: true });
    await fs.mkdir(temporaryRoot, { recursive: true });
    const temporaryDirectory = await fs.mkdtemp(path.join(temporaryRoot, `publish-${slug}-`));
    const marker = JSON.stringify({ slug, zipHash });
    let published = false;
    try {
      await fs.cp(sourceDirectory, temporaryDirectory, { recursive: true });
      await fs.writeFile(path.join(temporaryDirectory, '.complete.json'), marker, 'utf8');
      if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_PUBLISH_BARRIER === '1' && process.send) {
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
      try {
        await renameWithRetry(temporaryDirectory, targetDirectory);
        published = true;
      } catch (error) {
        if (!await this.isComplete(targetDirectory, marker)) throw error;
      }
    } catch (error) {
      throw error;
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }

    return {
      package: new LocalPluginPackage(targetDirectory),
      published,
      commit: async () => {},
      rollback: async () => {},
    };
  }

  async get(slug: string, zipHash: string): Promise<PluginPackage | null> {
    this.assertHash(zipHash);
    const directory = path.join(this.root, slug, zipHash);
    return await this.isComplete(directory, JSON.stringify({ slug, zipHash }))
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

  private async isComplete(directory: string, marker: string): Promise<boolean> {
    try {
      return await fs.readFile(path.join(directory, '.complete.json'), 'utf8') === marker;
    } catch {
      return false;
    }
  }
}

export const pluginPackageStore: PluginPackageStore = new LocalPluginPackageStore();

class LocalThemePackageStore {
  private readonly root: string;

  constructor() {
    const configuredRoot = process.env.EXTENSIONS_PATH || 'extensions';
    const extensionsRoot = path.isAbsolute(configuredRoot)
      ? configuredRoot : path.join(process.cwd(), configuredRoot);
    this.root = path.join(extensionsRoot, 'themes');
  }

  async put(slug: string, sourceDirectory: string): Promise<PluginPackageDeployment> {
    const target = path.join(this.root, slug);
    const backup = `${target}.__backup_${Date.now()}`;
    await fs.mkdir(this.root, { recursive: true });
    const existed = await fs.access(target).then(() => true, () => false);
    if (existed) await renameWithRetry(target, backup);
    try {
      await renameWithRetry(sourceDirectory, target);
    } catch (error) {
      if (existed) await renameWithRetry(backup, target);
      throw error;
    }
    return {
      package: new LocalPluginPackage(target),
      commit: async () => { if (existed) await fs.rm(backup, { recursive: true, force: true }); },
      rollback: async () => {
        await fs.rm(target, { recursive: true, force: true });
        if (existed) await renameWithRetry(backup, target);
      },
    };
  }

  async get(slug: string): Promise<PluginPackage | null> {
    const pkg = new LocalPluginPackage(path.join(this.root, slug));
    return await pkg.exists() ? pkg : null;
  }

  async delete(slug: string): Promise<void> {
    await fs.rm(path.join(this.root, slug), { recursive: true, force: true });
  }

  async createTemporaryDirectory(prefix: string): Promise<string> {
    const root = path.join(this.root, '.tmp');
    await fs.mkdir(root, { recursive: true });
    return fs.mkdtemp(path.join(root, `${prefix}-`));
  }
}

export const themePackageStore = new LocalThemePackageStore();
