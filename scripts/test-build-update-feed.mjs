#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILDER = path.join(ROOT, 'scripts', 'build-update-feed.mjs');
const RELEASE_TAG = 'v9.8.7-opensource';
const CORE_VERSION = '9.8.7';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}\n${result.stderr || result.stdout || ''}`);
  }

  return result.stdout || '';
}

function writeFile(filePath, content, mode = 0o644) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, mode);
}

function readTarFile(repoDir, archivePath, fileName) {
  return run('tar', ['-xOzf', archivePath, fileName], {
    cwd: repoDir,
    capture: true,
  });
}

function createFixtureRepo(repoDir) {
  run('git', ['init', '-q'], { cwd: repoDir });
  run('git', ['config', 'user.email', 'release-test@example.test'], { cwd: repoDir });
  run('git', ['config', 'user.name', 'Release Test'], { cwd: repoDir });

  writeFile(path.join(repoDir, 'package.json'), JSON.stringify({
    name: 'jiffoo-feed-builder-fixture',
    version: `${CORE_VERSION}-opensource`,
  }, null, 2));
  writeFile(path.join(repoDir, 'install.sh'), '#!/bin/sh\necho install from release tag\n', 0o755);
  writeFile(path.join(repoDir, 'docker-compose.prod.yml'), 'services:\n  api:\n    image: release-tag\n');
  writeFile(path.join(repoDir, '.env.production.example'), 'NODE_ENV=production\nAPP_SOURCE=release-tag\n');
  writeFile(path.join(repoDir, 'nginx', 'get-jiffoo.conf'), 'server { # release tag }\n');
  writeFile(path.join(repoDir, 'release-source.txt'), 'archive source from release tag\n');

  run('git', ['add', '.'], { cwd: repoDir });
  run('git', ['commit', '-qm', 'release fixture'], { cwd: repoDir });
  run('git', ['tag', '-a', RELEASE_TAG, '-m', 'Release fixture'], { cwd: repoDir });

  writeFile(path.join(repoDir, 'release-source.txt'), 'archive source from later HEAD\n');
  writeFile(path.join(repoDir, 'install.sh'), '#!/bin/sh\necho install from later HEAD\n', 0o755);
  writeFile(path.join(repoDir, 'docker-compose.prod.yml'), 'services:\n  api:\n    image: later-head\n');
  writeFile(path.join(repoDir, '.env.production.example'), 'NODE_ENV=production\nAPP_SOURCE=later-head\n');
  writeFile(path.join(repoDir, 'nginx', 'get-jiffoo.conf'), 'server { # later head }\n');
  run('git', ['add', '.'], { cwd: repoDir });
  run('git', ['commit', '-qm', 'later head fixture'], { cwd: repoDir });
}

function main() {
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-feed-builder-'));
  try {
    createFixtureRepo(scratchRoot);
    const outputDir = path.join(scratchRoot, 'self-hosted');
    const releaseNotesPath = path.join(scratchRoot, 'release-notes.md');
    writeFile(releaseNotesPath, 'Pinned archive fixture.\n');

    run(process.execPath, [
      BUILDER,
      '--root',
      scratchRoot,
      '--output-dir',
      outputDir,
      '--release-tag',
      RELEASE_TAG,
      '--archive-ref',
      RELEASE_TAG,
      '--delivery-mode',
      'image-first',
      '--release-date',
      '2026-01-01T00:00:00.000Z',
      '--release-notes-file',
      releaseNotesPath,
      '--repository',
      'test/repo',
      '--source-archive-url',
      'https://example.test/jiffoo-source.tar.gz',
    ]);

    const archivePath = path.join(outputDir, 'jiffoo-source.tar.gz');
    const archivedSource = readTarFile(scratchRoot, archivePath, 'release-source.txt');
    assert.equal(archivedSource, 'archive source from release tag\n');
    assert.equal(fs.readFileSync(path.join(outputDir, 'install.sh'), 'utf8'), '#!/bin/sh\necho install from release tag\n');
    assert.equal(fs.readFileSync(path.join(outputDir, 'docker-compose.yml'), 'utf8'), 'services:\n  api:\n    image: release-tag\n');
    assert.equal(fs.readFileSync(path.join(outputDir, '.env.production.example'), 'utf8'), 'NODE_ENV=production\nAPP_SOURCE=release-tag\n');
    assert.equal(fs.readFileSync(path.join(outputDir, 'get-jiffoo.conf'), 'utf8'), 'server { # release tag }\n');

    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, 'update-feed-metadata.json'), 'utf8'));
    assert.equal(metadata.archiveRef, RELEASE_TAG);

    const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'core-update-manifest.json'), 'utf8'));
    assert.equal(manifest.releaseTag, RELEASE_TAG);
    assert.equal(manifest.deliveryMode, 'image-first');
    assert.equal(manifest.sourceArchiveUrl, 'https://example.test/jiffoo-source.tar.gz');
    assert.equal(manifest.checksumUrl, 'https://example.test/jiffoo-source.tar.gz.sha256');
    assert.equal(manifest.images.api, `crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/api:${CORE_VERSION}`);

    const checksumText = fs.readFileSync(path.join(outputDir, 'jiffoo-source.tar.gz.sha256'), 'utf8');
    assert.match(checksumText, /^[a-f0-9]{64}\s+jiffoo-source\.tar\.gz\n$/);
    const [checksum] = checksumText.trim().split(/\s+/);

    const defaultOutputDir = path.join(scratchRoot, 'self-hosted-default-url');
    run(process.execPath, [
      BUILDER,
      '--root',
      scratchRoot,
      '--output-dir',
      defaultOutputDir,
      '--release-tag',
      RELEASE_TAG,
      '--archive-ref',
      RELEASE_TAG,
      '--delivery-mode',
      'image-first',
      '--release-date',
      '2026-01-01T00:00:00.000Z',
      '--release-notes-file',
      releaseNotesPath,
      '--repository',
      'test/repo',
    ]);

    const defaultManifest = JSON.parse(fs.readFileSync(path.join(defaultOutputDir, 'core-update-manifest.json'), 'utf8'));
    const defaultChecksumText = fs.readFileSync(path.join(defaultOutputDir, 'jiffoo-source.tar.gz.sha256'), 'utf8');
    const [defaultChecksum] = defaultChecksumText.trim().split(/\s+/);
    assert.equal(defaultChecksum, checksum);
    assert.equal(defaultManifest.sourceArchiveUrl, `https://get.jiffoo.com/jiffoo-source.tar.gz?sha256=${defaultChecksum}`);
    assert.equal(defaultManifest.checksumUrl, `https://get.jiffoo.com/jiffoo-source.tar.gz.sha256?sha256=${defaultChecksum}`);

    console.log('Update feed builder regression tests passed.');
  } finally {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  }
}

main();
