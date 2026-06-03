#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REQUIRED_SERVICES = ['api', 'admin', 'shop', 'updater'];
const REQUIRED_RELEASE_ASSETS = [
  'core-update-manifest.json',
  'jiffoo-source.tar.gz',
  'jiffoo-source.tar.gz.sha256',
];
const DELIVERY_MODES = new Set(['image-first', 'source-archive']);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function fail(message) {
  throw new Error(message);
}

function resolvePath(rootDir, value, fallback) {
  const target = value || fallback;
  return path.isAbsolute(target) ? target : path.join(rootDir, target);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Failed to read JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size <= 0) {
    fail(`Required file is empty or not a regular file: ${filePath}`);
  }
}

function normalizeCoreVersion(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const normalized = value.trim().replace(/^v/, '').replace(/-opensource$/, '');
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized) ? normalized : null;
}

function normalizeReleaseTag(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value.trim().startsWith('v') ? value.trim() : `v${value.trim()}-opensource`;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout || '';
}

function assertSameManifest(left, right, label) {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  if (leftJson !== rightJson) {
    fail(`Manifest drift detected between core-update-manifest.json and ${label}.`);
  }
}

function assertSameFileBytes(leftPath, rightPath, label) {
  assertFile(leftPath);
  assertFile(rightPath);

  const leftHash = sha256File(leftPath);
  const rightHash = sha256File(rightPath);
  if (leftHash !== rightHash) {
    fail(`${label} content mismatch: expected sha256 ${leftHash}, found ${rightHash}.`);
  }
}

function assertSameChecksumFile(localChecksumPath, remoteChecksumPath, expectedChecksum, label) {
  assertSameFileBytes(localChecksumPath, remoteChecksumPath, label);

  const checksumText = fs.readFileSync(remoteChecksumPath, 'utf8').trim();
  const [actualChecksum, checksumFileName] = checksumText.split(/\s+/);
  if (actualChecksum !== expectedChecksum) {
    fail(`${label} checksum mismatch: expected ${expectedChecksum}, found ${actualChecksum}`);
  }
  if (checksumFileName !== 'jiffoo-source.tar.gz') {
    fail(`${label} should reference jiffoo-source.tar.gz, found ${checksumFileName || '<empty>'}`);
  }
}

function assertRuntimeImagesAvailable(manifest) {
  if (!manifest.images || typeof manifest.images !== 'object') {
    fail('Cannot verify runtime images because manifest has no image metadata.');
  }

  for (const service of REQUIRED_SERVICES) {
    const image = manifest.images[service];
    if (typeof image !== 'string' || image.trim().length === 0) {
      fail(`Cannot verify missing ${service} runtime image metadata.`);
    }

    const result = runCapture('docker', ['buildx', 'imagetools', 'inspect', image]);
    if (!result.ok) {
      fail(`Runtime image is not available for ${service}: ${image}\n${result.stderr || result.stdout}`);
    }
  }
}

function validateManifest(manifest, options) {
  const coreVersion = options.coreVersion || normalizeCoreVersion(manifest.latestVersion);
  if (!coreVersion) {
    fail(`Manifest latestVersion is invalid: ${manifest.latestVersion}`);
  }

  const expectedReleaseTag = options.releaseTag || normalizeReleaseTag(manifest.releaseTag);
  if (expectedReleaseTag && manifest.releaseTag !== expectedReleaseTag) {
    fail(`Manifest releaseTag mismatch: expected ${expectedReleaseTag}, found ${manifest.releaseTag}`);
  }

  if (manifest.latestVersion !== coreVersion) {
    fail(`Manifest latestVersion mismatch: expected ${coreVersion}, found ${manifest.latestVersion}`);
  }

  if (manifest.deliveryMode === 'image') {
    fail('Legacy image deliveryMode is no longer publishable; republish the feed as image-first with api/admin/shop/updater image metadata.');
  }

  if (!DELIVERY_MODES.has(manifest.deliveryMode)) {
    fail(`Invalid manifest deliveryMode: ${manifest.deliveryMode}`);
  }

  if (manifest.deliveryMode === 'source-archive' && !options.allowSourceArchiveRelease) {
    fail('source-archive public feed requires --allow-source-archive-release.');
  }

  if (manifest.deliveryMode === 'image-first') {
    if (!manifest.images || typeof manifest.images !== 'object') {
      fail('image-first manifest must include runtime image metadata.');
    }

    for (const service of REQUIRED_SERVICES) {
      const image = manifest.images[service];
      if (typeof image !== 'string' || image.trim().length === 0) {
        fail(`image-first manifest is missing ${service} image metadata.`);
      }

      if (!image.includes(`:${coreVersion}`)) {
        fail(`Runtime image for ${service} must use tag ${coreVersion}: ${image}`);
      }
    }
  }

  return { coreVersion, releaseTag: expectedReleaseTag };
}

function validateLocalOutput(rootDir, args) {
  const outputDir = resolvePath(rootDir, args['output-dir'], '.release/self-hosted');
  const releaseAssetManifestPath = resolvePath(
    rootDir,
    args.manifest,
    path.join(outputDir, 'core-update-manifest.json'),
  );
  const publicManifestPath = path.join(outputDir, 'releases', 'core', 'manifest.json');
  const archivePath = path.join(outputDir, 'jiffoo-source.tar.gz');
  const checksumPath = path.join(outputDir, 'jiffoo-source.tar.gz.sha256');

  for (const filePath of [releaseAssetManifestPath, publicManifestPath, archivePath, checksumPath]) {
    assertFile(filePath);
  }

  const releaseManifest = readJson(releaseAssetManifestPath);
  const publicManifest = readJson(publicManifestPath);
  assertSameManifest(releaseManifest, publicManifest, 'releases/core/manifest.json');

  const expectedChecksum = sha256File(archivePath);
  const checksumText = fs.readFileSync(checksumPath, 'utf8').trim();
  const [actualChecksum, checksumFileName] = checksumText.split(/\s+/);
  if (actualChecksum !== expectedChecksum) {
    fail(`Source archive checksum mismatch: expected ${expectedChecksum}, found ${actualChecksum}`);
  }
  if (checksumFileName !== 'jiffoo-source.tar.gz') {
    fail(`Checksum file should reference jiffoo-source.tar.gz, found ${checksumFileName || '<empty>'}`);
  }

  validateManifest(releaseManifest, {
    coreVersion: args['core-version'] ? normalizeCoreVersion(args['core-version']) : null,
    releaseTag: normalizeReleaseTag(args['release-tag']),
    allowSourceArchiveRelease: args['allow-source-archive-release'] === 'true',
  });

  return { manifest: releaseManifest, outputDir, expectedChecksum };
}

function validateInputManifest(rootDir, args) {
  const manifestPath = resolvePath(rootDir, args.manifest, 'core-update-manifest.json');
  assertFile(manifestPath);
  const manifest = readJson(manifestPath);
  validateManifest(manifest, {
    coreVersion: args['core-version'] ? normalizeCoreVersion(args['core-version']) : null,
    releaseTag: normalizeReleaseTag(args['release-tag']),
    allowSourceArchiveRelease: args['allow-source-archive-release'] === 'true',
  });

  return { manifest, outputDir: null, expectedChecksum: null };
}

async function assertPublicAssetReachable(url, label) {
  const headResponse = await fetch(url, { method: 'HEAD' });
  if (headResponse.ok) {
    return;
  }

  const rangeResponse = await fetch(url, { headers: { range: 'bytes=0-0' } });
  if (!rangeResponse.ok) {
    fail(`${label} ${url} returned HTTP ${headResponse.status} to HEAD and HTTP ${rangeResponse.status} to range GET`);
  }
}

async function sha256PublicAsset(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`${label} ${url} returned HTTP ${response.status}`);
  }
  if (!response.body) {
    fail(`${label} ${url} did not return a readable response body`);
  }

  const hash = crypto.createHash('sha256');
  for await (const chunk of response.body) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function validatePublicAssets(manifest, expectedChecksum) {
  if (typeof manifest.sourceArchiveUrl !== 'string' || manifest.sourceArchiveUrl.trim().length === 0) {
    fail('Public manifest is missing sourceArchiveUrl.');
  }
  if (typeof manifest.checksumUrl !== 'string' || manifest.checksumUrl.trim().length === 0) {
    fail('Public manifest is missing checksumUrl.');
  }

  if (expectedChecksum) {
    const archiveChecksum = await sha256PublicAsset(manifest.sourceArchiveUrl, 'Source archive');
    if (archiveChecksum !== expectedChecksum) {
      fail(`Public source archive checksum mismatch: expected ${expectedChecksum}, found ${archiveChecksum}`);
    }
  } else {
    await assertPublicAssetReachable(manifest.sourceArchiveUrl, 'Source archive');
  }

  const checksumResponse = await fetch(manifest.checksumUrl, { headers: { accept: 'text/plain' } });
  if (!checksumResponse.ok) {
    fail(`Checksum asset ${manifest.checksumUrl} returned HTTP ${checksumResponse.status}`);
  }

  const checksumText = (await checksumResponse.text()).trim();
  const [actualChecksum, checksumFileName] = checksumText.split(/\s+/);
  if (expectedChecksum && actualChecksum !== expectedChecksum) {
    fail(`Public checksum mismatch: expected ${expectedChecksum}, found ${actualChecksum}`);
  }
  if (checksumFileName !== 'jiffoo-source.tar.gz') {
    fail(`Public checksum should reference jiffoo-source.tar.gz, found ${checksumFileName || '<empty>'}`);
  }
}

async function validatePublicFeed(url, localManifest, args, context) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    fail(`Public feed ${url} returned HTTP ${response.status}`);
  }

  const publicManifest = await response.json();
  validateManifest(publicManifest, {
    coreVersion: normalizeCoreVersion(localManifest.latestVersion),
    releaseTag: normalizeReleaseTag(localManifest.releaseTag),
    allowSourceArchiveRelease: args['allow-source-archive-release'] === 'true',
  });
  assertSameManifest(localManifest, publicManifest, url);

  if (args['verify-public-assets'] === 'true') {
    await validatePublicAssets(publicManifest, context.expectedChecksum);
  }
}

function downloadGithubReleaseAssets(tag, repo, downloadDir) {
  fs.mkdirSync(downloadDir, { recursive: true });
  for (const assetName of REQUIRED_RELEASE_ASSETS) {
    run('gh', [
      'release',
      'download',
      tag,
      '--repo',
      repo,
      '--pattern',
      assetName,
      '--dir',
      downloadDir,
      '--clobber',
    ]);
  }
}

function validateGithubReleaseAssetContent(tag, repo, context) {
  if (!context || !context.outputDir || !context.manifest || !context.expectedChecksum) {
    return;
  }

  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-release-assets-'));
  try {
    downloadGithubReleaseAssets(tag, repo, downloadDir);

    const remoteManifestPath = path.join(downloadDir, 'core-update-manifest.json');
    const remoteArchivePath = path.join(downloadDir, 'jiffoo-source.tar.gz');
    const remoteChecksumPath = path.join(downloadDir, 'jiffoo-source.tar.gz.sha256');

    const remoteManifest = readJson(remoteManifestPath);
    assertSameManifest(context.manifest, remoteManifest, `GitHub release ${tag} asset core-update-manifest.json`);
    assertSameFileBytes(
      path.join(context.outputDir, 'jiffoo-source.tar.gz'),
      remoteArchivePath,
      `GitHub release ${tag} asset jiffoo-source.tar.gz`,
    );
    assertSameChecksumFile(
      path.join(context.outputDir, 'jiffoo-source.tar.gz.sha256'),
      remoteChecksumPath,
      context.expectedChecksum,
      `GitHub release ${tag} asset jiffoo-source.tar.gz.sha256`,
    );
  } finally {
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }
}

function validateGithubRelease(tag, repo, options = {}) {
  const result = spawnSync(
    'gh',
    ['release', 'view', tag, '--repo', repo, '--json', 'tagName,isDraft,isPrerelease,assets,url'],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    fail(`gh release view ${tag} failed: ${result.stderr || result.stdout}`);
  }

  const release = JSON.parse(result.stdout);
  if (release.tagName !== tag) {
    fail(`GitHub release tag mismatch: expected ${tag}, found ${release.tagName}`);
  }
  if (release.isDraft && !options.allowDraft) {
    fail(`GitHub release ${tag} is still a draft.`);
  }
  if (release.isPrerelease && options.requireStable) {
    fail(`GitHub release ${tag} is still marked as prerelease.`);
  }

  const assets = release.assets || [];
  const assetNames = new Set(assets.map((asset) => asset.name));
  const missing = REQUIRED_RELEASE_ASSETS.filter((assetName) => !assetNames.has(assetName));
  if (missing.length > 0) {
    fail(`GitHub release ${tag} is missing required assets: ${missing.join(', ')}`);
  }

  for (const assetName of REQUIRED_RELEASE_ASSETS) {
    const asset = assets.find((candidate) => candidate.name === assetName);
    if (asset && typeof asset.size === 'number' && asset.size <= 0) {
      fail(`GitHub release asset ${assetName} is empty.`);
    }
  }

  validateGithubReleaseAssetContent(tag, repo, options.context);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolvePath(process.cwd(), args.root, '.');
  const { manifest, outputDir, expectedChecksum } = args['skip-local'] === 'true'
    ? validateInputManifest(rootDir, args)
    : validateLocalOutput(rootDir, args);

  const releaseTag = normalizeReleaseTag(args['release-tag'] || manifest.releaseTag);
  if (!releaseTag) {
    fail('A release tag is required for release verification.');
  }

  if (args['github-release']) {
    validateGithubRelease(
      normalizeReleaseTag(args['github-release']),
      args.repo || process.env.GITHUB_REPOSITORY || 'thefreelight/Jiffoo',
      {
        allowDraft: args['allow-draft'] === 'true',
        requireStable: args['require-stable-release'] === 'true',
        context: { manifest, outputDir, expectedChecksum },
      },
    );
  }

  if (args['verify-images'] === 'true') {
    assertRuntimeImagesAvailable(manifest);
  }

  if (args['public-url']) {
    await validatePublicFeed(args['public-url'], manifest, args, { expectedChecksum });
  }

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    releaseTag,
    latestVersion: manifest.latestVersion,
    deliveryMode: manifest.deliveryMode,
    verifiedGithubRelease: Boolean(args['github-release']),
    verifiedPublicFeed: Boolean(args['public-url']),
    verifiedRuntimeImages: args['verify-images'] === 'true',
    verifiedPublicAssets: args['verify-public-assets'] === 'true',
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
