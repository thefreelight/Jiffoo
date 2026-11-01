import { copyFile, mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bridge = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dist = path.join(bridge, 'dist');

function run(entry, args) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: bridge, stdio: 'inherit', windowsHide: true });
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
async function publishFile(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  const staging = path.join(path.dirname(target), `.publish-${path.basename(target)}-${process.pid}-${Date.now()}`);
  await copyFile(source, staging);
  try {
    await rename(staging, target);
  } catch (error) {
    await rm(staging, { force: true });
    throw error;
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

/**
 * Build the bridge beside the published output and publish it file by file.
 *
 * The published `dist` directory is never removed and never rebuilt in place,
 * so a consumer that reads it while the build runs always finds a complete
 * `dist/index.js` and a complete `dist/protocol.js`.
 */
async function build() {
  const staging = await mkdtemp(path.join(os.tmpdir(), 'jiffoo-plugin-bridge-build-'));
  try {
    run(require.resolve('typescript/bin/tsc'), ['-p', path.join(bridge, 'tsconfig.json'), '--outDir', staging]);
    const files = await listFiles(staging);
    await mkdir(dist, { recursive: true });
    const published = new Set();
    for (const relative of files) {
      published.add(relative);
      await publishFile(path.join(staging, relative), path.join(dist, relative));
    }
    for (const relative of await listFiles(dist)) {
      if (published.has(relative)) continue;
      await rm(path.join(dist, relative), { force: true });
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
