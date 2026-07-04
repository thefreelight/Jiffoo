#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

const RELEASE_QUALITY_GATE_COMMANDS = [
  ['pnpm', ['--filter', 'api', 'type-check']],
  ['pnpm', ['--filter', 'shop', 'type-check']],
  ['pnpm', ['--filter', 'admin', 'type-check']],
  ['pnpm', ['--filter', 'admin', 'test']],
  ['pnpm', ['verify:admin-quality-gate']],
  ['pnpm', ['test:admin-market-theme-upgrade']],
  ['pnpm', ['--filter', 'api', 'db:mode:test']],
  ['pnpm', ['test:self-hosted-detection']],
  ['pnpm', ['test:shop-runtime-truth']],
  ['pnpm', ['test:official-artifacts']],
  ['pnpm', ['test:updater:docker-compose']],
  ['pnpm', ['test:update-feed-builder']],
  ['pnpm', ['test:update-feed-verifier']],
  ['pnpm', ['test:public-release-convergence-verifier']],
  ['pnpm', ['test:release-history-availability-verifier']],
  ['pnpm', ['test:release-helper-quarantine']],
  ['pnpm', ['verify:release-history-availability']],
  ['pnpm', ['test:live-runtime-verifier']],
  ['pnpm', ['test:branded-storefront-runtime-verifier']],
  ['pnpm', ['verify:release-publication-gate']],
  ['pnpm', ['verify:theme-clients']],
];

function localBin(name) {
  const executable = process.platform === 'win32' ? `${name}.cmd` : name;
  return path.join(ROOT, 'node_modules', '.bin', executable);
}

function appBin(appName, name) {
  const executable = process.platform === 'win32' ? `${name}.cmd` : name;
  return path.join(ROOT, 'apps', appName, 'node_modules', '.bin', executable);
}

function bin(appName, name) {
  const appExecutable = appBin(appName, name);
  if (fs.existsSync(appExecutable)) {
    return appExecutable;
  }

  return localBin(name);
}

function spec(command, args, cwd = ROOT, options = {}) {
  return { command, args, cwd, ...options };
}

function toolingNode() {
  return process.env.JIFFOO_RELEASE_GATE_NODE || process.execPath;
}

function vitestEntrypoint() {
  const entrypoint = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
  return fs.existsSync(entrypoint) ? entrypoint : localBin('vitest');
}

function vitestSpec(appName, args) {
  return spec(toolingNode(), [vitestEntrypoint(), ...args], path.join(ROOT, 'apps', appName));
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

const COMMAND_FALLBACKS = new Map([
  ['pnpm --filter api type-check', [
    spec(bin('api', 'tsc'), ['--noEmit'], path.join(ROOT, 'apps', 'api')),
  ]],
  ['pnpm --filter shop type-check', [
    spec(bin('shop', 'tsc'), ['--noEmit'], path.join(ROOT, 'apps', 'shop')),
  ]],
  ['pnpm --filter admin type-check', [
    spec(bin('admin', 'tsc'), ['--noEmit'], path.join(ROOT, 'apps', 'admin')),
  ]],
  ['pnpm --filter admin test', [
    vitestSpec('admin', ['run', '--config', 'vitest.config.mts']),
    spec(process.execPath, ['scripts/verify-admin-quality-gate.mjs']),
  ]],
  ['pnpm verify:admin-quality-gate', [
    spec(process.execPath, ['scripts/verify-admin-quality-gate.mjs']),
  ]],
  ['pnpm test:admin-market-theme-upgrade', [
    vitestSpec('api', [
      'run',
      '--coverage.enabled=false',
      'tests/routes/admin-staff.test.ts',
      'tests/routes/admin-market-install.test.ts',
      'tests/routes/market-install-binding.test.ts',
      'tests/core/official-catalog.test.ts',
      'tests/core/market-update-checker.test.ts',
      'tests/core/theme-installer-upgrade.test.ts',
      'tests/core/theme-management-service.test.ts',
      'tests/routes/upgrade.test.ts',
      'tests/core/upgrade-executors.test.ts',
    ]),
  ]],
  ['pnpm --filter api db:mode:test', [
    spec(localBin('dotenv'), [
      '-e',
      'apps/api/tests/.env.test',
      '--',
      process.execPath,
      'apps/api/scripts/run-test-migrate.js',
    ]),
  ]],
  ['pnpm test:self-hosted-detection', [
    vitestSpec('api', [
      'run',
      '--coverage.enabled=false',
      'tests/routes/upgrade.test.ts',
      'tests/core/upgrade-executors.test.ts',
    ]),
  ]],
  ['pnpm test:shop-runtime-truth', [
    vitestSpec('shop', [
      'run',
      '--config',
      'vitest.config.mts',
      'tests/themes/theme-pack-rendering-mode.test.ts',
      'tests/themes/theme-pack-loader.test.ts',
      'tests/themes/remote-runtime-identity.test.ts',
      'tests/themes/theme-provider-remote-runtime.test.tsx',
      'tests/themes/store-context-provider.test.tsx',
      'tests/themes/storefront-runtime-source-of-truth.test.ts',
      'tests/themes/esim-mall-runtime-registry.test.ts',
    ]),
  ]],
  ['pnpm test:official-artifacts', [
    vitestSpec('api', [
      'run',
      '--coverage.enabled=false',
      'tests/core/official-artifact-builder.test.ts',
    ]),
  ]],
  ['pnpm test:updater:docker-compose', [
    spec(process.execPath, ['scripts/rehearse-docker-compose-updater.mjs']),
  ]],
  ['pnpm test:update-feed-builder', [
    spec(process.execPath, ['scripts/test-build-update-feed.mjs']),
  ]],
  ['pnpm test:update-feed-verifier', [
    spec(process.execPath, ['scripts/test-verify-self-hosted-update-feed.mjs']),
  ]],
  ['pnpm test:public-release-convergence-verifier', [
    spec(process.execPath, ['scripts/test-verify-public-release-convergence.mjs']),
  ]],
  ['pnpm test:release-history-availability-verifier', [
    spec(process.execPath, ['scripts/test-verify-release-history-availability.mjs']),
  ]],
  ['pnpm test:release-helper-quarantine', [
    spec(process.execPath, ['scripts/test-release-oss-patch-quarantine.mjs']),
  ]],
  ['pnpm verify:release-history-availability', [
    spec(process.execPath, ['scripts/verify-release-history-availability.mjs', '--verify-images']),
  ]],
  ['pnpm test:live-runtime-verifier', [
    spec(process.execPath, ['scripts/test-verify-live-runtime-version.mjs']),
  ]],
  ['pnpm test:branded-storefront-runtime-verifier', [
    spec(process.execPath, ['scripts/test-verify-branded-storefront-runtime.mjs']),
  ]],
  ['pnpm verify:release-publication-gate', [
    spec(process.execPath, ['scripts/verify-release-publication-gate.mjs']),
  ]],
  ['pnpm verify:theme-clients', [
    spec(process.execPath, ['scripts/verify-theme-client-contracts.mjs']),
  ]],
]);

function parseArgs(argv) {
  const args = new Set();
  for (const token of argv) {
    if (token.startsWith('--')) {
      args.add(token);
    }
  }
  return args;
}

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function runSpec(commandSpec) {
  const { command, args, cwd = ROOT, loginShell = false } = commandSpec;
  const spawnCommand = loginShell ? '/bin/zsh' : command;
  const spawnArgs = loginShell
    ? ['-lc', `cd ${shellQuote(cwd)} && ${[command, ...args].map(shellQuote).join(' ')}`]
    : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    stdio: 'inherit',
    cwd: loginShell ? ROOT : cwd,
  });

  if (result.error?.code === 'ENOENT') {
    return false;
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${formatCommand(command, args)} failed with exit code ${result.status ?? 1}`);
  }

  return true;
}

function outputFor(result) {
  return [result.stderr, result.stdout]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function assertReleaseHistoryAuditPreflight() {
  const failures = [];
  const dockerResult = spawnSync('docker', ['buildx', 'version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (dockerResult.error?.code === 'ENOENT') {
    failures.push('Docker with Buildx is required before image-aware release history audit; docker was not found on PATH.');
  } else if (dockerResult.error) {
    failures.push(`Docker Buildx preflight failed: ${dockerResult.error.message}`);
  } else if (dockerResult.status !== 0) {
    const details = outputFor(dockerResult);
    failures.push(`Docker Buildx preflight failed${details ? `: ${details}` : '.'}`);
  }

  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    const ghResult = spawnSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (ghResult.error?.code === 'ENOENT') {
      failures.push('GitHub API authentication is required for release history audit; set GITHUB_TOKEN/GH_TOKEN or install and authenticate the gh CLI.');
    } else if (ghResult.error) {
      failures.push(`GitHub auth preflight failed: ${ghResult.error.message}`);
    } else if (ghResult.status !== 0 || !ghResult.stdout.trim()) {
      const details = outputFor(ghResult);
      failures.push(`GitHub API authentication is required for release history audit; set GITHUB_TOKEN/GH_TOKEN or authenticate the gh CLI${details ? `: ${details}` : '.'}`);
    }
  }

  if (failures.length > 0) {
    throw new Error([
      'Release quality gate preflight failed.',
      ...failures.map((failure) => `- ${failure}`),
      'Run with --dry-run to inspect the gate list without executing external release-history checks.',
    ].join('\n'));
  }
}

function run(command, args) {
  const commandSpec = spec(command, args);
  const ranPrimary = runSpec(commandSpec);
  if (ranPrimary) {
    return;
  }

  const fallbackKey = formatCommand(command, args);
  const fallback = COMMAND_FALLBACKS.get(fallbackKey);
  if (!fallback) {
    throw new Error(`${command} is not available on PATH and no release quality gate fallback is configured for ${fallbackKey}.`);
  }

  console.warn(`${command} is not available on PATH; running local fallback for ${fallbackKey}.`);
  for (const fallbackSpec of fallback) {
    const ranFallback = runSpec(fallbackSpec);
    if (!ranFallback) {
      throw new Error(`${fallbackSpec.command} is not available for release quality gate fallback ${fallbackKey}.`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.has('--dry-run');

  if (dryRun) {
    console.log('[dry-run] release-history image audit preflight: docker buildx version + GitHub API auth');
  } else {
    assertReleaseHistoryAuditPreflight();
  }

  for (const [command, commandArgs] of RELEASE_QUALITY_GATE_COMMANDS) {
    if (dryRun) {
      console.log(`[dry-run] ${formatCommand(command, commandArgs)}`);
      continue;
    }

    run(command, commandArgs);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
