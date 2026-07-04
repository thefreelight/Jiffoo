#!/usr/bin/env node

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-release-history-availability.mjs');
const REPO = 'test/repo';
const REQUIRED_ASSETS = [
  'core-update-manifest.json',
  'jiffoo-source.tar.gz',
  'jiffoo-source.tar.gz.sha256',
];

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function coreVersionFromTag(tagName) {
  return tagName.replace(/^v/, '').replace(/-opensource$/, '');
}

function compareCoreVersions(left, right) {
  const leftParts = coreVersionFromTag(left).split('.').map((part) => Number(part));
  const rightParts = coreVersionFromTag(right).split('.').map((part) => Number(part));
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function createManifest(tagName, overrides = {}) {
  const version = coreVersionFromTag(tagName);
  return {
    latestVersion: version,
    latestStableVersion: version,
    latestPrereleaseVersion: null,
    channel: 'stable',
    deliveryMode: 'image-first',
    images: {
      api: `registry.example.test/jiffoo-oss/api:${version}`,
      admin: `registry.example.test/jiffoo-oss/admin:${version}`,
      shop: `registry.example.test/jiffoo-oss/shop:${version}`,
      updater: `registry.example.test/jiffoo-oss/updater:${version}`,
    },
    releaseDate: '2026-06-03T00:00:00.000Z',
    changelogUrl: `https://github.example.test/${REPO}/releases/tag/${tagName}`,
    sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
    minimumCompatibleVersion: '1.0.0',
    minimumAutoUpgradableVersion: '1.0.0',
    requiresManualIntervention: false,
    releaseNotes: 'Release history availability fixture.',
    checksumUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz.sha256',
    signatureUrl: null,
    releaseTag: tagName,
    repository: REPO,
    ...overrides,
  };
}

function createRelease(tagName, overrides = {}) {
  const archiveBody = overrides.archiveBody || Buffer.from(`${tagName} source archive\n`, 'utf8');
  const checksumText = overrides.checksumText || `${sha256(archiveBody)}  jiffoo-source.tar.gz\n`;
  return {
    tag_name: tagName,
    name: tagName,
    body: 'Release fixture.',
    draft: false,
    prerelease: false,
    html_url: `https://github.example.test/${REPO}/releases/tag/${tagName}`,
    assets: REQUIRED_ASSETS.map((name) => ({
      name,
      size: 128,
      browser_download_url: '',
    })),
    manifest: createManifest(tagName, overrides.manifest || {}),
    archiveBody,
    checksumText,
    ...overrides,
  };
}

function createQuarantinedRelease(tagName, overrides = {}) {
  return createRelease(tagName, {
    prerelease: true,
    assets: [],
    name: `QUARANTINED: ${tagName}`,
    body: [
      '## Release publication blocked',
      '',
      'This release was automatically quarantined because it is not self-hosted-detectable and must not be treated as self-hosted-detectable.',
      '',
      'Required release facts missing:',
      '- runtime images: api/admin/shop/updater',
      '- GitHub release assets: core-update-manifest.json, jiffoo-source.tar.gz, jiffoo-source.tar.gz.sha256',
      '- public feed: https://get.jiffoo.com/releases/core/manifest.json',
    ].join('\n'),
    ...overrides,
  });
}

function latestStableManifest(releases) {
  const stableReleases = releases
    .filter((release) => !release.draft && !release.prerelease)
    .sort((left, right) => compareCoreVersions(right.tag_name, left.tag_name));
  return stableReleases[0]?.manifest || releases[0]?.manifest || {};
}

async function startServer(releases, options = {}) {
  let baseUrl = '';
  const releasesByTag = new Map(releases.map((release) => [release.tag_name, release]));
  const publicManifest = options.publicManifest || latestStableManifest(releases);

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');

    if (requestUrl.pathname === `/rate-limit/repos/${REPO}/releases`) {
      response.writeHead(403, {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '0',
      });
      response.end(json({ message: 'API rate limit exceeded for test fixtures.' }));
      return;
    }

    if (requestUrl.pathname === `/repos/${REPO}/releases`) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json(releases.map((release) => serializeRelease(release, baseUrl))));
      return;
    }

    if (requestUrl.pathname === '/releases/core/manifest.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json(publicManifest));
      return;
    }

    const releaseTagMatch = requestUrl.pathname.match(new RegExp(`^/repos/${REPO}/releases/tags/(.+)$`));
    if (releaseTagMatch) {
      const tagName = decodeURIComponent(releaseTagMatch[1]);
      const release = releasesByTag.get(tagName);
      if (!release) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(json({ message: 'not found' }));
        return;
      }

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json(serializeRelease(release, baseUrl)));
      return;
    }

    const assetMatch = requestUrl.pathname.match(/^\/assets\/([^/]+)\/([^/]+)$/);
    if (assetMatch) {
      const [, encodedTagName, assetName] = assetMatch;
      const release = releasesByTag.get(decodeURIComponent(encodedTagName));
      if (!release) {
        response.writeHead(404, { 'content-type': 'text/plain' });
        response.end('release not found');
        return;
      }

      let assetResponse = release.assetResponses?.[assetName];
      if (Array.isArray(assetResponse)) {
        assetResponse = assetResponse.length > 0 ? assetResponse.shift() : null;
      }
      if (assetResponse) {
        const sendAssetResponse = () => {
          if (response.destroyed || response.writableEnded) {
            return;
          }
          response.writeHead(assetResponse.status || 500, {
            'content-type': assetResponse.contentType || 'text/plain',
          });
          response.end(assetResponse.body || '');
        };
        if (assetResponse.delayMs) {
          setTimeout(sendAssetResponse, assetResponse.delayMs);
        } else {
          sendAssetResponse();
        }
        return;
      }

      if (assetName === 'core-update-manifest.json') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(json(release.manifest));
        return;
      }

      if (assetName === 'jiffoo-source.tar.gz') {
        response.writeHead(200, { 'content-type': 'application/octet-stream' });
        response.end(release.archiveBody || Buffer.from(`${release.tag_name} source archive\n`, 'utf8'));
        return;
      }

      if (assetName === 'jiffoo-source.tar.gz.sha256') {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end(release.checksumText || `${sha256(Buffer.from(`${release.tag_name} source archive\n`, 'utf8'))}  jiffoo-source.tar.gz\n`);
        return;
      }

      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(`${release.tag_name} ${assetName}\n`);
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
    throw new Error('Failed to start fake release history server.');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function serializeRelease(release, baseUrl) {
  const assets = (release.assets || []).map((asset) => ({
    ...asset,
    browser_download_url: asset.browser_download_url || `${baseUrl}/assets/${encodeURIComponent(release.tag_name)}/${asset.name}`,
  }));

  return {
    tag_name: release.tag_name,
    name: release.name,
    body: release.body,
    draft: release.draft,
    prerelease: release.prerelease,
    html_url: release.html_url,
    assets,
  };
}

function createFakeDocker(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const dockerPath = path.join(binDir, 'docker');
  fs.writeFileSync(
    dockerPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] !== 'buildx' || args[1] !== 'imagetools' || args[2] !== 'inspect') {
  console.error('unsupported fake docker command: ' + args.join(' '));
  process.exit(1);
}
const image = args[3] || '';
if (process.env.JIFFOO_FAKE_DOCKER_FAIL_IMAGE && image.includes(process.env.JIFFOO_FAKE_DOCKER_FAIL_IMAGE)) {
  console.error('fake docker image missing: ' + image);
  process.exit(1);
}
console.log('fake docker image available: ' + image);
`,
    'utf8',
  );
  fs.chmodSync(dockerPath, 0o755);
}

function runVerifier(baseUrl, extraArgs = [], envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT,
      '--repo',
      REPO,
      '--github-api-url',
      baseUrl,
      '--min-version',
      '1.0.32',
      '--max-pages',
      '1',
      '--public-url',
      `${baseUrl}/releases/core/manifest.json`,
      '--fetch-retry-delay-ms',
      '1',
      ...extraArgs,
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
        JIFFOO_SKIP_GH_AUTH_TOKEN: 'true',
        ...envOverrides,
      },
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

function assertNotIncludes(result, label, unexpectedOutput) {
  const combined = `${result.stdout}\n${result.stderr}`;
  if (combined.includes(unexpectedOutput)) {
    throw new Error(`${label}: unexpected output "${unexpectedOutput}"\n${combined}`);
  }
}

async function withServer(releases, fn, options = {}) {
  const server = await startServer(releases, options);
  try {
    return await fn(server.baseUrl);
  } finally {
    await server.close();
  }
}

async function withFakeDocker(fn) {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-fake-docker-'));
  createFakeDocker(binDir);
  try {
    return await fn({
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    });
  } finally {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
}

async function main() {
  await withServer([
    createRelease('v1.0.35-opensource'),
    createRelease('v1.0.31-opensource', { assets: [] }),
    createQuarantinedRelease('v1.0.37-opensource'),
  ], async (baseUrl) => {
    assertStatus(await runVerifier(baseUrl), 0, 'modern stable release history passes', '"auditedReleases": 1');
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
    createRelease('v1.0.37-opensource', { prerelease: true, assets: [] }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--exclude-pending-release-tag', 'v1.0.37-opensource']),
      0,
      'pending prerelease can be excluded from pre-promotion history audit',
      '"excludedPendingReleaseTag": "v1.0.37-opensource"',
    );
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
    createRelease('v1.0.37-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--exclude-pending-release-tag', 'v1.0.37-opensource']),
      1,
      'stable release cannot be excluded from history audit',
      'stable releases must be audited',
    );
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--exclude-pending-release-tag', 'v1.0.37-opensource']),
      1,
      'missing pending release exclusion fails',
      'did not match a release in the fetched history',
    );
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
    createRelease('v1.0.37-opensource', { prerelease: true, assets: [] }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'modern prerelease without quarantine metadata fails',
      'quarantined release title must start with QUARANTINED',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', { assets: [] }),
  ], async (baseUrl) => {
    const missingAssetsResult = await runVerifier(baseUrl);
    assertStatus(
      missingAssetsResult,
      1,
      'modern stable release missing required assets fails',
      'missing required assets',
    );
    assertStatus(
      missingAssetsResult,
      1,
      'modern stable release failure prints workflow remediation',
      'Repair OSS Release Publication',
    );
    assertStatus(
      missingAssetsResult,
      1,
      'modern stable release failure prints local quarantine fallback',
      '--quarantine-existing-release',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      checksumText: 'not-a-sha256  jiffoo-source.tar.gz\n',
    }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'modern stable release invalid checksum asset fails',
      'does not start with a valid sha256 checksum',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      assetResponses: {
        'jiffoo-source.tar.gz.sha256': {
          status: 504,
          contentType: 'text/html',
          body: '<html><body><h1>504 Gateway Time-out</h1></body></html>',
        },
      },
    }),
  ], async (baseUrl) => {
    const transientFailureResult = await runVerifier(baseUrl);
    assertStatus(
      transientFailureResult,
      1,
      'transient checksum asset fetch failure still fails the audit',
      'Transient fetch failures: retry the audit before mutating release state for v1.0.36-opensource',
    );
    assertNotIncludes(
      transientFailureResult,
      'transient checksum asset fetch failure does not recommend quarantine',
      '--version 1.0.36 --publish --quarantine-existing-release',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      assetResponses: {
        'jiffoo-source.tar.gz.sha256': [
          {
            status: 504,
            contentType: 'text/html',
            body: '<html><body><h1>504 Gateway Time-out</h1></body></html>',
          },
        ],
      },
    }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      0,
      'transient checksum asset fetch failure retries before succeeding',
      '"auditedReleases": 1',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      assetResponses: {
        'jiffoo-source.tar.gz.sha256': {
          status: 200,
          contentType: 'text/plain',
          body: `${sha256(Buffer.from('v1.0.36-opensource source archive\n', 'utf8'))}  jiffoo-source.tar.gz\n`,
          delayMs: 1000,
        },
      },
    }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--fetch-timeout-ms', '500', '--fetch-retries', '0']),
      1,
      'slow checksum asset fetch timeout is classified as transient',
      'Transient fetch failures: retry the audit before mutating release state for v1.0.36-opensource',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      archiveBody: Buffer.from('actual archive contents\n', 'utf8'),
      checksumText: `${sha256(Buffer.from('different archive contents\n', 'utf8'))}  jiffoo-source.tar.gz\n`,
    }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'modern stable release source archive checksum mismatch fails',
      'source archive checksum mismatch',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', { assets: [] }),
    createRelease('v1.0.35-opensource', {
      manifest: {
        deliveryMode: 'image',
      },
    }),
  ], async (baseUrl) => {
    const multiFailureResult = await runVerifier(baseUrl);
    assertStatus(
      multiFailureResult,
      1,
      'multi-release stable failure prints batch local quarantine fallback',
      '--version 1.0.36,1.0.35 --publish --quarantine-existing-release',
    );
    assertStatus(
      multiFailureResult,
      1,
      'multi-release stable failure preserves batch workflow version order',
      'Repair OSS Release Publication" with action=quarantine and version=1.0.36,1.0.35',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      manifest: {
        deliveryMode: 'image',
      },
    }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'modern stable release legacy delivery mode fails',
      'manifest deliveryMode must be image-first',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      manifest: {
        latestVersion: '1.0.35',
        releaseTag: 'v1.0.35-opensource',
      },
    }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'modern stable release manifest version drift fails',
      'manifest latestVersion mismatch',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'modern stable release public feed drift fails',
      'Manifest drift detected between latest audited GitHub release asset',
    );
  }, {
    publicManifest: createManifest('v1.0.35-opensource'),
  });

  await withServer([
    createRelease('v1.0.36-opensource'),
    createRelease('v1.0.35-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--release-tag', 'v1.0.35-opensource']),
      0,
      'explicit stable release tag audit skips latest public feed comparison',
      '"verifiedPublicFeed": false',
    );
  });

  await withServer([
    createRelease('v1.0.36-opensource', {
      manifest: {
        images: {
          api: 'registry.example.test/jiffoo-oss/api:1.0.360',
          admin: 'registry.example.test/jiffoo-oss/admin:1.0.36',
          shop: 'registry.example.test/jiffoo-oss/shop:1.0.36',
          updater: 'registry.example.test/jiffoo-oss/updater:1.0.36',
        },
      },
    }),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'modern stable release partial runtime image tag fails',
      'runtime image for api must use exact tag',
    );
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--verify-images'], { PATH: '' }),
      1,
      'image-aware release history explains missing Docker',
      'Docker is required for --verify-images',
    );
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
  ], async (baseUrl) => {
    await withFakeDocker(async (envOverrides) => {
      assertStatus(
        await runVerifier(baseUrl, ['--verify-images'], envOverrides),
        0,
        'image-aware release history passes with available images',
        '"verifiedImages": true',
      );
    });
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
  ], async (baseUrl) => {
    await withFakeDocker(async (envOverrides) => {
      assertStatus(
        await runVerifier(baseUrl, ['--verify-images'], {
          ...envOverrides,
          JIFFOO_FAKE_DOCKER_FAIL_IMAGE: 'jiffoo-oss/admin:1.0.35',
        }),
        1,
        'image-aware release history fails when a runtime image is unavailable',
        'runtime image is not available for admin',
      );
    });
  });

  await withServer([
    createQuarantinedRelease('v1.0.37-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--release-tag', 'v1.0.37-opensource']),
      1,
      'explicit prerelease release audit fails',
      'release is still marked as prerelease',
    );
  });

  await withServer([
    createQuarantinedRelease('v1.0.37-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--release-tag', 'v1.0.37-opensource', '--expect-quarantined']),
      0,
      'explicit quarantined release audit passes',
      '"quarantinedReleaseTags": [',
    );
  });

  await withServer([
    createRelease('v1.0.37-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--release-tag', 'v1.0.37-opensource', '--expect-quarantined']),
      1,
      'stable release fails quarantined expectation',
      'quarantined failed publication must remain marked as prerelease',
    );
  });

  await withServer([
    createQuarantinedRelease('v1.0.37-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--expect-quarantined']),
      1,
      'expect quarantined requires explicit release tag',
      '--expect-quarantined requires --release-tag',
    );
  });

  await withServer([
    createRelease('v1.0.35-opensource'),
  ], async (baseUrl) => {
    assertStatus(
      await runVerifier(`${baseUrl}/rate-limit`),
      1,
      'GitHub API rate limit explains token requirement',
      'Set GITHUB_TOKEN or GH_TOKEN',
    );
  });

  console.log('Release history availability verifier regression tests passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
