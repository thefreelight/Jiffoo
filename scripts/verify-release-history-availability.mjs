#!/usr/bin/env node

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const DEFAULT_REPO = 'thefreelight/Jiffoo';
const DEFAULT_GITHUB_API_URL = 'https://api.github.com';
const DEFAULT_PUBLIC_MANIFEST_URL = 'https://get.jiffoo.com/releases/core/manifest.json';
const DEFAULT_MIN_VERSION = '1.0.32';
const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_FETCH_RETRIES = 2;
const DEFAULT_FETCH_RETRY_DELAY_MS = 500;
const DEFAULT_FETCH_TIMEOUT_MS = 120000;
const REQUIRED_SERVICES = ['api', 'admin', 'shop', 'updater'];
const REQUIRED_RELEASE_ASSETS = [
  'core-update-manifest.json',
  'jiffoo-source.tar.gz',
  'jiffoo-source.tar.gz.sha256',
];

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
  node scripts/verify-release-history-availability.mjs [--min-version 1.0.32]

Options:
  --repo             GitHub repository, default: ${DEFAULT_REPO}
  --github-api-url   GitHub API base URL for tests/mirrors.
  --public-url       Public feed URL, default: ${DEFAULT_PUBLIC_MANIFEST_URL}
  --min-version      First OSS release version that must satisfy the modern availability contract, default: ${DEFAULT_MIN_VERSION}
  --release-tag      Audit one release tag instead of the stable release history.
  --expect-quarantined
                     With --release-tag, require that release to be a visible QUARANTINED prerelease.
  --exclude-pending-release-tag
                     Exclude one draft/prerelease release from the full history audit before stable promotion.
  --per-page         GitHub page size, default: ${DEFAULT_PER_PAGE}
  --max-pages        Maximum release-list pages, default: ${DEFAULT_MAX_PAGES}
  --fetch-retries    Retry count for transient GitHub/public asset fetches, default: ${DEFAULT_FETCH_RETRIES}
  --fetch-retry-delay-ms
                     Delay between transient fetch retries, default: ${DEFAULT_FETCH_RETRY_DELAY_MS}
  --fetch-timeout-ms
                     Per-attempt timeout for GitHub/public fetches, default: ${DEFAULT_FETCH_TIMEOUT_MS}
  --verify-images    Verify runtime image refs with docker buildx imagetools inspect.

Checks:
  - stable OSS releases at or above --min-version have core-update-manifest.json, jiffoo-source.tar.gz, and checksum assets
  - prerelease/draft OSS releases at or above --min-version are not silently skipped; they must be visibly quarantined
  - manifest latestVersion and releaseTag match the GitHub release tag
  - manifest deliveryMode is image-first
  - manifest includes api/admin/shop/updater image metadata tagged with the release version
  - the latest audited stable release manifest matches the public get.jiffoo.com feed
`);
}

function fail(message) {
  throw new Error(message);
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

function githubHeaders() {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'jiffoo-release-history-availability-verifier',
  };

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || readGhAuthToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function buildGithubApiUrl(baseUrl, repo, apiPath, params = {}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/repos/${repo}${apiPath}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseNonNegativeIntegerArg(value, fallback, label) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`${label} must be a non-negative integer.`);
  }

  return parsed;
}

function parsePositiveIntegerArg(value, fallback, label) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`${label} must be a positive integer.`);
  }

  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableFetchStatus(status) {
  return status === 408 || status === 425 || status >= 500;
}

function isRetryableFetchError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up|timed out)\b/i.test(message);
}

function formatFetchFailure(label, url, response, text, attempts) {
  const attemptText = attempts > 1 ? ` after ${attempts} attempts` : '';
  return `${label} ${url} returned HTTP ${response.status}${attemptText}${text ? `: ${text.slice(0, 300)}` : ''}`;
}

async function fetchResponse(url, label, headers = {}, options = {}) {
  const maxAttempts = Math.max(1, (options.fetchRetries ?? DEFAULT_FETCH_RETRIES) + 1);
  const retryDelayMs = options.fetchRetryDelayMs ?? DEFAULT_FETCH_RETRY_DELAY_MS;
  const timeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error(`${label} ${url} timed out after ${timeoutMs}ms`)
        : error;
      if (attempt < maxAttempts && isRetryableFetchError(lastError)) {
        await sleep(retryDelayMs);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const lowerText = text.toLowerCase();
      const remaining = response.headers.get('x-ratelimit-remaining');
      const rateLimited = (
        response.status === 429
        || (
          response.status === 403
          && (remaining === '0' || lowerText.includes('rate limit') || lowerText.includes('api rate limit exceeded'))
        )
      );
      if (rateLimited) {
        const authHint = headers.authorization
          ? 'The configured GitHub token was rate-limited or rejected; refresh GITHUB_TOKEN/GH_TOKEN with contents:read access and retry.'
          : 'Set GITHUB_TOKEN or GH_TOKEN, or authenticate the gh CLI, and retry.';
        fail(`${label} ${url} returned HTTP ${response.status}: GitHub API rate limit blocked the release availability audit. ${authHint}${text ? ` Response: ${text.slice(0, 300)}` : ''}`);
      }
      lastError = new Error(formatFetchFailure(label, url, response, text, attempt));
      if (attempt < maxAttempts && isRetryableFetchStatus(response.status)) {
        await sleep(retryDelayMs);
        continue;
      }
      throw lastError;
    }
    return response;
  }

  throw lastError || new Error(`${label} ${url} failed without a response.`);
}

async function fetchJson(url, label, headers = {}, options = {}) {
  const response = await fetchResponse(url, label, headers, options);
  try {
    return await response.json();
  } catch (error) {
    fail(`${label} ${url} did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchText(url, label, headers = {}, options = {}) {
  const response = await fetchResponse(url, label, headers, options);
  return response.text();
}

async function sha256Url(url, label, headers = {}, options = {}) {
  const response = await fetchResponse(url, label, headers, options);
  const buffer = Buffer.from(await response.arrayBuffer());
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseChecksum(text, label) {
  const [checksum, fileName] = String(text || '').trim().split(/\s+/);
  if (!/^[a-f0-9]{64}$/i.test(checksum || '')) {
    throw new Error(`${label} does not start with a valid sha256 checksum.`);
  }
  if (fileName !== 'jiffoo-source.tar.gz') {
    throw new Error(`${label} should reference jiffoo-source.tar.gz, found ${fileName || '<empty>'}.`);
  }
  return checksum.toLowerCase();
}

function parseSemver(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:-opensource)?$/);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function compareReleaseTags(leftTag, rightTag) {
  const leftVersion = parseSemver(releaseVersionFromTag(leftTag));
  const rightVersion = parseSemver(releaseVersionFromTag(rightTag));
  if (!leftVersion && !rightVersion) {
    return 0;
  }
  if (!leftVersion) {
    return -1;
  }
  if (!rightVersion) {
    return 1;
  }
  return compareSemver(leftVersion, rightVersion);
}

function assertSameManifest(left, right, label) {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  if (leftJson !== rightJson) {
    fail(`Manifest drift detected between latest audited GitHub release asset and ${label}.`);
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

  const trimmed = value.trim();
  if (/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-opensource$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(trimmed)) {
    return `v${trimmed}-opensource`;
  }
  return null;
}

function getRuntimeImageTag(image) {
  const [namePart = ''] = image.trim().split('@', 1);
  const lastSlashIndex = namePart.lastIndexOf('/');
  const tagSeparatorIndex = namePart.lastIndexOf(':');
  if (tagSeparatorIndex <= lastSlashIndex) {
    return null;
  }

  const tag = namePart.slice(tagSeparatorIndex + 1);
  return tag.length > 0 ? tag : null;
}

function isModernOssReleaseTag(tagName) {
  return /^v\d+\.\d+\.\d+-opensource$/.test(String(tagName || ''));
}

function releaseVersionFromTag(tagName) {
  return String(tagName).replace(/^v/, '').replace(/-opensource$/, '');
}

async function fetchReleaseHistory(args, repo, headers, fetchOptions) {
  const apiBaseUrl = args['github-api-url'] || DEFAULT_GITHUB_API_URL;
  const releaseTag = normalizeReleaseTag(args['release-tag']);
  if (args['release-tag'] && !releaseTag) {
    fail(`Invalid --release-tag: ${args['release-tag']}`);
  }

  if (releaseTag) {
    const release = await fetchJson(
      buildGithubApiUrl(apiBaseUrl, repo, `/releases/tags/${encodeURIComponent(releaseTag)}`),
      `GitHub release ${releaseTag}`,
      headers,
      fetchOptions,
    );
    return [release];
  }

  const perPage = Number(args['per-page'] || DEFAULT_PER_PAGE);
  const maxPages = Number(args['max-pages'] || DEFAULT_MAX_PAGES);
  if (!Number.isInteger(perPage) || perPage <= 0 || perPage > 100) {
    fail(`Invalid --per-page: ${args['per-page']}`);
  }
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    fail(`Invalid --max-pages: ${args['max-pages']}`);
  }

  const releases = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const pageReleases = await fetchJson(
      buildGithubApiUrl(apiBaseUrl, repo, '/releases', { per_page: perPage, page }),
      `GitHub release history page ${page}`,
      headers,
      fetchOptions,
    );
    if (!Array.isArray(pageReleases)) {
      fail(`GitHub release history page ${page} did not return an array.`);
    }

    releases.push(...pageReleases);
    if (pageReleases.length < perPage) {
      break;
    }
  }

  return releases;
}

function excludePendingRelease(releases, releaseTag) {
  if (!releaseTag) {
    return { releases, excludedRelease: null };
  }

  const excludedRelease = releases.find((release) => release?.tag_name === releaseTag);
  if (!excludedRelease) {
    fail(`--exclude-pending-release-tag ${releaseTag} did not match a release in the fetched history.`);
  }
  if (!excludedRelease.draft && !excludedRelease.prerelease) {
    fail(`--exclude-pending-release-tag ${releaseTag} can only exclude a draft or prerelease pending release; stable releases must be audited.`);
  }

  return {
    releases: releases.filter((release) => release?.tag_name !== releaseTag),
    excludedRelease,
  };
}

function shouldAuditRelease(release, minVersion, releaseTagFilter) {
  if (!release || typeof release !== 'object') {
    return false;
  }

  if (releaseTagFilter) {
    return release.tag_name === releaseTagFilter;
  }

  if (release.draft || release.prerelease || !isModernOssReleaseTag(release.tag_name)) {
    return false;
  }

  const releaseVersion = parseSemver(releaseVersionFromTag(release.tag_name));
  return Boolean(releaseVersion && compareSemver(releaseVersion, minVersion) >= 0);
}

function shouldAuditQuarantine(release, minVersion, releaseTagFilter) {
  if (releaseTagFilter || !release || typeof release !== 'object') {
    return false;
  }

  if (!isModernOssReleaseTag(release.tag_name)) {
    return false;
  }

  const releaseVersion = parseSemver(releaseVersionFromTag(release.tag_name));
  if (!releaseVersion || compareSemver(releaseVersion, minVersion) < 0) {
    return false;
  }

  return Boolean(release.draft || release.prerelease);
}

function assetMapForRelease(release, issues) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const assetMap = new Map(assets.map((asset) => [asset.name, asset]));

  const missing = REQUIRED_RELEASE_ASSETS.filter((assetName) => !assetMap.has(assetName));
  if (missing.length > 0) {
    issues.push(`missing required assets: ${missing.join(', ')}`);
  }

  for (const assetName of REQUIRED_RELEASE_ASSETS) {
    const asset = assetMap.get(assetName);
    if (!asset) {
      continue;
    }
    if (!asset.browser_download_url) {
      issues.push(`asset ${assetName} is missing browser_download_url`);
    }
    if (typeof asset.size === 'number' && asset.size <= 0) {
      issues.push(`asset ${assetName} is empty`);
    }
  }

  return assetMap;
}

function validateManifest(releaseTag, manifest, issues) {
  if (!manifest || typeof manifest !== 'object') {
    issues.push('manifest asset is not a JSON object');
    return null;
  }

  const expectedVersion = releaseVersionFromTag(releaseTag);
  const manifestVersion = normalizeCoreVersion(manifest.latestVersion);
  if (manifestVersion !== expectedVersion) {
    issues.push(`manifest latestVersion mismatch: expected ${expectedVersion}, found ${manifest.latestVersion || '<missing>'}`);
  }

  if (manifest.releaseTag !== releaseTag) {
    issues.push(`manifest releaseTag mismatch: expected ${releaseTag}, found ${manifest.releaseTag || '<missing>'}`);
  }

  if (manifest.deliveryMode !== 'image-first') {
    issues.push(`manifest deliveryMode must be image-first, found ${manifest.deliveryMode || '<missing>'}`);
  }

  if (!manifest.images || typeof manifest.images !== 'object') {
    issues.push('image-first manifest must include runtime image metadata');
    return manifest;
  }

  for (const service of REQUIRED_SERVICES) {
    const image = manifest.images[service];
    if (typeof image !== 'string' || image.trim().length === 0) {
      issues.push(`manifest is missing ${service} image metadata`);
      continue;
    }
    if (getRuntimeImageTag(image) !== expectedVersion) {
      issues.push(`runtime image for ${service} must use exact tag ${expectedVersion}: ${image}`);
    }
  }

  return manifest;
}

async function validateSourceArchiveChecksum(releaseTag, assetMap, headers, issues, options) {
  const archiveAsset = assetMap.get('jiffoo-source.tar.gz');
  const checksumAsset = assetMap.get('jiffoo-source.tar.gz.sha256');
  if (!archiveAsset?.browser_download_url || !checksumAsset?.browser_download_url) {
    return;
  }

  try {
    const checksumText = await fetchText(
      checksumAsset.browser_download_url,
      `GitHub release ${releaseTag} checksum asset`,
      headers,
      options.fetch,
    );
    const expectedChecksum = parseChecksum(checksumText, `GitHub release ${releaseTag} checksum asset`);
    const archiveChecksum = await sha256Url(
      archiveAsset.browser_download_url,
      `GitHub release ${releaseTag} source archive`,
      headers,
      options.fetch,
    );
    if (archiveChecksum !== expectedChecksum) {
      issues.push(`source archive checksum mismatch: expected ${expectedChecksum}, found ${archiveChecksum}`);
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
}

function assertRuntimeImagesAvailable(releaseTag, manifest, issues) {
  if (!manifest?.images || typeof manifest.images !== 'object') {
    return;
  }

  for (const service of REQUIRED_SERVICES) {
    const image = manifest.images[service];
    if (typeof image !== 'string' || image.trim().length === 0) {
      continue;
    }

    const result = spawnSync('docker', ['buildx', 'imagetools', 'inspect', image], {
      encoding: 'utf8',
    });
    if (result.error?.code === 'ENOENT') {
      throw new Error('Docker is required for --verify-images but docker was not found on PATH. Install Docker with buildx, or rerun without --verify-images for a metadata-only audit.');
    }
    if (result.error) {
      throw new Error(`Failed to inspect runtime image for ${service} in ${releaseTag}: ${image}\n${result.error.message}`);
    }
    if (result.status !== 0) {
      issues.push(`runtime image is not available for ${service} in ${releaseTag}: ${image}`);
    }
  }
}

async function auditRelease(release, headers, options) {
  const releaseTag = release.tag_name || '<unknown>';
  const issues = [];

  if (release.draft) {
    issues.push('release is still a draft');
  }
  if (release.prerelease) {
    issues.push('release is still marked as prerelease');
  }
  if (!isModernOssReleaseTag(releaseTag)) {
    issues.push(`release tag is not a modern OSS tag: ${releaseTag}`);
  }

  const assetMap = assetMapForRelease(release, issues);
  await validateSourceArchiveChecksum(releaseTag, assetMap, headers, issues, options);
  let manifest = null;
  const manifestAsset = assetMap.get('core-update-manifest.json');
  if (manifestAsset?.browser_download_url) {
    try {
      manifest = await fetchJson(
      manifestAsset.browser_download_url,
      `GitHub release ${releaseTag} manifest asset`,
      headers,
      options.fetch,
    );
      validateManifest(releaseTag, manifest, issues);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (options.verifyImages && manifest) {
    assertRuntimeImagesAvailable(releaseTag, manifest, issues);
  }

  return {
    releaseTag,
    url: release.html_url || release.url || null,
    manifest,
    issues,
  };
}

async function auditPublicFeedConvergence(results, publicUrl, options = {}) {
  if (results.length === 0) {
    return false;
  }

  const latestResult = results.reduce((current, candidate) => (
    compareReleaseTags(candidate.releaseTag, current.releaseTag) > 0 ? candidate : current
  ));

  if (!latestResult.manifest) {
    return false;
  }

  try {
    const publicManifest = await fetchJson(
      publicUrl,
      'public self-hosted feed manifest',
      {},
      options.fetch,
    );
    assertSameManifest(latestResult.manifest, publicManifest, publicUrl);
    return true;
  } catch (error) {
    latestResult.issues.push(error instanceof Error ? error.message : String(error));
    return false;
  }
}

function auditQuarantinedRelease(release) {
  const releaseTag = release.tag_name || '<unknown>';
  const issues = [];
  const name = String(release.name || release.title || '');
  const body = String(release.body || '');

  if (!isModernOssReleaseTag(releaseTag)) {
    issues.push(`quarantined release tag is not a modern OSS tag: ${releaseTag}`);
  }
  if (release.draft) {
    issues.push('release is still a draft; failed OSS publication must be visible as a QUARANTINED prerelease');
  }
  if (!release.prerelease) {
    issues.push('quarantined failed publication must remain marked as prerelease');
  }
  if (!name.startsWith(`QUARANTINED: ${releaseTag}`)) {
    issues.push(`quarantined release title must start with QUARANTINED: ${releaseTag}`);
  }

  for (const token of [
    'Release publication blocked',
    'runtime images',
    'GitHub release assets',
    'public feed',
  ]) {
    if (!body.includes(token)) {
      issues.push(`quarantine notes must include "${token}"`);
    }
  }
  const explainsUnavailable = (
    body.includes('not self-hosted-detectable')
    || body.includes('must not be treated as self-hosted-detectable')
    || (body.includes('must not be treated') && body.includes('self-hosted-detectable'))
  );
  if (!explainsUnavailable) {
    issues.push('quarantine notes must explain that the release is not self-hosted-detectable and must not be treated as available');
  }

  return {
    releaseTag,
    url: release.html_url || release.url || null,
    issues,
  };
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function isTransientAvailabilityIssue(issue) {
  return (
    /returned HTTP (?:408|425|429|5\d\d)\b/i.test(issue)
    || /\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up|timed out)\b/i.test(issue)
  );
}

function buildRemediationGuide(failures, repo) {
  const hardFailures = failures.filter((failure) => (
    failure.issues.some((issue) => !isTransientAvailabilityIssue(issue))
  ));
  const transientOnlyFailures = failures.filter((failure) => (
    failure.issues.length > 0
    && failure.issues.every((issue) => isTransientAvailabilityIssue(issue))
  ));
  const releaseVersions = uniqueValues(
    hardFailures
      .map((failure) => (isModernOssReleaseTag(failure.releaseTag)
        ? releaseVersionFromTag(failure.releaseTag)
        : null)),
  );
  const transientTags = uniqueValues(
    transientOnlyFailures.map((failure) => failure.releaseTag),
  );

  if (releaseVersions.length === 0 && transientTags.length === 0) {
    return '';
  }

  const lines = [
    '',
    'Remediation:',
  ];

  if (releaseVersions.length > 0) {
    const versionsValue = releaseVersions.join(',');
    lines.push(
      `- GitHub Actions: run "Repair OSS Release Publication" with action=quarantine and version=${versionsValue}.`,
      `- Local fallback: GITHUB_TOKEN=... node scripts/release-oss-patch.mjs --version ${versionsValue} --publish --quarantine-existing-release --defer-release-history-availability --repo ${repo}`,
      `- After all release mutations: GITHUB_TOKEN=... node scripts/verify-release-history-availability.mjs --repo ${repo} --verify-images`,
    );
  }

  if (transientTags.length > 0) {
    lines.push(
      `- Transient fetch failures: retry the audit before mutating release state for ${transientTags.join(', ')}.`,
      '- If transient fetch failures repeat, check GitHub release asset download/CDN availability and rerun the release history audit before deciding whether quarantine or repair is needed.',
    );
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const minVersion = parseSemver(args['min-version'] || DEFAULT_MIN_VERSION);
  if (!minVersion) {
    fail(`Invalid --min-version: ${args['min-version'] || DEFAULT_MIN_VERSION}`);
  }

  const repo = args.repo || process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const headers = githubHeaders();
  const fetchOptions = {
    fetchRetries: parseNonNegativeIntegerArg(args['fetch-retries'], DEFAULT_FETCH_RETRIES, '--fetch-retries'),
    fetchRetryDelayMs: parsePositiveIntegerArg(args['fetch-retry-delay-ms'], DEFAULT_FETCH_RETRY_DELAY_MS, '--fetch-retry-delay-ms'),
    fetchTimeoutMs: parsePositiveIntegerArg(args['fetch-timeout-ms'], DEFAULT_FETCH_TIMEOUT_MS, '--fetch-timeout-ms'),
  };
  const releaseTagFilter = normalizeReleaseTag(args['release-tag']);
  const excludePendingReleaseTag = normalizeReleaseTag(args['exclude-pending-release-tag']);
  if (args['exclude-pending-release-tag'] && !excludePendingReleaseTag) {
    fail(`Invalid --exclude-pending-release-tag: ${args['exclude-pending-release-tag']}`);
  }
  if (excludePendingReleaseTag && releaseTagFilter) {
    fail('--exclude-pending-release-tag cannot be combined with --release-tag; it only applies to full history audits before stable promotion.');
  }
  const expectQuarantined = args['expect-quarantined'] === 'true';
  if (expectQuarantined && !releaseTagFilter) {
    fail('--expect-quarantined requires --release-tag so the verifier can audit one explicit quarantined release.');
  }
  if (expectQuarantined && excludePendingReleaseTag) {
    fail('--exclude-pending-release-tag cannot be combined with --expect-quarantined.');
  }

  const fetchedReleases = await fetchReleaseHistory(args, repo, headers, fetchOptions);
  const { releases, excludedRelease } = excludePendingRelease(fetchedReleases, excludePendingReleaseTag);
  const auditedReleases = expectQuarantined
    ? []
    : releases.filter((release) => shouldAuditRelease(release, minVersion, releaseTagFilter));
  const auditedQuarantines = expectQuarantined
    ? releases.filter((release) => release?.tag_name === releaseTagFilter)
    : releases.filter((release) => shouldAuditQuarantine(release, minVersion, releaseTagFilter));
  if (auditedReleases.length === 0 && auditedQuarantines.length === 0) {
    fail(`No releases matched the availability audit scope for ${repo}.`);
  }

  const results = [];
  for (const release of auditedReleases) {
    results.push(await auditRelease(release, headers, {
      verifyImages: args['verify-images'] === 'true',
      fetch: fetchOptions,
    }));
  }
  const verifiedPublicFeed = (expectQuarantined || releaseTagFilter)
    ? false
    : await auditPublicFeedConvergence(results, args['public-url'] || DEFAULT_PUBLIC_MANIFEST_URL, {
      fetch: fetchOptions,
    });

  const quarantineResults = auditedQuarantines.map((release) => auditQuarantinedRelease(release));
  const failures = [...results, ...quarantineResults].filter((result) => result.issues.length > 0);
  if (failures.length > 0) {
    const lines = failures.flatMap((failure) => [
      `${failure.releaseTag}:`,
      ...failure.issues.map((issue) => `  - ${issue}`),
    ]);
    const remediationGuide = buildRemediationGuide(failures, repo);
    fail(`Release history availability audit failed for ${failures.length} release(s):\n${lines.join('\n')}${remediationGuide ? `\n${remediationGuide}` : ''}`);
  }

  console.log(JSON.stringify({
    ok: true,
    repo,
    minVersion: args['min-version'] || DEFAULT_MIN_VERSION,
    auditedReleases: results.length,
    auditedQuarantinedReleases: quarantineResults.length,
    excludedPendingReleaseTag: excludedRelease?.tag_name || null,
    releaseTags: results.map((result) => result.releaseTag),
    quarantinedReleaseTags: quarantineResults.map((result) => result.releaseTag),
    verifiedImages: args['verify-images'] === 'true',
    verifiedPublicFeed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
