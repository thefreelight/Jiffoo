import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline/promises';
import assert from 'node:assert/strict';
import { emulatorImage } from './backup-host-emulator.mjs';
import { makeRelease } from '../deploy/release/prepare.mjs';
import { redactComposeOutput } from './compose-startup.mjs';
import { generateStorageSecret } from './storage-secret.mjs';

export const trialProject = 'jiffoo-trial';
export const trialActions = ['up', 'status', 'logs', 'down', 'backup', 'update', 'restore', 'destroy'];
export function assertTrialProject(project, acceptance) {
  if (!acceptance) assert.equal(project, trialProject);
  else assert.match(project, /^jiffoo-trial-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/);
}
export async function requireFreePort(port) {
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  assert.ok(![3001, 3002, 3003, 3004, 3010, 5432, 6379].includes(port));
  await new Promise((done, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Loopback port ${port} is in use; no stack was started.`)));
    server.listen(port, '127.0.0.1', () => server.close(done));
  });
}
export async function askExact(message, expected) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try { assert.equal(await input.question(message), expected, 'Confirmation did not match; operation cancelled.'); }
  finally { input.close(); }
}

/** The persistent Linux directory is also a real daemon-visible helper bind path. */
export class LocalTrial {
  constructor({ root = process.cwd(), state, project = trialProject, acceptance = false, port = 8443 } = {}) {
    assertTrialProject(project, acceptance);
    if (acceptance) assert.equal(process.env.DATABASE_URL_TEST, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
    this.root = resolve(root); this.state = resolve(state ?? join(process.env.LOCALAPPDATA ?? '', 'JiffooTrial'));
    const within = relative(this.root, this.state);
    assert.ok(isAbsolute(within) || within === '..' || within.startsWith('..'), 'Trial state must be outside the repository');
    this.project = project; this.acceptance = acceptance; this.port = port;
    this.host = project + '-host'; this.volume = project + '-host-data'; this.tags = []; this.secrets = [];
  }
  async run(command, args, { quiet = true, allowFailure = false, env = process.env } = {}) {
    const result = await new Promise((done, reject) => {
      const child = spawn(command, args, { cwd: this.root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
      child.once('error', reject); child.once('close', code => done({ code, stdout, output: stdout + stderr }));
    });
    if (!quiet) process.stdout.write(redactComposeOutput(result.output, this.secrets));
    if (result.code !== 0 && !allowFailure) throw new Error(redactComposeOutput(`${command} failed (${result.code}): ${result.output}`, this.secrets));
    return result;
  }
  docker(args, options) { return this.run('docker', args, options); }
  linux(command, args, options) { return this.docker(['exec', this.host, command, ...args], options); }
  async open({ create = false } = {}) {
    if (!existsSync(this.state)) { assert.ok(create, 'No trial exists. Run pnpm trial:up first.'); mkdirSync(this.state, { recursive: true, mode: 0o700 }); }
    this.recordPath = join(this.state, 'trial.json');
    this.record = existsSync(this.recordPath) ? JSON.parse(readFileSync(this.recordPath, 'utf8')) : { project: this.project, port: this.port };
    assert.equal(this.record.project, this.project); this.port = this.record.port;
    const existing = await this.docker(['volume', 'inspect', this.volume], { allowFailure: true });
    if (existing.code !== 0) {
      assert.ok(create && !this.record.release, 'Trial host volume is missing; do not recreate an existing deployment.');
      await this.docker(['volume', 'create', '--label', `io.jiffoo.trial.project=${this.project}`, this.volume]);
    }
    const volume = JSON.parse((await this.docker(['volume', 'inspect', this.volume])).stdout)[0];
    assert.equal(volume.Labels['io.jiffoo.trial.project'], this.project);
    this.directory = volume.Mountpoint;
    assert.equal(this.directory, `/var/lib/docker/volumes/${this.volume}/_data`);
    const oldHost = await this.docker(['inspect', this.host], { allowFailure: true });
    assert.notEqual(oldHost.code, 0, 'Another trial command is active or its host remains; inspect it before continuing.');
    const cached = await this.docker(['image', 'inspect', emulatorImage], { allowFailure: true });
    if (cached.code !== 0) await this.docker(['pull', '--platform', 'linux/amd64', emulatorImage]);
    const image = JSON.parse((await this.docker(['image', 'inspect', emulatorImage])).stdout)[0];
    assert.equal(image.Os, 'linux'); assert.equal(image.Architecture, 'amd64');
    assert.ok(image.RepoDigests.some(value => value.endsWith('@' + emulatorImage.split('@')[1])));
    await this.docker(['run', '-d', '--name', this.host, '--label', `io.jiffoo.trial.project=${this.project}`, '--network', 'none',
      '--mount', 'type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock',
      '--mount', `type=volume,source=${this.volume},target=${this.directory}`, '-e', `TMPDIR=${this.directory}/tmp`,
      '--entrypoint', 'sh', emulatorImage, '-c', 'exec tail -f /dev/null']);
    this.active = true;
    await this.linux('mkdir', ['-p', this.directory + '/tmp', this.directory + '/backups']);
    if (existsSync(join(this.state, '.env'))) this.loadSecrets();
  }
  loadSecrets() {
    this.environment = readFileSync(join(this.state, '.env'), 'utf8');
    this.secrets = this.environment.split('\n').filter(line => /SECRET|PASSWORD|ACCESS_KEY|MINIO_ROOT_USER/.test(line)).map(line => line.slice(line.indexOf('=') + 1));
  }
  save() { writeFileSync(this.recordPath, JSON.stringify(this.record, null, 2) + '\n', { mode: 0o600 }); }
  async close() {
    if (!this.active) return;
    const host = JSON.parse((await this.docker(['inspect', this.host])).stdout)[0];
    assert.equal(host.Config.Labels['io.jiffoo.trial.project'], this.project);
    await this.docker(['stop', '-t', '10', this.host]); await this.docker(['rm', this.host]); this.active = false;
  }
  async initialize(manifest) {
    if (existsSync(join(this.state, '.env'))) return;
    const secret = generateStorageSecret;
    const values = { COMPOSE_PROJECT_NAME: this.project, REVISION: manifest.sourceCommit, POSTGRES_PASSWORD: secret(), JWT_SECRET: secret(),
      PLUGIN_SECRETS_KEY: randomBytes(32).toString('base64'), MINIO_ROOT_USER: secret(), MINIO_ROOT_PASSWORD: secret(),
      PLUGIN_PAGE_TOKEN_SECRET: randomBytes(32).toString('base64'),
      PLUGIN_FILE_URL_SECRET: randomBytes(32).toString('base64'),
      SILO_APP_ACCESS_KEY_ID: secret(), SILO_APP_SECRET_ACCESS_KEY: secret(), UPLOAD_S3_BUCKET: 'jiffoo-uploads',
      STOREFRONT_URL: `https://shop.localhost:${this.port}`, ADMIN_URL: `https://admin.localhost:${this.port}`, EDGE_PORT: this.port,
      TLS_CERT_FILE: this.directory + '/tls/cert.pem', TLS_KEY_FILE: this.directory + '/tls/key.pem' };
    writeFileSync(join(this.state, '.env'), Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
    this.loadSecrets();
    await this.linux('mkdir', ['-p', this.directory + '/tls']);
    await this.docker(['run', '--rm', '--label', `com.docker.compose.project=${this.project}`, '--network', 'none', '--user', '0:0',
      '--mount', `type=volume,source=${this.volume},target=${this.directory}`, '--entrypoint', 'openssl', manifest.verifierImage,
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365', '-keyout', values.TLS_KEY_FILE, '-out', values.TLS_CERT_FILE,
      '-subj', '/CN=shop.localhost', '-addext', 'subjectAltName=DNS:shop.localhost,DNS:admin.localhost']);
    await this.linux('chown', ['1000:1000', values.TLS_CERT_FILE, values.TLS_KEY_FILE]);
    await this.linux('chmod', ['600', values.TLS_KEY_FILE]); await this.linux('chmod', ['644', values.TLS_CERT_FILE]);
    await this.docker(['cp', `${this.host}:${this.directory}/tls`, this.state]);
  }
  async build({ commit, version, allowDirty = false } = {}) {
    assert.ok(!allowDirty || this.acceptance, 'Only the acceptance harness may build an uncommitted tree');
    if (!allowDirty) assert.equal((await this.run('git', ['status', '--porcelain'])).stdout.trim(), '', 'Working tree is dirty; commit changes before trial:up or trial:update.');
    const head = (await this.run('git', ['rev-parse', 'HEAD'])).stdout.trim();
    commit ??= head;
    if (!this.acceptance) assert.equal(commit, head);
    assert.match(commit, /^[a-f0-9]{40}$/);
    version ??= JSON.parse(readFileSync(join(this.root, 'package.json'))).version.replace(/-opensource$/, '');
    const generation = 'release-' + randomUUID(), output = join(this.state, generation), inspections = join(this.state, generation + '-inspection');
    mkdirSync(inspections, { mode: 0o700 });
    for (const role of ['backend', 'admin', 'shop']) {
      const tag = `${this.project}-${generation}-${role}`; this.tags.push(tag);
      await this.docker(['build', '--platform', 'linux/amd64', '-f', join(this.root, 'deploy/compose/Dockerfile'), '--target', role,
        '--build-arg', `REVISION=${commit}`, '--build-arg', `RELEASE_VERSION=${version}`, '-t', tag, this.root], { quiet: false });
      writeFileSync(join(inspections, role + '.json'), (await this.docker(['image', 'inspect', tag])).stdout);
    }
    const compose = readFileSync(join(this.root, 'deploy/compose/compose.yml'), 'utf8');
    for (const role of ['postgres', 'redis', 'silo', 'nginx']) {
      const reference = compose.match(new RegExp('image: (' + (role === 'silo' ? 'pgsty/silo' : role) + ':[^\\s]+@sha256:[a-f0-9]{64})'))[1];
      if ((await this.docker(['image', 'inspect', reference], { allowFailure: true })).code !== 0) await this.docker(['pull', '--platform', 'linux/amd64', reference]);
      writeFileSync(join(inspections, role + '.json'), (await this.docker(['image', 'inspect', reference])).stdout);
    }
    const manifest = makeRelease({ root: this.root, output, inspections, commit, version, mode: 'acceptance' });
    await this.initialize(manifest);
    writeFileSync(join(output, 'deploy/compose/.env'), this.environment.replace(/^REVISION=.*$/m, 'REVISION=' + commit), { mode: 0o600 });
    const release = this.directory + '/' + generation;
    await this.docker(['cp', output, `${this.host}:${release}`]);
    if (this.acceptance) {
      // Isolated acceptance uses the test database only, without extra services.
      const config = JSON.parse((await this.linux('docker', ['compose', '--project-name', this.project, '--env-file', release + '/deploy/compose/.env',
        '-f', release + '/deploy/compose/compose.yml', '-f', release + '/deploy/compose/compose.release.yml', 'config', '--format', 'json'])).stdout);
      config.services.postgres.environment.POSTGRES_DB = 'jiffoo_core_test';
      for (const service of ['api-1', 'api-2', 'worker-1', 'worker-2', 'db-init', 'silo-volume-init']) config.services[service].environment.DATABASE_URL = config.services[service].environment.DATABASE_URL.replace('/jiffoo_core', '/jiffoo_core_test');
      const override = join(output, 'deploy/compose/compose.release.yml');
      writeFileSync(override, JSON.stringify(config));
      // A release file is changed before sealing its manifest, never afterwards.
      const { sha256 } = await import('../deploy/release/identity.mjs');
      const row = manifest.deployment.find(item => item.path === 'deploy/compose/compose.release.yml');
      const bytes = readFileSync(override); row.sha256 = sha256(bytes); row.size = bytes.length;
      writeFileSync(join(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
      await this.docker(['cp', override, `${this.host}:${release}/deploy/compose/compose.release.yml`]);
      await this.docker(['cp', join(output, 'release.json'), `${this.host}:${release}/release.json`]);
    }
    rmSync(inspections, { recursive: true, force: true });
    await this.linux('sh', [release + '/bin/jiffoo-host', 'verify', release, commit, '--acceptance'], { quiet: false });
    return { release, manifest, output };
  }
  compose(args, options) {
    assert.ok(this.record.release, 'No trial deployment is recorded');
    return this.linux('docker', ['compose', '--project-name', this.project, ...(this.record.config ? ['-f', this.record.config]
      : ['--env-file', this.record.release + '/deploy/compose/.env', '-f', this.record.release + '/deploy/compose/compose.yml', '-f', this.record.release + '/deploy/compose/compose.release.yml']), ...args], options);
  }
  hostCommand(args, options) { return this.linux('sh', [this.record.release + '/bin/jiffoo-host', ...args, '--acceptance'], options); }
  async up(buildOptions) {
    const head = (await this.run('git', ['rev-parse', 'HEAD'])).stdout.trim();
    if (!this.acceptance) assert.equal((await this.run('git', ['status', '--porcelain'])).stdout.trim(), '', 'Working tree is dirty; commit changes first.');
    if (this.record.release && !this.acceptance) assert.equal(this.record.commit, head, 'The trial runs an older release. Run pnpm trial:update.');
    await requireFreePort(this.port);
    const networks = (await this.docker(['network', 'ls', '-q'])).stdout.trim().split(/\s+/).filter(Boolean);
    if (networks.length) {
      const rows = JSON.parse((await this.docker(['network', 'inspect', ...networks])).stdout);
      assert.ok(!rows.some(row => row.Labels?.['com.docker.compose.project'] !== this.project && row.IPAM?.Config?.some(item => item.Subnet === '172.30.65.0/24')), 'The Compose subnet is in use by another project');
    }
    if (!this.record.release) {
      const built = await this.build(buildOptions); this.record.release = built.release; this.record.commit = built.manifest.sourceCommit; this.record.version = built.manifest.version; this.save();
    }
    await this.compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '600', 'edge'], { quiet: false });
    console.info(`Shop: https://shop.localhost:${this.port}\nAdmin: https://admin.localhost:${this.port}\nFirst run: open Admin, complete installation and create your administrator account.\nLocal TLS: accept the browser certificate warning for these localhost URLs only.`);
  }
  async backup() {
    const name = 'backup-' + randomUUID(), destination = this.directory + '/backups/' + name;
    await this.compose(['stop', '-t', '45', 'edge', 'shop', 'admin', 'api-lb', 'worker-1', 'worker-2', 'api-1', 'api-2', 'redis', 'silo'], { quiet: false });
    try {
      await this.hostCommand(['backup', this.record.release, this.project, destination], { quiet: false });
      mkdirSync(join(this.state, 'backups'), { recursive: true, mode: 0o700 });
      await this.docker(['cp', `${this.host}:${destination}`, join(this.state, 'backups', name)]);
      console.info('Backup: ' + join(this.state, 'backups', name)); return destination;
    } finally { await this.compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '600', 'edge'], { quiet: false }); }
  }
  async update(buildOptions) {
    const built = await this.build(buildOptions), generation = 'update-' + randomUUID(), state = this.directory + '/' + generation, backup = this.directory + '/backups/' + generation;
    const args = ['update', '--project', this.project, '--current-release', this.record.release, '--target-release', built.release, '--target-commit', built.manifest.sourceCommit,
      '--state-dir', state, '--backup-dir', backup, '--actor', 'local-trial-operator'];
    await this.hostCommand(['verify', built.release, built.manifest.sourceCommit], { quiet: false });
    const updateHost = (arguments_, options) => this.linux('sh', [built.release + '/bin/jiffoo-host', ...arguments_, '--acceptance'], options);
    const plan = await updateHost([...args, '--plan'], { quiet: false });
    const digest = plan.stdout.match(/Update plan: ([a-f0-9]{64})/)[1];
    if (!/Pending Core migrations: 0\nPending plugin migrations: 0\n/.test(plan.stdout)) await askExact(`PLAN_SHA256: ${digest}\nPaste PLAN_SHA256 to confirm migrations: `, digest);
    let result;
    try { result = await updateHost([...args, '--confirm', digest], { quiet: false }); }
    finally {
      mkdirSync(join(this.state, 'backups'), { recursive: true, mode: 0o700 });
      await this.docker(['cp', `${this.host}:${backup}`, join(this.state, 'backups', generation)], { allowFailure: true });
      await this.docker(['cp', `${this.host}:${state}`, join(this.state, generation)], { allowFailure: true });
    }
    assert.equal(result.code, 0);
    this.record.release = state + '/deployment/release'; this.record.config = state + '/next-config.json';
    this.record.commit = built.manifest.sourceCommit; this.record.version = built.manifest.version; this.save();
  }
  async restore(backupName) {
    assert.match(backupName ?? '', /^(?:backup|update)-[a-f0-9-]{36}$/);
    const backup = this.directory + '/backups/' + backupName;
    const hash = (await this.linux('cat', [backup + '/backup.sha256'])).stdout.trim();
    await askExact(`Restore replaces the active trial using new volumes; old volumes are retained.\nBackup SHA-256: ${hash}\nPaste this hash to confirm: `, hash);
    await this.compose(['stop', '-t', '45'], { quiet: false });
    const destination = this.directory + '/restore-' + randomUUID();
    await this.hostCommand(['restore', backup, this.project, destination, hash, '--actor', 'local-trial-operator'], { quiet: false });
    const manifest = JSON.parse((await this.linux('cat', [destination + '/release/release.json'])).stdout);
    this.record.release = destination + '/release'; this.record.config = destination + '/compose.restore.json'; this.record.commit = manifest.sourceCommit; this.record.version = manifest.version; this.save();
  }
  async destroy({ confirmed = false } = {}) {
    assert.ok(!confirmed || this.acceptance, 'Non-interactive destroy is acceptance-only');
    if (!confirmed) await askExact(`This deletes ALL trial data and backups. Type ${this.project}: `, this.project);
    if (this.record.release) await this.compose(['down', '--timeout', '45'], { quiet: false });
    const volumes = (await this.docker(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${this.project}`])).stdout.trim().split(/\s+/).filter(Boolean);
    for (const name of volumes) {
      const row = JSON.parse((await this.docker(['volume', 'inspect', name])).stdout)[0]; assert.equal(row.Labels['com.docker.compose.project'], this.project);
      assert.equal((await this.docker(['ps', '-aq', '--filter', 'volume=' + name])).stdout.trim(), '', 'A volume is still mounted; it was not removed');
      await this.docker(['volume', 'rm', name]);
    }
    await this.close();
    await this.docker(['volume', 'rm', this.volume]);
    const tags = (await this.docker(['image', 'ls', '--format', '{{.Repository}}:{{.Tag}}', '--filter', `reference=${this.project}-release-*`])).stdout.trim().split('\n').filter(Boolean);
    for (const tag of tags) await this.docker(['image', 'rm', tag]);
    rmSync(this.state, { recursive: true, force: true });
  }
}

async function main() {
  const [action, ...args] = process.argv.slice(2);
  assert.ok(trialActions.includes(action), 'Unknown trial command');
  assert.ok(action === 'restore' ? args.length === 1 : args.length === 0, 'Only trial:restore accepts a backup directory name');
  assert.ok(process.env.LOCALAPPDATA, 'Local trial requires Windows LOCALAPPDATA');
  const trial = new LocalTrial();
  try {
    await trial.open({ create: action === 'up' });
    if (action === 'up') await trial.up();
    else if (action === 'update') await trial.update();
    else if (action === 'backup') await trial.backup();
    else if (action === 'restore') await trial.restore(args[0]);
    else if (action === 'destroy') await trial.destroy();
    else await trial.compose(action === 'status' ? ['ps', '-a'] : action === 'logs' ? ['logs', '--no-color', '--tail', '200'] : ['down', '--timeout', '45'], { quiet: false });
  } finally { await trial.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
