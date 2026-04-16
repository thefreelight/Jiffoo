#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const REPO_ROOT = '/Users/jordan/Projects/Jiffoo';
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

  const wrapperBody = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${dockerLog}"
exit 0
`;

  for (const binaryName of ['docker', 'docker-compose']) {
    const binaryPath = path.join(binDir, binaryName);
    await fs.writeFile(
      binaryPath,
      wrapperBody,
      'utf8',
    );
    await fs.chmod(binaryPath, 0o755);
  }

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
    deliveryMode: 'image-first',
    images: {
      api: 'registry.example.com/jiffoo-oss/api:1.0.5',
      admin: 'registry.example.com/jiffoo-oss/admin:1.0.5',
      shop: 'registry.example.com/jiffoo-oss/shop:1.0.5',
      updater: 'registry.example.com/jiffoo-oss/updater:1.0.5',
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

async function waitForAgent(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for updater agent health endpoint');
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
    await waitForAgent(agentPort);

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
    for (const expectedEnvLine of [
      'API_IMAGE=registry.example.com/jiffoo-oss/api:1.0.5',
      'ADMIN_IMAGE=registry.example.com/jiffoo-oss/admin:1.0.5',
      'SHOP_IMAGE=registry.example.com/jiffoo-oss/shop:1.0.5',
      'UPDATER_IMAGE=registry.example.com/jiffoo-oss/updater:1.0.5',
    ]) {
      if (!envFile.includes(expectedEnvLine)) {
        throw new Error(`Updater rehearsal did not persist ${expectedEnvLine}`);
      }
    }

    const dockerCalls = await fs.readFile(dockerLog, 'utf8');
    for (const expected of [
      'compose',
      'pull api shop admin updater',
      'rm -f -s api',
      'up -d --no-build --no-deps api',
      'rm -f -s shop',
      'up -d --no-build --no-deps shop',
      'rm -f -s admin',
      'up -d --no-build --no-deps admin',
      'exec -T api npx prisma migrate deploy',
    ]) {
      if (!dockerCalls.includes(expected)) {
        throw new Error(`Expected docker call not observed: ${expected}`);
      }
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
