#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_TAG = 'v9.8.7-opensource';
const CORE_VERSION = '9.8.7';
const REQUIRED_ASSETS = [
  'core-update-manifest.json',
  'jiffoo-source.tar.gz',
  'jiffoo-source.tar.gz.sha256',
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeLocalManifest(outputDir, manifest) {
  writeJson(path.join(outputDir, 'core-update-manifest.json'), manifest);
  writeJson(path.join(outputDir, 'releases', 'core', 'manifest.json'), manifest);
}

function copyRequiredAssets(outputDir, assetsDir) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  for (const assetName of REQUIRED_ASSETS) {
    fs.copyFileSync(path.join(outputDir, assetName), path.join(assetsDir, assetName));
  }
}

async function startPublicServer(files) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const file = files.get(requestUrl.pathname);

    if (!file) {
      response.writeHead(404);
      response.end('not found');
      return;
    }

    response.setHeader('content-type', file.contentType);
    response.setHeader('content-length', String(file.body.length));

    if (request.method === 'HEAD') {
      response.writeHead(200);
      response.end();
      return;
    }

    response.writeHead(200);
    response.end(file.body);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake public feed server.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function setPublicFile(files, pathname, body, contentType) {
  files.set(pathname, {
    body: Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'),
    contentType,
  });
}

function publishPublicFixture(files, outputDir, manifest, archiveOverride = null) {
  setPublicFile(
    files,
    '/releases/core/manifest.json',
    `${JSON.stringify(manifest, null, 2)}\n`,
    'application/json',
  );
  setPublicFile(
    files,
    '/jiffoo-source.tar.gz',
    archiveOverride || fs.readFileSync(path.join(outputDir, 'jiffoo-source.tar.gz')),
    'application/gzip',
  );
  setPublicFile(
    files,
    '/jiffoo-source.tar.gz.sha256',
    fs.readFileSync(path.join(outputDir, 'jiffoo-source.tar.gz.sha256')),
    'text/plain',
  );
}

function createFixture(rootDir, publicBaseUrl) {
  const outputDir = path.join(rootDir, 'self-hosted');
  const assetsDir = path.join(rootDir, 'github-assets');
  const archive = Buffer.from('local canonical archive bytes\n', 'utf8');
  const checksum = sha256(archive);
  const manifest = {
    latestVersion: CORE_VERSION,
    latestStableVersion: CORE_VERSION,
    latestPrereleaseVersion: null,
    channel: 'stable',
    deliveryMode: 'image-first',
    images: {
      api: `registry.example.test/jiffoo-oss/api:${CORE_VERSION}`,
      admin: `registry.example.test/jiffoo-oss/admin:${CORE_VERSION}`,
      shop: `registry.example.test/jiffoo-oss/shop:${CORE_VERSION}`,
      updater: `registry.example.test/jiffoo-oss/updater:${CORE_VERSION}`,
    },
    releaseDate: '2026-01-01T00:00:00.000Z',
    changelogUrl: `https://github.com/test/repo/releases/tag/${RELEASE_TAG}`,
    sourceArchiveUrl: `${publicBaseUrl}/jiffoo-source.tar.gz`,
    minimumCompatibleVersion: '1.0.0',
    minimumAutoUpgradableVersion: '1.0.0',
    requiresManualIntervention: false,
    releaseNotes: 'Verifier fixture.',
    checksumUrl: `${publicBaseUrl}/jiffoo-source.tar.gz.sha256`,
    signatureUrl: null,
    releaseTag: RELEASE_TAG,
    repository: 'test/repo',
  };

  writeLocalManifest(outputDir, manifest);
  fs.writeFileSync(path.join(outputDir, 'jiffoo-source.tar.gz'), archive);
  fs.writeFileSync(
    path.join(outputDir, 'jiffoo-source.tar.gz.sha256'),
    `${checksum}  jiffoo-source.tar.gz\n`,
    'utf8',
  );
  copyRequiredAssets(outputDir, assetsDir);

  return { assetsDir, manifest, outputDir };
}

function createFakeGh(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const fakeGhPath = path.join(binDir, 'gh');
  fs.writeFileSync(
    fakeGhPath,
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const assetsDir = process.env.JIFFOO_FAKE_GH_ASSETS_DIR;
const requiredAssets = ${JSON.stringify(REQUIRED_ASSETS)};

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!assetsDir) {
  fail('JIFFOO_FAKE_GH_ASSETS_DIR is required.');
}

if (args[0] === 'release' && args[1] === 'view') {
  const tag = args[2];
  const assets = requiredAssets.filter((name) => {
    return fs.existsSync(path.join(assetsDir, name));
  }).map((name) => {
    const filePath = path.join(assetsDir, name);
    return { name, size: fs.statSync(filePath).size };
  });
  console.log(JSON.stringify({
    tagName: tag,
    isDraft: false,
    isPrerelease: process.env.JIFFOO_FAKE_GH_IS_PRERELEASE === 'true',
    assets,
    url: 'https://github.com/test/repo/releases/tag/' + tag,
  }));
  process.exit(0);
}

if (args[0] === 'release' && args[1] === 'download') {
  const pattern = args[args.indexOf('--pattern') + 1];
  const dir = args[args.indexOf('--dir') + 1];
  if (!pattern || !dir) {
    fail('fake gh release download requires --pattern and --dir.');
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(assetsDir, pattern), path.join(dir, pattern));
  process.exit(0);
}

fail('unsupported fake gh command: ' + args.join(' '));
`,
    'utf8',
  );
  fs.chmodSync(fakeGhPath, 0o755);
}

function runVerifier(outputDir, assetsDir, extraEnv = {}, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        path.join(ROOT, 'scripts', 'verify-self-hosted-update-feed.mjs'),
        '--output-dir',
        outputDir,
        '--release-tag',
        RELEASE_TAG,
        '--github-release',
        RELEASE_TAG,
        '--repo',
        'test/repo',
        ...extraArgs,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          ...extraEnv,
          JIFFOO_FAKE_GH_ASSETS_DIR: assetsDir,
        },
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      stderr += error instanceof Error ? error.message : String(error);
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function runManifestVerifier(manifestPath, extraArgs = [], envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        path.join(ROOT, 'scripts', 'verify-self-hosted-update-feed.mjs'),
        '--skip-local',
        '--manifest',
        manifestPath,
        '--release-tag',
        RELEASE_TAG,
        ...extraArgs,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          ...envOverrides,
        },
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      stderr += error instanceof Error ? error.message : String(error);
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function publicFeedArgs(publicBaseUrl) {
  return [
    '--public-url',
    `${publicBaseUrl}/releases/core/manifest.json`,
    '--verify-public-assets',
  ];
}

function assertStatus(result, expectedStatus, label, expectedOutput = null) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label}: expected exit ${expectedStatus}, got ${result.status ?? '<signal>'}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (expectedOutput && !combinedOutput.includes(expectedOutput)) {
    throw new Error(`${label}: missing expected output "${expectedOutput}"\n${combinedOutput}`);
  }
}

async function main() {
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-feed-verifier-'));
  const publicFiles = new Map();
  const publicServer = await startPublicServer(publicFiles);
  try {
    const { assetsDir, manifest, outputDir } = createFixture(scratchRoot, publicServer.baseUrl);
    const binDir = path.join(scratchRoot, 'bin');
    createFakeGh(binDir);
    const env = { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` };

    publishPublicFixture(publicFiles, outputDir, manifest);
    assertStatus(await runVerifier(outputDir, assetsDir, env), 0, 'matching GitHub release assets pass');
    assertStatus(
      await runManifestVerifier(path.join(outputDir, 'core-update-manifest.json')),
      0,
      'matching skip-local manifest passes',
    );
    assertStatus(
      await runManifestVerifier(path.join(outputDir, 'core-update-manifest.json'), ['--verify-images'], { PATH: '' }),
      1,
      'image-aware skip-local manifest explains missing Docker',
      'Docker is required for --verify-images',
    );
    assertStatus(
      await runVerifier(outputDir, assetsDir, env, publicFeedArgs(publicServer.baseUrl)),
      0,
      'matching public feed and public assets pass',
    );

    copyRequiredAssets(outputDir, assetsDir);
    fs.rmSync(path.join(assetsDir, 'jiffoo-source.tar.gz.sha256'), { force: true });
    assertStatus(
      await runVerifier(outputDir, assetsDir, env),
      1,
      'missing GitHub release asset fails',
      'missing required assets: jiffoo-source.tar.gz.sha256',
    );

    const missingImageManifest = {
      ...manifest,
      images: {
        ...manifest.images,
      },
    };
    delete missingImageManifest.images.shop;
    writeLocalManifest(outputDir, missingImageManifest);
    copyRequiredAssets(outputDir, assetsDir);
    assertStatus(
      await runVerifier(outputDir, assetsDir, env),
      1,
      'missing image-first runtime image metadata fails',
      'image-first manifest is missing shop image metadata',
    );
    writeLocalManifest(outputDir, manifest);
    copyRequiredAssets(outputDir, assetsDir);
    publishPublicFixture(publicFiles, outputDir, manifest);

    const partialImageTagManifest = {
      ...manifest,
      images: {
        ...manifest.images,
        api: `registry.example.test/jiffoo-oss/api:${CORE_VERSION}0`,
      },
    };
    const partialImageTagManifestPath = path.join(scratchRoot, 'partial-image-tag-manifest.json');
    writeJson(partialImageTagManifestPath, partialImageTagManifest);
    assertStatus(
      await runManifestVerifier(partialImageTagManifestPath),
      1,
      'partial image-first runtime image tag fails',
      'Runtime image for api must use exact tag',
    );

    const legacyDeliveryModeManifestPath = path.join(scratchRoot, 'legacy-delivery-mode-manifest.json');
    writeJson(legacyDeliveryModeManifestPath, {
      ...manifest,
      deliveryMode: 'image',
      images: null,
    });
    assertStatus(
      await runManifestVerifier(legacyDeliveryModeManifestPath),
      1,
      'skip-local legacy delivery mode manifest fails',
      'Legacy image deliveryMode is no longer publishable',
    );

    assertStatus(
      await runVerifier(outputDir, assetsDir, { ...env, JIFFOO_FAKE_GH_IS_PRERELEASE: 'true' }, [
        '--require-stable-release',
      ]),
      1,
      'stable release requirement rejects prerelease',
      'is still marked as prerelease',
    );
    assertStatus(
      await runVerifier(outputDir, assetsDir, { ...env, JIFFOO_FAKE_GH_IS_PRERELEASE: 'false' }, [
        '--require-stable-release',
      ]),
      0,
      'stable release requirement accepts stable release',
    );

    copyRequiredAssets(outputDir, assetsDir);
    publishPublicFixture(publicFiles, outputDir, manifest);
    writeJson(path.join(assetsDir, 'core-update-manifest.json'), {
      ...manifest,
      releaseNotes: 'Remote asset drift.',
    });
    assertStatus(
      await runVerifier(outputDir, assetsDir, env),
      1,
      'drifted manifest asset fails',
      'Manifest drift detected between core-update-manifest.json and GitHub release',
    );

    copyRequiredAssets(outputDir, assetsDir);
    publishPublicFixture(publicFiles, outputDir, manifest);
    fs.writeFileSync(path.join(assetsDir, 'jiffoo-source.tar.gz'), 'remote archive drift\n', 'utf8');
    assertStatus(
      await runVerifier(outputDir, assetsDir, env),
      1,
      'drifted source archive asset fails',
      'asset jiffoo-source.tar.gz content mismatch',
    );

    copyRequiredAssets(outputDir, assetsDir);
    publishPublicFixture(publicFiles, outputDir, manifest, Buffer.from('stale public archive bytes\n', 'utf8'));
    assertStatus(
      await runVerifier(outputDir, assetsDir, env, publicFeedArgs(publicServer.baseUrl)),
      1,
      'stale public source archive fails',
      'Public source archive checksum mismatch',
    );

    console.log('Self-hosted update feed verifier regression tests passed.');
  } finally {
    await publicServer.close();
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
