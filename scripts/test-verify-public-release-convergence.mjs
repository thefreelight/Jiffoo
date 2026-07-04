#!/usr/bin/env node

import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-public-release-convergence.mjs');
const RELEASE_TAG = 'v9.8.7-opensource';
const CORE_VERSION = '9.8.7';
const REPO = 'test/repo';
const REQUIRED_ASSETS = [
  'core-update-manifest.json',
  'jiffoo-source.tar.gz',
  'jiffoo-source.tar.gz.sha256',
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createFixture(baseUrl, overrides = {}) {
  const archive = Buffer.from(overrides.archiveBody || 'canonical source archive\n', 'utf8');
  const checksum = sha256(archive);
  const checksumText = `${checksum}  jiffoo-source.tar.gz\n`;
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
    releaseDate: '2026-06-02T00:00:00.000Z',
    changelogUrl: `${baseUrl}/releases/tag/${RELEASE_TAG}`,
    sourceArchiveUrl: `${baseUrl}/jiffoo-source.tar.gz`,
    minimumCompatibleVersion: '1.0.0',
    minimumAutoUpgradableVersion: '1.0.0',
    requiresManualIntervention: false,
    releaseNotes: 'Public convergence fixture.',
    checksumUrl: `${baseUrl}/jiffoo-source.tar.gz.sha256`,
    signatureUrl: null,
    releaseTag: RELEASE_TAG,
    repository: REPO,
  };
  const releaseManifest = typeof overrides.releaseManifest === 'function'
    ? overrides.releaseManifest(baseUrl, manifest)
    : overrides.releaseManifest || manifest;
  const publicManifest = typeof overrides.publicManifest === 'function'
    ? overrides.publicManifest(baseUrl, manifest)
    : overrides.publicManifest || manifest;
  const releaseAssets = overrides.releaseAssets || REQUIRED_ASSETS;

  return {
    archive,
    checksum,
    checksumText,
    manifest,
    publicArchive: Buffer.from(overrides.publicArchiveBody || archive),
    publicChecksumText: overrides.publicChecksumText || checksumText,
    publicManifest,
    releaseManifest,
    releaseAssets,
  };
}

async function startServer(overrides = {}) {
  let baseUrl = '';
  let fixture = null;
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');

    if (!fixture) {
      response.writeHead(503);
      response.end('fixture not ready');
      return;
    }

    if (requestUrl.pathname === `/repos/${REPO}/releases/tags/${RELEASE_TAG}`) {
      if (
        overrides.expectedGithubAuthorization
        && request.headers.authorization !== overrides.expectedGithubAuthorization
      ) {
        response.writeHead(401, { 'content-type': 'application/json' });
        response.end(json({
          message: `missing expected authorization: ${request.headers.authorization || '<missing>'}`,
        }));
        return;
      }

      const assets = fixture.releaseAssets.map((name) => {
        const body = name === 'core-update-manifest.json'
          ? Buffer.from(json(fixture.releaseManifest), 'utf8')
          : name === 'jiffoo-source.tar.gz'
            ? fixture.archive
            : Buffer.from(fixture.checksumText, 'utf8');
        return {
          name,
          size: body.length,
          browser_download_url: `${baseUrl}/github-assets/${name}`,
        };
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json({
        tag_name: RELEASE_TAG,
        name: overrides.releaseName || RELEASE_TAG,
        body: overrides.releaseBody || 'Release fixture.',
        draft: false,
        prerelease: Boolean(overrides.prerelease),
        assets,
      }));
      return;
    }

    if (requestUrl.pathname === '/github-assets/core-update-manifest.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json(fixture.releaseManifest));
      return;
    }

    if (requestUrl.pathname === '/github-assets/jiffoo-source.tar.gz') {
      response.writeHead(200, { 'content-type': 'application/gzip' });
      response.end(fixture.archive);
      return;
    }

    if (requestUrl.pathname === '/github-assets/jiffoo-source.tar.gz.sha256') {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end(fixture.checksumText);
      return;
    }

    if (requestUrl.pathname === '/releases/core/manifest.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json(fixture.publicManifest));
      return;
    }

    if (requestUrl.pathname === '/jiffoo-source.tar.gz') {
      response.writeHead(200, { 'content-type': 'application/gzip' });
      response.end(fixture.publicArchive);
      return;
    }

    if (requestUrl.pathname === '/jiffoo-source.tar.gz.sha256') {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end(fixture.publicChecksumText);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake public convergence server.');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
  fixture = createFixture(baseUrl, overrides);

  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function runVerifier(baseUrl, envOverrides = {}, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT,
      '--repo',
      REPO,
      '--github-api-url',
      baseUrl,
      '--public-url',
      `${baseUrl}/releases/core/manifest.json`,
      '--release-tag',
      RELEASE_TAG,
      ...extraArgs,
    ], {
      cwd: ROOT,
      env: { ...process.env, ...envOverrides },
    });

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

function assertStatus(result, expectedStatus, label, expectedOutput = null) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label}: expected exit ${expectedStatus}, got ${result.status ?? '<signal>'}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  if (expectedOutput && !combined.includes(expectedOutput)) {
    throw new Error(`${label}: missing expected output "${expectedOutput}"\n${combined}`);
  }
}

async function withServer(overrides, fn) {
  const server = await startServer(overrides);
  try {
    return await fn(server.baseUrl);
  } finally {
    await server.close();
  }
}

async function main() {
  await withServer({}, async (baseUrl) => {
    assertStatus(await runVerifier(baseUrl), 0, 'matching public release convergence passes', '"ok": true');
    assertStatus(
      await runVerifier(baseUrl, { PATH: '' }, ['--verify-images']),
      1,
      'image-aware public convergence explains missing Docker',
      'Docker is required for --verify-images',
    );
  });

  await withServer({
    expectedGithubAuthorization: 'Bearer fixture-gh-token',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, {
        GITHUB_TOKEN: '',
        GH_TOKEN: 'fixture-gh-token',
        JIFFOO_SKIP_GH_AUTH_TOKEN: 'true',
      }),
      0,
      'GH_TOKEN authenticates GitHub release API requests',
      '"ok": true',
    );
  });

  await withServer({
    prerelease: true,
    releaseName: `QUARANTINED: ${RELEASE_TAG}`,
    releaseBody: 'This release must not be treated as self-hosted-detectable.',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, {}, ['--allow-prerelease']),
      1,
      'quarantined prerelease public convergence fails even with prerelease opt-in',
      'is quarantined and must not be published',
    );
  });

  await withServer({ releaseAssets: [] }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'missing GitHub release assets fail',
      'missing required assets',
    );
  });

  await withServer({
    publicManifest: {
      latestVersion: CORE_VERSION,
      latestStableVersion: CORE_VERSION,
      latestPrereleaseVersion: null,
      channel: 'stable',
      deliveryMode: 'image',
      images: null,
      releaseDate: '2026-06-02T00:00:00.000Z',
      changelogUrl: `${RELEASE_TAG}`,
      sourceArchiveUrl: 'https://example.invalid/jiffoo-source.tar.gz',
      minimumCompatibleVersion: '1.0.0',
      minimumAutoUpgradableVersion: '1.0.0',
      requiresManualIntervention: false,
      releaseNotes: 'Legacy feed shape.',
      checksumUrl: 'https://example.invalid/jiffoo-source.tar.gz.sha256',
      signatureUrl: null,
      releaseTag: RELEASE_TAG,
      repository: REPO,
    },
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'legacy public delivery mode fails',
      'Legacy image deliveryMode is no longer publishable',
    );
  });

  await withServer({
    releaseManifest: (_baseUrl, manifest) => ({
      ...manifest,
      images: {
        ...manifest.images,
        api: `registry.example.test/jiffoo-oss/api:${CORE_VERSION}0`,
      },
    }),
    publicManifest: (_baseUrl, manifest) => ({
      ...manifest,
      images: {
        ...manifest.images,
        api: `registry.example.test/jiffoo-oss/api:${CORE_VERSION}0`,
      },
    }),
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'partial public runtime image tag fails',
      'Runtime image for api must use exact tag',
    );
  });

  await withServer({
    publicManifest: (_baseUrl, manifest) => ({
      ...manifest,
      releaseNotes: 'Public feed drift.',
    }),
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'public manifest drift fails',
      'Manifest drift detected between GitHub release asset and',
    );
  });

  await withServer({
    publicArchiveBody: 'stale public archive\n',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'stale public source archive fails',
      'Public source archive checksum mismatch',
    );
  });

  console.log('Public release convergence verifier regression tests passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
