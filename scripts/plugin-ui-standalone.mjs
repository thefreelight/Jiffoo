import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = path.join(root, 'packages/plugin-ui');
const require = createRequire(import.meta.url);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(directory, relative));
    else files.push(relative);
  }
  return files;
}

export async function verifyStandaloneUi() {
  // Only package-manager subprocesses and a private temporary tree; no services or database.
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'jiffoo-ui-install with spaces-'));
  const relative = path.relative(root, temporary);
  assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Temporary directory must be outside the repository');
  const env = { ...process.env };
  delete env.NODE_PATH;
  const run = (entry, args = [], cwd = temporary) => {
    const result = spawnSync(process.execPath, [entry, ...args], { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, `${entry}: ${result.stdout}\n${result.stderr}`);
    return result.stdout;
  };
  try {
    let npm;
    try { npm = path.join(path.dirname(require.resolve('npm/package.json')), 'bin/npm-cli.js'); }
    catch {
      const nodeDirectory = path.dirname(await realpath(process.execPath));
      npm = process.platform === 'win32'
        ? path.join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js')
        : path.join(nodeDirectory, 'npm');
    }
    // 1. The tree builds the package and publishes the two stylesheets.
    run(path.join(ui, 'scripts/build.mjs'), [], root);
    const published = path.join(ui, 'dist');
    const treeFiles = (await listFiles(published)).sort();
    assert.deepEqual(treeFiles, ['styles.css', 'tokens.css']);
    const treeBytes = new Map(await Promise.all(treeFiles.map(async name => [name, await readFile(path.join(published, name))])));

    // 2. The package is packed from that tree and installs outside the monorepo.
    const packed = JSON.parse(run(npm, ['pack', ui, '--json', '--pack-destination', temporary]));
    assert.equal(packed.length, 1);
    assert.equal(packed[0].name, '@jiffoo/plugin-ui');
    const manifest = JSON.parse(await readFile(path.join(ui, 'package.json'), 'utf8'));
    assert.equal(packed[0].version, manifest.version);
    assert.match(packed[0].version, /^1\.0\.0-alpha\.\d+$/);
    assert(packed[0].files.every(file => /^(package\.json|dist\/|README\.md$|LICENSE$)/.test(file.path)));
    const tarball = path.join(temporary, packed[0].filename);
    await writeFile(path.join(temporary, 'package.json'), '{"private":true}\n');
    run(npm, ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball]);
    const installed = path.join(temporary, 'node_modules/@jiffoo/plugin-ui');

    // 3. The installed bytes are the tree's bytes: the artifact is traceable to a named commit.
    for (const [name, bytes] of treeBytes) {
      const installedBytes = await readFile(path.join(installed, 'dist', name));
      assert.equal(sha256(installedBytes), sha256(bytes), `dist/${name} differs from the tree's build`);
    }
    const installedManifest = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
    assert(!JSON.stringify(installedManifest).includes('workspace:'));
    assert.equal(Object.keys(installedManifest.dependencies ?? {}).length, 0);
    assert.equal(Object.keys(installedManifest.devDependencies ?? {}).length, 0);

    // 4. The installed package is the stylesheet a plugin page links to.
    const tokens = await readFile(path.join(installed, 'dist/tokens.css'), 'utf8');
    const styles = await readFile(path.join(installed, 'dist/styles.css'), 'utf8');
    assert(tokens.includes('--jpu-bg'));
    assert(tokens.includes('var(--core-ground)'));
    assert(styles.includes('.jpu-btn'));
    assert(styles.includes('var(--jpu-'));

    // 5. The tarball hash is the token a consumer records beside the file.
    console.log(`Standalone plugin UI: npm pack/install, dist bytes equal the tree build, tarball ${sha256(await readFile(tarball))}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyStandaloneUi();
