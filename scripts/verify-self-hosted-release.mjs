#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function fail(message) {
  console.error(`VERIFY FAILED: ${message}`);
  process.exit(1);
}

function normalizeReleaseTag(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

function normalizeCoreVersion(tagOrVersion) {
  const normalized = String(tagOrVersion || '')
    .trim()
    .replace(/^v/, '')
    .replace(/-opensource$/, '');

  if (!/^\d+\.\d+\.\d+$/.test(normalized)) {
    fail(`Cannot derive a strict core version from "${tagOrVersion}"`);
  }

  return normalized;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function expectFile(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing required self-hosted runtime asset: ${relativePath}`);
  }
  return absolutePath;
}

function expectContains(content, snippet, label) {
  if (!content.includes(snippet)) {
    fail(`${label} is missing required snippet: ${snippet}`);
  }
}

function expectNotContains(content, snippet, label) {
  if (content.includes(snippet)) {
    fail(`${label} still contains forbidden snippet: ${snippet}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const releaseTag = normalizeReleaseTag(args['release-tag']);

  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fail('package.json not found at repository root');
  }

  const packageJson = JSON.parse(readText(packageJsonPath));
  const packageVersion = String(packageJson.version || '').trim();
  if (!/^\d+\.\d+\.\d+-opensource$/.test(packageVersion)) {
    fail(`Root package.json version must be strict opensource semver, got "${packageVersion}"`);
  }

  const coreVersion = normalizeCoreVersion(releaseTag || packageVersion);
  const expectedPackageVersion = `${coreVersion}-opensource`;
  if (releaseTag && packageVersion !== expectedPackageVersion) {
    fail(
      `Root package.json version "${packageVersion}" does not match release tag "${releaseTag}" (expected "${expectedPackageVersion}")`,
    );
  }

  [
    'install.sh',
    'docker-compose.prod.yml',
    '.env.production.example',
    'nginx/get-jiffoo.conf',
  ].forEach((relativePath) => expectFile(rootDir, relativePath));

  const officialCatalogPath = expectFile(rootDir, 'packages/shared/src/extensions/official-catalog.ts');
  const officialCatalogContent = readText(officialCatalogPath);
  const themeEntryCount = (officialCatalogContent.match(/kind:\s*'theme'/g) || []).length;
  if (themeEntryCount < 9) {
    fail(`Official catalog seed only contains ${themeEntryCount} theme entries; expected at least 9`);
  }

  const requiredThemeSlugs = [
    'fire',
    'imagic-studio',
    'navtoai',
    'modelsfind',
    'ai-gateway',
    'quiet-curator',
    'stellar-midnight',
    'yevbi',
    'esim-mall',
  ];

  for (const slug of requiredThemeSlugs) {
    expectContains(officialCatalogContent, `slug: '${slug}'`, 'packages/shared official catalog seed');
  }

  [
    'apps/api/src/core/admin/market/official-catalog.ts',
    'apps/api/src/core/admin/market/official-artifact-health.ts',
    'apps/api/src/core/admin/market/official-artifacts-client.ts',
    'apps/api/src/core/admin/market/embedded-artifact-store.ts',
  ].forEach((relativePath) => expectFile(rootDir, relativePath));

  const releaseWorkflowPath = expectFile(rootDir, '.github/workflows/publish-self-hosted-update-feed.yml');
  const releaseWorkflow = readText(releaseWorkflowPath);
  expectContains(
    releaseWorkflow,
    'GET_JIFFOO_SSH_PRIVATE_KEY',
    'publish-self-hosted-update-feed workflow',
  );
  expectNotContains(
    releaseWorkflow,
    'GET_JIFFOO_SSH_PASSWORD',
    'publish-self-hosted-update-feed workflow',
  );
  expectContains(
    releaseWorkflow,
    'APP_VERSION=${{ steps.image_refs.outputs.core_version }}',
    'publish-self-hosted-update-feed workflow',
  );

  const sourceFeedWorkflowPath = expectFile(rootDir, '.github/workflows/publish-self-hosted-source-feed.yml');
  const sourceFeedWorkflow = readText(sourceFeedWorkflowPath);
  expectContains(
    sourceFeedWorkflow,
    'GET_JIFFOO_SSH_PRIVATE_KEY',
    'publish-self-hosted-source-feed workflow',
  );
  expectNotContains(
    sourceFeedWorkflow,
    'GET_JIFFOO_SSH_PASSWORD',
    'publish-self-hosted-source-feed workflow',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        releaseTag: releaseTag || null,
        packageVersion,
        themeEntryCount,
        requiredThemeSlugs,
      },
      null,
      2,
    ),
  );
}

main();
