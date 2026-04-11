#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const LEGACY_MANIFEST_URL = 'https://api.jiffoo.com/api/upgrade/manifest.json';
const DEFAULT_MANIFEST_URL = 'https://get.jiffoo.com/releases/core/manifest.json';
const DEFAULT_SOURCE_ARCHIVE_URL = 'https://get.jiffoo.com/jiffoo-source.tar.gz';
const DEFAULT_STATUS = {
  status: 'idle',
  progress: 0,
  currentStep: null,
  error: null,
  updatedAt: null,
  targetVersion: null,
};

function parseEnvFile(content) {
  const env = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      env[key] = value;
    }
  }

  return env;
}

async function buildComposeEnv(envFile) {
  const nextEnv = { ...process.env };
  if (!envFile || !fsSync.existsSync(envFile)) {
    return nextEnv;
  }

  try {
    const content = await fs.readFile(envFile, 'utf8');
    return {
      ...nextEnv,
      ...parseEnvFile(content),
    };
  } catch {
    return nextEnv;
  }
}

function inferComposeProjectName(commandEnv) {
  const result = spawnSync(
    'docker',
    ['ps', '--format', '{{.Names}}'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: commandEnv,
    },
  );

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const candidates = new Map();
  for (const rawLine of result.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(.+?)[-_](api|shop|admin|updater|postgres|redis)[-_]1$/);
    if (!match) continue;

    const [, prefix, service] = match;
    const existing = candidates.get(prefix) || new Set();
    existing.add(service);
    candidates.set(prefix, existing);
  }

  let bestPrefix = null;
  let bestScore = -1;

  for (const [prefix, services] of candidates.entries()) {
    const score =
      (services.has('api') ? 4 : 0) +
      (services.has('shop') ? 3 : 0) +
      (services.has('admin') ? 3 : 0) +
      services.size;

    if (score > bestScore) {
      bestScore = score;
      bestPrefix = prefix;
    }
  }

  return bestPrefix;
}

function resolveComposeProjectName(workspaceDir, commandEnv) {
  const explicit = commandEnv.JIFFOO_DOCKER_COMPOSE_PROJECT_NAME || commandEnv.COMPOSE_PROJECT_NAME;
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }

  const inferred = inferComposeProjectName(commandEnv);
  if (inferred && inferred.trim().length > 0) {
    return inferred.trim();
  }

  const basename = path.basename(workspaceDir);
  if (basename && basename !== 'workspace') {
    return basename;
  }

  return 'current';
}

function printUsage() {
  console.log(`Usage:
  jiffoo-updater upgrade --mode docker-compose --target-version <version> --compose-file <path> [--env-file <path>] [--source-archive-url <url>]
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }

  return { command, options };
}

async function writeStatus(statusFile, patch) {
  if (!statusFile) return;

  const next = {
    ...DEFAULT_STATUS,
    updatedAt: new Date().toISOString(),
    ...patch,
  };

  await fs.mkdir(path.dirname(statusFile), { recursive: true });
  await fs.writeFile(statusFile, JSON.stringify(next, null, 2), 'utf8');
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 1}`));
      }
    });
    child.on('error', reject);
  });
}

function hasCommand(command, args = []) {
  const result = spawnSync(command, args, { stdio: 'ignore', env: process.env });
  return result.status === 0;
}

function resolveComposeInvocation() {
  if (hasCommand('docker-compose', ['--version'])) {
    return {
      command: 'docker-compose',
      prefixArgs: [],
    };
  }

  if (hasCommand('docker', ['compose', 'version'])) {
    return {
      command: 'docker',
      prefixArgs: ['compose'],
    };
  }

  throw new Error('Neither "docker compose" nor "docker-compose" is available in the updater runtime');
}

function resolvePath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function substituteVersion(url, version) {
  return url.includes('{version}') ? url.replaceAll('{version}', version) : url;
}

function normalizeManifestUrl(url) {
  return url === LEGACY_MANIFEST_URL ? DEFAULT_MANIFEST_URL : url;
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
}

async function findProjectRoot(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  if (entries.some((entry) => entry.name === 'package.json') && entries.some((entry) => entry.name === 'docker-compose.prod.yml')) {
    return rootDir;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(rootDir, entry.name);
    try {
      const candidate = await findProjectRoot(nested);
      if (candidate) return candidate;
    } catch {
      // keep scanning
    }
  }

  throw new Error(`Could not find Jiffoo project root inside extracted archive: ${rootDir}`);
}

async function writeEnvValue(envPath, key, value) {
  let content = '';
  try {
    content = await fs.readFile(envPath, 'utf8');
  } catch {
    // file created below
  }

  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const nextContent = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;

  await fs.writeFile(envPath, nextContent, 'utf8');
}

async function backupWorkspace(workspaceDir, backupTarPath) {
  await fs.mkdir(path.dirname(backupTarPath), { recursive: true });
  await run('tar', [
    '--exclude=.jiffoo-updater',
    '-czf',
    backupTarPath,
    '-C',
    workspaceDir,
    '.',
  ]);
}

async function restoreWorkspace(workspaceDir, backupTarPath) {
  const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.jiffoo-updater') continue;
    await fs.rm(path.join(workspaceDir, entry.name), { recursive: true, force: true });
  }

  await run('tar', ['-xzf', backupTarPath, '-C', workspaceDir]);
}

async function replaceWorkspace(workspaceDir, sourceDir) {
  const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.jiffoo-updater' || entry.name === '.env.production.local') continue;
    await fs.rm(path.join(workspaceDir, entry.name), { recursive: true, force: true });
  }

  const sourceEntries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of sourceEntries) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(workspaceDir, entry.name);
    await fs.cp(from, to, { recursive: true, force: true });
  }
}

async function waitForApiHealth(composeCommand, composePrefixArgs, composeFile, commandEnv) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const args = [
        ...composePrefixArgs,
        '-p',
        commandEnv.COMPOSE_PROJECT_NAME,
        '-f',
        composeFile,
        'exec',
        '-T',
        'api',
        'sh',
        '-lc',
        'curl -fsS http://127.0.0.1:3002/health/ready >/dev/null',
      ];
      await run(composeCommand, args, { env: commandEnv });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error('API health check did not become ready in time');
}

async function performDockerComposeUpgrade(options) {
  const composeFile = resolvePath(String(options['compose-file']));
  const envFile = options['env-file']
    ? resolvePath(String(options['env-file']))
    : path.join(path.dirname(composeFile), '.env.production.local');
  const targetVersion = String(options['target-version']);
  const statusFile = options['status-file'] ? resolvePath(String(options['status-file'])) : null;
  const workspaceDir = path.dirname(composeFile);
  const backupRoot = path.join(workspaceDir, '.jiffoo-updater', 'backups');
  const backupId = `backup-${Date.now()}`;
  const backupTarPath = path.join(backupRoot, `${backupId}.tar.gz`);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-updater-'));
  const composeEnv = await buildComposeEnv(envFile);
  const composeProjectName = resolveComposeProjectName(workspaceDir, composeEnv);
  composeEnv.COMPOSE_PROJECT_NAME = composeProjectName;
  const { command: composeCommand, prefixArgs: composePrefixArgs } = resolveComposeInvocation();

  try {
    let archiveUrl = options['source-archive-url']
      ? String(options['source-archive-url'])
      : process.env.JIFFOO_SOURCE_ARCHIVE_URL || DEFAULT_SOURCE_ARCHIVE_URL;

    if (!options['source-archive-url']) {
      try {
        const manifest = await fetchJson(
          normalizeManifestUrl(process.env.JIFFOO_CORE_UPDATE_MANIFEST_URL || DEFAULT_MANIFEST_URL),
        );
        if (typeof manifest?.sourceArchiveUrl === 'string' && manifest.sourceArchiveUrl.trim().length > 0) {
          archiveUrl = manifest.sourceArchiveUrl.trim();
        }
      } catch {
        // keep fallback archive URL
      }
    }

    archiveUrl = substituteVersion(archiveUrl, targetVersion);
    const archivePath = path.join(tempDir, 'release.tar.gz');
    const extractDir = path.join(tempDir, 'extract');
    await fs.mkdir(extractDir, { recursive: true });

    console.log(`[jiffoo-updater] Downloading source archive: ${archiveUrl}`);
    await writeStatus(statusFile, {
      status: 'downloading',
      progress: 20,
      currentStep: 'Downloading source archive',
      error: null,
      targetVersion,
    });
    await downloadFile(archiveUrl, archivePath);
    await run('tar', ['-xzf', archivePath, '-C', extractDir]);

    const nextRoot = await findProjectRoot(extractDir);

    console.log('[jiffoo-updater] Creating workspace backup');
    await writeStatus(statusFile, {
      status: 'backing_up',
      progress: 35,
      currentStep: 'Creating pre-upgrade backup',
      targetVersion,
    });
    await backupWorkspace(workspaceDir, backupTarPath);

    console.log('[jiffoo-updater] Replacing workspace with downloaded release');
    await writeStatus(statusFile, {
      status: 'applying',
      progress: 50,
      currentStep: 'Applying release payload',
      targetVersion,
    });
    await replaceWorkspace(workspaceDir, nextRoot);
    if (envFile && fsSync.existsSync(envFile)) {
      await writeEnvValue(envFile, 'APP_VERSION', targetVersion);
      await writeEnvValue(envFile, 'JIFFOO_DEPLOYMENT_MODE', 'docker-compose');
      await writeEnvValue(
        envFile,
        'JIFFOO_CORE_UPDATE_MANIFEST_URL',
        normalizeManifestUrl(process.env.JIFFOO_CORE_UPDATE_MANIFEST_URL || DEFAULT_MANIFEST_URL),
      );
      await writeEnvValue(envFile, 'COMPOSE_PROJECT_NAME', composeProjectName);
    }
    process.env.APP_VERSION = targetVersion;
    process.env.JIFFOO_DEPLOYMENT_MODE = 'docker-compose';
    process.env.JIFFOO_CORE_UPDATE_MANIFEST_URL = normalizeManifestUrl(
      process.env.JIFFOO_CORE_UPDATE_MANIFEST_URL || DEFAULT_MANIFEST_URL,
    );
    process.env.COMPOSE_PROJECT_NAME = composeProjectName;

    console.log('[jiffoo-updater] Rebuilding and restarting docker-compose services');
    await writeStatus(statusFile, {
      status: 'applying',
      progress: 65,
      currentStep: 'Rebuilding and restarting api/shop/admin services',
      targetVersion,
    });
    const removeArgs = [
      ...composePrefixArgs,
      '-p',
      composeProjectName,
      '-f',
      composeFile,
      'rm',
      '-f',
      '-s',
      'api',
      'shop',
      'admin',
    ];
    await run(composeCommand, removeArgs, { env: composeEnv }).catch(() => {
      // Ignore when target containers do not exist yet.
    });
    const composeArgs = [
      ...composePrefixArgs,
      '-p',
      composeProjectName,
      '-f',
      composeFile,
      'up',
      '-d',
      '--build',
      '--no-deps',
      'api',
      'shop',
      'admin',
    ];
    await run(composeCommand, composeArgs, { env: composeEnv });

    console.log('[jiffoo-updater] Applying database migrations');
    await writeStatus(statusFile, {
      status: 'migrating',
      progress: 80,
      currentStep: 'Applying database migrations',
      targetVersion,
    });
    const migrateArgs = [
      ...composePrefixArgs,
      '-p',
      composeProjectName,
      '-f',
      composeFile,
      'exec',
      '-T',
      'api',
      'npx',
      'prisma',
      'migrate',
      'deploy',
      '--schema',
      'apps/api/prisma/schema.prisma',
    ];
    await run(composeCommand, migrateArgs, { env: composeEnv });

    console.log('[jiffoo-updater] Waiting for API health');
    await writeStatus(statusFile, {
      status: 'verifying',
      progress: 92,
      currentStep: 'Waiting for API health checks',
      targetVersion,
    });
    await waitForApiHealth(composeCommand, composePrefixArgs, composeFile, composeEnv);
    await writeStatus(statusFile, {
      status: 'completed',
      progress: 100,
      currentStep: 'Upgrade completed successfully',
      targetVersion,
      error: null,
    });
    console.log('[jiffoo-updater] Upgrade completed successfully');
  } catch (error) {
    console.error(`[jiffoo-updater] Upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
    await writeStatus(statusFile, {
      status: 'failed',
      progress: 95,
      currentStep: 'Upgrade failed; restoring previous backup',
      targetVersion,
      error: error instanceof Error ? error.message : String(error),
    });
    if (fsSync.existsSync(backupTarPath)) {
      console.error('[jiffoo-updater] Restoring previous workspace backup');
      await restoreWorkspace(workspaceDir, backupTarPath);
      const restoreArgs = ['compose'];
      if (envFile && fsSync.existsSync(envFile)) {
        restoreArgs.push('--env-file', envFile);
      }
      restoreArgs.push('-f', composeFile, 'up', '-d', '--build', 'api', 'shop', 'admin');
      await run('docker', restoreArgs, { env: process.env });
      await writeStatus(statusFile, {
        status: 'recovered',
        progress: 100,
        currentStep: 'Restored previous healthy release',
        targetVersion,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || options.help || options.h) {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  if (command !== 'upgrade') {
    throw new Error(`Unsupported command: ${command}`);
  }

  if (options.mode !== 'docker-compose') {
    throw new Error('Only --mode docker-compose is implemented in this updater version');
  }

  if (!options['target-version'] || !options['compose-file']) {
    printUsage();
    throw new Error('--target-version and --compose-file are required');
  }

  await performDockerComposeUpgrade(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
