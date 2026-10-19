import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, chmod, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';
import { readFileSync } from 'node:fs';
import { AcceptanceChecks, scenarioPlans } from '../deploy/compose/checks.mjs';
import { ComposeVolumeLedger } from './compose-volumes.mjs';
import { archiveComposeStartup, withComposeStartupDiagnostics } from './compose-startup.mjs';
import { generateStorageSecret } from './storage-secret.mjs';

export const composeStep = 'Run Docker Compose acceptance';
export function guardComposeDatabase(value) {
  if (value !== 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test') throw new Error('Compose verification requires the exact jiffoo_core_test DATABASE_URL_TEST.');
}
export function validateWorkerLogs(outputs, proof) {
  const entries = outputs.flatMap(output => output.split(/\r?\n/).filter(Boolean).map(line => {
    const entry = JSON.parse(line);
    assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(typeof entry.level, 'string'); return entry;
  }));
  const delivered = entries.filter(entry => entry.message?.includes('[plugin:console-email] Console email') && entry.message.includes(proof.orderNumber) && entry.message.includes(proof.to) && entry.message.includes('Payment received'));
  assert.equal(delivered.length, 1, 'Both worker stdout logs together must contain exactly one payment notification send');
}

async function verify() {
  guardComposeDatabase(process.env.DATABASE_URL_TEST);
  const started = new Date().toISOString(); const start = performance.now();
  const project = 'jiffoo-compose-' + randomUUID();
  const certificateDirectory = await mkdtemp(join(tmpdir(), project + '-'));
  // The disposable certificate is created by UID 1000, including on CI hosts
  // whose runner UID differs. This permission applies only to throwaway TLS.
  await chmod(certificateDirectory, 0o777);
  const evidence = resolve(process.env.GITHUB_ACTIONS === 'true' ? join(process.env.RUNNER_TEMP, 'verification') : join('e2e/test-results', project));
  await mkdir(evidence, { recursive: true });
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
  if (revision.status !== 0) throw new Error('Cannot determine source revision');
  const env = { ...process.env, COMPOSE_PROJECT_NAME: project, REVISION: revision.stdout.trim(),
    POSTGRES_PASSWORD: 'postgres', JWT_SECRET: randomBytes(48).toString('base64url'), PLUGIN_SECRETS_KEY: randomBytes(32).toString('base64'),
    MINIO_ROOT_USER: 'compose-' + randomUUID(), MINIO_ROOT_PASSWORD: generateStorageSecret(), UPLOAD_S3_BUCKET: 'compose-' + randomUUID(),
    SILO_APP_ACCESS_KEY_ID: 'app-' + randomUUID(), SILO_APP_SECRET_ACCESS_KEY: generateStorageSecret(),
    STOREFRONT_URL: 'https://compose-shop.test', ADMIN_URL: 'https://compose-admin.test', EDGE_PORT: '0',
    TLS_CERT_FILE: join(certificateDirectory, 'cert.pem'), TLS_KEY_FILE: join(certificateDirectory, 'key.pem'),
  };
  const args = ['compose', '--project-name', project, '-f', 'deploy/compose/compose.yml', '-f', 'deploy/compose/compose.acceptance.yml'];
  const commands = [];
  const docker = (arguments_, { capture = false, allowFailure = false } = {}) => new Promise((done, reject) => {
    const child = spawn('docker', arguments_, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output += bytes.toString(); if (!capture) process.stdout.write(bytes); });
    child.once('error', reject);
    child.once('close', code => {
      commands.push({ command: ['docker', ...arguments_].join(' '), code, output });
      if (code !== 0 && !allowFailure) reject(new Error(`docker ${arguments_.slice(0, 3).join(' ')} exited ${code}\n${output}`));
      else done(output);
    });
  });
  const compose = (arguments_, options) => docker([...args, ...arguments_], options);
  const startupDiagnostics = {
    project, query: arguments_ => docker(arguments_, { capture: true }),
    logs: service => compose(['logs', '--no-color', '--no-log-prefix', ...(service ? [service] : [])], { capture: true }),
    save: (name, output) => writeFile(join(evidence, name), output),
    secrets: [env.JWT_SECRET, env.PLUGIN_SECRETS_KEY, env.MINIO_ROOT_USER, env.MINIO_ROOT_PASSWORD, env.SILO_APP_ACCESS_KEY_ID, env.SILO_APP_SECRET_ACCESS_KEY],
  };
  const checks = new AcceptanceChecks();
  const volumes = new ComposeVolumeLedger(project, arguments_ => docker(arguments_, { capture: true }));
  let projectCreated = false;
  const scenario = async service => {
    const output = await compose(['run', '--rm', '--no-deps', service], { capture: true, allowFailure: true });
    const code = commands.at(-1).code;
    process.stdout.write(output);
    const line = output.split(/\r?\n/).find(value => value.startsWith('COMPOSE_CHECK_RESULTS '));
    if (!line) throw new Error(`Missing ${service} check results: ${output}`);
    const rows = JSON.parse(line.slice('COMPOSE_CHECK_RESULTS '.length));
    assert.deepEqual(rows.map(row => row.name).sort(), [...scenarioPlans[service]].sort(), 'Container checker must report every planned check exactly once');
    checks.importRows(rows);
    if (code !== 0 && rows.every(row => row.status === 'PASS')) throw new Error(`${service} exited ${code} despite successful check results`);
    const proofLine = output.split(/\r?\n/).find(value => value.startsWith('COMPOSE_NOTIFICATION_PROOF '));
    return proofLine ? JSON.parse(proofLine.slice('COMPOSE_NOTIFICATION_PROOF '.length)) : undefined;
  };
  try {
    await checks.run('Docker preflight', [], async () => {
      await volumes.capture('before startup');
      await docker(['version']); await docker(['compose', 'version']);
      const networks = (await docker(['network', 'ls', '-q'], { capture: true })).trim().split(/\s+/).filter(Boolean);
      if (networks.length) {
        const existing = JSON.parse(await docker(['network', 'inspect', ...networks], { capture: true }));
        if (existing.some(network => network.IPAM?.Config?.some(config => config.Subnet === '172.30.65.0/24'))) throw new Error('Fixed Compose proxy subnet 172.30.65.0/24 is already in use; existing networks were not modified.');
      }
      await compose(['config', '--quiet']);
    });
    await checks.run('Build application images', ['Docker preflight'], () => compose(['build', '--build-arg', 'RELEASE_VERSION=' + JSON.parse(readFileSync('package.json')).version.replace(/-opensource$/, ''), 'api-1', 'admin', 'shop']));
    await checks.run('Generate disposable TLS certificate', ['Build application images'], () => docker(['run', '--rm', '--name', project + '-certificate', '--label', `com.docker.compose.project=${project}`, '--user', '1000:1000',
      '--mount', `type=bind,source=${certificateDirectory},target=/tls`, '--entrypoint', 'openssl', project + '-backend',
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', '/tls/key.pem', '-out', '/tls/cert.pem', '-subj', `/CN=${new URL(env.STOREFRONT_URL).hostname}`, '-addext', `subjectAltName=DNS:${new URL(env.STOREFRONT_URL).hostname},DNS:${new URL(env.ADMIN_URL).hostname}`], { capture: true }));
    await checks.run('Stack creation', ['Generate disposable TLS certificate'], () => { projectCreated = true; });
    await checks.run('Stack startup', ['Stack creation'], () => withComposeStartupDiagnostics(() => compose(['up', '-d', '--wait', '--wait-timeout', '600', 'edge']), startupDiagnostics));
    await checks.run('Running API reports the built source commit and version', ['Stack startup'], () => compose(['exec', '-T', 'api-1', 'node', '--input-type=module', '-e', "const assert=(await import('node:assert/strict')).default;const r=await fetch('http://127.0.0.1:3001/health');assert.equal(r.status,200);const h=await r.json();assert.equal(h.git_sha,process.argv[1]);assert.equal(h.version,process.argv[2]);", env.REVISION, JSON.parse(readFileSync('package.json')).version.replace(/-opensource$/, '')], { capture: true }));
    await checks.run('No anonymous volumes after startup', ['Stack startup'], async () => { await volumes.capture('after startup'); await volumes.assertNoAnonymousVolumes(); });
    await checks.run('Validate existing database without updates', ['Stack startup'], () => compose(['run', '--rm', '--no-deps', 'db-init']));
    await checks.run('State checker protocol', ['Validate existing database without updates'], () => scenario('acceptance'));
    await checks.run('Client A checker protocol', ['Stack startup'], () => scenario('client-a'));
    await checks.run('Client B checker protocol', ['Stack startup'], () => scenario('client-b'));
    for (const [service, protocol] of [['acceptance', 'State checker protocol'], ['client-a', 'Client A checker protocol'], ['client-b', 'Client B checker protocol']]) {
      for (const name of scenarioPlans[service]) {
        if (!checks.rows.some(row => row.name === name)) await checks.run(name, [protocol], () => { throw new Error('Expected container check was not reported'); });
      }
    }
    await checks.run('Graceful worker stop', ['Stack startup'], () => compose(['stop', '-t', '45', 'worker-1', 'worker-2']));
    for (const service of ['api-1', 'api-2', 'worker-1', 'worker-2']) {
      await checks.run(`Read ${service} logs`, ['Stack startup'], async () => {
        const logs = await compose(['logs', '--no-color', '--no-log-prefix', service], { capture: true });
        await writeFile(join(evidence, service + '.log'), logs);
        return logs;
      });
      await checks.run(`${service} stdout JSON format`, [`Read ${service} logs`], () => {
        const lines = checks.value(`Read ${service} logs`).split(/\r?\n/).filter(Boolean);
        assert.ok(lines.length, 'Container has no log entries');
        for (const line of lines) {
          const entry = JSON.parse(line);
          assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
          assert.equal(typeof entry.level, 'string');
        }
      });
      if (service.startsWith('api')) await checks.run(`${service} has no log files`, ['Stack startup'], () => compose(['exec', '-T', service, 'node', '-e', "if (require('fs').existsSync('logs')) process.exit(1)"], { capture: true }));
    }
    await checks.run('Exactly one console-email send across workers', ['Manual payment across APIs', 'State checker protocol', 'Read worker-1 logs', 'Read worker-2 logs'], () => {
      const proof = checks.value('State checker protocol');
      assert.ok(proof, 'Missing payment notification proof');
      validateWorkerLogs([checks.value('Read worker-1 logs'), checks.value('Read worker-2 logs')], proof);
    });
  } finally {
    const publishedPorts = [];
    await checks.run('Capture published ports', [], async () => {
      if (!projectCreated) return;
      const edgeId = (await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`, '--filter', 'label=com.docker.compose.service=edge'], { capture: true })).trim();
      if (edgeId) {
        const ports = JSON.parse(await docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', edgeId], { capture: true })) ?? {};
        for (const binding of Object.values(ports).flatMap(bindings => bindings ?? [])) publishedPorts.push(Number(binding.HostPort));
      }
    });
    await checks.run('Archive stack logs', [], async () => {
      await archiveComposeStartup(startupDiagnostics);
    });
    await checks.run('Remove UUID project', [], async () => {
      if (projectCreated) await compose(['down', '--volumes', '--remove-orphans', '--timeout', '45']);
      for (const role of ['backend', 'admin', 'shop']) await docker(['image', 'rm', project + '-' + role], { capture: true, allowFailure: true });
      await rm(certificateDirectory, { recursive: true, force: true });
    });
    const cleanup = { project, publishedPorts };
    for (const [kind, arguments_] of [
      ['containers', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]],
      ['networks', ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]],
      ['volumes', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]],
      ['images', ['image', 'ls', '-q', '--filter', `reference=${project}-*`]],
    ]) {
      await checks.run(`No UUID ${kind} remain`, [], async () => {
        cleanup[kind] = (await docker(arguments_, { capture: true })).trim();
        assert.equal(cleanup[kind], '', `Owned project ${kind} remain: ${cleanup[kind]}`);
      });
    }
    cleanup.listeners = [];
    await checks.run('No published listeners remain', ['Capture published ports'], async () => {
      for (const port of publishedPorts) {
        const listening = await new Promise(done => {
          const socket = connect({ host: '127.0.0.1', port }); socket.setTimeout(1000);
          socket.once('connect', () => { socket.destroy(); done(true); });
          socket.once('error', () => done(false));
          socket.once('timeout', () => { socket.destroy(); done(false); });
        });
        if (listening) cleanup.listeners.push(port);
      }
      assert.deepEqual(cleanup.listeners, []);
    });
    await writeFile(join(evidence, 'cleanup.json'), JSON.stringify(cleanup, null, 2));
    await writeFile(join(evidence, 'commands.json'), JSON.stringify(commands, null, 2));
    await writeFile(join(evidence, 'checks.json'), JSON.stringify(checks.rows, null, 2));
  }
  const duration = ((performance.now() - start) / 1000).toFixed(2) + 's';
  const counts = checks.counts();
  const summary = `Compose start time: ${started}\nCompose results: ${counts.PASS} passed, ${counts.FAIL} failed, ${counts.SKIPPED} skipped\nCompose project: ${project}\nCompose duration: ${duration}\n`;
  const block = `=== Final test summary ===\n${summary}\n${checks.table()}\n| Step | Result | Duration |\n| --- | --- | --- |\n| ${composeStep} | ${checks.passed ? 'PASS' : 'FAIL'} | ${duration} |\n`;
  await writeFile('verify-summary.txt', block);
  await writeFile(join(evidence, 'verify-summary.txt'), block);
  await writeFile(join(evidence, 'verify-result.json'), JSON.stringify({ group: 'compose', valid: checks.passed, results: [[composeStep, checks.passed ? 'PASS' : 'FAIL', duration]], outputs: [{ name: composeStep, kind: 'compose', output: summary + '\n' + checks.table() }], apiFiles: [], fullApiFiles: [] }, null, 2));
  process.stdout.write(block);
  if (!checks.passed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verify();
