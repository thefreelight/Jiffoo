#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_TAG = 'v1.0.32-opensource';
const CORE_VERSION = '1.0.32';
const SECOND_RELEASE_TAG = 'v1.0.33-opensource';
const SECOND_CORE_VERSION = '1.0.33';
const REPO = 'test/repo';

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function startGithubApiFixture() {
  const patches = [];
  let baseUrl = '';
  const releaseStates = new Map([
    [RELEASE_TAG, {
      id: 123,
      tag_name: RELEASE_TAG,
      name: RELEASE_TAG,
      draft: false,
      prerelease: false,
      body: '',
    }],
    [SECOND_RELEASE_TAG, {
      id: 124,
      tag_name: SECOND_RELEASE_TAG,
      name: SECOND_RELEASE_TAG,
      draft: false,
      prerelease: false,
      body: '',
    }],
  ]);

  function releaseById(releaseId) {
    return Array.from(releaseStates.values()).find((release) => String(release.id) === String(releaseId));
  }

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.headers.authorization !== 'Bearer fake-token') {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(json({ message: 'missing fake token' }));
      return;
    }

    const tagMatch = requestUrl.pathname.match(new RegExp(`^/repos/${REPO}/releases/tags/(.+)$`));
    if (request.method === 'GET' && tagMatch) {
      const tagName = decodeURIComponent(tagMatch[1]);
      const releaseState = releaseStates.get(tagName);
      if (!releaseState) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(json({ message: `release not found: ${tagName}` }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json(releaseState));
      return;
    }

    const releasePatchMatch = requestUrl.pathname.match(new RegExp(`^/repos/${REPO}/releases/(\\d+)$`));
    if (request.method === 'PATCH' && releasePatchMatch) {
      const releaseState = releaseById(releasePatchMatch[1]);
      if (!releaseState) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(json({ message: `release id not found: ${releasePatchMatch[1]}` }));
        return;
      }
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const patch = JSON.parse(body);
        patches.push({ releaseTag: releaseState.tag_name, ...patch });
        const nextReleaseState = {
          ...releaseState,
          ...patch,
        };
        releaseStates.set(releaseState.tag_name, nextReleaseState);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(json(nextReleaseState));
      });
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(json({ message: `not found: ${request.method} ${requestUrl.pathname}`, baseUrl }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake GitHub API.');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    patches,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function runReleaseHelper(baseUrl, options = {}) {
  const args = [
    path.join(ROOT, 'scripts', 'release-oss-patch.mjs'),
    '--version',
    CORE_VERSION,
    '--publish',
    '--quarantine-existing-release',
    '--notes',
    'Stable release is missing required self-hosted assets.',
    '--github-api-url',
    baseUrl,
    '--repo',
    REPO,
  ];

  if (options.deferReleaseHistoryAvailability) {
    args.push('--defer-release-history-availability');
  } else {
    args.push('--dry-run');
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: 'fake-token',
        GH_TOKEN: '',
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

function runBatchQuarantineDryRunReleaseHelper(baseUrl) {
  const args = [
    path.join(ROOT, 'scripts', 'release-oss-patch.mjs'),
    '--version',
    '1.0.32,1.0.33',
    '--publish',
    '--quarantine-existing-release',
    '--defer-release-history-availability',
    '--notes',
    'Historical stable releases failed the self-hosted publication contract.',
    '--github-api-url',
    baseUrl,
    '--repo',
    REPO,
    '--dry-run',
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
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

function runBatchQuarantineReleaseHelper(baseUrl) {
  const args = [
    path.join(ROOT, 'scripts', 'release-oss-patch.mjs'),
    '--version',
    `${CORE_VERSION},${SECOND_CORE_VERSION}`,
    '--publish',
    '--quarantine-existing-release',
    '--defer-release-history-availability',
    '--notes',
    'Historical stable releases failed the self-hosted publication contract.',
    '--github-api-url',
    baseUrl,
    '--repo',
    REPO,
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: 'fake-token',
        GH_TOKEN: '',
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

function runInvalidQuarantineVersionDryRunReleaseHelper(baseUrl) {
  const args = [
    path.join(ROOT, 'scripts', 'release-oss-patch.mjs'),
    '--version',
    '1.0.32-beta,1.0.33',
    '--publish',
    '--quarantine-existing-release',
    '--defer-release-history-availability',
    '--notes',
    'Invalid quarantine version regression.',
    '--github-api-url',
    baseUrl,
    '--repo',
    REPO,
    '--dry-run',
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
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

function runDryRunReleaseHelper() {
  const args = [
    path.join(ROOT, 'scripts', 'release-oss-patch.mjs'),
    '--version',
    '9.9.9',
    '--notes',
    'Dry-run release gate coverage regression.',
    '--dry-run',
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
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

function runPublishDryRunReleaseHelper(baseUrl) {
  const args = [
    path.join(ROOT, 'scripts', 'release-oss-patch.mjs'),
    '--version',
    '9.9.8',
    '--notes',
    'Dry-run publish repo propagation regression.',
    '--publish',
    '--dry-run',
    '--github-api-url',
    baseUrl,
    '--repo',
    REPO,
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
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

function runRepairDryRunReleaseHelper(baseUrl) {
  const args = [
    path.join(ROOT, 'scripts', 'release-oss-patch.mjs'),
    '--version',
    '9.9.7',
    '--notes',
    'Dry-run repair repo propagation regression.',
    '--publish',
    '--repair-existing-release',
    '--publication-tooling-ref',
    'codex/test-release-tooling',
    '--dry-run',
    '--github-api-url',
    baseUrl,
    '--repo',
    REPO,
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
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

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (expectedOutput && !combinedOutput.includes(expectedOutput)) {
    throw new Error(`${label}: missing expected output "${expectedOutput}"\n${combinedOutput}`);
  }
}

function assertIncludesResult(result, expectedOutput, label) {
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (!combinedOutput.includes(expectedOutput)) {
    throw new Error(`${label}: missing expected output "${expectedOutput}"\n${combinedOutput}`);
  }
}

function assertNotIncludes(result, unexpectedOutput, label) {
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (combinedOutput.includes(unexpectedOutput)) {
    throw new Error(`${label}: unexpected output "${unexpectedOutput}"\n${combinedOutput}`);
  }
}

function assertOutputCount(result, expectedOutput, expectedCount, label) {
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const actualCount = combinedOutput.split(expectedOutput).length - 1;
  if (actualCount !== expectedCount) {
    throw new Error(`${label}: expected "${expectedOutput}" ${expectedCount} time(s), found ${actualCount}\n${combinedOutput}`);
  }
}

function section(content, startNeedle, endNeedle, label) {
  const start = content.indexOf(startNeedle);
  if (start < 0) {
    throw new Error(`${label}: missing start "${startNeedle}"`);
  }

  const end = content.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) {
    throw new Error(`${label}: missing end "${endNeedle}"`);
  }

  return content.slice(start, end);
}

function assertBeforeText(content, earlierNeedle, laterNeedle, label) {
  const earlierIndex = content.indexOf(earlierNeedle);
  if (earlierIndex < 0) {
    throw new Error(`${label}: missing earlier text "${earlierNeedle}"`);
  }

  const laterIndex = content.indexOf(laterNeedle);
  if (laterIndex < 0) {
    throw new Error(`${label}: missing later text "${laterNeedle}"`);
  }

  if (earlierIndex >= laterIndex) {
    throw new Error(`${label}: expected "${earlierNeedle}" before "${laterNeedle}"`);
  }
}

async function main() {
  const server = await startGithubApiFixture();
  const notesPath = path.join(ROOT, '.release', `quarantine-notes-${RELEASE_TAG}.md`);
  const secondNotesPath = path.join(ROOT, '.release', `quarantine-notes-${SECOND_RELEASE_TAG}.md`);

  try {
    const dryRunResult = await runDryRunReleaseHelper();
    assertStatus(dryRunResult, 0, 'dry-run release helper path passes');
    assertIncludesResult(
      dryRunResult,
      '[dry-run] pnpm verify:release-publication-gate',
      'dry-run release helper includes release publication gate',
    );
    assertIncludesResult(
      dryRunResult,
      '[dry-run] pnpm verify:theme-clients',
      'dry-run release helper includes theme client contracts gate',
    );
    const dryRunPublishResult = await runPublishDryRunReleaseHelper(server.baseUrl);
    assertStatus(dryRunPublishResult, 0, 'dry-run publish helper path passes');
    assertIncludesResult(
      dryRunPublishResult,
      `gh release create v9.9.8-opensource --repo ${REPO}`,
      'dry-run publish helper creates release in configured repo',
    );
    assertIncludesResult(
      dryRunPublishResult,
      `--github-api-url ${server.baseUrl}`,
      'dry-run publish helper propagates GitHub API URL to convergence verifier',
    );
    assertIncludesResult(
      dryRunPublishResult,
      `repos/${REPO}/releases/<id>`,
      'dry-run publish helper promotes stable release in configured repo',
    );
    assertIncludesResult(
      dryRunPublishResult,
      `scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --exclude-pending-release-tag v9.9.8-opensource --verify-images`,
      'dry-run publish helper audits image-aware release history before stable promotion',
    );
    assertIncludesResult(
      dryRunPublishResult,
      `scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --verify-images`,
      'dry-run publish helper audits image-aware release history after stable promotion',
    );
    const dryRunRepairResult = await runRepairDryRunReleaseHelper(server.baseUrl);
    assertStatus(dryRunRepairResult, 0, 'dry-run repair helper path passes');
    assertIncludesResult(
      dryRunRepairResult,
      `gh release view v9.9.7-opensource --repo ${REPO}`,
      'dry-run repair helper reads release from configured repo',
    );
    assertIncludesResult(
      dryRunRepairResult,
      `gh workflow run publish-self-hosted-update-feed.yml --repo ${REPO}`,
      'dry-run repair helper dispatches feed workflow in configured repo',
    );
    assertBeforeText(
      `${dryRunRepairResult.stdout}\n${dryRunRepairResult.stderr}`,
      'node scripts/verify-live-runtime-version.mjs',
      `gh workflow run publish-self-hosted-update-feed.yml --repo ${REPO}`,
      'dry-run repair helper verifies live runtime before feed dispatch',
    );
    assertBeforeText(
      `${dryRunRepairResult.stdout}\n${dryRunRepairResult.stderr}`,
      'node scripts/verify-branded-storefront-runtime.mjs',
      `gh workflow run publish-self-hosted-update-feed.yml --repo ${REPO}`,
      'dry-run repair helper verifies branded runtime before feed dispatch',
    );
    assertIncludesResult(
      dryRunRepairResult,
      `--github-api-url ${server.baseUrl}`,
      'dry-run repair helper propagates GitHub API URL to convergence verifier',
    );
    assertIncludesResult(
      dryRunRepairResult,
      `repos/${REPO}/releases/<id>`,
      'dry-run repair helper promotes stable release in configured repo',
    );
    assertIncludesResult(
      dryRunRepairResult,
      `scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --exclude-pending-release-tag v9.9.7-opensource --verify-images`,
      'dry-run repair helper audits image-aware release history before stable promotion',
    );
    assertIncludesResult(
      dryRunRepairResult,
      `scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --verify-images`,
      'dry-run repair helper audits image-aware release history after stable promotion',
    );

    fs.rmSync(notesPath, { force: true });
    const dryRunQuarantineResult = await runReleaseHelper(server.baseUrl);
    assertStatus(
      dryRunQuarantineResult,
      0,
      'dry-run quarantine path includes direct release history verifier',
      '[dry-run] node scripts/verify-release-history-availability.mjs',
    );
    assertIncludesResult(
      dryRunQuarantineResult,
      `scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --verify-images`,
      'dry-run quarantine path propagates repo and API URL to full release history verifier',
    );
    assertIncludesResult(
      dryRunQuarantineResult,
      `--release-tag ${RELEASE_TAG} --expect-quarantined`,
      'dry-run quarantine path includes targeted quarantined release verifier',
    );
    if (server.patches.length !== 0) {
      throw new Error(`Dry-run quarantine unexpectedly patched GitHub ${server.patches.length} time(s).`);
    }

    const batchDryRunQuarantineResult = await runBatchQuarantineDryRunReleaseHelper(server.baseUrl);
    assertStatus(
      batchDryRunQuarantineResult,
      0,
      'dry-run batch quarantine path passes',
      'Quarantining existing OSS patch release v1.0.32-opensource, v1.0.33-opensource',
    );
    assertIncludesResult(
      batchDryRunQuarantineResult,
      '--release-tag v1.0.32-opensource --expect-quarantined',
      'dry-run batch quarantine verifies first targeted release',
    );
    assertIncludesResult(
      batchDryRunQuarantineResult,
      '--release-tag v1.0.33-opensource --expect-quarantined',
      'dry-run batch quarantine verifies second targeted release',
    );
    assertIncludesResult(
      batchDryRunQuarantineResult,
      `deferred node scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --verify-images`,
      'dry-run batch quarantine keeps final deferred history audit',
    );
    assertOutputCount(
      batchDryRunQuarantineResult,
      `deferred node scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --verify-images`,
      1,
      'dry-run batch quarantine prints one final deferred history audit',
    );

    assertStatus(
      await runInvalidQuarantineVersionDryRunReleaseHelper(server.baseUrl),
      1,
      'dry-run quarantine rejects prerelease version tags',
      'Use core SemVer without prerelease/build metadata',
    );

    const result = await runReleaseHelper(server.baseUrl, {
      deferReleaseHistoryAvailability: true,
    });
    assertStatus(
      result,
      0,
      'token-backed deferred quarantine path passes',
      'Deferred release history availability verification',
    );
    assertIncludesResult(
      result,
      `caller must run node scripts/verify-release-history-availability.mjs --github-api-url ${server.baseUrl} --repo ${REPO} --verify-images after the batch`,
      'token-backed deferred quarantine path prints repo-aware final history command',
    );
    assertIncludesResult(
      result,
      '"quarantinedReleaseTags": [',
      'token-backed deferred quarantine path verifies targeted quarantined release',
    );
    assertIncludesResult(
      result,
      RELEASE_TAG,
      'token-backed deferred quarantine path reports the quarantined release tag',
    );

    if (server.patches.length !== 1) {
      throw new Error(`Expected one GitHub release PATCH, got ${server.patches.length}`);
    }

    const patch = server.patches[0];
    if (patch.prerelease !== true) {
      throw new Error('Quarantine PATCH did not set prerelease=true.');
    }
    if (patch.name !== `QUARANTINED: ${RELEASE_TAG}`) {
      throw new Error(`Quarantine PATCH set unexpected title: ${patch.name || '<missing>'}`);
    }
    if (!patch.body || !patch.body.includes('must not be treated as self-hosted-detectable')) {
      throw new Error('Quarantine PATCH body is missing the self-hosted-detectable contract text.');
    }
    if (!patch.body.includes('GitHub release assets: core-update-manifest.json, jiffoo-source.tar.gz, jiffoo-source.tar.gz.sha256')) {
      throw new Error('Quarantine PATCH body is missing required release asset facts.');
    }
    if (!fs.existsSync(notesPath)) {
      throw new Error('Quarantine notes file was not written for auditability.');
    }

    const batchServer = await startGithubApiFixture();
    try {
      fs.rmSync(notesPath, { force: true });
      fs.rmSync(secondNotesPath, { force: true });
      const batchResult = await runBatchQuarantineReleaseHelper(batchServer.baseUrl);
      assertStatus(
        batchResult,
        0,
        'token-backed batch quarantine path passes',
        `Quarantined release https://github.com/${REPO}/releases/tag/${SECOND_RELEASE_TAG}.`,
      );
      assertIncludesResult(
        batchResult,
        RELEASE_TAG,
        'token-backed batch quarantine reports first quarantined release tag',
      );
      assertIncludesResult(
        batchResult,
        SECOND_RELEASE_TAG,
        'token-backed batch quarantine reports second quarantined release tag',
      );
      assertOutputCount(
        batchResult,
        `caller must run node scripts/verify-release-history-availability.mjs --github-api-url ${batchServer.baseUrl} --repo ${REPO} --verify-images after the batch`,
        1,
        'token-backed batch quarantine prints one final history command',
      );
      if (batchServer.patches.length !== 2) {
        throw new Error(`Expected two GitHub release PATCHes for batch quarantine, got ${batchServer.patches.length}`);
      }

      const patchesByTag = new Map(batchServer.patches.map((item) => [item.releaseTag, item]));
      for (const releaseTag of [RELEASE_TAG, SECOND_RELEASE_TAG]) {
        const batchPatch = patchesByTag.get(releaseTag);
        if (!batchPatch) {
          throw new Error(`Missing batch quarantine PATCH for ${releaseTag}`);
        }
        if (batchPatch.prerelease !== true) {
          throw new Error(`Batch quarantine PATCH for ${releaseTag} did not set prerelease=true.`);
        }
        if (batchPatch.name !== `QUARANTINED: ${releaseTag}`) {
          throw new Error(`Batch quarantine PATCH set unexpected title for ${releaseTag}: ${batchPatch.name || '<missing>'}`);
        }
        if (!batchPatch.body || !batchPatch.body.includes('must not be treated as self-hosted-detectable')) {
          throw new Error(`Batch quarantine PATCH body is missing the self-hosted contract text for ${releaseTag}.`);
        }
      }
      if (!fs.existsSync(notesPath) || !fs.existsSync(secondNotesPath)) {
        throw new Error('Batch quarantine did not write both quarantine notes files for auditability.');
      }
    } finally {
      await batchServer.close();
    }

    const releaseHelperSource = fs.readFileSync(path.join(ROOT, 'scripts', 'release-oss-patch.mjs'), 'utf8');
    assertBeforeText(
      section(
        releaseHelperSource,
        'public self-hosted feed did not converge',
        'try {\n    updateReleaseNotes(version, options.notesPath, options);',
        'automatic feed publication quarantine path',
      ),
      'await quarantinePublishedRelease(version, message, options);',
      'verifyQuarantinedRelease(version, options);',
      'automatic feed publication quarantine verifies targeted metadata',
    );
    assertBeforeText(
      section(
        releaseHelperSource,
        'final stable publication verification failed',
        'async function repairExistingRelease',
        'automatic final publication quarantine path',
      ),
      'await quarantinePublishedRelease(version, message, options);',
      'verifyQuarantinedRelease(version, options);',
      'automatic final publication quarantine verifies targeted metadata',
    );

    console.log('Release helper quarantine regression tests passed.');
  } finally {
    fs.rmSync(notesPath, { force: true });
    fs.rmSync(secondNotesPath, { force: true });
    await server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
