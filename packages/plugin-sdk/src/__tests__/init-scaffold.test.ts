import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const prompt = vi.hoisted(() => vi.fn());

vi.mock('inquirer', () => ({ default: { prompt } }));
vi.mock('ora', () => ({
  default: () => ({
    start: () => ({ succeed: vi.fn(), fail: vi.fn() }),
  }),
}));

import { initCommand } from '../cli/commands/init';

describe('in-process plugin scaffold', () => {
  let rootDir: string | undefined;

  afterEach(async () => {
    if (rootDir) await fs.rm(rootDir, { recursive: true, force: true });
    rootDir = undefined;
    prompt.mockReset();
  });

  it('creates a TypeScript package whose declared entry is the packed in-process module', async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-sdk-init-'));
    const target = path.join(rootDir, 'plugin');
    prompt.mockResolvedValue({
      name: 'scaffold-plugin',
      displayName: 'Scaffold Plugin',
      description: 'A generated in-process plugin package.',
      author: 'Jiffoo Test',
    });

    await initCommand('scaffold-plugin', { template: 'default', directory: target, typescript: true });

    const manifest = JSON.parse(await fs.readFile(path.join(target, 'manifest.json'), 'utf8'));
    const packageJson = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
    const source = await fs.readFile(path.join(target, 'src', 'index.ts'), 'utf8');

    expect(manifest).toMatchObject({
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      trustLevel: 'unsigned',
      entryModule: 'dist/index.js',
    });
    expect(packageJson.main).toBe(manifest.entryModule);
    expect(source).toContain('fastify: PluginFastify');
    expect(source).toContain('export = plugin;');
    expect(source).toContain("fastify.get('/status'");
    await expect(fs.access(path.join(target, 'README.md'))).resolves.toBeUndefined();
  });
});
