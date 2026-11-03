import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The local packaging entry point of the plugin packages.
 *
 * The repository has no release-asset mechanism: the SDK and the bridge
 * tarballs were packed by hand. This script is the local way to produce the
 * three plugin tarballs of a Core tree and to record the provenance of each
 * of them beside the file.
 *
 * It never publishes to a registry and never touches the CI configuration.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** The packages, in the order they are built and packed. */
const PACKAGES = [
  { name: '@jiffoo-core/plugin-sdk', directory: path.join(root, 'packages/plugin-sdk') },
  { name: '@jiffoo/plugin-bridge', directory: path.join(root, 'packages/plugin-bridge') },
  { name: '@jiffoo/plugin-ui', directory: path.join(root, 'packages/plugin-ui') },
];

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function run(entry, args, cwd) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 600_000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${entry} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

/** The path of the npm CLI, on every platform. */
async function npmCli() {
  try { return path.join(path.dirname(require.resolve('npm/package.json')), 'bin/npm-cli.js'); }
  catch {
    const nodeDirectory = path.dirname(await realpath(process.execPath));
    return process.platform === 'win32'
      ? path.join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js')
      : path.join(nodeDirectory, 'npm');
  }
}

/** The commit the tree carries. A read-only lookup; the script writes no git state. */
function headCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) return 'unknown';
  return result.stdout.trim() || 'unknown';
}

/**
 * Whether the tree that was packed is the commit or the working tree.
 *
 * The artifacts are the build of the files on disk. When the tree carries
 * uncommitted work, the provenance has to say so, because the commit alone
 * does not name the bytes.
 */
function workingTreeState() {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) return 'unknown';
  return result.stdout.trim() ? 'modified; the artifacts are the build of the working tree, not of the commit' : 'clean';
}

export async function packPluginPackages(outputDirectory = path.join(root, 'artifacts/plugin-packages')) {
  const npm = await npmCli();
  await mkdir(outputDirectory, { recursive: true });
  const tarballs = [];
  for (const entry of PACKAGES) {
    const build = path.join(entry.directory, 'scripts/build.mjs');
    console.log(`Building ${entry.name}`);
    run(build, [], entry.directory);
    console.log(`Packing ${entry.name}`);
    // `--ignore-scripts` keeps the pack free of the install scripts of the package.
    const packed = JSON.parse(run(npm, ['pack', entry.directory, '--ignore-scripts', '--json', '--pack-destination', outputDirectory], root));
    if (packed.length !== 1) throw new Error(`Expected one tarball for ${entry.name}, got ${packed.length}.`);
    const file = packed[0];
    const bytes = await readFile(path.join(outputDirectory, file.filename));
    const digest = sha256(bytes);
    console.log(`${file.filename}  sha256 ${digest}`);
    tarballs.push({ name: entry.name, version: file.version, filename: file.filename, sha256: digest });
  }
  const provenance = [
    'Jiffoo plugin packages - local build artifacts',
    '',
    'This directory holds local build artifacts. It is not an npm publication.',
    '',
    `Core commit: ${headCommit()}`,
    `Working tree: ${workingTreeState()}`,
    `Built with: node ${process.version}`,
    'Build commands:',
    ...PACKAGES.map(entry => `  node ${path.relative(root, path.join(entry.directory, 'scripts/build.mjs'))}`),
    'Pack command:',
    '  npm pack <package> --ignore-scripts --json --pack-destination artifacts/plugin-packages',
    '',
    'Artifacts:',
    ...tarballs.map(item => `  ${item.filename}  sha256 ${item.sha256}  (${item.name} ${item.version})`),
    '',
  ].join('\n');
  await writeFile(path.join(outputDirectory, 'provenance.txt'), provenance, 'utf8');
  console.log(`Wrote ${path.relative(root, path.join(outputDirectory, 'provenance.txt'))}`);
  return tarballs;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  try {
    await packPluginPackages(output);
  } catch (error) {
    console.error(error?.message ?? error);
    process.exit(error?.status ?? 1);
  }
}
