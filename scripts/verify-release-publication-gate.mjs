#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(startDir) {
  let current = startDir;

  for (;;) {
    if (
      fs.existsSync(path.join(current, 'package.json'))
      && fs.existsSync(path.join(current, '.github', 'workflows'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find Jiffoo repo root from ${startDir}`);
    }
    current = parent;
  }
}

const ROOT = findRepoRoot(process.cwd());
const checks = [];

function read(relativePath) {
  const target = path.join(ROOT, relativePath);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(target, 'utf8');
}

function addCheck(name, fn) {
  checks.push({ name, fn });
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertMatches(content, pattern, label) {
  if (!pattern.test(content)) {
    throw new Error(`Missing ${label}: ${pattern}`);
  }
}

function assertNotMatches(content, pattern, label) {
  if (pattern.test(content)) {
    throw new Error(`Unexpected ${label}: ${pattern}`);
  }
}

function assertBefore(content, earlierNeedle, laterNeedle, label) {
  const earlierIndex = content.indexOf(earlierNeedle);
  if (earlierIndex < 0) {
    throw new Error(`Missing ${label} earlier step: ${earlierNeedle}`);
  }

  const laterIndex = content.indexOf(laterNeedle);
  if (laterIndex < 0) {
    throw new Error(`Missing ${label} later step: ${laterNeedle}`);
  }

  if (earlierIndex >= laterIndex) {
    throw new Error(`Invalid order for ${label}: expected "${earlierNeedle}" before "${laterNeedle}"`);
  }
}

function section(content, startNeedle, endNeedle, label) {
  const start = content.indexOf(startNeedle);
  if (start < 0) {
    throw new Error(`Missing ${label}: ${startNeedle}`);
  }

  if (!endNeedle) {
    return content.slice(start);
  }

  const end = content.indexOf(endNeedle, start + startNeedle.length);
  return end < 0 ? content.slice(start) : content.slice(start, end);
}

function assertImageAuditJobReady(job, auditNeedle, label) {
  for (const token of [
    'docker/setup-buildx-action@v3',
    'docker/login-action@v3',
    'registry: ${{ env.REGISTRY }}',
    'username: ${{ secrets.ACR_USERNAME }}',
    'password: ${{ secrets.ACR_PASSWORD }}',
  ]) {
    assertIncludes(job, token, `${label} ${token}`);
  }

  assertBefore(
    job,
    'docker/setup-buildx-action@v3',
    'docker/login-action@v3',
    `${label} buildx setup before registry login`,
  );
  assertBefore(
    job,
    'docker/login-action@v3',
    auditNeedle,
    `${label} registry login before image-aware audit`,
  );
}

addCheck('root scripts expose release and runtime quality gates', () => {
  const pkg = JSON.parse(read('package.json'));
  const scripts = pkg.scripts || {};

  for (const [name, token] of [
    ['test:update-feed-builder', 'scripts/test-build-update-feed.mjs'],
    ['test:update-feed-verifier', 'scripts/test-verify-self-hosted-update-feed.mjs'],
    ['test:public-release-convergence-verifier', 'scripts/test-verify-public-release-convergence.mjs'],
    ['test:release-history-availability-verifier', 'scripts/test-verify-release-history-availability.mjs'],
    ['test:release-helper-quarantine', 'scripts/test-release-oss-patch-quarantine.mjs'],
    ['test:live-runtime-verifier', 'scripts/test-verify-live-runtime-version.mjs'],
    ['test:branded-storefront-runtime-verifier', 'scripts/test-verify-branded-storefront-runtime.mjs'],
    ['test:admin-market-theme-upgrade', 'tests/routes/admin-market-install.test.ts'],
    ['test:shop-runtime-truth', 'storefront-runtime-source-of-truth.test.ts'],
    ['test:shop-runtime-truth', 'theme-provider-remote-runtime.test.tsx'],
    ['verify:release-quality-gates', 'scripts/run-release-quality-gates.mjs'],
    ['verify:release-publication-gate', 'scripts/verify-release-publication-gate.mjs'],
    ['verify:release-history-availability', 'scripts/verify-release-history-availability.mjs'],
    ['verify:live-runtime', 'scripts/verify-live-runtime-version.mjs'],
    ['verify:branded-storefront-runtime', 'scripts/verify-branded-storefront-runtime.mjs'],
    ['verify:admin-quality-gate', 'scripts/verify-admin-quality-gate.mjs'],
    ['verify:theme-clients', 'scripts/verify-theme-client-contracts.mjs'],
  ]) {
    assertIncludes(String(scripts[name] || ''), token, `${name} script`);
  }

  assertIncludes(
    String(scripts['verify:release-history-availability'] || ''),
    '--verify-images',
    'verify:release-history-availability image-aware script',
  );
});

addCheck('release publication checklist defines the self-hosted truth chain', () => {
  const checklist = read('docs/operations/oss-release-publication-checklist.md');
  const repairRunbook = read('docs/operations/oss-release-publication-repair-runbook.md');
  const updaterExecutable = read('docs/operations/self-hosted-updater-prd-executable.md');

  for (const token of [
    'GitHub Release exists for `v<version>-opensource` and is not quarantined',
    'Runtime images for `api`, `admin`, `shop`, and `updater` exist and use the exact `<version>` tag',
    'GitHub release assets include `core-update-manifest.json`, `jiffoo-source.tar.gz`, and `jiffoo-source.tar.gz.sha256`',
    'The public feed at `https://get.jiffoo.com/releases/core/manifest.json` serves the same `latestVersion`, `releaseTag`, `deliveryMode: image-first`, runtime images, source archive URL, and checksum URL',
    'Self-hosted detection through `/api/upgrade/version` reports the same public manifest facts',
    'Live runtime verification passes for API `APP_VERSION`, API `package_version`, and branded storefront active runtime HTML',
    'Stable promotion must reuse verified images and assets',
    'A GitHub Release alone is never enough evidence for self-hosted availability',
    'Quarantine notes must say the release must not be treated as self-hosted-detectable',
    '`get.jiffoo.com` is the public self-hosted detection source of truth',
  ]) {
    assertIncludes(checklist, token, `release publication checklist ${token}`);
  }

  assertBefore(checklist, 'GitHub Release exists', 'Runtime images for `api`', 'release checklist GitHub before images');
  assertBefore(checklist, 'Runtime images for `api`', 'GitHub release assets include', 'release checklist images before assets');
  assertBefore(checklist, 'GitHub release assets include', 'The public feed at `https://get.jiffoo.com/releases/core/manifest.json`', 'release checklist assets before public feed');
  assertBefore(checklist, 'The public feed at `https://get.jiffoo.com/releases/core/manifest.json`', 'Self-hosted detection through `/api/upgrade/version`', 'release checklist public feed before self-hosted detection');
  assertBefore(checklist, 'Self-hosted detection through `/api/upgrade/version`', 'Live runtime verification passes', 'release checklist detection before live runtime');
  assertIncludes(repairRunbook, 'docs/operations/oss-release-publication-checklist.md', 'repair runbook normal publication checklist link');
  assertIncludes(updaterExecutable, 'Published `docs/operations/oss-release-publication-checklist.md`', 'updater executable checklist completion log');
});

addCheck('OSS release workflow starts releases quarantined', () => {
  const workflow = read('.github/workflows/publish-oss-release-images.yml');
  const metadata = section(
    workflow,
    'name: Resolve target metadata',
    'name: Guard release until publication gate passes',
    'release metadata resolver',
  );
  const guard = section(
    workflow,
    'name: Guard release until publication gate passes',
    'name: Checkout release ref',
    'initial release guard',
  );

  for (const token of [
    'GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    'gh release view "$release_tag" --repo "${{ github.repository }}" --json isDraft,isPrerelease',
    'release_is_draft',
    'release_was_prerelease',
    'Release ${release_tag} is still a draft and cannot enter OSS publication.',
  ]) {
    assertIncludes(metadata, token, `release metadata quarantine guard ${token}`);
  }

  assertIncludes(guard, 'gh release edit "$RELEASE_TAG"', 'GitHub release edit before publication');
  assertIncludes(guard, '--prerelease', 'prerelease quarantine before publication');
});

addCheck('release workflows require publishable release refs', () => {
  const imageWorkflow = read('.github/workflows/publish-oss-release-images.yml');
  const feedWorkflow = read('.github/workflows/publish-self-hosted-update-feed.yml');
  const imageRefGate = section(
    imageWorkflow,
    'name: Verify release ref is publishable',
    'name: Resolve release commit sha',
    'image workflow release-ref gate',
  );
  const feedToolingGate = section(
    feedWorkflow,
    'name: Verify publication tooling ref is publishable',
    'name: Verify release archive ref exists',
    'feed workflow tooling-ref gate',
  );
  const feedArchiveGate = section(
    feedWorkflow,
    'name: Verify release archive ref exists',
    'name: Setup Node',
    'feed workflow archive-ref gate',
  );

  for (const token of [
    'apps/api/Dockerfile',
    'apps/api/Dockerfile.selfhost',
    'apps/admin/Dockerfile',
    'apps/shop/Dockerfile',
    'scripts/build-update-feed.mjs',
    'scripts/run-release-quality-gates.mjs',
    'scripts/verify-self-hosted-update-feed.mjs',
    'scripts/verify-public-release-convergence.mjs',
    'scripts/verify-release-history-availability.mjs',
    'scripts/verify-live-runtime-version.mjs',
    'scripts/verify-branded-storefront-runtime.mjs',
    'install.sh',
    'docker-compose.prod.yml',
    '.env.production.example',
    'nginx/get-jiffoo.conf',
    'Release ref is missing files required',
  ]) {
    assertIncludes(imageRefGate, token, `image workflow publishable-ref invariant ${token}`);
  }

  for (const token of [
    'apps/api/Dockerfile',
    'apps/api/Dockerfile.selfhost',
    'apps/admin/Dockerfile',
    'apps/shop/Dockerfile',
    'scripts/build-update-feed.mjs',
    'scripts/verify-self-hosted-update-feed.mjs',
    'scripts/verify-public-release-convergence.mjs',
    'scripts/verify-live-runtime-version.mjs',
    'scripts/verify-branded-storefront-runtime.mjs',
    'install.sh',
    'docker-compose.prod.yml',
    '.env.production.example',
    'nginx/get-jiffoo.conf',
    'Publication tooling ref ${TOOLING_REF} is missing files required',
  ]) {
    assertIncludes(feedToolingGate, token, `feed workflow tooling-ref invariant ${token}`);
  }

  assertIncludes(imageRefGate, 'scripts/verify-live-runtime-version.mjs', 'image workflow live runtime verifier source');
  for (const token of [
    'publication_tooling_ref:',
    'publication_tooling_ref: ${{ steps.meta.outputs.publication_tooling_ref }}',
    'publication_tooling_ref="${{ inputs.publication_tooling_ref || github.event.repository.default_branch }}"',
  ]) {
    assertIncludes(imageWorkflow, token, `image workflow publication tooling ref ${token}`);
  }
  for (const token of [
    'tooling_ref:',
    'TOOLING_REF: ${{ inputs.tooling_ref || github.event.release.tag_name || inputs.release_tag }}',
    'ref: ${{ inputs.tooling_ref || github.event.release.tag_name || inputs.release_tag }}',
  ]) {
    assertIncludes(feedWorkflow, token, `feed workflow tooling ref recovery ${token}`);
  }
  for (const token of [
    'git rev-parse -q --verify "${RELEASE_TAG}^{commit}"',
    'git fetch --force --depth=1 origin "refs/tags/${RELEASE_TAG}:refs/tags/${RELEASE_TAG}"',
    'Source archive will be generated from ${RELEASE_TAG}',
  ]) {
    assertIncludes(feedArchiveGate, token, `feed workflow archive-ref invariant ${token}`);
  }
  assertBefore(
    imageWorkflow,
    'name: Verify release ref is publishable',
    'quality-gate:',
    'image workflow publishable-ref gate before quality gates',
  );
  assertBefore(
    feedWorkflow,
    'name: Verify publication tooling ref is publishable',
    'name: Verify release archive ref exists',
    'feed workflow tooling-ref gate before archive check',
  );
  assertBefore(
    feedWorkflow,
    'name: Verify release archive ref exists',
    'name: Wait for runtime images',
    'feed workflow archive-ref gate before image verification',
  );
});

addCheck('OSS release workflow runs Admin/shop/release quality gates', () => {
  const workflow = read('.github/workflows/publish-oss-release-images.yml');
  const releaseQualityGateRunner = read('scripts/run-release-quality-gates.mjs');
  const qualityJob = section(
    workflow,
    'quality-gate:',
    'build-and-push:',
    'release quality gate job',
  );
  const quality = section(
    qualityJob,
    'name: Verify release quality gates',
    null,
    'release quality gate',
  );

  for (const token of [
    'name: Set up Docker Buildx for release history quality gate',
    'docker/setup-buildx-action@v3',
    'name: Log in to ACR for release history quality gate',
    'docker/login-action@v3',
    'registry: ${{ env.REGISTRY }}',
    'username: ${{ secrets.ACR_USERNAME }}',
    'password: ${{ secrets.ACR_PASSWORD }}',
  ]) {
    assertIncludes(qualityJob, token, `workflow release quality gate image audit setup ${token}`);
  }
  assertIncludes(quality, 'pnpm verify:release-quality-gates', 'workflow shared release quality gate');
  assertBefore(
    qualityJob,
    'name: Log in to ACR for release history quality gate',
    'name: Verify release quality gates',
    'workflow release quality gate logs into registry before shared gates',
  );

  for (const token of [
    "['pnpm', ['--filter', 'api', 'type-check']]",
    "['pnpm', ['--filter', 'shop', 'type-check']]",
    "['pnpm', ['--filter', 'admin', 'type-check']]",
    "['pnpm', ['--filter', 'admin', 'test']]",
    "['pnpm', ['verify:admin-quality-gate']]",
    "['pnpm', ['test:admin-market-theme-upgrade']]",
    "['pnpm', ['--filter', 'api', 'db:mode:test']]",
    "['pnpm', ['test:self-hosted-detection']]",
    "['pnpm', ['test:shop-runtime-truth']]",
    "['pnpm', ['test:official-artifacts']]",
    "['pnpm', ['test:updater:docker-compose']]",
    "['pnpm', ['test:update-feed-builder']]",
    "['pnpm', ['test:update-feed-verifier']]",
    "['pnpm', ['test:public-release-convergence-verifier']]",
    "['pnpm', ['test:release-history-availability-verifier']]",
    "['pnpm', ['test:release-helper-quarantine']]",
    "['pnpm', ['verify:release-history-availability']]",
    "['pnpm', ['test:live-runtime-verifier']]",
    "['pnpm', ['test:branded-storefront-runtime-verifier']]",
    "['pnpm', ['verify:release-publication-gate']]",
    "['pnpm', ['verify:theme-clients']]",
  ]) {
    assertIncludes(releaseQualityGateRunner, token, `shared release quality gate ${token}`);
  }

  for (const token of [
    'const COMMAND_FALLBACKS = new Map',
    'is not available on PATH; running local fallback',
    "['pnpm verify:release-history-availability'",
    "spec(process.execPath, ['scripts/verify-release-history-availability.mjs', '--verify-images'])",
    "spec(localBin('dotenv'),",
    "function vitestSpec",
    'function toolingNode',
    'JIFFOO_RELEASE_GATE_NODE',
    'function vitestEntrypoint',
    "path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs')",
    "['pnpm test:admin-market-theme-upgrade'",
    "'tests/routes/admin-staff.test.ts'",
    "'tests/routes/admin-market-install.test.ts'",
    "'tests/routes/market-install-binding.test.ts'",
    "'tests/core/theme-installer-upgrade.test.ts'",
    "'tests/core/theme-management-service.test.ts'",
    "'tests/routes/upgrade.test.ts'",
    "vitestSpec('shop',",
    "vitestSpec('admin',",
    'function assertReleaseHistoryAuditPreflight',
    "spawnSync('docker', ['buildx', 'version']",
    'Docker with Buildx is required before image-aware release history audit',
    "spawnSync('gh', ['auth', 'token']",
    'GitHub API authentication is required for release history audit',
    'Release quality gate preflight failed.',
    '[dry-run] release-history image audit preflight: docker buildx version + GitHub API auth',
    'assertReleaseHistoryAuditPreflight();',
  ]) {
    assertIncludes(releaseQualityGateRunner, token, `shared release quality gate fallback ${token}`);
  }

  assertBefore(
    releaseQualityGateRunner,
    'assertReleaseHistoryAuditPreflight();',
    'for (const [command, commandArgs] of RELEASE_QUALITY_GATE_COMMANDS)',
    'shared release quality gate preflights external release-history image audit before expensive local gates',
  );
});

addCheck('image-aware release workflow jobs authenticate runtime image registry', () => {
  const imageWorkflow = read('.github/workflows/publish-oss-release-images.yml');
  const feedWorkflow = read('.github/workflows/publish-self-hosted-update-feed.yml');
  const repairWorkflow = read('.github/workflows/repair-oss-release-publication.yml');

  assertImageAuditJobReady(
    section(imageWorkflow, 'quality-gate:', 'build-and-push:', 'image release quality gate job'),
    'pnpm verify:release-quality-gates',
    'image release quality gate',
  );
  assertImageAuditJobReady(
    section(imageWorkflow, 'publish-feed:', 'quarantine-failed-release:', 'image release publish-feed job'),
    '--verify-images',
    'image release publish-feed',
  );
  assertImageAuditJobReady(
    section(feedWorkflow, 'publish-update-feed:', null, 'self-hosted feed publish job'),
    '--verify-images',
    'self-hosted feed publish',
  );
  assertImageAuditJobReady(
    section(repairWorkflow, 'repair-or-quarantine:', null, 'manual repair job'),
    '--verify-images',
    'manual repair final history audit',
  );
});

addCheck('OSS release workflow requires image-first feed convergence before stability', () => {
  const workflow = read('.github/workflows/publish-oss-release-images.yml');
  const publish = section(
    workflow,
    'publish-feed:',
    'quarantine-failed-release:',
    'publish-feed job',
  );
  const finalStable = section(
    publish,
    'name: Mark release stable after publication gate',
    null,
    'final stable release gate',
  );
  const prePublicRuntime = section(
    publish,
    'name: Verify live runtime before public feed publication',
    'name: Dispatch self-hosted feed publication',
    'pre-public feed runtime gate',
  );

  for (const token of [
    "if: ${{ needs.prepare.outputs.release_was_prerelease != 'true' }}",
    'node scripts/build-update-feed.mjs',
    '--archive-ref "$RELEASE_TAG"',
    '--delivery-mode image-first',
    'node scripts/verify-self-hosted-update-feed.mjs',
    '--verify-images',
    'gh workflow run publish-self-hosted-update-feed.yml',
    'name: Checkout publication tooling ref',
    'ref: ${{ needs.prepare.outputs.publication_tooling_ref }}',
    'pnpm/action-setup@v4',
    'pnpm install --frozen-lockfile',
    'name: Verify live runtime before public feed publication',
    'git fetch --force --depth=1 origin "refs/tags/${RELEASE_TAG}:refs/tags/${RELEASE_TAG}"',
    'PUBLICATION_TOOLING_REF: ${{ needs.prepare.outputs.publication_tooling_ref }}',
    '--ref "$PUBLICATION_TOOLING_REF"',
    '-f "tooling_ref=$PUBLICATION_TOOLING_REF"',
    'allow_prerelease_publication=true',
    'quarantine_on_failure=true',
    '--github-release "$RELEASE_TAG"',
    '--public-url https://get.jiffoo.com/releases/core/manifest.json',
    '--verify-public-assets',
  ]) {
    assertIncludes(publish, token, `publish-feed invariant ${token}`);
  }
  assertBefore(
    publish,
    'name: Checkout publication tooling ref',
    'name: Build expected self-hosted feed',
    'publication tooling checkout before expected feed build',
  );
  assertBefore(
    publish,
    'pnpm install --frozen-lockfile',
    'name: Build expected self-hosted feed',
    'publish-feed installs verifier dependencies before expected feed build',
  );
  assertBefore(
    publish,
    'pnpm install --frozen-lockfile',
    'node scripts/verify-branded-storefront-runtime.mjs',
    'publish-feed installs Playwright dependencies before branded runtime verification',
  );
  assertBefore(
    publish,
    'git fetch --force --depth=1 origin "refs/tags/${RELEASE_TAG}:refs/tags/${RELEASE_TAG}"',
    '--archive-ref "$RELEASE_TAG"',
    'release archive tag fetch before expected feed build',
  );
  for (const token of [
    'JIFFOO_RELEASE_LIVE_API_URL is required before public feed publication',
    'JIFFOO_RELEASE_BRANDED_STOREFRONT_URL, JIFFOO_RELEASE_BRANDED_THEME_SLUG, and JIFFOO_RELEASE_BRANDED_THEME_VERSION are required before public feed publication',
    'node scripts/verify-live-runtime-version.mjs',
    '--base-url "$JIFFOO_RELEASE_LIVE_API_URL"',
    '--target-version "$RELEASE_TAG"',
    'node scripts/verify-branded-storefront-runtime.mjs',
    '--base-url "$JIFFOO_RELEASE_BRANDED_STOREFRONT_URL"',
    '--theme-slug "$JIFFOO_RELEASE_BRANDED_THEME_SLUG"',
    '--theme-version "$JIFFOO_RELEASE_BRANDED_THEME_VERSION"',
    '--runtime-path "$JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS"',
  ]) {
    assertIncludes(prePublicRuntime, token, `pre-public feed runtime gate ${token}`);
  }
  assertBefore(
    prePublicRuntime,
    'node scripts/verify-live-runtime-version.mjs',
    'node scripts/verify-branded-storefront-runtime.mjs',
    'pre-public API runtime before branded storefront runtime verification',
  );
  assertBefore(
    publish,
    'name: Verify live runtime before public feed publication',
    'name: Dispatch self-hosted feed publication',
    'live runtime verification before public feed dispatch',
  );

  for (const token of [
    "needs.prepare.outputs.release_was_prerelease != 'true'",
    '-F prerelease=false',
    '--require-stable-release',
    '--allow-prerelease',
    '--github-release "$RELEASE_TAG"',
    '--public-url https://get.jiffoo.com/releases/core/manifest.json',
    '--verify-images',
    '--verify-public-assets',
    'node scripts/verify-public-release-convergence.mjs',
    'node scripts/verify-release-history-availability.mjs',
    'node scripts/verify-live-runtime-version.mjs',
    'node scripts/verify-branded-storefront-runtime.mjs',
    '--runtime-path "$JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS"',
    '--exclude-pending-release-tag "$RELEASE_TAG"',
    'JIFFOO_RELEASE_LIVE_API_URL: ${{ vars.JIFFOO_RELEASE_LIVE_API_URL || secrets.JIFFOO_RELEASE_LIVE_API_URL }}',
    'JIFFOO_RELEASE_BRANDED_STOREFRONT_URL: ${{ vars.JIFFOO_RELEASE_BRANDED_STOREFRONT_URL || secrets.JIFFOO_RELEASE_BRANDED_STOREFRONT_URL }}',
    'JIFFOO_RELEASE_BRANDED_THEME_SLUG: ${{ vars.JIFFOO_RELEASE_BRANDED_THEME_SLUG || secrets.JIFFOO_RELEASE_BRANDED_THEME_SLUG }}',
    'JIFFOO_RELEASE_BRANDED_THEME_VERSION: ${{ vars.JIFFOO_RELEASE_BRANDED_THEME_VERSION || secrets.JIFFOO_RELEASE_BRANDED_THEME_VERSION }}',
    'JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS: ${{ vars.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS || secrets.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS }}',
    'JIFFOO_RELEASE_LIVE_API_URL is required for stable release promotion',
    'JIFFOO_RELEASE_BRANDED_STOREFRONT_URL, JIFFOO_RELEASE_BRANDED_THEME_SLUG, and JIFFOO_RELEASE_BRANDED_THEME_VERSION are required for stable release promotion',
  ]) {
    assertIncludes(finalStable, token, `final stable gate ${token}`);
  }
  assertBefore(
    finalStable,
    '--allow-prerelease',
    'release_id="$(gh release view "$RELEASE_TAG"',
    'prerelease public convergence before stable promotion',
  );
  assertBefore(
    finalStable,
    'node scripts/verify-live-runtime-version.mjs',
    'node scripts/verify-branded-storefront-runtime.mjs',
    'API live runtime verification before branded storefront verification',
  );
  assertBefore(
    finalStable,
    'node scripts/verify-branded-storefront-runtime.mjs',
    'release_id="$(gh release view "$RELEASE_TAG"',
    'branded storefront verification before stable promotion',
  );
  assertBefore(
    finalStable,
    '--exclude-pending-release-tag "$RELEASE_TAG"',
    'release_id="$(gh release view "$RELEASE_TAG"',
    'full history audit before stable promotion',
  );
  assertMatches(
    finalStable,
    /node scripts\/verify-release-history-availability\.mjs[\s\\]+--exclude-pending-release-tag "\$RELEASE_TAG"[\s\\]+--verify-images/,
    'image-aware full history audit before stable promotion',
  );
  assertBefore(
    finalStable,
    'release_id="$(gh release view "$RELEASE_TAG"',
    '--require-stable-release',
    'stable promotion before stable release assertion',
  );
  const afterStableAssertion = section(
    finalStable,
    '--require-stable-release',
    null,
    'final stable release assertion tail',
  );
  assertIncludes(
    afterStableAssertion,
    'node scripts/verify-release-history-availability.mjs',
    'post-promotion release history audit',
  );
  assertMatches(
    afterStableAssertion,
    /node scripts\/verify-release-history-availability\.mjs[\s\\]+--verify-images/,
    'image-aware post-promotion release history audit',
  );
  assertBefore(
    afterStableAssertion,
    'node scripts/verify-release-history-availability.mjs',
    'echo "Marked $RELEASE_TAG as stable after public self-hosted feed convergence."',
    'release history audit before stable success message',
  );
});

addCheck('OSS release workflow quarantines failed publication', () => {
  const workflow = read('.github/workflows/publish-oss-release-images.yml');
  const quarantine = section(
    workflow,
    'quarantine-failed-release:',
    null,
    'failed release quarantine job',
  );

  for (const token of [
    'needs.quality-gate.result !=',
    'needs.build-and-push.result !=',
    'needs.publish-feed.result !=',
    'branded storefront runtime verifier',
    'gh release edit "$RELEASE_TAG"',
    '--prerelease',
    '--title "QUARANTINED: $RELEASE_TAG"',
  ]) {
    assertIncludes(quarantine, token, `failed release quarantine ${token}`);
  }
});

addCheck('self-hosted feed workflow verifies images, release assets, and public assets', () => {
  const workflow = read('.github/workflows/publish-self-hosted-update-feed.yml');

  for (const token of [
    'name: Wait for runtime images',
    'docker buildx imagetools inspect "${image}"',
    'node scripts/build-update-feed.mjs',
    '--archive-ref "$RELEASE_TAG"',
    '--delivery-mode image-first',
    'name: Verify local update feed artifacts',
    '--verify-images',
    'name: Upload release assets',
    '.release/self-hosted/jiffoo-source.tar.gz',
    '.release/self-hosted/jiffoo-source.tar.gz.sha256',
    '.release/self-hosted/core-update-manifest.json',
    'name: Verify GitHub release assets',
    '--github-release "$RELEASE_TAG"',
    'name: Verify live runtime before public feed publication',
    'name: Verify public feed',
    '--public-url https://get.jiffoo.com/releases/core/manifest.json',
    '--verify-public-assets',
    'node scripts/verify-public-release-convergence.mjs',
    '--allow-prerelease',
    '--require-stable-release',
    'curl -fsSI https://get.jiffoo.com/jiffoo-source.tar.gz',
    'node scripts/verify-live-runtime-version.mjs',
    'node scripts/verify-branded-storefront-runtime.mjs',
    'node scripts/verify-release-history-availability.mjs',
  ]) {
    assertIncludes(workflow, token, `self-hosted feed invariant ${token}`);
  }
});

addCheck('self-hosted feed workflow verifies direct stable live runtime before availability', () => {
  const workflow = read('.github/workflows/publish-self-hosted-update-feed.yml');
  const directStableGuard = section(
    workflow,
    'name: Guard direct stable release until publication gate passes',
    'name: Verify direct stable runtime verification configuration',
    'direct stable release guard',
  );
  const configGate = section(
    workflow,
    'name: Verify direct stable runtime verification configuration',
    'name: Setup pnpm',
    'direct stable runtime config gate',
  );
  const dependencyStep = section(
    workflow,
    'name: Install runtime verifier dependencies',
    'name: Verify direct stable publication gate',
    'direct stable runtime verifier dependency step',
  );
  const publicationGate = section(
    workflow,
    'name: Verify direct stable publication gate',
    'name: Verify live runtime before public feed publication',
    'direct stable publication gate',
  );
  const prePublicRuntime = section(
    workflow,
    'name: Verify live runtime before public feed publication',
    'name: Set up Docker Buildx',
    'direct stable pre-public runtime gate',
  );
  const publicFeed = section(
    workflow,
    'name: Verify public feed',
    'name: Quarantine failed published release',
    'direct stable public feed verification step',
  );
  const quarantine = section(
    workflow,
    'name: Quarantine failed published release',
    null,
    'self-hosted feed quarantine step',
  );

  for (const token of [
    '[ "${ALLOW_PRERELEASE_PUBLICATION}" = "true" ]',
    'Skipping direct stable release guard for controlled prerelease feed publication.',
    'gh api \\',
    '-F prerelease=true',
    'touch .release/direct-stable-release-guarded',
    'Marked ${RELEASE_TAG} as prerelease until direct stable feed, assets, and live runtime verification pass.',
  ]) {
    assertIncludes(directStableGuard, token, `direct stable release guard ${token}`);
  }

  for (const token of [
    'JIFFOO_RELEASE_LIVE_API_URL: ${{ vars.JIFFOO_RELEASE_LIVE_API_URL || secrets.JIFFOO_RELEASE_LIVE_API_URL }}',
    'JIFFOO_RELEASE_BRANDED_STOREFRONT_URL: ${{ vars.JIFFOO_RELEASE_BRANDED_STOREFRONT_URL || secrets.JIFFOO_RELEASE_BRANDED_STOREFRONT_URL }}',
    'JIFFOO_RELEASE_BRANDED_THEME_SLUG: ${{ vars.JIFFOO_RELEASE_BRANDED_THEME_SLUG || secrets.JIFFOO_RELEASE_BRANDED_THEME_SLUG }}',
    'JIFFOO_RELEASE_BRANDED_THEME_VERSION: ${{ vars.JIFFOO_RELEASE_BRANDED_THEME_VERSION || secrets.JIFFOO_RELEASE_BRANDED_THEME_VERSION }}',
    '[ "${ALLOW_PRERELEASE_PUBLICATION}" = "true" ]',
    'Skipping direct stable live runtime configuration gate for controlled prerelease feed publication.',
    'Direct stable self-hosted feed publication requires live runtime verification configuration:',
  ]) {
    assertIncludes(configGate, token, `direct stable runtime config gate ${token}`);
  }

  for (const token of [
    'JIFFOO_RELEASE_LIVE_API_URL',
    'JIFFOO_RELEASE_BRANDED_STOREFRONT_URL',
    'JIFFOO_RELEASE_BRANDED_THEME_SLUG',
    'JIFFOO_RELEASE_BRANDED_THEME_VERSION',
  ]) {
    assertIncludes(configGate, token, `direct stable required runtime config ${token}`);
    assertIncludes(prePublicRuntime, token, `direct stable pre-public runtime verifier env ${token}`);
    assertIncludes(publicFeed, token, `direct stable runtime verifier env ${token}`);
  }

  for (const token of [
    'pnpm install --frozen-lockfile',
  ]) {
    assertIncludes(dependencyStep, token, `direct stable runtime verifier dependency ${token}`);
  }

  for (const token of [
    '[ "${ALLOW_PRERELEASE_PUBLICATION}" = "true" ]',
    'Skipping direct stable publication gate for controlled prerelease feed publication.',
    'pnpm verify:release-publication-gate',
  ]) {
    assertIncludes(publicationGate, token, `direct stable publication gate ${token}`);
  }

  for (const token of [
    'node scripts/verify-live-runtime-version.mjs',
    '--base-url "$JIFFOO_RELEASE_LIVE_API_URL"',
    '--target-version "$RELEASE_TAG"',
    'node scripts/verify-branded-storefront-runtime.mjs',
    '--base-url "$JIFFOO_RELEASE_BRANDED_STOREFRONT_URL"',
    '--theme-slug "$JIFFOO_RELEASE_BRANDED_THEME_SLUG"',
    '--theme-version "$JIFFOO_RELEASE_BRANDED_THEME_VERSION"',
    '--runtime-path "$JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS"',
    'JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS: ${{ vars.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS || secrets.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS }}',
  ]) {
    assertIncludes(prePublicRuntime, token, `direct stable pre-public runtime verifier ${token}`);
  }

  for (const token of [
    '[ "${ALLOW_PRERELEASE_PUBLICATION}" != "true" ]',
    'node scripts/verify-live-runtime-version.mjs',
    '--base-url "$JIFFOO_RELEASE_LIVE_API_URL"',
    '--target-version "$RELEASE_TAG"',
    'node scripts/verify-branded-storefront-runtime.mjs',
    '--base-url "$JIFFOO_RELEASE_BRANDED_STOREFRONT_URL"',
    '--theme-slug "$JIFFOO_RELEASE_BRANDED_THEME_SLUG"',
    '--theme-version "$JIFFOO_RELEASE_BRANDED_THEME_VERSION"',
    '--runtime-path "$JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS"',
    '--exclude-pending-release-tag "$RELEASE_TAG"',
    'JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS: ${{ vars.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS || secrets.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS }}',
    '-F prerelease=false',
    '--require-stable-release',
    'node scripts/verify-release-history-availability.mjs',
    'Marked ${RELEASE_TAG} as stable after direct stable feed, assets, and live runtime verification.',
  ]) {
    assertIncludes(publicFeed, token, `direct stable runtime verifier ${token}`);
  }

  assertBefore(
    workflow,
    'name: Guard direct stable release until publication gate passes',
    'name: Verify direct stable runtime verification configuration',
    'direct stable release guard before runtime config gate',
  );
  assertBefore(
    workflow,
    'name: Verify direct stable runtime verification configuration',
    'name: Verify direct stable publication gate',
    'direct stable runtime config gate before publication gate',
  );
  assertBefore(
    workflow,
    'name: Verify direct stable publication gate',
    'name: Verify live runtime before public feed publication',
    'direct stable publication gate before pre-public runtime verification',
  );
  assertBefore(
    workflow,
    'name: Verify live runtime before public feed publication',
    'name: Wait for runtime images',
    'direct stable live runtime before public feed image publication',
  );
  assertBefore(
    prePublicRuntime,
    'node scripts/verify-live-runtime-version.mjs',
    'node scripts/verify-branded-storefront-runtime.mjs',
    'direct stable pre-public API runtime before branded storefront runtime verification',
  );
  assertBefore(
    publicFeed,
    'node scripts/verify-public-release-convergence.mjs',
    'node scripts/verify-live-runtime-version.mjs',
    'direct stable public convergence before live runtime verification',
  );
  assertBefore(
    publicFeed,
    'node scripts/verify-live-runtime-version.mjs',
    'node scripts/verify-branded-storefront-runtime.mjs',
    'direct stable API runtime before branded storefront runtime verification',
  );
  assertBefore(
    publicFeed,
    'node scripts/verify-branded-storefront-runtime.mjs',
    '-F prerelease=false',
    'direct stable branded storefront verification before stable promotion',
  );
  assertBefore(
    publicFeed,
    '--exclude-pending-release-tag "$RELEASE_TAG"',
    '-F prerelease=false',
    'direct stable full history audit before stable promotion',
  );
  assertMatches(
    publicFeed,
    /node scripts\/verify-release-history-availability\.mjs[\s\\]+--exclude-pending-release-tag "\$RELEASE_TAG"[\s\\]+--verify-images/,
    'direct stable image-aware full history audit before stable promotion',
  );
  assertBefore(
    publicFeed,
    '-F prerelease=false',
    '--require-stable-release',
    'direct stable release promotion before final stable verification',
  );
  const afterDirectStableAssertion = section(
    publicFeed,
    '--require-stable-release',
    null,
    'direct stable release assertion tail',
  );
  assertIncludes(
    afterDirectStableAssertion,
    'node scripts/verify-release-history-availability.mjs',
    'direct stable post-promotion release history audit',
  );
  assertMatches(
    afterDirectStableAssertion,
    /node scripts\/verify-release-history-availability\.mjs[\s\\]+--verify-images/,
    'direct stable image-aware post-promotion release history audit',
  );
  assertBefore(
    afterDirectStableAssertion,
    'node scripts/verify-release-history-availability.mjs',
    'Marked ${RELEASE_TAG} as stable after direct stable feed, assets, and live runtime verification.',
    'direct stable release history audit before final availability message',
  );
  assertIncludes(quarantine, 'live runtime verification: API APP_VERSION/package_version and branded storefront active runtime', 'direct stable runtime failure quarantine note');
  assertIncludes(quarantine, "if [ \"${QUARANTINE_ON_FAILURE}\" = \"true\" ]; then", 'explicit quarantine-on-failure switch');
  assertIncludes(quarantine, 'if [ -f .release/direct-stable-release-guarded ]; then', 'direct stable guard marker quarantine switch');
  assertIncludes(quarantine, 'Skipping release quarantine because quarantine_on_failure is false and the direct stable guard did not touch ${RELEASE_TAG}.', 'unmarked failure quarantine skip');
});

addCheck('self-hosted feed workflow rejects quarantined releases before public feed publication', () => {
  const imageWorkflow = read('.github/workflows/publish-oss-release-images.yml');
  const feedWorkflow = read('.github/workflows/publish-self-hosted-update-feed.yml');
  const releaseGuard = section(
    feedWorkflow,
    'name: Verify GitHub release is publishable',
    'name: Setup Node',
    'self-hosted release publishability guard',
  );

  for (const token of [
    'allow_prerelease_publication:',
    "ALLOW_PRERELEASE_PUBLICATION: ${{ inputs.allow_prerelease_publication || 'false' }}",
    'gh release view "$RELEASE_TAG" --repo "${{ github.repository }}" --json tagName,isDraft,isPrerelease,name,body',
    'Refusing to publish draft release ${RELEASE_TAG} to get.jiffoo.com.',
    'Refusing to publish quarantined release ${RELEASE_TAG} to get.jiffoo.com.',
    'Refusing to publish prerelease/quarantined release ${RELEASE_TAG} to the stable self-hosted feed.',
    'Only the primary release image workflow may set allow_prerelease_publication=true',
  ]) {
    assertIncludes(feedWorkflow, token, `feed prerelease guard ${token}`);
  }

  for (const token of [
    'isDraft',
    'isPrerelease',
    'release_name',
    'release_body',
    'QUARANTINED:*',
    'must not be treated as self-hosted-detectable',
    '[ "${ALLOW_PRERELEASE_PUBLICATION}" != "true" ]',
  ]) {
    assertIncludes(releaseGuard, token, `feed release guard ${token}`);
  }

  assertIncludes(imageWorkflow, '-f "allow_prerelease_publication=true"', 'primary release workflow controlled prerelease feed opt-in');
  assertIncludes(feedWorkflow, '-F prerelease=true', 'direct feed publication guarded as prerelease before publication');
  assertIncludes(feedWorkflow, '-F prerelease=false', 'direct feed publication stable promotion after runtime verification');
  assertIncludes(feedWorkflow, '--require-stable-release', 'direct feed publication final stable release verification');
  assertIncludes(feedWorkflow, 'public_convergence_args=(--allow-prerelease)', 'guarded prerelease convergence verification');
  assertBefore(
    feedWorkflow,
    'name: Verify GitHub release is publishable',
    'name: Wait for runtime images',
    'release publishability guard before image waits',
  );
  assertBefore(
    feedWorkflow,
    'name: Verify GitHub release is publishable',
    'name: Deploy update feed to get.jiffoo.com',
    'release publishability guard before public deployment',
  );
});

addCheck('self-hosted feed workflow can quarantine failed publications', () => {
  const workflow = read('.github/workflows/publish-self-hosted-update-feed.yml');
  const quarantine = section(
    workflow,
    'name: Quarantine failed published release',
    null,
    'self-hosted failed publication quarantine',
  );

  for (const token of [
    'if: ${{ failure() }}',
    'should_quarantine=0',
    "if [ \"${QUARANTINE_ON_FAILURE}\" = \"true\" ]; then",
    'if [ -f .release/direct-stable-release-guarded ]; then',
    'gh release edit "$RELEASE_TAG"',
    '--prerelease',
    '--title "QUARANTINED: $RELEASE_TAG"',
  ]) {
    assertIncludes(quarantine, token, `self-hosted quarantine ${token}`);
  }
});

addCheck('feed verifier rejects stale public source archives by hash', () => {
  const verifier = read('scripts/verify-self-hosted-update-feed.mjs');
  const regression = read('scripts/test-verify-self-hosted-update-feed.mjs');

  assertIncludes(verifier, 'sha256PublicAsset', 'public archive hash check');
  assertIncludes(verifier, 'Public source archive checksum mismatch', 'public archive mismatch failure');
  assertIncludes(verifier, 'function getRuntimeImageTag', 'self-hosted verifier exact runtime image tag parser');
  assertIncludes(verifier, 'must use exact tag', 'self-hosted verifier exact runtime image tag failure');
  assertIncludes(verifier, 'Docker is required for --verify-images', 'self-hosted verifier explains missing Docker');
  assertIncludes(verifier, 'result.error?.code === \'ENOENT\'', 'self-hosted verifier detects missing Docker binary');
  assertIncludes(regression, 'missing GitHub release asset fails', 'missing release asset regression');
  assertIncludes(regression, 'missing image-first runtime image metadata fails', 'missing image metadata regression');
  assertIncludes(regression, 'partial image-first runtime image tag fails', 'partial runtime image tag regression');
  assertIncludes(regression, 'image-aware skip-local manifest explains missing Docker', 'self-hosted missing Docker regression');
  assertIncludes(regression, 'skip-local legacy delivery mode manifest fails', 'legacy local delivery mode regression');
  assertIncludes(regression, 'Legacy image deliveryMode is no longer publishable', 'legacy delivery mode failure message');
  assertIncludes(regression, 'stale public source archive fails', 'stale public archive regression');
});

addCheck('update feed builder content-addresses default public archive URLs', () => {
  const builder = read('scripts/build-update-feed.mjs');
  const regression = read('scripts/test-build-update-feed.mjs');

  assertIncludes(builder, 'function withContentCacheKey', 'content cache key helper');
  assertIncludes(builder, 'function getRuntimeImageTag', 'update feed builder exact runtime image tag parser');
  assertIncludes(builder, 'must use exact tag', 'update feed builder exact runtime image tag failure');
  assertIncludes(builder, "url.searchParams.set('sha256', checksum)", 'archive sha256 cache key');
  assertIncludes(builder, 'deriveChecksumUrl(sourceArchiveUrl)', 'checksum URL derived from content-addressed archive URL');
  assertIncludes(regression, 'https://get.jiffoo.com/jiffoo-source.tar.gz?sha256=${defaultChecksum}', 'default archive cache-key regression');
  assertIncludes(regression, 'https://get.jiffoo.com/jiffoo-source.tar.gz.sha256?sha256=${defaultChecksum}', 'default checksum cache-key regression');
  assertIncludes(regression, "manifest.sourceArchiveUrl, 'https://example.test/jiffoo-source.tar.gz'", 'explicit archive URL compatibility regression');
  assertIncludes(regression, 'self-hosted-invalid-image-tag', 'update feed builder partial runtime image tag regression');
});

addCheck('public convergence verifier rejects legacy delivery mode feeds', () => {
  const verifier = read('scripts/verify-public-release-convergence.mjs');
  const regression = read('scripts/test-verify-public-release-convergence.mjs');

  assertIncludes(verifier, 'process.env.GH_TOKEN', 'public convergence GH_TOKEN fallback');
  assertIncludes(verifier, "spawnSync('gh', ['auth', 'token']", 'public convergence local gh auth fallback');
  assertIncludes(regression, 'GH_TOKEN authenticates GitHub release API requests', 'public convergence auth fallback regression');
  assertIncludes(verifier, 'Legacy image deliveryMode is no longer publishable', 'public legacy delivery mode failure');
  assertIncludes(verifier, 'QUARANTINED:', 'public convergence quarantine title rejection');
  assertIncludes(verifier, 'must not be treated as self-hosted-detectable', 'public convergence quarantine body rejection');
  assertIncludes(verifier, 'is quarantined and must not be published', 'public convergence quarantine failure message');
  assertIncludes(verifier, 'function getRuntimeImageTag', 'public convergence exact runtime image tag parser');
  assertIncludes(verifier, 'must use exact tag', 'public convergence exact runtime image tag failure');
  assertIncludes(verifier, 'Docker is required for --verify-images', 'public convergence explains missing Docker');
  assertIncludes(verifier, 'result.error?.code === \'ENOENT\'', 'public convergence detects missing Docker binary');
  assertIncludes(regression, 'legacy public delivery mode fails', 'public legacy delivery mode regression');
  assertIncludes(regression, 'quarantined prerelease public convergence fails even with prerelease opt-in', 'public convergence quarantined prerelease regression');
  assertIncludes(regression, 'partial public runtime image tag fails', 'public convergence partial runtime image tag regression');
  assertIncludes(regression, 'image-aware public convergence explains missing Docker', 'public convergence missing Docker regression');
  assertIncludes(regression, 'Legacy image deliveryMode is no longer publishable', 'public legacy delivery mode failure message');
});

addCheck('release history verifier audits explicit quarantine metadata', () => {
  const verifier = read('scripts/verify-release-history-availability.mjs');
  const regression = read('scripts/test-verify-release-history-availability.mjs');
  const releaseHelper = read('scripts/release-oss-patch.mjs');
  const releaseQualityGateRunner = read('scripts/run-release-quality-gates.mjs');

  for (const token of [
    'function shouldAuditQuarantine',
    'function auditQuarantinedRelease',
    'function excludePendingRelease',
    '--expect-quarantined requires --release-tag',
    '--exclude-pending-release-tag cannot be combined with --release-tag',
    'stable releases must be audited',
    'Release publication blocked',
    'quarantined release title must start with QUARANTINED',
    'not self-hosted-detectable',
    'must not be treated',
    'auditedQuarantinedReleases',
    'excludedPendingReleaseTag',
    'function assertRuntimeImagesAvailable',
    'function validateSourceArchiveChecksum',
    'function parseChecksum',
    'source archive checksum mismatch',
    'DEFAULT_PUBLIC_MANIFEST_URL',
    'function auditPublicFeedConvergence',
    'Manifest drift detected between latest audited GitHub release asset',
    'verifiedPublicFeed',
    "verifyImages: args['verify-images'] === 'true'",
    'verifiedImages',
    'function getRuntimeImageTag',
    'must use exact tag',
    'GitHub API rate limit blocked the release availability audit',
    'Set GITHUB_TOKEN or GH_TOKEN',
    'Docker is required for --verify-images',
    'result.error?.code === \'ENOENT\'',
    'DEFAULT_FETCH_RETRIES',
    'DEFAULT_FETCH_TIMEOUT_MS',
    'function isRetryableFetchStatus',
    'function isRetryableFetchError',
    'function formatFetchFailure',
    'timed out',
    '--fetch-retry-delay-ms',
    '--fetch-timeout-ms',
    'function buildRemediationGuide',
    'function isTransientAvailabilityIssue',
    'Transient fetch failures: retry the audit before mutating release state',
    'check GitHub release asset download/CDN availability',
    'Repair OSS Release Publication',
    'const versionsValue = releaseVersions.join(\',\');',
    '--version ${versionsValue}',
    '--quarantine-existing-release',
    'After all release mutations',
  ]) {
    assertIncludes(verifier, token, `release history quarantine verifier ${token}`);
  }

  for (const token of [
    'createQuarantinedRelease',
    'pending prerelease can be excluded from pre-promotion history audit',
    'stable release cannot be excluded from history audit',
    'missing pending release exclusion fails',
    'image-aware release history passes with available images',
    'image-aware release history fails when a runtime image is unavailable',
    'modern prerelease without quarantine metadata fails',
    'modern stable release public feed drift fails',
    'explicit stable release tag audit skips latest public feed comparison',
    'modern stable release partial runtime image tag fails',
    'explicit prerelease release audit fails',
    'explicit quarantined release audit passes',
    'stable release fails quarantined expectation',
    'expect quarantined requires explicit release tag',
    'GitHub API rate limit explains token requirement',
    'image-aware release history explains missing Docker',
    'modern stable release failure prints workflow remediation',
    'modern stable release failure prints local quarantine fallback',
    'modern stable release invalid checksum asset fails',
    'transient checksum asset fetch failure still fails the audit',
    'transient checksum asset fetch failure does not recommend quarantine',
    'transient checksum asset fetch failure retries before succeeding',
    'slow checksum asset fetch timeout is classified as transient',
    'modern stable release source archive checksum mismatch fails',
    'multi-release stable failure prints batch local quarantine fallback',
    'multi-release stable failure preserves batch workflow version order',
  ]) {
    assertIncludes(regression, token, `release history quarantine regression ${token}`);
  }

  assertIncludes(releaseQualityGateRunner, "['pnpm', ['test:release-history-availability-verifier']]", 'shared gate release history regression');
  assertIncludes(releaseQualityGateRunner, "['pnpm', ['test:release-helper-quarantine']]", 'shared gate quarantine regression');
  assertIncludes(releaseQualityGateRunner, "['pnpm', ['verify:release-history-availability']]", 'shared gate live release history verifier');
  assertIncludes(releaseQualityGateRunner, "['scripts/verify-release-history-availability.mjs', '--verify-images']", 'shared gate image-aware release history fallback');
  assertIncludes(releaseHelper, 'scripts/run-release-quality-gates.mjs', 'release helper publishes shared quality gate runner');
});

addCheck('local OSS release helper can quarantine existing bad releases', () => {
  const releaseHelper = read('scripts/release-oss-patch.mjs');
  const quarantineRegression = read('scripts/test-release-oss-patch-quarantine.mjs');
  const quarantinePath = section(
    releaseHelper,
    'async function quarantineExistingRelease',
    'async function main()',
    'release helper quarantine existing path',
  );
  const quarantineHelper = section(
    releaseHelper,
    'async function quarantinePublishedRelease',
    'async function waitPromoteAndVerifyRelease',
    'release helper quarantine implementation',
  );

  for (const token of [
    '--quarantine-existing-release',
    '--defer-release-history-availability',
    '--github-api-url',
    '--repo thefreelight/Jiffoo',
    'Stable releases are missing required self-hosted assets.',
    'async function quarantineExistingRelease',
    'async function quarantinePublishedRelease',
    'function parseVersionList',
    'function assertCoreSemver',
    'coreOnly: quarantineExisting',
    'Use core SemVer without prerelease/build metadata',
    'function resolveGithubToken',
    'function getGithubReleaseByTag',
    'function patchGithubRelease',
    'function verifyReleaseHistoryAvailability',
    'function getReleaseHistoryAvailabilityArgs',
    "args.push('--verify-images')",
    'excludePendingReleaseTag',
    'function formatNodeCommand',
    'function verifyQuarantinedRelease',
    '--expect-quarantined',
    'quarantineExisting && !publish',
    'repairExisting && quarantineExisting',
    '--repair-existing-release and --quarantine-existing-release are mutually exclusive.',
    '--version accepts multiple values only with --quarantine-existing-release.',
    '--repair-existing-release accepts exactly one version; use --quarantine-existing-release for batch isolation.',
    '--quarantine-existing-release must be used with --publish',
    '--defer-release-history-availability can only be used with --quarantine-existing-release.',
    'Batch --quarantine-existing-release requires --defer-release-history-availability',
    '!skipChecks && !quarantineExisting',
    'defaultNote: quarantineExisting',
    'suppressDeferredHistoryMessage',
  ]) {
    assertIncludes(releaseHelper, token, `release helper quarantine existing ${token}`);
  }

  for (const token of [
    '[dry-run] GET ${githubOptions.apiUrl}/repos/${githubOptions.repo}/releases/tags/${releaseTag}',
    '[dry-run] PATCH ${githubOptions.apiUrl}/repos/${githubOptions.repo}/releases/<id>',
    'verifyQuarantinedRelease(version, {',
    'deferred ${formatNodeCommand(getReleaseHistoryAvailabilityArgs(options))}',
    'verifyReleaseHistoryAvailability(true, options)',
    'await quarantinePublishedRelease(version, reason, options);',
    'verifyQuarantinedRelease(version, options);',
    'options.deferReleaseHistoryAvailability',
    'verifyReleaseHistoryAvailability(false, options)',
  ]) {
    assertIncludes(quarantinePath, token, `release helper quarantine path ${token}`);
  }

  for (const token of [
    'const token = resolveGithubToken();',
    'await getGithubReleaseByTag(releaseTag, githubOptions, token)',
    'await patchGithubRelease(',
    'prerelease: true',
    'name: `QUARANTINED: ${releaseTag}`',
    'body: notes',
    'GH_TOKEN/GITHUB_TOKEN or an authenticated gh CLI is required',
  ]) {
    assertIncludes(quarantineHelper, token, `release helper quarantine implementation ${token}`);
  }

  for (const token of [
    'startGithubApiFixture',
    'GITHUB_TOKEN: \'fake-token\'',
    'Expected one GitHub release PATCH',
    'prerelease !== true',
    'QUARANTINED: ${RELEASE_TAG}',
    'must not be treated as self-hosted-detectable',
    'dry-run quarantine path includes direct release history verifier',
    'dry-run quarantine path propagates repo and API URL to full release history verifier',
    'dry-run publish helper audits image-aware release history before stable promotion',
    'dry-run publish helper audits image-aware release history after stable promotion',
    'dry-run repair helper audits image-aware release history before stable promotion',
    'dry-run repair helper audits image-aware release history after stable promotion',
    'dry-run quarantine path includes targeted quarantined release verifier',
    'dry-run batch quarantine path passes',
    'dry-run batch quarantine verifies first targeted release',
    'dry-run batch quarantine verifies second targeted release',
    'dry-run batch quarantine keeps final deferred history audit',
    'dry-run batch quarantine prints one final deferred history audit',
    'dry-run quarantine rejects prerelease version tags',
    'token-backed batch quarantine path passes',
    'token-backed batch quarantine reports first quarantined release tag',
    'token-backed batch quarantine reports second quarantined release tag',
    'token-backed batch quarantine prints one final history command',
    'Expected two GitHub release PATCHes for batch quarantine',
    'Batch quarantine did not write both quarantine notes files for auditability.',
    '[dry-run] node scripts/verify-release-history-availability.mjs',
    '"quarantinedReleaseTags": [',
    'token-backed deferred quarantine path verifies targeted quarantined release',
    'token-backed deferred quarantine path prints repo-aware final history command',
    'dry-run publish helper creates release in configured repo',
    'dry-run publish helper propagates GitHub API URL to convergence verifier',
    'dry-run publish helper promotes stable release in configured repo',
    'dry-run repair helper reads release from configured repo',
    'dry-run repair helper dispatches feed workflow in configured repo',
    'dry-run repair helper propagates GitHub API URL to convergence verifier',
    'dry-run repair helper promotes stable release in configured repo',
    'Deferred release history availability verification',
  ]) {
    assertIncludes(quarantineRegression, token, `release helper quarantine regression ${token}`);
  }

  assertBefore(
    quarantinePath,
    'await quarantinePublishedRelease(version, reason, options);',
    'verifyQuarantinedRelease(version, options);',
    'release helper verifies targeted quarantine after mutation',
  );
  assertBefore(
    quarantinePath,
    'verifyQuarantinedRelease(version, options);',
    'verifyReleaseHistoryAvailability(false, options)',
    'release helper verifies history after quarantine',
  );
});

addCheck('manual OSS release repair workflow uses hardened release helper', () => {
  const workflow = read('.github/workflows/repair-oss-release-publication.yml');
  const runbook = read('docs/operations/oss-release-publication-repair-runbook.md');
  const repairStep = section(
    workflow,
    'name: Repair or quarantine release',
    'name: Verify release history after repair',
    'manual release repair step',
  );
  const quarantineBranch = section(
    repairStep,
    'quarantine)',
    ';;',
    'manual release quarantine branch',
  );

  for (const token of [
    'workflow_dispatch:',
    'type: choice',
    '- quarantine',
    '- repair',
    'Quarantine may use comma-separated versions',
    'permissions:',
    'actions: write',
    'contents: write',
    'GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    'GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    'REGISTRY: crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com',
    'IMAGE_NAMESPACE: jiffoo-oss',
    'JIFFOO_RELEASE_LIVE_API_URL: ${{ vars.JIFFOO_RELEASE_LIVE_API_URL || secrets.JIFFOO_RELEASE_LIVE_API_URL }}',
    'JIFFOO_RELEASE_BRANDED_STOREFRONT_URL: ${{ vars.JIFFOO_RELEASE_BRANDED_STOREFRONT_URL || secrets.JIFFOO_RELEASE_BRANDED_STOREFRONT_URL }}',
    'JIFFOO_RELEASE_BRANDED_THEME_SLUG: ${{ vars.JIFFOO_RELEASE_BRANDED_THEME_SLUG || secrets.JIFFOO_RELEASE_BRANDED_THEME_SLUG }}',
    'JIFFOO_RELEASE_BRANDED_THEME_VERSION: ${{ vars.JIFFOO_RELEASE_BRANDED_THEME_VERSION || secrets.JIFFOO_RELEASE_BRANDED_THEME_VERSION }}',
    'JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS: ${{ vars.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS || secrets.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS }}',
    'pnpm test:release-helper-quarantine',
    'pnpm test:release-history-availability-verifier',
    'node scripts/run-release-quality-gates.mjs --dry-run',
    'pnpm verify:release-publication-gate',
    'docker/setup-buildx-action@v3',
    'name: Log in to ACR for release history image audit',
    'docker/login-action@v3',
    'registry: ${{ env.REGISTRY }}',
    'username: ${{ secrets.ACR_USERNAME }}',
    'password: ${{ secrets.ACR_PASSWORD }}',
    'node scripts/verify-release-history-availability.mjs --verify-images',
    '--release-tag "v${release_version}-opensource"',
    '--expect-quarantined',
  ]) {
    assertIncludes(workflow, token, `manual release repair workflow ${token}`);
  }

  for (const token of [
    '--quarantine-existing-release',
    '--defer-release-history-availability',
    'mapfile -t versions',
    'declare -A seen_versions=()',
    'Use core SemVer without v/-opensource',
    'Duplicate release version',
    'versions_value="$(IFS=,; printf \'%s\' "${versions[*]}")"',
    '--version "$versions_value"',
    'for release_version in "${versions[@]}"; do',
    'Repair action accepts exactly one version; use quarantine for batch isolation.',
    '--release-tag "v${release_version}-opensource"',
    '--expect-quarantined',
    '--repair-existing-release',
    '--publication-tooling-ref "$PUBLICATION_TOOLING_REF"',
    '--live-api-url "$JIFFOO_RELEASE_LIVE_API_URL"',
    '--branded-storefront-url "$JIFFOO_RELEASE_BRANDED_STOREFRONT_URL"',
    '--branded-theme-slug "$JIFFOO_RELEASE_BRANDED_THEME_SLUG"',
    '--branded-theme-version "$JIFFOO_RELEASE_BRANDED_THEME_VERSION"',
    '--branded-runtime-paths "$JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS"',
    'Repairing an existing release requires live runtime verification configuration:',
  ]) {
    assertIncludes(repairStep, token, `manual release repair helper invocation ${token}`);
  }

  assertBefore(
    workflow,
    'pnpm verify:release-publication-gate',
    'name: Set up Docker Buildx for release history image audit',
    'manual repair verifies release gate before image-audit setup',
  );
  assertBefore(
    workflow,
    'name: Set up Docker Buildx for release history image audit',
    'name: Log in to ACR for release history image audit',
    'manual repair sets up buildx before registry login',
  );
  assertBefore(
    workflow,
    'name: Log in to ACR for release history image audit',
    'name: Repair or quarantine release',
    'manual repair logs into registry before release helper image checks',
  );
  assertBefore(
    workflow,
    'name: Repair or quarantine release',
    'name: Verify release history after repair',
    'manual repair mutates before final image-aware history verification',
  );
  assertBefore(
    repairStep,
    '--defer-release-history-availability',
    '--expect-quarantined',
    'manual quarantine verifies each release after mutation',
  );
  assertBefore(
    quarantineBranch,
    '--version "$versions_value"',
    'for release_version in "${versions[@]}"; do',
    'manual quarantine uses batch helper before targeted verification loop',
  );

  for (const token of [
    'Repair OSS Release Publication',
    'core SemVer only',
    'duplicates are rejected',
    '--expect-quarantined',
    'verifies each quarantined tag',
    'pass the same `--repo`',
    '`--github-api-url` values',
    '1.0.32',
    '--version 1.0.32',
    'Existing stable release failed the self-hosted publication contract and is not self-hosted-detectable.',
    '--defer-release-history-availability',
    'node scripts/verify-release-history-availability.mjs --exclude-pending-release-tag <release-tag> --verify-images',
    'node scripts/verify-release-history-availability.mjs --verify-images',
    'pnpm verify:release-history-availability',
    'GITHUB_TOKEN=... node scripts/verify-release-history-availability.mjs',
    'GITHUB_TOKEN=... node scripts/verify-release-history-availability.mjs --verify-images',
    'Local image-aware audits require Docker Buildx and ACR credentials',
    'docker buildx version',
    'docker login crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com',
    'Current bounded public metadata audit on 2026-06-08',
    '`v1.0.32-opensource` is still a stable-looking GitHub release with no',
    '`v1.0.33-opensource`, `v1.0.34-opensource`, and `v1.0.35-opensource`',
    'transient GitHub release asset fetch failures',
    '`v1.0.36-opensource` is already `QUARANTINED`',
    '`v1.0.37-opensource` is already `QUARANTINED` with no release assets',
    'QUARANTINED: <release-tag>',
  ]) {
    assertIncludes(runbook, token, `manual release repair runbook ${token}`);
  }
});

addCheck('live runtime verifier checks APP_VERSION and package version', () => {
  const health = read('apps/api/src/utils/health-check.ts');
  const runtimeInfo = read('apps/api/src/utils/runtime-build-info.ts');
  const verifier = read('scripts/verify-live-runtime-version.mjs');
  const regression = read('scripts/test-verify-live-runtime-version.mjs');
  const selfhostDockerfile = read('apps/api/Dockerfile.selfhost');

  assertIncludes(health, 'package_version: runtimeBuildInfo.packageVersion', 'health package version field');
  assertIncludes(runtimeInfo, 'findWorkspacePackageJson', 'runtime package version resolver');
  assertIncludes(verifier, "assertVersionField(health, 'version'", 'live verifier APP_VERSION check');
  assertIncludes(verifier, "assertVersionField(health, 'package_version'", 'live verifier package version check');
  assertIncludes(regression, 'APP_VERSION mismatch fails', 'live verifier app version regression');
  assertIncludes(regression, 'package version mismatch fails', 'live verifier package version regression');
  assertIncludes(regression, 'missing package version fails', 'live verifier missing package version regression');
  assertIncludes(selfhostDockerfile, 'ARG APP_VERSION=1.0.0', 'self-host Dockerfile APP_VERSION arg');
  assertIncludes(selfhostDockerfile, 'ENV APP_VERSION=${APP_VERSION}', 'self-host Dockerfile APP_VERSION env');
});

addCheck('storefront runtime gate forbids host-domain theme rewrites', () => {
  const shopRootLayout = read('apps/shop/app/layout.tsx');
  const serverStoreContext = read('apps/shop/lib/server-store-context.ts');
  const storeContext = read('apps/shop/lib/store-context.ts');
  const storeContextProvider = read('apps/shop/components/store-context-provider.tsx');
  const activeThemeLoader = read('apps/shop/lib/theme-pack/loader.ts');
  const renderingMode = read('apps/shop/lib/theme-pack/rendering-mode.ts');
  const themeProvider = read('apps/shop/lib/themes/provider.tsx');
  const remoteRuntimeLoader = read('apps/shop/lib/themes/remote-runtime.ts');
  const renderingModeTest = read('apps/shop/tests/themes/theme-pack-rendering-mode.test.ts');
  const themePackLoaderTest = read('apps/shop/tests/themes/theme-pack-loader.test.ts');
  const runtimeTest = read('apps/shop/tests/themes/storefront-runtime-source-of-truth.test.ts');
  const storeContextProviderTest = read('apps/shop/tests/themes/store-context-provider.test.tsx');
  const remoteRuntimeTest = read('apps/shop/tests/themes/theme-provider-remote-runtime.test.tsx');
  const remoteRuntimeIdentityTest = read('apps/shop/tests/themes/remote-runtime-identity.test.ts');
  const registryVersionTest = read('apps/shop/tests/themes/esim-mall-runtime-registry.test.ts');
  const officialArtifactBuilder = read('apps/api/scripts/build-official-artifacts.ts');
  const officialArtifactBuilderTest = read('apps/api/tests/core/official-artifact-builder.test.ts');
  const officialCatalog = read('packages/shared/src/extensions/official-catalog.ts');
  const bokmooThemeManifest = read('packages/shop-themes/bokmoo/theme-pack/theme.json');
  const brandedRuntimeVerifier = read('scripts/verify-branded-storefront-runtime.mjs');
  const brandedRuntimeVerifierTest = read('scripts/test-verify-branded-storefront-runtime.mjs');

  assertIncludes(shopRootLayout, "import '@/styles/globals.css';", 'global platform stylesheet import');
  assertNotMatches(shopRootLayout, /@shop-themes\/[^'"]+\/tokens\.css/, 'host-bundled theme tokens import');
  assertIncludes(serverStoreContext, 'return context;', 'raw API server store context return');
  assertMatches(serverStoreContext, /const context = data\.data as ServerStoreContext;\s*return context;/s, 'unmodified server store context return');
  assertMatches(storeContext, /return\s+\{\s*context\s*\}/s, 'raw API store context return');
  assertIncludes(storeContextProvider, 'Theme/runtime identity is owned by the API/SSR context', 'store context provider API-owned identity comment');
  assertNotMatches(storeContextProvider, /sessionStorage\.getItem\(['"]store-context['"]\)/, 'store context provider stale sessionStorage hydration');
  assertIncludes(activeThemeLoader, 'return (response.data || null) as ActiveTheme | null;', 'raw API active theme return');
  assertIncludes(activeThemeLoader, 'function isManifestIdentityValid', 'theme pack loader manifest identity validator');
  assertIncludes(activeThemeLoader, 'Ignoring manifest version mismatch', 'theme pack loader stale version rejection');
  assertIncludes(activeThemeLoader, 'Ignoring manifest slug mismatch', 'theme pack loader stale slug rejection');
  assertIncludes(renderingMode, 'if (options.serverThemeSlug && isBuiltinFallbackSlug(options.serverThemeSlug))', 'builtin-only server renderer fallback');
  assertIncludes(renderingMode, 'if (options.serverThemeSlug) {\n    return null;\n  }', 'non-builtin server renderer hold');
  assertNotMatches(renderingMode, /activeThemeIsEmbeddedOfficial[\s\S]*return options\.activeThemeSlug;/, 'active official-market host renderer shortcut');

  assertIncludes(renderingModeTest, 'does not mount non-builtin server theme slugs before active theme metadata loads', 'non-builtin server fallback regression');
  assertIncludes(renderingModeTest, 'does not resolve same-slug host renderers for installed official themes without runtime bundles', 'installed official no-runtime host renderer regression');
  assertIncludes(renderingModeTest, 'does not use approved active embedded renderers while manifest metadata is still loading', 'official metadata loading host renderer regression');
  assertIncludes(themePackLoaderTest, 'rejects stale manifests whose declared version does not match the active installed version', 'theme pack loader stale version regression');
  assertIncludes(themePackLoaderTest, 'does not cache a rejected versioned manifest', 'theme pack loader rejected manifest cache regression');
  assertIncludes(themePackLoaderTest, 'rejects manifests whose declared slug does not match the active installed slug', 'theme pack loader stale slug regression');
  assertIncludes(runtimeTest, 'returns the API store context unchanged', 'store context source-of-truth test');
  assertIncludes(runtimeTest, 'returns the API active theme unchanged', 'active theme source-of-truth test');
  assertIncludes(storeContextProviderTest, 'does not hydrate a stale sessionStorage theme before the API context resolves', 'store context stale session storage regression');
  assertIncludes(storeContextProviderTest, 'expect(screen.queryByTestId(\'theme-provider\')).toBeNull()', 'store context no pre-API theme renderer assertion');
  assertIncludes(themeProvider, 'cacheKey = `runtime:${remoteRuntime.slug}:${remoteRuntime.version}`;', 'remote runtime slug+version cache key');
  assertIncludes(themeProvider, 'getRuntimeJsUrl(themePack.activeTheme.slug || normalizedSlug, themePack.manifest, themePack.activeTheme.version)', 'remote runtime versioned URL resolution');
  assertIncludes(themeProvider, 'expectedIdentity: {', 'remote runtime active identity propagation');
  assertIncludes(remoteRuntimeLoader, 'function assertThemeRuntimeIdentity', 'remote runtime bundle identity validator');
  assertIncludes(remoteRuntimeLoader, 'Theme runtime bundle is missing identity metadata', 'remote runtime missing metadata fail-closed path');
  assertIncludes(remoteRuntimeLoader, 'Theme runtime version mismatch', 'remote runtime stale version fail-closed path');
  assertIncludes(remoteRuntimeLoader, 'resolveThemeRuntimeFromCache', 'remote runtime cached identity revalidation');
  assertIncludes(remoteRuntimeLoader, 'window.__JIFFOO_THEME_RUNTIME__ = undefined;', 'remote runtime global cleanup after load');
  assertIncludes(remoteRuntimeTest, 'runtime:modelsfind:0.1.4', 'remote runtime slug+version regression');
  assertIncludes(remoteRuntimeTest, '/extensions/themes/shop/.versions/modelsfind/0.1.4/runtime/theme-runtime.js?v=0.1.4', 'remote runtime versioned URL regression');
  assertIncludes(remoteRuntimeTest, 'expectedIdentity', 'remote runtime provider identity regression');
  assertIncludes(remoteRuntimeTest, 'fails closed instead of falling back to a host bundled renderer when the active installed runtime fails', 'remote runtime fail-closed regression');
  assertIncludes(remoteRuntimeTest, 'loads a new runtime URL when the active installed theme version changes', 'remote runtime active-version reload regression');
  assertIncludes(remoteRuntimeTest, 'runtime:modelsfind:0.1.5', 'remote runtime new active version cache key regression');
  assertIncludes(remoteRuntimeTest, '/extensions/themes/shop/.versions/modelsfind/0.1.5/runtime/theme-runtime.js?v=0.1.5', 'remote runtime new active version URL regression');
  assertIncludes(remoteRuntimeIdentityTest, 'accepts a runtime bundle whose metadata matches the active installed theme', 'remote runtime identity success regression');
  assertIncludes(remoteRuntimeIdentityTest, 'rejects a runtime bundle whose metadata version is stale', 'remote runtime identity stale version regression');
  assertIncludes(remoteRuntimeIdentityTest, 'revalidates cached runtimes when the caller supplies an expected identity', 'remote runtime identity cache bypass regression');
  assertIncludes(remoteRuntimeIdentityTest, 'expect(window.__JIFFOO_THEME_RUNTIME__).toBeUndefined()', 'remote runtime identity failure cleanup regression');
  assertIncludes(registryVersionTest, 'keeps embedded official runtime versions aligned with catalog and theme-pack manifests', 'embedded official runtime version regression');
  assertIncludes(registryVersionTest, 'OFFICIAL_LAUNCH_EXTENSIONS', 'embedded runtime official catalog version source');
  assertIncludes(registryVersionTest, 'EMBEDDED_OFFICIAL_RUNTIME_SLUGS', 'embedded runtime explicit slug list');
  assertIncludes(registryVersionTest, 'registryEntry?.meta.version', 'embedded runtime registry version assertion');
  assertIncludes(registryVersionTest, 'theme-pack manifest version', 'embedded runtime theme-pack version assertion');
  assertIncludes(registryVersionTest, 'package.json version', 'embedded runtime package version assertion');
  assertIncludes(registryVersionTest, 'x-jiffoo-renderer-slug', 'embedded runtime renderer slug assertion');
  assertIncludes(registryVersionTest, 'PACKAGED_RUNTIME_THEME_SLUGS', 'packaged runtime theme explicit slug list');
  assertIncludes(registryVersionTest, "'bokmoo'", 'Bokmoo packaged runtime regression');
  assertIncludes(registryVersionTest, 'requires installed runtime-capable theme packs to ship a versioned runtime bundle', 'packaged runtime bundle regression');
  assertIncludes(registryVersionTest, "themeManifest.entry?.runtimeJS", 'packaged runtime manifest assertion');
  assertIncludes(registryVersionTest, "catalogEntry?.packageUrl", 'packaged runtime official artifact URL assertion');
  assertIncludes(officialArtifactBuilder, 'const existingMeta =', 'official runtime artifact preserves existing metadata');
  assertIncludes(officialArtifactBuilder, 'slug: ${JSON.stringify(entry.slug)}', 'official runtime artifact slug metadata injection');
  assertIncludes(officialArtifactBuilder, 'version: ${JSON.stringify(entry.version)}', 'official runtime artifact version metadata injection');
  assertIncludes(officialArtifactBuilder, "target: 'shop'", 'official runtime artifact target metadata injection');
  assertIncludes(officialArtifactBuilderTest, 'getSourceBackedRuntimeThemeEntries', 'official runtime artifact source-derived build matrix');
  assertIncludes(officialArtifactBuilderTest, "path.join(themeRoot, 'src', 'runtime.ts')", 'official runtime artifact source gate');
  assertIncludes(officialArtifactBuilderTest, 'SOURCE_BACKED_RUNTIME_THEME_FLOOR', 'official runtime artifact minimum theme coverage');
  assertIncludes(officialArtifactBuilderTest, 'slugs: themeSlugs', 'official runtime artifact catalog-derived build request');
  assertIncludes(officialArtifactBuilderTest, 'expect(runtimeBundle).toContain(`slug: "${slug}"`);', 'official runtime artifact slug metadata regression');
  assertIncludes(officialArtifactBuilderTest, 'expect(runtimeBundle).toContain(`version: "${version}"`);', 'official runtime artifact version metadata regression');
  assertIncludes(officialArtifactBuilderTest, "expect(runtimeBundle).toContain('target: \"shop\"');", 'official runtime artifact target metadata regression');
  assertNotMatches(officialArtifactBuilderTest, /const themeVersions: Record<string, string>/, 'hard-coded official runtime artifact matrix');
  assertIncludes(officialCatalog, "slug: 'bokmoo'", 'Bokmoo official catalog entry');
  assertIncludes(officialCatalog, "packageUrl: 'https://market.jiffoo.com/artifacts/themes/bokmoo/1.1.2.jtheme'", 'Bokmoo official artifact URL');
  assertIncludes(bokmooThemeManifest, '"runtimeJS": "runtime/theme-runtime.js"', 'Bokmoo packaged runtime manifest entry');
  assertIncludes(brandedRuntimeVerifier, '/api/themes/active?target=shop', 'branded verifier active theme API check');
  assertIncludes(brandedRuntimeVerifier, '/api/store/context', 'branded verifier store context API check');
  assertIncludes(brandedRuntimeVerifier, '/extensions/themes/shop/.versions/${expectedSlug}/${expectedVersion}/runtime/theme-runtime.js', 'branded verifier versioned runtime path check');
  assertIncludes(brandedRuntimeVerifier, '--runtime-path', 'branded verifier multi runtime path option');
  assertIncludes(brandedRuntimeVerifier, 'process.env.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS', 'branded verifier release runtime paths env');
  assertIncludes(brandedRuntimeVerifier, 'function getRuntimePaths', 'branded verifier runtime path resolver');
  assertIncludes(brandedRuntimeVerifier, 'function assertThemeIdentity', 'branded verifier official theme identity check');
  assertIncludes(brandedRuntimeVerifier, 'theme source mismatch: expected official-market', 'branded verifier official-market source assertion');
  assertIncludes(brandedRuntimeVerifier, 'theme type mismatch: expected pack', 'branded verifier pack type assertion');
  assertIncludes(brandedRuntimeVerifier, 'function assertSameThemeIdentity', 'branded verifier active/context identity comparison');
  assertIncludes(brandedRuntimeVerifier, 'theme ${key} drift', 'branded verifier active/context drift failure');
  assertIncludes(brandedRuntimeVerifier, 'function assertRuntimeHtmlSource', 'branded verifier runtime HTML source check');
  assertIncludes(brandedRuntimeVerifier, 'function assertRuntimeScriptResponses', 'branded verifier runtime script response check');
  assertIncludes(brandedRuntimeVerifier, 'page.request.get(runtimeUrl)', 'branded verifier runtime script uses browser context request');
  assertIncludes(brandedRuntimeVerifier, 'window.__JIFFOO_THEME_RUNTIME__', 'branded verifier runtime bundle global assertion');
  assertIncludes(brandedRuntimeVerifier, 'runtimePages: runtimeChecks', 'branded verifier reports all runtime pages');
  assertIncludes(brandedRuntimeVerifier, '/extensions/themes/shop/${expectedSlug}/runtime/theme-runtime.js', 'branded verifier legacy runtime rejection');
  assertIncludes(brandedRuntimeVerifier, '${label} HTML references stale theme runtime URL', 'branded verifier stale HTML runtime rejection');
  assertIncludes(brandedRuntimeVerifier, '${label} page contains forbidden host fallback text', 'branded verifier runtime page fallback chrome check');
  assertIncludes(brandedRuntimeVerifier, 'Auth page contains forbidden host chrome text', 'branded verifier auth host chrome check');
  assertIncludes(brandedRuntimeVerifierTest, 'active theme version mismatch fails', 'branded verifier active version mismatch regression');
  assertIncludes(brandedRuntimeVerifierTest, 'active theme source mismatch fails', 'branded verifier active source mismatch regression');
  assertIncludes(brandedRuntimeVerifierTest, 'store context source drift fails', 'branded verifier store context source drift regression');
  assertIncludes(brandedRuntimeVerifierTest, 'store context version drift fails', 'branded verifier store context version drift regression');
  assertIncludes(brandedRuntimeVerifierTest, 'legacy unversioned runtime path fails', 'branded verifier legacy runtime regression');
  assertIncludes(brandedRuntimeVerifierTest, 'stale products HTML runtime version fails', 'branded verifier stale HTML runtime regression');
  assertIncludes(brandedRuntimeVerifierTest, 'missing versioned runtime script fails', 'branded verifier missing runtime script regression');
  assertIncludes(brandedRuntimeVerifierTest, 'runtime script without theme global fails', 'branded verifier runtime global regression');
  assertIncludes(brandedRuntimeVerifierTest, 'runtime script HTML response fails', 'branded verifier runtime HTML response regression');
  assertIncludes(brandedRuntimeVerifierTest, 'stale extra runtime path HTML version fails', 'branded verifier stale extra runtime path regression');
  assertIncludes(brandedRuntimeVerifierTest, 'products host fallback text fails', 'branded verifier products fallback regression');
  assertIncludes(brandedRuntimeVerifierTest, 'auth host chrome leak fails', 'branded verifier auth chrome regression');
});

addCheck('local OSS release helper runs branded runtime verifier regression', () => {
  const releaseHelper = read('scripts/release-oss-patch.mjs');
  const publicManifestSource = read('packages/shared/src/core-update/public-manifest.ts');
  const upgradeRoutes = read('apps/api/src/core/upgrade/routes.ts');
  const upgradeService = read('apps/api/src/core/upgrade/service.ts');
  const upgradeRouteTest = read('apps/api/tests/routes/upgrade.test.ts');
  const localUpgradeCommitPath = section(
    upgradeService,
    'const liveRuntimeError = await this.verifyLiveRuntimeVersionBeforeLocalCommit(targetVersion);',
    "this.reportProgress('completed', 'Upgrade completed successfully', 100);",
    'API local upgrade version commit path',
  );
  const compatibilityGatePath = section(
    upgradeService,
    'static async checkCompatibility(targetVersion: string)',
    '  /**\n   * Get upgrade status',
    'API one-click compatibility gate path',
  );
  const performManifestRecheckPath = section(
    upgradeService,
    '      const manifestResult = await this.fetchUpdateManifest(this.resolveReleaseChannel());\n      const manifest = manifestResult.manifest;',
    '      if (!result.success) {',
    'API perform upgrade manifest recheck path',
  );

  assertIncludes(releaseHelper, 'function runReleaseQualityGates', 'release helper shared quality gate helper');
  assertIncludes(releaseHelper, "args.push('--dry-run');", 'release helper shared quality gate dry-run propagation');
  assertIncludes(releaseHelper, "run('node', args);", 'release helper shared quality gate execution');
  assertIncludes(releaseHelper, 'runReleaseQualityGates(dryRun);', 'release helper shared quality gate call');
  assertNotMatches(releaseHelper, /PUBLIC_MANIFEST_TS_PATH|updatePublicManifestSource|updateUpgradeRouteFixture/, 'release helper static public manifest mutation');
  assertNotMatches(publicManifestSource, /PUBLIC_CORE_UPDATE_MANIFEST\s*:/, 'bundled public core update manifest object');
  assertIncludes(upgradeRoutes, 'DEFAULT_PUBLIC_CORE_UPDATE_MANIFEST_URL', 'upgrade route canonical manifest URL');
  assertIncludes(upgradeRoutes, '.code(308)', 'upgrade route canonical redirect status');
  assertIncludes(upgradeService, 'function normalizeManifestAssetUrl', 'upgrade service manifest recovery asset URL validation');
  assertIncludes(upgradeService, 'verifyManifestRecoveryAssets(manifest', 'upgrade service manifest recovery asset reachability validation');
  assertIncludes(upgradeService, "method: 'HEAD'", 'upgrade service recovery asset HEAD probe');
  assertIncludes(upgradeService, '-opensource$', 'upgrade service requires OSS release tags for self-hosted detection');
  assertIncludes(upgradeService, 'missing a valid sourceArchiveUrl recovery asset', 'upgrade service source archive recovery asset rejection');
  assertIncludes(upgradeService, 'missing a valid checksumUrl recovery asset', 'upgrade service checksum recovery asset rejection');
  assertIncludes(upgradeService, 'verifyLiveRuntimeVersionBeforeLocalCommit', 'upgrade service local live runtime pre-commit verifier');
  assertIncludes(upgradeService, 'Health endpoint ${field} mismatch', 'upgrade service runtime mismatch failure');
  assertIncludes(upgradeService, 'No valid public update manifest is available for one-click upgrade', 'upgrade service one-click manifest availability guard');
  assertIncludes(upgradeService, 'must match public update manifest latestVersion', 'upgrade service one-click target manifest guard');
  assertIncludes(upgradeService, 'requires manual intervention and cannot use one-click upgrade', 'upgrade service manual-intervention guard');
  assertIncludes(upgradeService, 'minimum auto-upgradable version', 'upgrade service minimum auto-upgradable guard');
  assertIncludes(upgradeService, 'oneClickUpgradeAvailable', 'upgrade service current release one-click availability field');
  assertIncludes(upgradeService, 'oneClickUpgradeBlockedReason', 'upgrade service current release one-click blocked reason field');
  assertIncludes(upgradeService, 'Public update manifest changed during upgrade preparation', 'upgrade service execution-time manifest race guard');
  assertBefore(
    localUpgradeCommitPath,
    'const liveRuntimeError = await this.verifyLiveRuntimeVersionBeforeLocalCommit(targetVersion);',
    'await prisma.systemSettings.upsert({',
    'API local live runtime verification before version metadata commit',
  );
  assertBefore(
    compatibilityGatePath,
    'No valid public update manifest is available for one-click upgrade',
    'const availability = await executor.probe();',
    'API one-click manifest guard before executor availability',
  );
  assertBefore(
    performManifestRecheckPath,
    'Public update manifest changed during upgrade preparation',
    'const result = await executor.execute({',
    'API perform manifest recheck before executor execution',
  );
  assertIncludes(upgradeRouteTest, 'should redirect to the canonical public manifest without authentication', 'upgrade route redirect regression');
  assertIncludes(upgradeRouteTest, 'runtime image tag only partially matches latestVersion', 'upgrade route partial runtime image tag regression');
  assertIncludes(upgradeRouteTest, 'api runtime image must use exact tag', 'upgrade route exact runtime image tag failure');
  assertIncludes(upgradeRouteTest, 'without a valid source archive recovery asset', 'upgrade route missing source archive recovery asset regression');
  assertIncludes(upgradeRouteTest, 'without a valid checksum recovery asset', 'upgrade route missing checksum recovery asset regression');
  assertIncludes(upgradeRouteTest, 'public source archive is unreachable', 'upgrade route unreachable source archive regression');
  assertIncludes(upgradeRouteTest, 'sourceArchiveUrl recovery asset returned HTTP 404', 'upgrade route unreachable source archive failure');
  assertIncludes(upgradeRouteTest, 'public checksum asset is unreachable', 'upgrade route unreachable checksum asset regression');
  assertIncludes(upgradeRouteTest, 'checksumUrl recovery asset returned HTTP 404', 'upgrade route unreachable checksum asset failure');
  assertIncludes(upgradeRouteTest, 'GitHub release tag is not an OSS release tag', 'upgrade route non-OSS release tag regression');
  assertIncludes(upgradeRouteTest, 'should verify live runtime before committing local version metadata', 'upgrade route live runtime pre-commit success regression');
  assertIncludes(upgradeRouteTest, 'should not commit local version metadata when the live runtime is stale', 'upgrade route live runtime pre-commit stale regression');
  assertIncludes(upgradeRouteTest, 'Health endpoint package_version mismatch', 'upgrade route package runtime mismatch failure regression');
  assertIncludes(upgradeRouteTest, 'should require one-click targets to match the public update manifest latestVersion', 'upgrade route manifest target guard regression');
  assertIncludes(upgradeRouteTest, 'should reject one-click upgrades when the manifest requires manual intervention', 'upgrade route manual intervention guard regression');
  assertIncludes(upgradeRouteTest, 'should reject one-click upgrades below the manifest minimum auto-upgradable version', 'upgrade route minimum auto-upgradable guard regression');
  assertIncludes(upgradeRouteTest, 'should mark one-click upgrade available only when the manifest release is auto-upgradable', 'upgrade route one-click available version regression');
  assertIncludes(upgradeRouteTest, 'should distinguish executor support from manual-intervention release eligibility', 'upgrade route one-click manual blocker regression');
  assertIncludes(upgradeRouteTest, 'should mark one-click upgrade unavailable below the manifest minimum auto-upgradable version', 'upgrade route one-click minimum auto blocker regression');
  assertIncludes(upgradeRouteTest, 'should not execute the updater when the public manifest changes after compatibility check', 'upgrade route manifest race execution regression');
});

addCheck('local OSS release helper verifies publication before stable promotion', () => {
  const releaseHelper = read('scripts/release-oss-patch.mjs');
  const feedPublicationFailurePath = section(
    releaseHelper,
    'public self-hosted feed did not converge',
    'try {\n    updateReleaseNotes(version, options.notesPath, options);',
    'local release helper feed publication failure path',
  );
  const finalPromotionPath = section(
    releaseHelper,
    'try {\n    updateReleaseNotes(version, options.notesPath, options);',
    'async function repairExistingRelease',
    'local release helper final promotion path',
  );
  const repairExistingPath = section(
    releaseHelper,
    'async function repairExistingRelease',
    'async function quarantineExistingRelease',
    'local release helper repair existing path',
  );

  assertIncludes(releaseHelper, 'function verifyStablePublicReleaseConvergence', 'release helper stable public convergence helper');
  assertIncludes(releaseHelper, 'function verifyLiveRuntimeVersion', 'release helper live runtime verifier helper');
  assertIncludes(releaseHelper, 'function verifyBrandedStorefrontRuntime', 'release helper branded runtime verifier helper');
  assertIncludes(releaseHelper, 'function getBrandedRuntimePathArgs', 'release helper branded runtime paths helper');
  assertIncludes(releaseHelper, '--branded-runtime-paths', 'release helper branded runtime paths CLI');
  assertIncludes(releaseHelper, 'JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS', 'release helper branded runtime paths env');
  assertIncludes(releaseHelper, "'scripts/verify-public-release-convergence.mjs'", 'release helper public convergence verifier');
  assertIncludes(releaseHelper, "'scripts/verify-live-runtime-version.mjs'", 'release helper live runtime verifier');
  assertIncludes(releaseHelper, "'scripts/verify-branded-storefront-runtime.mjs'", 'release helper branded runtime verifier');
  assertIncludes(finalPromotionPath, 'verifyStablePublicReleaseConvergence(version, {', 'release helper final public convergence call');
  assertIncludes(finalPromotionPath, '...options', 'release helper final verification propagates repo/API options');
  assertIncludes(finalPromotionPath, 'allowPrerelease: true', 'release helper prerelease convergence before promotion');
  assertIncludes(finalPromotionPath, 'verifyLiveRuntimeVersion(version, { liveApiUrl });', 'release helper final live runtime call');
  assertIncludes(finalPromotionPath, 'verifyBrandedStorefrontRuntime(options);', 'release helper final branded runtime call');
  assertIncludes(finalPromotionPath, 'verifyGithubReleaseAssets(version, false, { ...options, verifyImages: true });', 'release helper pre-promotion asset assertion');
  assertIncludes(finalPromotionPath, 'verifyReleaseHistoryAvailability(false, {', 'release helper pre-promotion history audit');
  assertIncludes(finalPromotionPath, 'excludePendingReleaseTag: `v${version}-opensource`', 'release helper pre-promotion pending release exclusion');
  assertIncludes(finalPromotionPath, 'markReleaseStable(version, options);', 'release helper stable promotion call');
  assertIncludes(finalPromotionPath, 'verifyGithubReleaseAssets(version, false, { ...options, requireStable: true });', 'release helper final stable asset assertion');
  assertIncludes(finalPromotionPath, 'verifyReleaseHistoryAvailability(false, options);', 'release helper post-promotion history audit');
  assertIncludes(finalPromotionPath, 'final stable publication verification failed', 'release helper final failure quarantine message');
  assertIncludes(finalPromotionPath, 'verifyQuarantinedRelease(version, options);', 'release helper verifies final failure quarantine metadata');
  assertIncludes(feedPublicationFailurePath, 'verifyQuarantinedRelease(version, options);', 'release helper verifies feed publication failure quarantine metadata');
  assertIncludes(repairExistingPath, 'verifyLiveRuntimeVersion(version, { liveApiUrl: options.liveApiUrl });', 'release helper repair pre-public live runtime call');
  assertIncludes(repairExistingPath, 'verifyBrandedStorefrontRuntime(options);', 'release helper repair pre-public branded runtime call');
  assertIncludes(repairExistingPath, 'dispatchSelfHostedFeedPublication(version, options);', 'release helper repair feed dispatch call');
  assertBefore(
    repairExistingPath,
    'verifyLiveRuntimeVersion(version, { liveApiUrl: options.liveApiUrl });',
    'verifyBrandedStorefrontRuntime(options);',
    'repair existing pre-public API runtime before branded storefront verification',
  );
  assertBefore(
    repairExistingPath,
    'verifyBrandedStorefrontRuntime(options);',
    'dispatchSelfHostedFeedPublication(version, options);',
    'repair existing branded runtime verification before public feed dispatch',
  );
  assertBefore(
    feedPublicationFailurePath,
    'await quarantinePublishedRelease(version, message, options);',
    'verifyQuarantinedRelease(version, options);',
    'feed publication failure quarantine is verified after mutation',
  );
  assertBefore(
    finalPromotionPath,
    'verifyStablePublicReleaseConvergence(version, {',
    'verifyLiveRuntimeVersion(version, { liveApiUrl });',
    'public convergence before live runtime verification',
  );
  assertBefore(
    finalPromotionPath,
    'verifyLiveRuntimeVersion(version, { liveApiUrl });',
    'verifyBrandedStorefrontRuntime(options);',
    'live runtime before branded storefront verification',
  );
  assertBefore(
    finalPromotionPath,
    'verifyBrandedStorefrontRuntime(options);',
    'verifyGithubReleaseAssets(version, false, { ...options, verifyImages: true });',
    'branded storefront verification before pre-promotion release asset assertion',
  );
  assertBefore(
    finalPromotionPath,
    'verifyGithubReleaseAssets(version, false, { ...options, verifyImages: true });',
    'verifyReleaseHistoryAvailability(false, {',
    'assets verified before pre-promotion history audit',
  );
  assertBefore(
    finalPromotionPath,
    'verifyReleaseHistoryAvailability(false, {',
    'markReleaseStable(version, options);',
    'pre-promotion history audit before stable promotion',
  );
  assertBefore(
    finalPromotionPath,
    'markReleaseStable(version, options);',
    'verifyGithubReleaseAssets(version, false, { ...options, requireStable: true });',
    'stable promotion before final stable release asset assertion',
  );
  assertBefore(
    finalPromotionPath,
    'verifyGithubReleaseAssets(version, false, { ...options, requireStable: true });',
    'verifyReleaseHistoryAvailability(false, options);',
    'final stable asset assertion before post-promotion history audit',
  );
  assertBefore(
    finalPromotionPath,
    'verifyReleaseHistoryAvailability(false, options);',
    'await quarantinePublishedRelease(version, message, options);',
    'post-promotion history audit before final failure quarantine',
  );
  assertBefore(
    finalPromotionPath,
    'await quarantinePublishedRelease(version, message, options);',
    'verifyQuarantinedRelease(version, options);',
    'final stable failure quarantine is verified after mutation',
  );
});

addCheck('updater verifies live runtime before committing version metadata', () => {
  const updater = read('scripts/jiffoo-updater.mjs');
  const upgradeService = read('apps/api/src/core/upgrade/service.ts');
  const executorTypes = read('apps/api/src/core/upgrade/executors/types.ts');
  const dockerExecutor = read('apps/api/src/core/upgrade/executors/docker-compose.ts');
  const k8sExecutor = read('apps/api/src/core/upgrade/executors/k8s.ts');
  const executorTest = read('apps/api/tests/core/upgrade-executors.test.ts');
  const dockerAgent = read('scripts/jiffoo-updater-agent.mjs');
  const k8sAgent = read('scripts/jiffoo-k8s-updater-agent.mjs');
  const k8sUpdaterController = read('deploy/k8s/jiffoo-k8s-updater-controller.yaml');
  const rehearsal = read('scripts/rehearse-docker-compose-updater.mjs');

  const imageFirstPath = section(
    updater,
    "console.log('[jiffoo-updater] Waiting for API health');",
    "console.log('[jiffoo-updater] Image-first upgrade completed successfully');",
    'image-first updater verification path',
  );
  const dockerAgentUpgradePath = section(
    dockerAgent,
    "if (request.method === 'POST' && request.url === '/upgrade') {",
    "sendJson(response, 404, { error: 'Not found' });",
    'docker updater agent upgrade endpoint',
  );
  const k8sAgentUpgradePath = section(
    k8sAgent,
    "if (request.method === 'POST' && request.url === '/upgrade') {",
    "sendJson(response, 404, { error: 'Not found' });",
    'k8s updater agent upgrade endpoint',
  );

  assertIncludes(updater, "const REQUIRED_IMAGE_FIRST_SERVICES = ['api', 'admin', 'shop', 'updater'];", 'updater requires all image-first runtime services');
  assertIncludes(updater, 'function getRuntimeImageTag', 'updater exact runtime image tag parser');
  assertIncludes(updater, 'must use exact tag', 'updater exact runtime image tag failure');
  assertIncludes(executorTypes, 'currentVersion?: string | null;', 'executor context current version field');
  assertIncludes(upgradeService, 'currentVersion: compatibility.currentVersion,', 'upgrade service passes current version to executor');
  assertIncludes(dockerExecutor, 'currentVersion: context.currentVersion || null', 'docker-compose bridge current version payload');
  assertIncludes(k8sExecutor, 'currentVersion: context.currentVersion || null', 'k8s bridge current version payload');
  assertIncludes(executorTest, 'sends currentVersion to the docker-compose updater agent', 'docker-compose bridge current version regression');
  assertIncludes(executorTest, 'sends currentVersion to the k8s updater bridge', 'k8s bridge current version regression');
  assertIncludes(dockerAgent, 'async function assertPublicManifestAllowsUpgrade(targetVersion, currentVersion = null)', 'docker updater agent public manifest guard helper');
  assertIncludes(dockerAgent, 'must match public update manifest latestVersion', 'docker updater agent public manifest target guard');
  assertIncludes(dockerAgent, 'requires manual intervention and cannot use one-click upgrade', 'docker updater agent manual-intervention guard');
  assertIncludes(dockerAgent, 'minimum auto-upgradable version', 'docker updater agent minimum auto-upgradable guard');
  assertIncludes(dockerAgent, 'Update manifest image-first delivery is missing a valid checksumUrl recovery asset', 'docker updater agent checksum recovery asset guard');
  assertBefore(
    dockerAgent,
    'resolveEnvFileVersion()',
    'normalizeReleaseVersion(explicitVersion)',
    'docker updater agent prefers local APP_VERSION over request body currentVersion',
  );
  assertIncludes(k8sAgent, 'async function assertPublicManifestAllowsUpgrade(targetVersion, currentVersion = null)', 'k8s updater agent public manifest guard helper');
  assertIncludes(k8sAgent, 'must match public update manifest latestVersion', 'k8s updater agent public manifest target guard');
  assertIncludes(k8sAgent, 'requires manual intervention and cannot use one-click upgrade', 'k8s updater agent manual-intervention guard');
  assertIncludes(k8sAgent, 'minimum auto-upgradable version', 'k8s updater agent minimum auto-upgradable guard');
  assertIncludes(k8sAgent, 'Update manifest image-first delivery is missing a valid checksumUrl recovery asset', 'k8s updater agent checksum recovery asset guard');
  assertIncludes(k8sUpdaterController, 'JIFFOO_CORE_UPDATE_MANIFEST_URL', 'k8s updater controller public manifest URL env');
  assertIncludes(k8sUpdaterController, 'https://get.jiffoo.com/releases/core/manifest.json', 'k8s updater controller default public manifest feed');
  assertIncludes(k8sUpdaterController, 'JIFFOO_UPDATE_CHANNEL', 'k8s updater controller update channel env');
  assertBefore(
    dockerAgentUpgradePath,
    'validatedTargetVersion = await assertPublicManifestAllowsUpgrade(targetVersion, body.currentVersion);',
    'await startUpgrade(validatedTargetVersion);',
    'docker updater agent validates public manifest before starting upgrade',
  );
  assertBefore(
    k8sAgentUpgradePath,
    'validatedTargetVersion = await assertPublicManifestAllowsUpgrade(targetVersion, body.currentVersion);',
    'activeUpgrade = performUpgrade(validatedTargetVersion, body)',
    'k8s updater agent validates public manifest before starting upgrade',
  );
  assertIncludes(rehearsal, 'missing-updater-image', 'updater missing updater image rehearsal regression');
  assertIncludes(rehearsal, 'partial-image-tag', 'updater partial image tag rehearsal regression');
  assertIncludes(rehearsal, 'agent-target-manifest-mismatch', 'updater agent target manifest mismatch rehearsal regression');
  assertIncludes(rehearsal, 'agent-min-auto-body-spoof', 'updater agent currentVersion spoof regression');
  assertIncludes(imageFirstPath, 'await waitForApiHealth(composeCommand, composePrefixArgs, composeFile, cutoverEnv);', 'API health verification');
  assertIncludes(imageFirstPath, 'await writeComposeState(envFile, nextComposeState);', 'version metadata commit after live verification');
  assertBefore(
    imageFirstPath,
    "currentStep: 'Verifying live runtime version before commit'",
    'await waitForApiLiveRuntime(composeCommand, composePrefixArgs, composeFile, cutoverEnv, targetVersion);',
    'visible live-runtime verification status before live validation',
  );
  assertBefore(
    imageFirstPath,
    'await waitForApiLiveRuntime(composeCommand, composePrefixArgs, composeFile, cutoverEnv, targetVersion);',
    'await writeComposeState(envFile, nextComposeState);',
    'live runtime verification before image-first commit',
  );
  assertIncludes(rehearsal, 'Updater rehearsal committed APP_VERSION before the runtime cutover finished', 'early commit regression check');
  assertIncludes(rehearsal, "'exec -T api node -e'", 'live runtime validation docker call regression');
});

for (const check of checks) {
  try {
    check.fn();
    console.log(`ok - ${check.name}`);
  } catch (error) {
    console.error(`not ok - ${check.name}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

console.log(`Release publication gate passed (${checks.length} checks).`);
