import { promises as fs } from 'fs';
import path from 'path';

export interface UploadedFileStore {
  put(key: string, content: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  list(prefix?: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

class LocalUploadedFileStore implements UploadedFileStore {
  private readonly root = path.join(process.cwd(), 'uploads');

  async put(key: string, content: Buffer): Promise<void> {
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolveKey(key));
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(prefix = ''): Promise<string[]> {
    const directory = this.resolveKey(prefix);
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => path.posix.join(prefix, entry.name));
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true });
  }

  private resolveKey(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.resolve(this.root, normalized);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Invalid uploaded file key');
    }
    return resolved;
  }
}

export const uploadedFileStore: UploadedFileStore = new LocalUploadedFileStore();
