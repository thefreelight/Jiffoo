import { readFileSync, writeFileSync, mkdirSync, lstatSync, readdirSync, chmodSync, statfsSync, openSync, readSync, closeSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertManifest, assertDeployment, assertDeploymentPolicy, deploymentFiles, roles } from './identity.mjs';

export const serviceRoles = {
  postgres: 'postgres', redis: 'redis', silo: 'silo', 'silo-init': 'silo',
  'silo-volume-init': 'backend', 'db-init': 'backend', 'api-1': 'backend', 'api-2': 'backend',
  'worker-1': 'backend', 'worker-2': 'backend', admin: 'admin', shop: 'shop', edge: 'nginx', 'api-lb': 'nginx',
};
const dataVolumes = ['postgres-data', 'silo-data', 'redis-data'];
const backupFiles = paths => ['database.sql', 'silo.tar', 'config.json', '.env', 'tls/cert.pem', 'tls/key.pem', 'release/release.json', ...assertDeploymentPolicy(paths).map(path => 'release/' + path)];
const fixedFiles = backupFiles(deploymentFiles);
const safeName = /^[a-z0-9][a-z0-9_-]{0,200}$/;
function requireThat(value, message) { if (!value) throw new Error(message); }
export function assertProject(project) { requireThat(safeName.test(project), 'Invalid project name'); }
function plainFile(root, path) {
  requireThat(typeof path === 'string' && path.split('/').every(part => part && part !== '.' && part !== '..') && !path.includes('\\'), 'Unsafe backup path');
  let current = root;
  for (const part of path.split('/')) { current = resolve(current, part); requireThat(!lstatSync(current).isSymbolicLink(), 'Backup symlinks are forbidden'); }
  requireThat(lstatSync(current).isFile(), 'Backup member is not a regular file');
  return current;
}
export function fileHash(path) {
  const hash = createHash('sha256'), buffer = Buffer.alloc(1024 * 1024), descriptor = openSync(path, 'r');
  try { for (;;) { const count = readSync(descriptor, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(descriptor); }
  return hash.digest('hex');
}
function releaseAt(directory, mode, expectedDeploymentFiles = deploymentFiles) {
  const release = JSON.parse(readFileSync(resolve(directory, 'release.json'), 'utf8'));
  assertManifest(release, release.sourceCommit, mode === 'acceptance', expectedDeploymentFiles); assertDeployment(release, directory);
  return release;
}
export function guardState(containers, project, operation) {
  assertProject(project); requireThat(Array.isArray(containers), 'Missing Docker state');
  for (const container of containers) {
    requireThat(container.Config?.Labels?.['com.docker.compose.project'] === project, 'Docker state includes a foreign project');
    const service = container.Config.Labels['com.docker.compose.service'];
    // Paused and restarting containers still hold data or may resume work.
    const active = container.State.Running || container.State.Paused || container.State.Restarting;
    requireThat(!active || operation === 'backup' && service === 'postgres', operation === 'backup' ? 'Backup requires maintenance: stop every project container except PostgreSQL' : 'Restore requires every target project container to be stopped');
  }
  if (operation === 'backup') {
    for (const name of Object.keys(serviceRoles)) requireThat(containers.filter(c => c.Config.Labels['com.docker.compose.service'] === name && c.Config.Labels['com.docker.compose.oneoff'] !== 'True').length === 1, 'Backup requires the complete installed stack');
    const postgres = containers.find(c => c.Config.Labels['com.docker.compose.service'] === 'postgres');
    requireThat(postgres.State.Running && postgres.State.Health?.Status === 'healthy', 'Backup requires healthy PostgreSQL');
  }
}
export function planBackup(config, containers, project, release, images) {
  guardState(containers, project, 'backup');
  requireThat(config.name === project, 'Compose project identity mismatch');
  const assets = [];
  const tls = { '/etc/nginx/tls/cert.pem': 'tls/cert.pem', '/etc/nginx/tls/key.pem': 'tls/key.pem' };
  const binds = { '/etc/nginx/nginx.conf': 'deploy/compose/api-lb.conf', '/etc/nginx/templates/nginx.conf.template': 'deploy/compose/edge.conf.template',
    '/docker-entrypoint.d/15-edge-hosts.envsh': 'deploy/compose/15-edge-hosts.envsh', '/bootstrap/silo-init.sh': 'deploy/compose/silo-init.sh' };
  const copy = structuredClone(config);
  for (const [name, service] of Object.entries(copy.services)) {
    requireThat(Object.hasOwn(serviceRoles, name), 'Unsupported deployment service');
    const role = serviceRoles[name], reference = release.images[role].reference;
    const actual = containers.find(c => c.Config.Labels['com.docker.compose.service'] === name && c.Config.Labels['com.docker.compose.oneoff'] !== 'True');
    requireThat(actual?.Image === images[role][0].Id, 'Installed image differs from the recorded release');
    const installedEnvironment = Object.fromEntries((actual.Config.Env ?? []).map(value => { const index = value.indexOf('='); return [value.slice(0, index), value.slice(index + 1)]; }));
    requireThat(Object.entries(service.environment ?? {}).every(([key, value]) => value !== null && installedEnvironment[key] === String(value).replaceAll('$$', '$')), 'Deployment environment differs from installed containers');
    requireThat(!service.command || JSON.stringify(service.command.map(value => value.replaceAll('$$', '$'))) === JSON.stringify(actual.Config.Cmd), 'Deployment command differs from installed containers');
    requireThat(!service.privileged && !service.devices?.length, 'Unsupported privileged deployment');
    service.image = reference; delete service.build; delete service.profiles;
    for (const volume of service.volumes ?? []) {
      if (volume.type === 'volume') requireThat(dataVolumes.includes(volume.source), 'Unsupported data volume');
      else {
        requireThat(volume.type === 'bind' && volume.read_only, 'Unsupported writable bind mount');
        const destination = tls[volume.target] ?? (binds[volume.target] ? 'release/' + binds[volume.target] : undefined);
        requireThat(destination, 'Unsupported deployment bind mount');
        if (tls[volume.target]) assets.push({ source: volume.source, path: destination });
        volume.source = './' + destination;
      }
    }
  }
  requireThat(Object.keys(serviceRoles).every(name => copy.services[name]), 'Incomplete deployment configuration');
  requireThat(assets.length === 2 && new Set(assets.map(a => a.path)).size === 2, 'Incomplete TLS configuration');
  const oldVolumes = {};
  for (const name of dataVolumes) {
    const service = name === 'postgres-data' ? 'postgres' : name === 'silo-data' ? 'silo' : 'redis';
    const actual = containers.find(c => c.Config.Labels['com.docker.compose.service'] === service);
    const mounts = actual.Mounts.filter(mount => mount.Type === 'volume');
    requireThat(mounts.length === 1 && mounts[0].Name === config.volumes[name]?.name, 'Data volume identity mismatch');
    requireThat(safeName.test(mounts[0].Name), 'Unsafe data volume name'); oldVolumes[name] = mounts[0].Name;
  }
  return { config: copy, assets, oldVolumes };
}
export function sealBackup(directory, project, oldVolumes, mode) {
  assertProject(project); const release = releaseAt(resolve(directory, 'release'), mode);
  const files = fixedFiles.map(path => { const file = plainFile(directory, path); chmodSync(file, 0o600); return { path, size: lstatSync(file).size, sha256: fileHash(file) }; });
  requireThat(files.find(file => file.path === 'database.sql').size > 0 && files.find(file => file.path === 'silo.tar').size >= 1024, 'Empty data backup');
  const manifest = { schemaVersion: 1, project, createdAt: new Date().toISOString(), sourceCommit: release.sourceCommit, verifierImage: release.verifierImage,
    mode, oldVolumes, files, redis: 'empty-on-restore', containsSecretsAndCustomerData: true };
  writeFileSync(resolve(directory, 'backup.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  const hash = fileHash(resolve(directory, 'backup.json'));
  writeFileSync(resolve(directory, 'backup.sha256'), hash + '\n', { mode: 0o600 });
  return { hash, size: files.reduce((sum, file) => sum + file.size, 0) + lstatSync(resolve(directory, 'backup.json')).size + lstatSync(resolve(directory, 'backup.sha256')).size };
}
export function verifyBackup(directory, confirmation, mode, expectedDeploymentFiles = deploymentFiles) {
  const fixedFiles = backupFiles(expectedDeploymentFiles);
  const manifestFile = plainFile(directory, 'backup.json'), expected = readFileSync(plainFile(directory, 'backup.sha256'), 'utf8').trim();
  const hash = fileHash(manifestFile);
  requireThat(/^[a-f0-9]{64}$/.test(expected) && expected === hash, 'Backup manifest checksum mismatch');
  requireThat(confirmation === hash, 'Confirmation must equal the backup manifest SHA-256');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  requireThat(manifest.schemaVersion === 1 && manifest.mode === mode && manifest.redis === 'empty-on-restore' && manifest.containsSecretsAndCustomerData === true, 'Invalid backup manifest');
  assertProject(manifest.project);
  requireThat(Array.isArray(manifest.files) && JSON.stringify(manifest.files.map(file => file.path).sort()) === JSON.stringify([...fixedFiles].sort()), 'Incomplete backup inventory');
  const allowedFiles = new Set([...fixedFiles, 'backup.json', 'backup.sha256']);
  const allowedDirectories = new Set(fixedFiles.flatMap(path => path.split('/').slice(0, -1).map((_, index) => path.split('/').slice(0, index + 1).join('/'))));
  function scan(root, prefix = '') {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = prefix + entry.name;
      requireThat(!entry.isSymbolicLink(), 'Backup symlinks are forbidden');
      if (entry.isDirectory()) { requireThat(allowedDirectories.has(path), 'Unexpected backup directory'); scan(resolve(root, entry.name), path + '/'); }
      else requireThat(entry.isFile() && allowedFiles.has(path), 'Unexpected backup file');
    }
  }
  scan(directory);
  for (const member of manifest.files) {
    const file = plainFile(directory, member.path);
    requireThat(Number.isSafeInteger(member.size) && member.size >= 0 && /^[a-f0-9]{64}$/.test(member.sha256) && lstatSync(file).size === member.size && fileHash(file) === member.sha256, 'Backup file checksum mismatch');
  }
  const release = releaseAt(resolve(directory, 'release'), mode, expectedDeploymentFiles);
  requireThat(release.sourceCommit === manifest.sourceCommit && release.verifierImage === manifest.verifierImage, 'Backup release identity mismatch');
  requireThat(Object.keys(manifest.oldVolumes).sort().join() === [...dataVolumes].sort().join() && Object.values(manifest.oldVolumes).every(name => safeName.test(name)), 'Invalid previous volume inventory');
  return manifest;
}
export function space(directory, bytes) {
  requireThat(Number.isSafeInteger(bytes) && bytes >= 0, 'Invalid space estimate');
  const filesystem = statfsSync(directory, { bigint: true });
  requireThat(filesystem.bavail * filesystem.bsize >= BigInt(bytes) + 64n * 1024n * 1024n, 'Insufficient disk space');
}
function privateTree(directory) {
  chmodSync(directory, 0o700);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name); requireThat(!entry.isSymbolicLink(), 'Backup symlinks are forbidden');
    if (entry.isDirectory()) privateTree(path); else { requireThat(entry.isFile(), 'Unsupported backup member'); chmodSync(path, 0o600); }
  }
}
function restoreConfig(directory, target, project, generation) {
  assertProject(project); requireThat(/^[a-f0-9]{32}$/.test(generation), 'Invalid restore generation');
  const config = JSON.parse(readFileSync(resolve(directory, 'config.json'), 'utf8'));
  const release = JSON.parse(readFileSync(resolve(directory, 'release/release.json'), 'utf8'));
  requireThat(Object.keys(config.services).sort().join() === Object.keys(serviceRoles).sort().join(), 'Invalid restored service inventory');
  config.name = project;
  for (const [name, service] of Object.entries(config.services)) {
    requireThat(service.image === release.images[serviceRoles[name]].reference && !service.build, 'Restored image must match the recorded release');
    for (const volume of service.volumes ?? []) if (volume.type === 'bind') {
      requireThat(volume.source.startsWith('./') && fixedFiles.includes(volume.source.slice(2)), 'Invalid restored bind');
      volume.source = resolve(target, volume.source.slice(2));
    }
  }
  for (const name of dataVolumes) config.volumes[name] = { name: `${project}-restore-${generation}-${name}`, external: true };
  for (const [name, network] of Object.entries(config.networks)) { delete network.external; network.name = `${project}_${name}`; }
  return config;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, directory, project, mode, extra, target] = process.argv.slice(2);
  try {
    if (command === 'plan') {
      const release = releaseAt('/release', mode);
      const images = Object.fromEntries(roles.map(role => [role, JSON.parse(readFileSync(`/work/${role}.json`))]));
      const plan = planBackup(JSON.parse(readFileSync('/work/config.json')), JSON.parse(readFileSync('/work/state.json')), project, release, images);
      writeFileSync('/work/plan.json', JSON.stringify(plan), { mode: 0o600 });
      for (const asset of plan.assets) console.log(`${asset.source}\t${asset.path}`);
    } else if (command === 'guard') {
      const containers = JSON.parse(readFileSync('/work/state.json')); guardState(containers, project, extra);
      const names = [...new Set(containers.flatMap(c => c.Mounts?.filter(m => m.Type === 'volume').map(m => m.Name) ?? []))];
      requireThat(names.every(name => safeName.test(name)), 'Unsafe previous volume name');
      writeFileSync('/work/old-volumes.txt', names.join(' '), { mode: 0o600 });
      if (extra === 'backup') {
        const api = containers.find(c => c.Config.Labels['com.docker.compose.service'] === 'api-1');
        const paths = api.Config.Labels['com.docker.compose.project.config_files']?.split(',');
        requireThat(paths?.length && paths.every(path => path.startsWith('/') && !/[\n\r\t]/.test(path)), 'Missing installed Compose file identity');
        writeFileSync('/work/config-files.txt', paths.join('\n') + '\n', { mode: 0o600 });
      }
    }
    else if (command === 'space') space(directory, Number(extra));
    else if (command === 'stage') {
      const plan = JSON.parse(readFileSync('/work/plan.json'));
      mkdirSync(resolve(directory, 'release'), { recursive: true, mode: 0o700 });
      for (const path of ['release.json', ...deploymentFiles]) {
        const dest = resolve(directory, 'release', path); mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
        copyFileSync(resolve('/release', path), dest); chmodSync(dest, 0o600);
      }
      writeFileSync(resolve(directory, 'config.json'), JSON.stringify(plan.config), { mode: 0o600 });
    } else if (command === 'seal') {
      privateTree(directory); const result = sealBackup(directory, project, JSON.parse(readFileSync('/work/plan.json')).oldVolumes, mode);
      console.log(`Backup manifest SHA-256: ${result.hash}\nBackup bytes: ${result.size}`);
    } else if (command === 'verify') { verifyBackup(directory, extra, mode); console.log('Backup checksums and required inventory verified'); }
    else if (command === 'restore-config') {
      const config = restoreConfig(directory, target, project, extra);
      writeFileSync('/work/restore.json', JSON.stringify(config), { mode: 0o600 });
      for (const [name, volume] of Object.entries(config.volumes)) console.log(`${name}\t${volume.name}`);
    } else if (command === 'inspect') {
      const manifest = verifyBackup(directory, fileHash(resolve(directory, 'backup.json')), mode);
      const permissions = [];
      function scan(root) {
        permissions.push({ path: root.slice(directory.length) || '/', mode: lstatSync(root).mode & 0o777 });
        if (lstatSync(root).isDirectory()) for (const entry of readdirSync(root)) scan(resolve(root, entry));
      }
      scan(directory); console.log(JSON.stringify({ manifest, hash: fileHash(resolve(directory, 'backup.json')), permissions }));
    } else throw new Error('Unknown backup helper command');
  } catch (error) {
    // Filesystem errors can contain paths; configuration and SQL errors may contain secrets.
    console.error(`Backup helper failed: ${error.code ? 'filesystem operation failed' : error instanceof SyntaxError || error instanceof TypeError ? 'invalid backup metadata' : error.message}`); process.exitCode = 1;
  }
}
