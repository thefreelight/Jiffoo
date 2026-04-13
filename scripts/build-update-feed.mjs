#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_SOURCE_ARCHIVE_NAME = 'jiffoo-source.tar.gz';
const DEFAULT_RELEASES_DIR = 'releases/core';
const DEFAULT_SOURCE_ARCHIVE_URL = 'https://get.jiffoo.com/jiffoo-source.tar.gz';
const DEFAULT_CHANGELOG_URL = 'https://github.com/thefreelight/Jiffoo/releases';
const DEFAULT_MINIMUM_COMPATIBLE_VERSION = '1.0.0';
const DEFAULT_MINIMUM_AUTO_UPGRADABLE_VERSION = '1.0.0';

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

function resolvePath(rootDir, value, fallback) {
  const target = value || fallback;
  if (!target) {
    throw new Error('Missing required path argument');
  }
  return path.isAbsolute(target) ? target : path.join(rootDir, target);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function normalizeReleaseTag(tagOrVersion) {
  if (!tagOrVersion || typeof tagOrVersion !== 'string') {
    throw new Error('release tag or version is required');
  }

  return tagOrVersion.startsWith('v') ? tagOrVersion : `v${tagOrVersion}`;
}

function normalizeCoreVersion(tagOrVersion) {
  const normalized = tagOrVersion.trim().replace(/^v/, '').replace(/-opensource$/, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
    throw new Error(`Cannot derive core version from "${tagOrVersion}"`);
  }
  return normalized;
}

function deriveReleaseChannel(coreVersion, explicitChannel) {
  if (explicitChannel === 'stable' || explicitChannel === 'prerelease') {
    return explicitChannel;
  }
  return coreVersion.includes('-') ? 'prerelease' : 'stable';
}

function sanitizeReleaseNotes(rawNotes) {
  if (!rawNotes) return null;
  const compact = rawNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
  return compact.length > 0 ? compact.slice(0, 600) : null;
}

function normalizeImageRef(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
}

function createArchive(rootDir, archivePath) {
  ensureDirectory(path.dirname(archivePath));
  run('git', ['-C', rootDir, 'archive', '--format=tar.gz', `--output=${archivePath}`, 'HEAD']);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

async function writeManifestFile(manifestPath, manifest) {
  await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
  await fsp.writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function writeChecksumFile(checksumPath, checksum, archiveName) {
  await fsp.writeFile(checksumPath, `${checksum}  ${archiveName}\n`, 'utf8');
}

async function copyRuntimeInstallFiles(rootDir, outputDir) {
  const files = [
    { from: path.join(rootDir, 'install.sh'), to: path.join(outputDir, 'install.sh') },
    { from: path.join(rootDir, 'docker-compose.prod.yml'), to: path.join(outputDir, 'docker-compose.yml') },
    { from: path.join(rootDir, '.env.production.example'), to: path.join(outputDir, '.env.production.example') },
    { from: path.join(rootDir, 'nginx', 'get-jiffoo.conf'), to: path.join(outputDir, 'get-jiffoo.conf') },
  ];

  for (const file of files) {
    await fsp.mkdir(path.dirname(file.to), { recursive: true });
    await fsp.copyFile(file.from, file.to);
  }
}

async function writeMetadataFile(outputDir, metadata) {
  await fsp.writeFile(
    path.join(outputDir, 'update-feed-metadata.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolvePath(process.cwd(), args.root, '.');
  const outputDir = resolvePath(rootDir, args['output-dir'], '.release/self-hosted');
  const packageJsonPath = resolvePath(rootDir, args['package-json'], 'package.json');
  const packageJson = readJson(packageJsonPath);
  const packageVersion = String(packageJson.version || '');
  const releaseTag = normalizeReleaseTag(args['release-tag'] || packageVersion);
  const coreVersion = normalizeCoreVersion(args['core-version'] || releaseTag || packageVersion);
  const releaseChannel = deriveReleaseChannel(coreVersion, args.channel);
  const releaseDate = args['release-date'] || new Date().toISOString();
  const repository = args.repository || process.env.GITHUB_REPOSITORY || 'thefreelight/Jiffoo';
  const releaseUrl = args['release-url'] || `${DEFAULT_CHANGELOG_URL}/tag/${releaseTag}`;
  const sourceArchiveName = args['source-archive-name'] || DEFAULT_SOURCE_ARCHIVE_NAME;
  const sourceArchiveUrl = args['source-archive-url'] || DEFAULT_SOURCE_ARCHIVE_URL;
  const checksumUrl = args['checksum-url'] || `${sourceArchiveUrl}.sha256`;
  const imageRefs = {
    api: normalizeImageRef(args['api-image']),
    shop: normalizeImageRef(args['shop-image']),
    admin: normalizeImageRef(args['admin-image']),
    updater: normalizeImageRef(args['updater-image']),
  };
  const hasImageBundle = Boolean(imageRefs.api && imageRefs.shop && imageRefs.admin);
  const deliveryMode = args['delivery-mode'] || (hasImageBundle ? 'image' : 'source');
  const manifestPath = path.join(outputDir, DEFAULT_RELEASES_DIR, 'manifest.json');
  const releaseAssetManifestPath = path.join(outputDir, 'core-update-manifest.json');
  const archivePath = path.join(outputDir, sourceArchiveName);
  const checksumPath = path.join(outputDir, `${sourceArchiveName}.sha256`);
  const releaseNotesPath = args['release-notes-file']
    ? resolvePath(rootDir, args['release-notes-file'])
    : null;
  const releaseNotes = sanitizeReleaseNotes(
    args['release-notes'] || (releaseNotesPath && fs.existsSync(releaseNotesPath)
      ? fs.readFileSync(releaseNotesPath, 'utf8')
      : ''),
  );

  ensureDirectory(outputDir);
  createArchive(rootDir, archivePath);
  const checksum = sha256File(archivePath);

  const manifest = {
    latestVersion: coreVersion,
    latestStableVersion: releaseChannel === 'stable' ? coreVersion : DEFAULT_MINIMUM_AUTO_UPGRADABLE_VERSION,
    latestPrereleaseVersion: releaseChannel === 'prerelease' ? coreVersion : null,
    channel: releaseChannel,
    deliveryMode,
    images: hasImageBundle
      ? {
          api: imageRefs.api,
          shop: imageRefs.shop,
          admin: imageRefs.admin,
          updater: imageRefs.updater,
        }
      : null,
    releaseDate,
    changelogUrl: releaseUrl,
    sourceArchiveUrl,
    minimumCompatibleVersion: args['minimum-compatible-version'] || DEFAULT_MINIMUM_COMPATIBLE_VERSION,
    minimumAutoUpgradableVersion:
      args['minimum-auto-upgradable-version'] || DEFAULT_MINIMUM_AUTO_UPGRADABLE_VERSION,
    requiresManualIntervention: args['requires-manual-intervention'] === 'true',
    releaseNotes,
    checksumUrl,
    signatureUrl: args['signature-url'] || null,
    releaseTag,
    repository,
  };

  await writeManifestFile(manifestPath, manifest);
  await writeManifestFile(releaseAssetManifestPath, manifest);
  await writeChecksumFile(checksumPath, checksum, sourceArchiveName);
  await copyRuntimeInstallFiles(rootDir, outputDir);
  await writeMetadataFile(outputDir, {
    releaseTag,
    coreVersion,
    deliveryMode,
    imageRefs: hasImageBundle ? imageRefs : null,
    releaseChannel,
    releaseDate,
    releaseUrl,
    sourceArchiveName,
    sourceArchiveUrl,
    checksum,
    checksumUrl,
    manifestPath: path.relative(rootDir, manifestPath),
    releaseAssetManifestPath: path.relative(rootDir, releaseAssetManifestPath),
  });

  console.log(JSON.stringify({
    outputDir,
    releaseTag,
    coreVersion,
    deliveryMode,
    manifestPath,
    releaseAssetManifestPath,
    archivePath,
    checksumPath,
    sourceArchiveUrl,
    checksumUrl,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
