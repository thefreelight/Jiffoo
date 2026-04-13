#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const UPDATER_SCRIPT = path.join(REPO_ROOT, 'scripts', 'jiffoo-updater.mjs');
const AGENT_SCRIPT = path.join(REPO_ROOT, 'scripts', 'jiffoo-updater-agent.mjs');

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 1}`));
    });
    child.on('error', reject);
  });
}

async function createFixtureWorkspace(rootDir) {
  const workspaceDir = path.join(rootDir, 'workspace');
  const releaseDir = path.join(rootDir, 'release-src');
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(releaseDir, { recursive: true });

  await fs.writeFile(
    path.join(workspaceDir, 'package.json'),
    JSON.stringify({ name: 'fixture-jiffoo', version: '1.0.0' }, null, 2),
    'utf8',
  );
  await fs.writeFile(path.join(workspaceDir, 'docker-compose.prod.yml'), 'services: {}\n', 'utf8');
  await fs.writeFile(path.join(workspaceDir, '.env.production.local'), 'APP_VERSION=1.0.0\n', 'utf8');

  await fs.writeFile(
    path.join(releaseDir, 'package.json'),
    JSON.stringify({ name: 'fixture-jiffoo', version: '1.0.1' }, null, 2),
    'utf8',
  );
  await fs.writeFile(path.join(releaseDir, 'docker-compose.prod.yml'), 'services: {}\n', 'utf8');
  await fs.mkdir(path.join(releaseDir, 'apps', 'api', 'prisma'), { recursive: true });
  await fs.writeFile(path.join(releaseDir, 'apps', 'api', 'prisma', 'schema.prisma'), '// fixture\n', 'utf8');

  const tarballPath = path.join(rootDir, 'jiffoo-source.tar.gz');
  await run('tar', ['-czf', tarballPath, '-C', releaseDir, '.']);

  return { workspaceDir, tarballPath };
}

async function createFakeDocker(rootDir) {
  const binDir = path.join(rootDir, 'bin');
  const dockerLog = path.join(rootDir, 'docker.log');
  await fs.mkdir(binDir, { recursive: true });

  const dockerShim = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${dockerLog}"
exit 0
`;

  const dockerPath = path.join(binDir, 'docker');
  await fs.writeFile(dockerPath, dockerShim, 'utf8');
  await fs.chmod(dockerPath, 0o755);

  const dockerComposePath = path.join(binDir, 'docker-compose');
  await fs.writeFile(dockerComposePath, dockerShim, 'utf8');
  await fs.chmod(dockerComposePath, 0o755);

  const wrapperPath = path.join(binDir, 'jiffoo-updater');
  await fs.writeFile(
    wrapperPath,
    `#!/usr/bin/env bash
set -euo pipefail
exec node "${UPDATER_SCRIPT}" "$@"
`,
    'utf8',
  );
  await fs.chmod(wrapperPath, 0o755);

  return { binDir, dockerLog, wrapperPath };
}

async function startHttpServer(tarballPath) {
  const manifest = JSON.stringify({
    latestVersion: '1.0.5',
    latestStableVersion: '1.0.5',
    latestPrereleaseVersion: null,
    channel: 'stable',
    deliveryMode: 'image',
    images: {
      api: 'ghcr.io/thefreelight/jiffoo-api:v1.0.5-opensource',
      shop: 'ghcr.io/thefreelight/jiffoo-shop:v1.0.5-opensource',
      admin: 'ghcr.io/thefreelight/jiffoo-admin:v1.0.5-opensource',
      updater: 'ghcr.io/thefreelight/jiffoo-updater:v1.0.5-opensource',
    },
    releaseDate: '2026-04-11T00:00:00.000Z',
    changelogUrl: 'https://example.com/releases/1.0.5',
    sourceArchiveUrl: 'http://127.0.0.1:43219/jiffoo-source.tar.gz',
    minimumCompatibleVersion: '1.0.0',
    minimumAutoUpgradableVersion: '1.0.0',
    requiresManualIntervention: false,
    releaseNotes: 'fixture release',
  });

  const tarballBuffer = await fs.readFile(tarballPath);

  const server = http.createServer((request, response) => {
    if (!request.url) {
      response.writeHead(404).end();
      return;
    }

    if (request.url === '/releases/core/manifest.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(manifest);
      return;
    }

    if (request.url === '/jiffoo-source.tar.gz') {
      response.writeHead(200, { 'content-type': 'application/gzip' });
      response.end(tarballBuffer);
      return;
    }

    response.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(43219, resolve));
  return server;
}

async function pollStatus(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await fetch(`http://127.0.0.1:${port}/status`).then((response) => response.json());
    if (['completed', 'failed', 'recovered'].includes(status.status)) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Timed out waiting for updater status to finish');
}

async function main() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-updater-rehearsal-'));
  const { workspaceDir, tarballPath } = await createFixtureWorkspace(rootDir);
  const { binDir, dockerLog, wrapperPath } = await createFakeDocker(rootDir);
  const httpServer = await startHttpServer(tarballPath);
  const statusFile = path.join(rootDir, 'status.json');
  const agentPort = 43220;

  const agent = spawn('node', [AGENT_SCRIPT], {
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH || ''}`,
      JIFFOO_UPDATER_AGENT_PORT: String(agentPort),
      JIFFOO_DOCKER_COMPOSE_FILE: path.join(workspaceDir, 'docker-compose.prod.yml'),
      JIFFOO_DOCKER_ENV_FILE: path.join(workspaceDir, '.env.production.local'),
      JIFFOO_UPDATER_STATUS_FILE: statusFile,
      JIFFOO_UPDATER_BIN: wrapperPath,
      JIFFOO_CORE_UPDATE_MANIFEST_URL: 'http://127.0.0.1:43219/releases/core/manifest.json',
    },
    stdio: 'ignore',
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const trigger = await fetch(`http://127.0.0.1:${agentPort}/upgrade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetVersion: '1.0.5' }),
    });

    if (!trigger.ok) {
      throw new Error(`Agent returned HTTP ${trigger.status}`);
    }

    const finalStatus = await pollStatus(agentPort);
    if (finalStatus.status !== 'completed') {
      throw new Error(`Updater rehearsal did not complete successfully: ${JSON.stringify(finalStatus)}`);
    }

    const envFile = await fs.readFile(path.join(workspaceDir, '.env.production.local'), 'utf8');
    if (!envFile.includes('APP_VERSION=1.0.5')) {
      throw new Error('Updater rehearsal did not persist APP_VERSION=1.0.5');
    }
    for (const expectedEnv of [
      'API_IMAGE=ghcr.io/thefreelight/jiffoo-api:v1.0.5-opensource',
      'SHOP_IMAGE=ghcr.io/thefreelight/jiffoo-shop:v1.0.5-opensource',
      'ADMIN_IMAGE=ghcr.io/thefreelight/jiffoo-admin:v1.0.5-opensource',
      'UPDATER_IMAGE=ghcr.io/thefreelight/jiffoo-updater:v1.0.5-opensource',
    ]) {
      if (!envFile.includes(expectedEnv)) {
        throw new Error(`Updater rehearsal did not persist ${expectedEnv}`);
      }
    }

    const dockerCalls = await fs.readFile(dockerLog, 'utf8');
    for (const expected of [
      'compose',
      'pull api shop admin',
      'up -d --no-build --no-deps api shop admin',
      'exec -T api npx prisma migrate deploy',
      'exec -T shop node -e',
      'exec -T admin node -e',
    ]) {
      if (!dockerCalls.includes(expected)) {
        throw new Error(`Expected docker call not observed: ${expected}`);
      }
    }
    if (dockerCalls.includes('--build api shop admin')) {
      throw new Error('Image-first rehearsal unexpectedly rebuilt api/shop/admin');
    }

    console.log('Rehearsal completed successfully.');
  } finally {
    agent.kill('SIGTERM');
    httpServer.close();
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
