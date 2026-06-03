#!/usr/bin/env node

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const DEFAULT_REPO = 'thefreelight/Jiffoo';
const DEFAULT_GITHUB_API_URL = 'https://api.github.com';
const DEFAULT_PUBLIC_MANIFEST_URL = 'https://get.jiffoo.com/releases/core/manifest.json';
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

function printHelp() {
  console.log(`
Usage:
  node scripts/verify-public-release-convergence.mjs [--release-tag v1.0.37-opensource]

Options:
  --repo                         GitHub repository, default: ${DEFAULT_REPO}
  --release-tag                  Specific release tag. Defaults to GitHub latest stable release.
  --github-api-url               GitHub API base URL for tests/mirrors.
  --public-url                   Public feed URL, default: ${DEFAULT_PUBLIC_MANIFEST_URL}
  --allow-prerelease             Allow prerelease GitHub releases.
  --allow-source-archive-release Allow source-archive public feeds.
  --verify-images                Verify runtime image refs with docker buildx imagetools inspect.

Checks:
  - latest stable GitHub release is not draft/prerelease unless explicitly allowed
  - GitHub release has core-update-manifest.json, jiffoo-source.tar.gz, and checksum assets
  - release manifest and public get.jiffoo.com manifest are byte-for-byte equivalent as JSON
  - manifest deliveryMode is image-first with api/admin/shop/updater image metadata
  - public archive/checksum assets match the GitHub release assets and checksum contents
`);
}

function fail(message) {
  throw new Error(message);
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

function githubHeaders() {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'jiffoo-release-convergence-verifier',
  };

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || readGhAuthToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function readGhAuthToken() {
  if (process.env.JIFFOO_SKIP_GH_AUTH_TOKEN === 'true') {
    return null;
  }

  const result = spawnSync('gh', ['auth', 'token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function buildGithubApiUrl(baseUrl, repo, path) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}/repos/${repo}${path}`;
}

async function fetchResponse(url, label, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    fail(`${label} ${url} returned HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
  }
  return response;
}

async function fetchJson(url, label, headers = {}) {
  const response = await fetchResponse(url, label, headers);
  try {
    return await response.json();
  } catch (error) {
    fail(`${label} ${url} did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchText(url, label, headers = {}) {
  const response = await fetchResponse(url, label, headers);
  return response.text();
}

async function sha256Url(url, label, headers = {}) {
  const response = await fetchResponse(url, label, headers);
  if (!response.body) {
    fail(`${label} ${url} did not return a readable response body.`);
  }

  const hash = crypto.createHash('sha256');
  for await (const chunk of response.body) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function assertSameManifest(left, right, label) {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  if (leftJson !== rightJson) {
    fail(`Manifest drift detected between GitHub release asset and ${label}.`);
  }
}

function parseChecksum(text, label) {
  const [checksum, fileName] = text.trim().split(/\s+/);
  if (!/^[a-f0-9]{64}$/i.test(checksum || '')) {
    fail(`${label} does not start with a valid sha256 checksum.`);
  }
  if (fileName !== 'jiffoo-source.tar.gz') {
    fail(`${label} should reference jiffoo-source.tar.gz, found ${fileName || '<empty>'}.`);
  }
  return checksum.toLowerCase();
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

function assertRuntimeImagesAvailable(manifest) {
  if (!manifest.images || typeof manifest.images !== 'object') {
    fail('Cannot verify runtime images because manifest has no image metadata.');
  }

  for (const service of REQUIRED_SERVICES) {
    const image = manifest.images[service];
    if (typeof image !== 'string' || image.trim().length === 0) {
      fail(`Cannot verify missing ${service} runtime image metadata.`);
    }

    const result = spawnSync('docker', ['buildx', 'imagetools', 'inspect', image], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      fail(`Runtime image is not available for ${service}: ${image}\n${result.stderr || result.stdout}`);
    }
  }
}

async function fetchRelease(args) {
  const repo = args.repo || process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const apiBaseUrl = args['github-api-url'] || DEFAULT_GITHUB_API_URL;
  const releaseTag = normalizeReleaseTag(args['release-tag']);
  const path = releaseTag ? `/releases/tags/${encodeURIComponent(releaseTag)}` : '/releases/latest';
  const release = await fetchJson(
    buildGithubApiUrl(apiBaseUrl, repo, path),
    releaseTag ? `GitHub release ${releaseTag}` : 'GitHub latest release',
    githubHeaders(),
  );
  return { release, repo };
}

function validateRelease(release, options) {
  if (!release || typeof release !== 'object') {
    fail('GitHub release response is invalid.');
  }
  if (release.draft) {
    fail(`GitHub release ${release.tag_name || '<unknown>'} is still a draft.`);
  }
  if (release.prerelease && !options.allowPrerelease) {
    fail(`GitHub release ${release.tag_name || '<unknown>'} is still marked as prerelease.`);
  }

  const releaseTag = normalizeReleaseTag(release.tag_name);
  if (!releaseTag || release.tag_name !== releaseTag) {
    fail(`GitHub release tag is invalid: ${release.tag_name}`);
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const assetMap = new Map(assets.map((asset) => [asset.name, asset]));
  const missing = REQUIRED_RELEASE_ASSETS.filter((assetName) => !assetMap.has(assetName));
  if (missing.length > 0) {
    fail(`GitHub release ${releaseTag} is missing required assets: ${missing.join(', ')}`);
  }

  for (const assetName of REQUIRED_RELEASE_ASSETS) {
    const asset = assetMap.get(assetName);
    if (!asset.browser_download_url) {
      fail(`GitHub release asset ${assetName} is missing browser_download_url.`);
    }
    if (typeof asset.size === 'number' && asset.size <= 0) {
      fail(`GitHub release asset ${assetName} is empty.`);
    }
  }

  return { releaseTag, assetMap };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const publicUrl = args['public-url'] || DEFAULT_PUBLIC_MANIFEST_URL;
  const { release, repo } = await fetchRelease(args);
  const { releaseTag, assetMap } = validateRelease(release, {
    allowPrerelease: args['allow-prerelease'] === 'true',
  });
  const expectedVersion = normalizeCoreVersion(releaseTag);

  const releaseManifest = await fetchJson(
    assetMap.get('core-update-manifest.json').browser_download_url,
    `GitHub release ${releaseTag} manifest asset`,
  );
  validateManifest(releaseManifest, {
    coreVersion: expectedVersion,
    releaseTag,
    allowSourceArchiveRelease: args['allow-source-archive-release'] === 'true',
  });

  const publicManifest = await fetchJson(publicUrl, 'Public feed');
  validateManifest(publicManifest, {
    coreVersion: expectedVersion,
    releaseTag,
    allowSourceArchiveRelease: args['allow-source-archive-release'] === 'true',
  });
  assertSameManifest(releaseManifest, publicManifest, publicUrl);

  const githubChecksumText = await fetchText(
    assetMap.get('jiffoo-source.tar.gz.sha256').browser_download_url,
    `GitHub release ${releaseTag} checksum asset`,
  );
  const publicChecksumText = await fetchText(publicManifest.checksumUrl, 'Public checksum asset');
  if (githubChecksumText.trim() !== publicChecksumText.trim()) {
    fail('Public checksum asset drift detected against GitHub release checksum asset.');
  }

  const expectedChecksum = parseChecksum(githubChecksumText, 'GitHub release checksum asset');
  const publicChecksum = parseChecksum(publicChecksumText, 'Public checksum asset');
  if (publicChecksum !== expectedChecksum) {
    fail(`Public checksum mismatch: expected ${expectedChecksum}, found ${publicChecksum}.`);
  }

  const githubArchiveChecksum = await sha256Url(
    assetMap.get('jiffoo-source.tar.gz').browser_download_url,
    `GitHub release ${releaseTag} source archive asset`,
  );
  if (githubArchiveChecksum !== expectedChecksum) {
    fail(`GitHub source archive checksum mismatch: expected ${expectedChecksum}, found ${githubArchiveChecksum}.`);
  }

  const publicArchiveChecksum = await sha256Url(publicManifest.sourceArchiveUrl, 'Public source archive');
  if (publicArchiveChecksum !== expectedChecksum) {
    fail(`Public source archive checksum mismatch: expected ${expectedChecksum}, found ${publicArchiveChecksum}.`);
  }

  if (args['verify-images'] === 'true') {
    assertRuntimeImagesAvailable(publicManifest);
  }

  console.log(JSON.stringify({
    ok: true,
    repo,
    releaseTag,
    latestVersion: publicManifest.latestVersion,
    publicUrl,
    deliveryMode: publicManifest.deliveryMode,
    verifiedImages: args['verify-images'] === 'true',
    requiredAssets: REQUIRED_RELEASE_ASSETS,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
