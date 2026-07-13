#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const OSS_BUILD_TARGET_PATH = path.join(ROOT, '.github', 'oss-build-target.json');
const PUBLIC_MANIFEST_TS_PATH = path.join(ROOT, 'packages', 'shared', 'src', 'core-update', 'public-manifest.ts');
const UPGRADE_TEST_PATH = path.join(ROOT, 'apps', 'api', 'tests', 'routes', 'upgrade.test.ts');

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

function printUsage() {
  console.log(`Usage:
  node scripts/release-oss-patch.mjs --version 1.0.12 --notes "Short release summary" [--release-date ISO8601] [--publish] [--skip-checks] [--dry-run]

Examples:
  node scripts/release-oss-patch.mjs --version 1.0.12 --notes "Fixes login demo mode and marketplace update refresh." --dry-run
  node scripts/release-oss-patch.mjs --version 1.0.12 --notes-file .release/release-notes.md --publish
`);
}

function assertSemver(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version "${version}". Expected MAJOR.MINOR.PATCH`);
  }
}

function escapeJsSingleQuotedString(input) {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content, dryRun) {
  if (!dryRun) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: ROOT,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: ROOT,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }

  return (result.stdout || '').trim();
}

function replaceOrThrow(content, pattern, replacer, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find ${label}`);
  }
  pattern.lastIndex = 0;
  return content.replace(pattern, replacer);
}

function updatePackageJson(version, dryRun) {
  const json = JSON.parse(readText(PACKAGE_JSON_PATH));
  json.version = `${version}-opensource`;
  writeText(PACKAGE_JSON_PATH, `${JSON.stringify(json, null, 2)}\n`, dryRun);
}

function updateOssBuildTarget(version, dryRun) {
  const json = JSON.parse(readText(OSS_BUILD_TARGET_PATH));
  json.target_ref = `v${version}-opensource`;
  json.image_tag = version;
  json.app_version = version;
  writeText(OSS_BUILD_TARGET_PATH, `${JSON.stringify(json, null, 2)}\n`, dryRun);
}

function updatePublicManifestSource(version, releaseDate, releaseNotes, dryRun) {
  let content = readText(PUBLIC_MANIFEST_TS_PATH);
  const escapedNotes = escapeJsSingleQuotedString(releaseNotes);
  content = replaceOrThrow(content, /latestVersion: '.*?'/, `latestVersion: '${version}'`, 'latestVersion');
  content = replaceOrThrow(content, /latestStableVersion: '.*?'/, `latestStableVersion: '${version}'`, 'latestStableVersion');
  content = replaceOrThrow(
    content,
    /(api: 'crpi-si4hvlqhabu9zjq7\.ap-southeast-1\.personal\.cr\.aliyuncs\.com\/jiffoo-oss\/api:)[^']+(')/,
    `$1${version}$2`,
    'api image ref',
  );
  content = replaceOrThrow(
    content,
    /(admin: 'crpi-si4hvlqhabu9zjq7\.ap-southeast-1\.personal\.cr\.aliyuncs\.com\/jiffoo-oss\/admin:)[^']+(')/,
    `$1${version}$2`,
    'admin image ref',
  );
  content = replaceOrThrow(
    content,
    /(shop: 'crpi-si4hvlqhabu9zjq7\.ap-southeast-1\.personal\.cr\.aliyuncs\.com\/jiffoo-oss\/shop:)[^']+(')/,
    `$1${version}$2`,
    'shop image ref',
  );
  content = replaceOrThrow(
    content,
    /(updater: 'crpi-si4hvlqhabu9zjq7\.ap-southeast-1\.personal\.cr\.aliyuncs\.com\/jiffoo-oss\/updater:)[^']+(')/,
    `$1${version}$2`,
    'updater image ref',
  );
  content = replaceOrThrow(content, /releaseDate: '.*?'/, `releaseDate: '${releaseDate}'`, 'releaseDate');
  content = replaceOrThrow(
    content,
    /changelogUrl: 'https:\/\/github\.com\/thefreelight\/Jiffoo\/releases\/tag\/v.*?-opensource'/,
    `changelogUrl: 'https://github.com/thefreelight/Jiffoo/releases/tag/v${version}-opensource'`,
    'changelogUrl',
  );
  content = replaceOrThrow(
    content,
    /releaseNotes:\s*\n\s*'.*?'/s,
    `releaseNotes:\n    '${escapedNotes}'`,
    'releaseNotes',
  );
  writeText(PUBLIC_MANIFEST_TS_PATH, content, dryRun);
}

function updateUpgradeRouteFixture(version, dryRun) {
  let content = readText(UPGRADE_TEST_PATH);
  const patterns = [
    [/latestVersion: '\d+\.\d+\.\d+(?:-[^']+)?'/g, `latestVersion: '${version}'`],
    [/latestStableVersion: '\d+\.\d+\.\d+(?:-[^']+)?'/g, `latestStableVersion: '${version}'`],
    [/(jiffoo-oss\/api:)\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?/g, `$1${version}`],
    [/(jiffoo-oss\/admin:)\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?/g, `$1${version}`],
    [/(jiffoo-oss\/shop:)\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?/g, `$1${version}`],
    [/(jiffoo-oss\/updater:)\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?/g, `$1${version}`],
    [/changelog\/\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?/g, `changelog/${version}`],
    [/toBe\('\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?'\)/g, `toBe('${version}')`],
  ];
  for (const [pattern, replacement] of patterns) {
    content = content.replace(pattern, replacement);
  }
  writeText(UPGRADE_TEST_PATH, content, dryRun);
}

function collectReleaseFiles() {
  return [
    'package.json',
    '.github/oss-build-target.json',
    'packages/shared/src/core-update/public-manifest.ts',
    'apps/api/tests/routes/upgrade.test.ts',
  ];
}

function collectPublishFiles() {
  return [
    ...collectReleaseFiles(),
    'apps/admin/app/[locale]/auth/login/page.tsx',
    'apps/admin/app/[locale]/settings/page.tsx',
    'apps/admin/components/auth/login-modal.tsx',
    'apps/admin/lib/api.ts',
    'apps/api/src/core/admin/market/market-client.ts',
    'apps/api/src/core/admin/market/official-catalog.ts',
    'apps/api/src/core/auth/routes.ts',
    'apps/api/src/core/auth/schemas.ts',
    'apps/api/src/core/auth/service.ts',
    'install.sh',
    '.env.production.example',
  ];
}

function assertNoUnexpectedStagedFiles(targetFiles) {
  const staged = runCapture('git', ['diff', '--cached', '--name-only'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const allowed = new Set(targetFiles);
  const unexpected = staged.filter((file) => !allowed.has(file));
  if (unexpected.length > 0) {
    throw new Error(`Refusing to continue with unrelated staged files: ${unexpected.join(', ')}`);
  }
}

function stageFiles(files) {
  run('git', ['add', ...files]);
}

function ensureGhAuth() {
  run('gh', ['auth', 'status']);
}

function createReleaseNotesFile(version, notes) {
  const notesPath = path.join(ROOT, '.release', `release-notes-v${version}.md`);
  fs.mkdirSync(path.dirname(notesPath), { recursive: true });
  fs.writeFileSync(
    notesPath,
    `## What's included\n- ${notes}\n`,
    'utf8',
  );
  return notesPath;
}

function buildFeed(version, releaseDate, notes, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] node scripts/build-update-feed.mjs --output-dir .release/self-hosted --release-tag v${version}-opensource --release-date ${releaseDate} --release-notes "${notes}"`);
    return;
  }

  run('node', [
    'scripts/build-update-feed.mjs',
    '--output-dir',
    '.release/self-hosted',
    '--release-tag',
    `v${version}-opensource`,
    '--release-date',
    releaseDate,
    '--release-notes',
    notes,
  ]);
}

function uploadReleaseAssets(version) {
  run('gh', [
    'release',
    'upload',
    `v${version}-opensource`,
    '.release/self-hosted/core-update-manifest.json',
    '.release/self-hosted/jiffoo-source.tar.gz',
    '.release/self-hosted/jiffoo-source.tar.gz.sha256',
    '--repo',
    'thefreelight/Jiffoo',
    '--clobber',
  ]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.version) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const version = String(args.version).trim();
  assertSemver(version);
  const releaseDate = args['release-date'] || new Date().toISOString();
  const notes =
    args.notes ||
    (args['notes-file'] ? fs.readFileSync(path.resolve(ROOT, args['notes-file']), 'utf8').trim() : null) ||
    `Publishes the ${version} OSS patch release.`;
  const dryRun = args['dry-run'] === 'true';
  const publish = args.publish === 'true';
  const skipChecks = args['skip-checks'] === 'true';

  console.log(`Preparing OSS patch release v${version}-opensource`);
  updatePackageJson(version, dryRun);
  updateOssBuildTarget(version, dryRun);
  updatePublicManifestSource(version, releaseDate, notes, dryRun);
  updateUpgradeRouteFixture(version, dryRun);

  if (!skipChecks) {
    if (dryRun) {
      console.log('[dry-run] pnpm --filter api type-check');
      console.log('[dry-run] pnpm --filter admin type-check');
      console.log('[dry-run] node scripts/build-update-feed.mjs ...');
    } else {
      run('pnpm', ['--filter', 'api', 'type-check']);
      run('pnpm', ['--filter', 'admin', 'type-check']);
      buildFeed(version, releaseDate, notes, false);
    }
  }

  if (!publish) {
    console.log('Prepared metadata only. Re-run with --publish to commit, tag, push, create release, and upload assets.');
    return;
  }

  const targetFiles = collectPublishFiles();
  if (dryRun) {
    console.log(`[dry-run] git add ${targetFiles.join(' ')}`);
    console.log(`[dry-run] git commit -m "release: prepare v${version} opensource"`);
    console.log(`[dry-run] git tag -a v${version}-opensource -m "Jiffoo OSS ${version}"`);
    console.log('[dry-run] git push origin <current-branch>');
    console.log(`[dry-run] git push origin v${version}-opensource`);
    console.log(`[dry-run] gh release create v${version}-opensource ...`);
    console.log(`[dry-run] gh release upload v${version}-opensource ...`);
    return;
  }

  ensureGhAuth();
  assertNoUnexpectedStagedFiles(targetFiles);
  stageFiles(targetFiles);
  run('git', ['commit', '-m', `release: prepare v${version} opensource`]);
  run('git', ['tag', '-a', `v${version}-opensource`, '-m', `Jiffoo OSS ${version}`]);

  const branch = runCapture('git', ['branch', '--show-current']);
  run('git', ['push', 'origin', branch]);
  run('git', ['push', 'origin', `v${version}-opensource`]);

  const notesPath = createReleaseNotesFile(version, notes);
  run('gh', [
    'release',
    'create',
    `v${version}-opensource`,
    '--repo',
    'thefreelight/Jiffoo',
    '--verify-tag',
    '--title',
    `Jiffoo OSS ${version}`,
    '--notes-file',
    notesPath,
  ]);
  uploadReleaseAssets(version);

  console.log(`Release https://github.com/thefreelight/Jiffoo/releases/tag/v${version}-opensource created.`);
  console.log('Reminder: sync get.jiffoo.com public feed/install assets if the workflow does not do it automatically.');
}

main();
