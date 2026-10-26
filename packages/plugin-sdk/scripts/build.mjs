import { chmod, copyFile, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sdk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dist = path.join(sdk, 'dist');
const generator = path.join(sdk, 'scripts/generate-types.mjs');

function run(entry, args) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: sdk, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const failure = new Error(`Command failed with exit code ${result.status}: ${entry}`);
    failure.status = result.status ?? 1;
    throw failure;
  }
}

/**
 * Replace a published file with a new one without ever leaving the published
 * path missing or half written: the new content is written beside the
 * published file and then renamed over it.
 */
async function publishFile(source, target, mode) {
  await mkdir(path.dirname(target), { recursive: true });
  const staging = path.join(path.dirname(target), `.publish-${path.basename(target)}-${process.pid}-${Date.now()}`);
  await copyFile(source, staging);
  await chmod(staging, mode);
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(staging, target);
      return;
    } catch (error) {
      const code = error.code;
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(code || '')) {
        await rm(staging, { force: true });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** (attempt - 1)));
    }
  }
}

async function listFiles(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, relative));
    else files.push(relative);
  }
  return files;
}

async function listDirectories(root, prefix = '') {
  const directories = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relative = path.join(prefix, entry.name);
    directories.push(relative);
    directories.push(...await listDirectories(root, relative));
  }
  return directories;
}

/**
 * Build the SDK output beside the published one and publish it file by file.
 *
 * The published `dist` directory is never removed and never rebuilt in place,
 * so a consumer that spawns the SDK command while the build runs always finds
 * a complete `dist/cli.js` and a complete `dist/internal` tree.
 */
async function build() {
  const staging = await mkdtemp(path.join(os.tmpdir(), 'jiffoo-plugin-sdk-build-'));
  try {
    // 1. Compile the module graph beside the published output. The relative
    //    layout of tsc is preserved, including only imported shared modules.
    run(require.resolve('typescript/bin/tsc'), ['-p', path.join(sdk, 'tsconfig.json'), '--outDir', path.join(staging, 'internal')]);

    // 2. The type snapshot is generated from the canonical contracts. The
    //    generator writes the published snapshot, so it only runs when the
    //    published snapshot is not the snapshot of the current sources.
    const publishedSnapshot = path.join(dist, 'template-types', 'index.d.ts');
    const checked = spawnSync(process.execPath, [generator, '--check', publishedSnapshot], { cwd: sdk, encoding: 'utf8', windowsHide: true });
    if (checked.error) throw checked.error;
    if (checked.status !== 0) run(generator, []);
    await mkdir(path.join(staging, 'template-types'), { recursive: true });
    await copyFile(publishedSnapshot, path.join(staging, 'template-types', 'index.d.ts'));
    // Preserve tsc's relative module graph, including only imported shared modules.
    const internalSources = path.join(staging, 'internal', path.basename(sdk), 'src');
    await mkdir(path.join(internalSources, 'template-types'), { recursive: true });
    await copyFile(path.join(staging, 'template-types', 'index.d.ts'), path.join(internalSources, 'template-types', 'index.d.ts'));

    // 3. The published entry point is the same shim as before.
    const cli = path.join(staging, 'cli.js');
    await writeFile(cli, '#!/usr/bin/env node\nrequire("./internal/plugin-sdk/src/cli.js");\n', { mode: 0o755 });

    // 4. Publish every file of the new build over the published one.
    const files = await listFiles(staging);
    await mkdir(dist, { recursive: true });
    const published = new Set();
    for (const relative of files) {
      const target = path.join(dist, relative);
      published.add(relative);
      await publishFile(path.join(staging, relative), target, relative === 'cli.js' ? 0o755 : 0o644);
    }
    // 5. A file that the new build does not produce is not part of the
    //    published artefact any more.
    for (const relative of await listFiles(dist)) {
      if (published.has(relative)) continue;
      await rm(path.join(dist, relative), { force: true });
    }
    // 6. An empty directory that the new build does not produce is not part of
    //    the published artefact any more either.
    const stagedDirectories = new Set(await listDirectories(staging));
    const directories = (await listDirectories(dist)).sort((a, b) => b.length - a.length);
    for (const relative of directories) {
      if (stagedDirectories.has(relative)) continue;
      const entries = await readdir(path.join(dist, relative));
      if (entries.length === 0) await rm(path.join(dist, relative), { recursive: true, force: true });
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

try {
  await build();
} catch (error) {
  console.error(error?.message ?? error);
  process.exit(error?.status ?? 1);
}
