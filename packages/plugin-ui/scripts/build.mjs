import { copyFile, mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The published CSS of the plugin UI package.
 *
 * The package carries no JavaScript: the build copies the two stylesheets from
 * `src` to `dist`. The copy is published file by file and never rebuilds
 * `dist` in place, so a consumer that reads `dist` while the build runs
 * always finds a complete stylesheet.
 */
const SOURCES = ['styles.css', 'tokens.css'];

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(packageRoot, 'src');
const dist = path.join(packageRoot, 'dist');

/**
 * Replace a published file with a new one without ever leaving the published
 * path missing or half written: the new content is written beside the
 * published file and then renamed over it.
 */
async function publishFile(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  const staging = path.join(path.dirname(to), `.publish-${path.basename(to)}-${process.pid}-${Date.now()}`);
  await copyFile(from, staging);
  try {
    await rename(staging, to);
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

async function build() {
  const staging = await mkdtemp(path.join(os.tmpdir(), 'jiffoo-plugin-ui-build-'));
  try {
    for (const name of SOURCES) {
      await copyFile(path.join(source, name), path.join(staging, name));
    }
    await mkdir(dist, { recursive: true });
    const published = new Set();
    for (const name of SOURCES) {
      published.add(name);
      await publishFile(path.join(staging, name), path.join(dist, name));
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
  console.log(`Published ${SOURCES.join(', ')} to ${path.relative(packageRoot, dist)}`);
} catch (error) {
  console.error(error?.message ?? error);
  process.exit(error?.status ?? 1);
}
