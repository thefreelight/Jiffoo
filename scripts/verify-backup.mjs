import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { ComposeVolumeLedger, RecordedAcceptanceChecks, assertDeploymentConfig } from './compose-volumes.mjs';
import { makeRelease } from '../deploy/release/prepare.mjs';
import { sha256 } from '../deploy/release/identity.mjs';
import { BackupHostEmulator, emulatorImage } from './backup-host-emulator.mjs';
import { archiveComposeStartup, withComposeStartupDiagnostics } from './compose-startup.mjs';

export function guardBackupDatabase(url) {
  assert.equal(url, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test', 'Backup acceptance requires the exact jiffoo_core_test DATABASE_URL_TEST');
}
const step = 'Run backup and restore acceptance';

async function main() {
  guardBackupDatabase(process.env.DATABASE_URL_TEST);
  const started = new Date().toISOString(), start = performance.now(), project = 'jiffoo-backup-' + randomUUID();
  const native = mkdtempSync(join(tmpdir(), project + '-'));
  const evidence = resolve(process.env.GITHUB_ACTIONS === 'true' ? join(process.env.RUNNER_TEMP, 'verification') : join('e2e/test-results', project));
  mkdirSync(evidence, { recursive: true });
  const emulator = process.platform === 'win32' ? new BackupHostEmulator(project, process.cwd(), native) : undefined;
  const root = emulator ? '/workspace' : process.cwd();
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  const version = JSON.parse(readFileSync('package.json')).version.replace(/-opensource$/, '');
  const commands = [], tags = [], ports = [];
  let directory, bundle, backup, restored, release, proof, expected, manifestHash, foreignBefore, hostUser, backupSize, backupTime, restoreTime;
  let secrets = [];
  const run = async (command, args, { allowFailure = false, quiet = false } = {}) => {
    const commandStart = performance.now();
    const result = emulator ? await emulator.run(command, args) : await new Promise((done, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.once('error', reject);
    child.once('close', code => {
      const output = stdout + stderr;
      done({ code, stdout, output });
    });
  });
    result.duration = ((performance.now() - commandStart) / 1000).toFixed(2) + 's';
    commands.push({ command, args, code: result.code, duration: result.duration, ...(quiet ? {} : { output: result.output }) });
    if (result.code !== 0 && !allowFailure) throw new Error(`${command} ${args.slice(0, 2).join(' ')} exited ${result.code}${quiet ? '' : ': ' + result.output}`);
    return result;
  };
  const docker = (args, options) => run('docker', args, options);
  const volumes = new ComposeVolumeLedger(project, async args => (await docker(args, { quiet: true })).stdout);
  const checks = new RecordedAcceptanceChecks(volumes, async (events, owned) => {
    writeFileSync(join(evidence, 'volume-mounts.json'), JSON.stringify({ project, events, owned }, null, 2));
  });
  const resources = async () => {
    const containers = (await docker(['ps', '-aq'], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
    const state = containers.length ? JSON.parse((await docker(['inspect', ...containers], { quiet: true })).stdout) : [];
    return {
      containers: state.filter(c => c.Config.Labels?.['com.docker.compose.project'] !== project && c.Config.Labels?.['io.jiffoo.acceptance.project'] !== project).map(c => ({ id: c.Id, running: c.State.Running, startedAt: c.State.StartedAt, mounts: c.Mounts.map(m => m.Name ?? m.Source).sort() })).sort((a, b) => a.id.localeCompare(b.id)),
      networks: (await docker(['network', 'ls', '--format', '{{.ID}} {{.Name}}'], { quiet: true })).stdout.trim().split('\n').filter(line => !line.includes(project)).sort(),
      volumes: (await docker(['volume', 'ls', '--format', '{{.Name}}'], { quiet: true })).stdout.trim().split('\n').filter(line => !line.includes(project)).sort(),
    };
  };
  const compose = (args, file = bundle + '/deploy/compose/compose.release.yml', options) => docker(['compose', '--project-name', project, '--env-file', bundle + '/deploy/compose/.env', '-f', bundle + '/deploy/compose/compose.yml', '-f', file, ...args], options);
  const startupDiagnostics = () => ({
    project, query: async args => (await docker(args, { quiet: true })).stdout,
    logs: async service => (await compose(['logs', '--no-color', '--no-log-prefix', ...(service ? [service] : [])], undefined, { quiet: true })).output,
    save: async (name, output) => writeFileSync(join(evidence, name), output), secrets,
  });
  const host = (args, options) => run('sh', [bundle + '/bin/jiffoo-host', ...args, ...(args[0] === 'restore' ? ['--actor', 'acceptance-operator'] : []), '--acceptance'], options);
  const fixture = async (mode, file = bundle + '/deploy/compose/compose.release.yml') => {
    const result = await compose(['exec', '-T', '-e', 'DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test', 'api-1', 'node', '/app/deploy/compose/backup-scenario.mjs', mode, ...(proof ? [JSON.stringify(proof)] : [])], file);
    const prefix = mode === 'seed' ? 'BACKUP_PROOF ' : mode === 'snapshot' ? 'BACKUP_SNAPSHOT ' : undefined;
    if (prefix) { const line = result.stdout.split('\n').find(line => line.startsWith(prefix)); assert.ok(line, 'Missing fixture proof'); return JSON.parse(line.slice(prefix.length)); }
  };
  const helper = async (command, source = backup, extra = '', allowFailure = false) => docker(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', 'none', '--read-only', '--user', hostUser, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--entrypoint', 'node',
    '--mount', `type=bind,source=${source},target=/backup`, release.verifierImage, '/app/deploy/release/backup.mjs', command, '/backup', project, 'acceptance', extra], { allowFailure });
  try {
    await checks.run('Docker and Linux host preflight', [], async () => {
      if (emulator) { await emulator.start(); console.info('Local Linux host emulator: ' + emulatorImage); }
      assert.match((await docker(['version'])).stdout, /Server:/); await docker(['compose', 'version']);
      assert.equal((await run('uname', ['-s'])).stdout.trim(), 'Linux');
      hostUser = (await run('id', ['-u'])).stdout.trim() + ':' + (await run('id', ['-g'])).stdout.trim();
      const temporaryRoot = emulator?.root ?? '/tmp';
      directory = (await run('mktemp', ['-d', temporaryRoot + '/' + project + '-XXXXXX'])).stdout.trim();
      assert.ok(directory.startsWith(temporaryRoot + '/' + project + '-'));
      bundle = directory + '/bundle'; backup = directory + '/backup'; restored = directory + '/restored';
      foreignBefore = await resources(); writeFileSync(join(evidence, 'resources-before.json'), JSON.stringify(foreignBefore, null, 2));
      const ids = (await docker(['network', 'ls', '-q'], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
      if (ids.length) assert.ok(!JSON.parse((await docker(['network', 'inspect', ...ids], { quiet: true })).stdout).some(n => n.IPAM?.Config?.some(c => c.Subnet === '172.30.65.0/24')), 'Acceptance subnet is already in use; foreign projects were not changed');
    });
    await checks.run('Build recorded release images', ['Docker and Linux host preflight'], async () => {
      const inspections = join(native, 'inspection'); mkdirSync(inspections);
      for (const role of ['backend', 'admin', 'shop']) {
        const tag = project + '-' + role; tags.push(tag);
        const result = await docker(['build', '--platform', 'linux/amd64', '-f', root + '/deploy/compose/Dockerfile', '--target', role, '--build-arg', `REVISION=${commit}`, '--build-arg', `RELEASE_VERSION=${version}`, '-t', tag, root]);
        process.stdout.write(result.output.split(/\r?\n/).slice(-3).join('\n') + '\n');
        writeFileSync(join(inspections, role + '.json'), (await docker(['image', 'inspect', tag], { quiet: true })).stdout);
      }
      const yaml = readFileSync('deploy/compose/compose.yml', 'utf8');
      for (const role of ['postgres', 'redis', 'silo', 'nginx']) {
        const reference = yaml.match(new RegExp('image: (' + (role === 'silo' ? 'pgsty/silo' : role) + ':[^\\s]+@sha256:[a-f0-9]{64})'))[1];
        if ((await docker(['image', 'inspect', reference], { allowFailure: true, quiet: true })).code !== 0) await docker(['pull', '--platform', 'linux/amd64', reference]);
        writeFileSync(join(inspections, role + '.json'), (await docker(['image', 'inspect', reference], { quiet: true })).stdout);
      }
      const nativeBundle = join(native, 'bundle');
      release = makeRelease({ root: process.cwd(), output: nativeBundle, inspections, commit, version, mode: 'acceptance' });
      // The acceptance release uses only its own jiffoo_core_test PostgreSQL.
      const override = join(nativeBundle, 'deploy/compose/compose.release.yml');
      const addition = '\n  postgres:\n    environment:\n      POSTGRES_DB: jiffoo_core_test\n';
      let text = readFileSync(override, 'utf8');
      for (const service of ['api-1', 'api-2', 'worker-1', 'worker-2', 'db-init', 'silo-volume-init']) text = text.replace(`  ${service}:\n`, `  ${service}:\n    environment:\n      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/jiffoo_core_test\n`);
      writeFileSync(override, text + addition);
      const bytes = readFileSync(override), member = release.deployment.find(file => file.path.endsWith('compose.release.yml')); member.sha256 = sha256(bytes); member.size = bytes.length;
      writeFileSync(join(nativeBundle, 'release.json'), JSON.stringify(release, null, 2) + '\n');
      const env = { COMPOSE_PROJECT_NAME: project, REVISION: commit, POSTGRES_PASSWORD: 'postgres', JWT_SECRET: randomBytes(48).toString('base64url'), PLUGIN_SECRETS_KEY: randomBytes(32).toString('base64'),
        MINIO_ROOT_USER: 'backup-' + randomUUID(), MINIO_ROOT_PASSWORD: randomBytes(48).toString('base64url'), UPLOAD_S3_BUCKET: 'backup-' + randomUUID(),
        SILO_APP_ACCESS_KEY_ID: 'app-' + randomUUID(), SILO_APP_SECRET_ACCESS_KEY: randomBytes(48).toString('base64url'), STOREFRONT_URL: 'https://backup-shop.test', ADMIN_URL: 'https://backup-admin.test', EDGE_PORT: '0',
        TLS_CERT_FILE: bundle + '/cert.pem', TLS_KEY_FILE: bundle + '/key.pem' };
      secrets = [env.JWT_SECRET, env.PLUGIN_SECRETS_KEY, env.MINIO_ROOT_USER, env.MINIO_ROOT_PASSWORD, env.SILO_APP_ACCESS_KEY_ID, env.SILO_APP_SECRET_ACCESS_KEY];
      writeFileSync(join(nativeBundle, 'deploy/compose/.env'), Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
      await run('cp', ['-R', emulator ? '/input/bundle' : nativeBundle, bundle]);
      await run('chmod', ['-R', 'u=rwX,go=', bundle]);
      await run('chmod', ['777', bundle]);
      await docker(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', 'none', '--user', '1000:1000', '--mount', `type=bind,source=${bundle},target=/tls`, '--entrypoint', 'openssl', release.verifierImage,
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', '/tls/key.pem', '-out', '/tls/cert.pem', '-subj', '/CN=backup-shop.test', '-addext', 'subjectAltName=DNS:backup-shop.test,DNS:backup-admin.test'], { quiet: true });
      // Only disposable acceptance TLS is readable across runner/runtime UIDs.
      await docker(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', 'none', '--user', '1000:1000', '--mount', `type=bind,source=${bundle},target=/tls`, '--entrypoint', 'chmod', release.verifierImage, '644', '/tls/cert.pem', '/tls/key.pem'], { quiet: true });
      await run('chmod', ['700', bundle]);
      for (const file of ['api-lb.conf', 'edge.conf.template', 'silo-init.sh']) await run('chmod', ['644', bundle + '/deploy/compose/' + file]);
      await run('chmod', ['755', bundle + '/deploy/compose/15-edge-hosts.envsh']);
      await compose(['config', '--quiet']);
    });
    await checks.run('Start isolated two API two worker stack', ['Build recorded release images'], () => withComposeStartupDiagnostics(() => compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '600', 'edge']), startupDiagnostics()));
    await checks.run('No anonymous volumes after startup', ['Start isolated two API two worker stack'], () => volumes.assertNoAnonymousVolumes());
    await checks.run('Create owner product paid order image and plugin schema data', ['Start isolated two API two worker stack'], async () => { proof = await fixture('seed'); });
    await checks.run('Refuse backup while application containers run', ['Start isolated two API two worker stack'], async () => {
      const result = await host(['backup', bundle, project, directory + '/unsafe-backup'], { allowFailure: true });
      assert.notEqual(result.code, 0); assert.match(result.output, /requires maintenance/);
      assert.notEqual((await run('test', ['-e', directory + '/unsafe-backup'], { allowFailure: true })).code, 0);
    });
    await checks.run('Maintenance stops applications Redis and Silo', ['Create owner product paid order image and plugin schema data'], () => compose(['stop', '-t', '45', 'edge', 'shop', 'admin', 'api-lb', 'worker-1', 'worker-2', 'api-1', 'api-2', 'redis', 'silo']));
    await checks.run('Create consistent protected backup', ['Maintenance stops applications Redis and Silo'], async () => {
      const result = await host(['backup', bundle, project, backup]);
      backupTime = result.duration;
      process.stdout.write(result.output); manifestHash = result.stdout.match(/Backup manifest SHA-256: ([a-f0-9]{64})/)[1];
      backupSize = Number(result.stdout.match(/Backup bytes: (\d+)/)[1]);
      assert.match(result.output, /Contains secrets and customer data; protect it off-host/);
    });
    await checks.run('No anonymous volumes after backup', ['Create consistent protected backup'], () => volumes.assertNoAnonymousVolumes());
    await checks.run('Verify complete checksum inventory and 0700 0600 permissions', ['Create consistent protected backup'], async () => {
      const data = JSON.parse((await helper('inspect')).stdout);
      assert.equal(data.hash, manifestHash);
      for (const member of data.permissions) assert.equal(member.mode, member.path === '/' || !data.manifest.files.some(f => '/' + f.path === member.path) && !['/backup.json', '/backup.sha256'].includes(member.path) ? 0o700 : 0o600, member.path);
      assert.equal(data.manifest.redis, 'empty-on-restore');
      assert.ok(!data.manifest.files.some(file => file.path.includes('redis')));
      writeFileSync(join(evidence, 'backup-metadata.json'), JSON.stringify(data, null, 2));
    });
    await checks.run('Capture backup point row and object hashes', ['Create consistent protected backup'], async () => {
      await withComposeStartupDiagnostics(() => compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '600', 'edge']), startupDiagnostics());
      expected = await fixture('snapshot'); writeFileSync(join(evidence, 'backup-point-hashes.json'), JSON.stringify(expected, null, 2));
    });
    await checks.run('Refuse restore while target containers run', ['Capture backup point row and object hashes'], async () => {
      const result = await host(['restore', backup, project, directory + '/unsafe-restore', manifestHash], { allowFailure: true });
      assert.notEqual(result.code, 0); assert.match(result.output, /every target project container/);
    });
    await checks.run('Mutate database plugin schema and uploaded bytes after backup', ['Capture backup point row and object hashes'], async () => {
      await fixture('mutate'); const actual = await fixture('snapshot');
      for (const name of ['product', 'pluginRecords', 'objectBytes']) assert.notEqual(actual[name], expected[name]);
      await compose(['exec', '-T', 'redis', 'redis-cli', 'SET', 'backup-post-snapshot', 'must-not-survive']);
    });
    await checks.run('Stop every target application and data container', ['Mutate database plugin schema and uploaded bytes after backup'], () => compose(['stop', '-t', '45']));
    await checks.run('Reject wrong confirmation hash', ['Stop every target application and data container'], async () => {
      const result = await host(['restore', backup, project, directory + '/wrong-confirmation', '0'.repeat(64)], { allowFailure: true });
      assert.notEqual(result.code, 0); assert.match(result.output, /Confirmation must equal/);
    });
    for (const [name, command, args] of [
      ['Reject corrupted backup file', 'sh', ['-c', 'printf corrupted >> "$1/database.sql"', 'fixture']],
      ['Reject missing backup file', 'rm', []],
    ]) await checks.run(name, ['Stop every target application and data container', 'Create consistent protected backup'], async () => {
      const copy = directory + '/' + (command === 'rm' ? 'missing' : 'corrupt');
      await run('cp', ['-R', backup, copy]);
      if (command === 'rm') await run(command, [copy + '/silo.tar']); else await run(command, [...args, copy]);
      const result = await host(['restore', copy, project, copy + '-restore', manifestHash], { allowFailure: true });
      assert.notEqual(result.code, 0); assert.match(result.output, /checksum mismatch|filesystem operation failed/);
      assert.notEqual((await run('test', ['-e', copy + '-restore'], { allowFailure: true })).code, 0);
    });
    await checks.run('Failed logical restore stops the target stack and retains new and old volumes', ['Stop every target application and data container', 'Verify complete checksum inventory and 0700 0600 permissions'], async () => {
      const copy = directory + '/failed-dump'; await run('cp', ['-R', backup, copy]);
      const fixtureCode = "const f=require('fs'),c=require('crypto');const h=p=>c.createHash('sha256').update(f.readFileSync(p)).digest('hex');f.appendFileSync('/backup/database.sql','\\nSELECT * FROM jiffoo_backup_restore_failure;\\n');const m=JSON.parse(f.readFileSync('/backup/backup.json'));const a=m.files.find(v=>v.path==='database.sql');a.size=f.statSync('/backup/database.sql').size;a.sha256=h('/backup/database.sql');f.writeFileSync('/backup/backup.json',JSON.stringify(m,null,2)+'\\n');const hash=h('/backup/backup.json');f.writeFileSync('/backup/backup.sha256',hash+'\\n');console.log(hash);";
      const changedHash = (await docker(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', 'none', '--user', hostUser, '--mount', `type=bind,source=${copy},target=/backup`, '--entrypoint', 'node', release.verifierImage, '-e', fixtureCode])).stdout.trim();
      const result = await host(['restore', copy, project, directory + '/failed-restore', changedHash], { allowFailure: true });
      assert.notEqual(result.code, 0); assert.match(result.output, /Restore failed during: restore-postgresql/); assert.match(result.output, /Created volumes \(retained\)/);
      const ids = (await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
      const actual = JSON.parse((await docker(['inspect', ...ids], { quiet: true })).stdout); assert.ok(actual.every(c => !c.State.Running));
      const metadata = JSON.parse((await helper('inspect')).stdout);
      for (const name of Object.values(metadata.manifest.oldVolumes)) await docker(['volume', 'inspect', name], { quiet: true });
    });
    await checks.run('Restore into new volumes and pass recorded release health checks', ['Stop every target application and data container', 'Verify complete checksum inventory and 0700 0600 permissions'], async () => {
      const result = await host(['restore', backup, project, restored, manifestHash]); restoreTime = result.duration; process.stdout.write(result.output);
      assert.match(result.output, /recorded release is healthy/);
      const inspected = await docker(['compose', '--project-name', project, '-f', restored + '/compose.restore.json', 'exec', '-T', '-e', 'DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test', 'api-1', 'node', '/app/deploy/compose/host-audit-check.mjs'], { quiet: true });
      const rows = JSON.parse(inspected.stdout.split('\n').find(line => line.startsWith('HOST_AUDITS ')).slice(12));
      const event = rows.at(-1); assert.equal(event.action, 'CORE_RESTORE'); assert.equal(event.actorId, 'acceptance-operator');
      assert.equal(event.summary.backupManifestHash, manifestHash); assert.equal(event.summary.restoredRelease.commit, commit);
      writeFileSync(join(evidence, 'restore-merchant-audit.json'), JSON.stringify(event, null, 2));
    });
    await checks.run('No anonymous volumes after restore', ['Restore into new volumes and pass recorded release health checks'], () => volumes.assertNoAnonymousVolumes());
    await checks.run('Every restored container uses the restored configuration and a second backup succeeds', ['Restore into new volumes and pass recorded release health checks'], async () => {
      await assertDeploymentConfig(async args => (await docker(args, { quiet: true })).stdout, project, restored + '/compose.restore.json');
      await docker(['compose', '--project-name', project, '-f', restored + '/compose.restore.json', 'stop', '-t', '45', 'edge', 'shop', 'admin', 'api-lb', 'worker-1', 'worker-2', 'api-1', 'api-2', 'redis', 'silo']);
      const second = directory + '/restored-backup';
      const result = await host(['backup', restored + '/release', project, second]); process.stdout.write(result.output);
      const metadata = JSON.parse((await helper('inspect', second)).stdout);
      const configBytes = (await run('cat', [second + '/config.json'], { quiet: true })).stdout;
      assert.equal(metadata.manifest.files.find(row => row.path === 'config.json').sha256, sha256(Buffer.from(configBytes)));
      const config = JSON.parse((await run('cat', [restored + '/compose.restore.json'], { quiet: true })).stdout);
      for (const [logical, volume] of Object.entries(config.volumes)) assert.equal(metadata.manifest.oldVolumes[logical], volume.name);
      await docker(['compose', '--project-name', project, '-f', restored + '/compose.restore.json', 'up', '-d', '--force-recreate', '--no-build', '--wait', '--wait-timeout', '600']);
      await assertDeploymentConfig(async args => (await docker(args, { quiet: true })).stdout, project, restored + '/compose.restore.json');
    });
    await checks.run('Restored rows plugin schema privileges and object bytes equal backup point', ['Restore into new volumes and pass recorded release health checks', 'Capture backup point row and object hashes'], async () => {
      const actual = await fixture('snapshot', restored + '/compose.restore.json'); assert.deepEqual(actual, expected);
    });
    await checks.run('Enabled plugin serves restored schema data on both APIs', ['Restore into new volumes and pass recorded release health checks'], () => fixture('plugin-health', restored + '/compose.restore.json'));
    await checks.run('Old volumes retained and distinct from all restored data volumes', ['Restore into new volumes and pass recorded release health checks'], async () => {
      const data = JSON.parse((await helper('inspect')).stdout);
      const ids = (await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
      const actual = JSON.parse((await docker(['inspect', ...ids], { quiet: true })).stdout);
      for (const old of Object.values(data.manifest.oldVolumes)) { await docker(['volume', 'inspect', old], { quiet: true }); assert.ok(!actual.some(c => c.Mounts.some(m => m.Name === old))); }
      const redis = (await compose(['exec', '-T', 'redis', 'redis-cli', 'EXISTS', 'backup-post-snapshot'], restored + '/compose.restore.json')).stdout.trim(); assert.equal(redis, '0');
    });
  } finally {
    await checks.run('Archive isolated stack logs and published ports', [], async () => {
      if (bundle) await archiveComposeStartup(startupDiagnostics());
      const ids = (await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
      if (ids.length) {
        const actual = JSON.parse((await docker(['inspect', ...ids], { quiet: true })).stdout);
        for (const c of actual) for (const values of Object.values(c.NetworkSettings.Ports ?? {})) for (const value of values ?? []) ports.push(Number(value.HostPort));
        const logs = [];
        for (const c of actual) logs.push((await docker(['logs', c.Id], { allowFailure: true })).output);
        writeFileSync(join(evidence, 'stack.log'), logs.join('\n'));
      }
    });
    await checks.run('Remove only UUID project resources', [], async () => {
      assert.match(project, /^jiffoo-backup-[a-f0-9-]{36}$/);
      const ids = (await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
      if (ids.length) { await docker(['stop', '-t', '45', ...ids], { quiet: true }); await docker(['rm', '--volumes', ...ids], { quiet: true }); }
      const networks = (await docker(['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
      if (networks.length) await docker(['network', 'rm', ...networks], { quiet: true });
      for (const tag of tags) await docker(['image', 'rm', tag], { allowFailure: true, quiet: true });
      if (directory) { assert.ok(directory.startsWith((emulator?.root ?? '/tmp') + '/' + project + '-')); await run('rm', ['-rf', directory]); }
      if (emulator) await emulator.close();
      await volumes.removeVolumes(name => docker(['volume', 'rm', name], { quiet: true }));
      rmSync(native, { recursive: true, force: true });
    });
    for (const [kind, args] of [['containers', ['ps', '-aq']], ['networks', ['network', 'ls', '-q']], ['volumes', ['volume', 'ls', '-q']]]) await checks.run('No UUID ' + kind + ' remain', [], async () => assert.equal((await docker([...args, '--filter', `label=com.docker.compose.project=${project}`])).stdout.trim(), ''));
    await checks.run('No UUID image tags remain', [], async () => assert.equal((await docker(['image', 'ls', '-q', '--filter', `reference=${project}-*`])).stdout.trim(), ''));
    await checks.run('No published listeners remain', [], async () => {
      for (const port of ports) {
        const listening = await new Promise(done => {
          const socket = connect({ host: '127.0.0.1', port }); socket.setTimeout(1000);
          socket.once('connect', () => { socket.destroy(); done(true); }); socket.once('error', () => done(false)); socket.once('timeout', () => { socket.destroy(); done(false); });
        }); assert.equal(listening, false, `Port ${port} remains in use`);
      }
    });
    await checks.run('Foreign containers networks and volumes are unchanged', ['Docker and Linux host preflight'], async () => {
      const after = await resources(); writeFileSync(join(evidence, 'resources-after.json'), JSON.stringify(after, null, 2)); assert.deepEqual(after, foreignBefore);
    });
    writeFileSync(join(evidence, 'commands.json'), JSON.stringify(commands, null, 2));
    writeFileSync(join(evidence, 'checks.json'), JSON.stringify(checks.rows, null, 2));
  }
  const duration = ((performance.now() - start) / 1000).toFixed(2) + 's', counts = checks.counts();
  const summary = `Backup start time: ${started}\nBackup results: ${counts.PASS} passed, ${counts.FAIL} failed, ${counts.SKIPPED} skipped\nBackup project: ${project}\nBackup duration: ${duration}\nBackup bytes: ${backupSize ?? 'not created'}\nBackup command duration: ${backupTime ?? 'not run'}\nRestore command duration: ${restoreTime ?? 'not run'}\n\n${checks.table()}`;
  const block = `=== Final test summary ===\n${summary}\n| Step | Result | Duration |\n| --- | --- | --- |\n| ${step} | ${checks.passed ? 'PASS' : 'FAIL'} | ${duration} |\n`;
  writeFileSync('verify-summary.txt', block); writeFileSync(join(evidence, 'verify-summary.txt'), block);
  writeFileSync(join(evidence, 'verify-result.json'), JSON.stringify({ group: 'backup', valid: checks.passed, results: [[step, checks.passed ? 'PASS' : 'FAIL', duration]], outputs: [{ name: step, kind: 'backup', output: summary }], apiFiles: [], fullApiFiles: [] }, null, 2));
  process.stdout.write(block); if (!checks.passed) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
