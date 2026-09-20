import { promises as fs } from 'fs';
import path from 'path';

export interface PluginPackage {
  getEntryPath(relativePath: string): string;
  readText(relativePath: string): Promise<string>;
  writeText(relativePath: string, content: string): Promise<void>;
  exists(relativePath?: string): Promise<boolean>;
  stat(): Promise<{ birthtime: Date; mtime: Date }>;
}

export interface PluginPackageDeployment {
  package: PluginPackage;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface PluginPackageStore {
  put(slug: string, sourceDirectory: string): Promise<PluginPackageDeployment>;
  get(slug: string): Promise<PluginPackage | null>;
  list(): Promise<string[]>;
  delete(slug: string): Promise<void>;
}

class LocalPluginPackage implements PluginPackage {
  constructor(private readonly directory: string) {}

  getEntryPath(relativePath: string): string {
    return path.join(this.directory, relativePath);
  }

  async readText(relativePath: string): Promise<string> {
    return fs.readFile(this.getEntryPath(relativePath), 'utf-8');
  }

  async writeText(relativePath: string, content: string): Promise<void> {
    await fs.writeFile(this.getEntryPath(relativePath), content, 'utf-8');
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

  constructor() {
    const configuredRoot = process.env.EXTENSIONS_PATH || 'extensions';
    const extensionsRoot = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.join(process.cwd(), configuredRoot);
    this.root = path.join(extensionsRoot, 'plugins');
  }

  async put(slug: string, sourceDirectory: string): Promise<PluginPackageDeployment> {
    const targetDirectory = path.join(this.root, slug);
    const backupDirectory = `${targetDirectory}.__backup_${Date.now()}`;
    const targetExists = await this.pathExists(targetDirectory);

    await fs.mkdir(this.root, { recursive: true });
    if (targetExists) {
      await fs.rename(targetDirectory, backupDirectory);
    }
    await fs.rename(sourceDirectory, targetDirectory);

    return {
      package: new LocalPluginPackage(targetDirectory),
      commit: async () => {
        if (targetExists) await fs.rm(backupDirectory, { recursive: true, force: true });
      },
      rollback: async () => {
        await fs.rm(targetDirectory, { recursive: true, force: true });
        if (targetExists) await fs.rename(backupDirectory, targetDirectory);
      },
    };
  }

  async get(slug: string): Promise<PluginPackage | null> {
    const plugin = new LocalPluginPackage(path.join(this.root, slug));
    return (await plugin.exists()) ? plugin : null;
  }

  async list(): Promise<string[]> {
    await fs.mkdir(this.root, { recursive: true });
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name);
  }

  async delete(slug: string): Promise<void> {
    await fs.rm(path.join(this.root, slug), { recursive: true, force: true });
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }
}

export const pluginPackageStore: PluginPackageStore = new LocalPluginPackageStore();
