import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, realpathSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertManifest, assertDeployment, sha256 } from './identity.mjs';
import { serviceRoles, guardState } from './backup.mjs';

const require = createRequire('/app/apps/api/package.json');
const limit = 128 * 1024 * 1024;
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const fail = message => { throw new Error(message); };
const need = (condition, message) => { if (!condition) fail(message); };
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = value => sha256(Buffer.from(JSON.stringify(value)));

export function durableJson(path, value) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path);
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

function inventory(root) {
  return readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const path = resolve(root, entry.name, 'migration.sql');
    need(!lstatSync(path).isSymbolicLink(), 'Migration symlinks are forbidden');
    return { name: entry.name, checksum: sha256(readFileSync(path)) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function assertNoMigrations(history, target) {
  need(history.length <= target.length && history.every((row, index) => row.migration_name === target[index]?.name && row.checksum === target[index]?.checksum && row.finished_at && !row.rolled_back_at), 'Core migration history mismatch; update refused');
  need(history.length === target.length, 'Target needs a migration-capable update (B16c2); pending Core migrations are not supported');
}

function release(directory, mode) {
  const result = json(resolve(directory, 'release.json'));
  assertManifest(result, result.sourceCommit, mode === 'acceptance'); assertDeployment(result, directory);
  return result;
}

function environment(containers) {
  const api = containers.find(c => c.Config?.Labels?.['com.docker.compose.service'] === 'api-1');
  need(api, 'Installed API identity is missing');
  return Object.fromEntries(api.Config.Env.map(item => { const index = item.indexOf('='); return [item.slice(0, index), item.slice(index + 1)]; }));
}

function configuredClient(containers) {
  const env = environment(containers), url = new URL(env.DATABASE_URL);
  // The helper shares only PostgreSQL's network namespace, never the Docker socket.
  url.hostname = '127.0.0.1'; url.port = '5432';
  for (const name of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(name);
  url.searchParams.set('application_name', 'jiffoo-host-update');
  const { Client } = require('pg');
  return new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000, query_timeout: 60000 });
}

async function database(containers, action) {
  const client = configuredClient(containers); client.on('error', () => undefined);
  try { await client.connect(); return await action(client); } finally { await client.end(); }
}

function configureRuntime(containers) {
  const env = environment(containers);
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  const url = new URL(env.DATABASE_URL); url.hostname = '127.0.0.1'; url.port = '5432';
  process.env.DATABASE_URL = url.toString();
  process.chdir('/app/apps/api');
}

function builtinManifests(root, filename) {
  return readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => json(resolve(root, entry.name, filename)));
}

async function pluginPlan(client, packages) {
  const { checkPluginApiCompatibility } = require('/app/apps/api/dist/core/admin/extension-installer/plugin-compatibility.js');
  const installed = (await client.query('SELECT slug, version, "zipHash", "manifestJson", "publisherId", "trustLevel" FROM public.plugin_installs WHERE "deletedAt" IS NULL ORDER BY slug')).rows;
  const targets = new Map();
  const { inspectPluginUpload, uploadOperation, assertPluginPackageHistory } = packages ? require('/app/apps/api/dist/core/admin/extension-installer/plugin-upload.js') : {};
  if (packages) for (const entry of readdirSync(packages, { withFileTypes: true })) {
    need(entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.zip'), 'Target plugin directory must contain only regular ZIP files');
    const path = resolve(packages, entry.name), bytes = readFileSync(path);
    const inspected = await inspectPluginUpload(bytes);
    need(!targets.has(inspected.manifest.slug), 'Duplicate target plugin slug');
    const current = installed.find(row => row.slug === inspected.manifest.slug);
    need(current, 'Target plugin must already be installed');
    need(inspected.publisher || current.zipHash === inspected.hash, 'Changed unsigned plugin requires separate merchant confirmation; use the Admin plugin flow');
    uploadOperation(inspected, { ...current, deletedAt: null }); await assertPluginPackageHistory(inspected);
    const namespace = (await client.query('SELECT id, "provisionedAt" FROM public.plugin_namespaces WHERE slug=$1', [inspected.manifest.slug])).rows[0];
    const applied = namespace ? (await client.query('SELECT "migrationId" AS id, "order", path, sha256 FROM public.plugin_migration_successes WHERE "namespaceId"=$1 ORDER BY "order"', [namespace.id])).rows : [];
    const { validatePluginMigrations } = require('shared/plugin-signing');
    const declarations = validatePluginMigrations(inspected.manifest.database, inspected.files, applied);
    need(namespace?.provisionedAt && applied.length === declarations.length || current.zipHash === inspected.hash && !inspected.manifest.database, 'Target needs a migration-capable update (B16c2); pending plugin migrations or namespace provisioning are not supported');
    targets.set(inspected.manifest.slug, { filename: entry.name, hash: inspected.hash, manifest: inspected.manifest, changed: current.zipHash !== inspected.hash });
  }
  const builtins = builtinManifests('/app/apps/api/builtin-plugins', 'manifest.json');
  for (const manifest of builtins) need(!manifest.database, 'Target needs a migration-capable update (B16c2); builtin database declarations are not supported');
  for (const row of installed) {
    const manifest = targets.get(row.slug)?.manifest ?? builtins.find(item => item.slug === row.slug) ?? row.manifestJson;
    need(manifest && checkPluginApiCompatibility(manifest).compatible, 'Installed plugin is incompatible with target API: ' + row.slug);
  }
  return { installed, packages: [...targets.values()].sort((a, b) => a.manifest.slug.localeCompare(b.manifest.slug)), pluginSlugs: [...new Set([...builtins.map(row => row.slug), ...targets.keys()])].sort(), themeSlugs: builtinManifests('/app/apps/api/builtin-themes', 'theme.json').map(row => row.slug).sort() };
}

function assertConfiguration(current, target, source, destination, containers, project) {
  need(current.name === project && target.name === project, 'Compose project identity mismatch');
  need(Object.keys(current.services).sort().join() === Object.keys(serviceRoles).sort().join() && Object.keys(target.services).sort().join() === Object.keys(serviceRoles).sort().join(), 'Unsupported service inventory');
  need(hash(current.volumes) === hash(target.volumes) && hash(current.networks) === hash(target.networks), 'Base volume or network changes are not supported');
  for (const role of ['postgres', 'redis', 'silo', 'nginx']) need(hash(source.images[role]) === hash(destination.images[role]), 'Base service image changes are not supported: ' + role);
  for (const [name, service] of Object.entries(current.services)) {
    const matches = containers.filter(c => c.Config.Labels['com.docker.compose.service'] === name && c.Config.Labels['com.docker.compose.oneoff'] !== 'True');
    need(matches.length === 1, 'Installed service inventory is ambiguous: ' + name);
    const role = serviceRoles[name], expected = json('/work/current-' + role + '.json')[0].Id;
    need(matches[0].Image === expected && matches[0].Config.Image === service.image, 'Installed image differs from the current release: ' + name);
    if (['backend','admin','shop'].includes(role)) need(target.services[name].image === destination.images[role].reference, 'Target application image differs from the verified release');
    else need(target.services[name].image === service.image, 'Base service image reference changes are not supported: ' + name);
    const left = structuredClone(service), right = structuredClone(target.services[name]);
    delete left.build; delete right.build; delete left.image; delete right.image;
    for (const config of [left, right]) for (const volume of config.volumes ?? []) if (volume.type === 'bind') {
      for (const root of ['/current/', '/target/']) if (volume.source.startsWith(root)) volume.source = '@release/' + volume.source.slice(root.length);
    }
    need(hash(left) === hash(right), 'Application configuration changes are not supported: ' + name);
  }
}

async function maintenance(client, containers, project, expectedBoots) {
  const own = containers.filter(c => c.Config.Labels?.['io.jiffoo.host-helper'] !== 'true');
  guardState(own, project, 'backup');
  const rows = (await client.query('SELECT "bootNonce", hostname, state, "databaseRole" FROM public.core_processes ORDER BY "bootNonce"')).rows;
  const prior = new Map(expectedBoots.map(row => [row.bootNonce, row]));
  for (const row of rows) {
    need(['QUIESCENT', 'DEAD_CONFIRMED'].includes(row.state), 'Unknown or undrained Core boot blocks maintenance: ' + row.bootNonce);
    need(prior.has(row.bootNonce) || row.state === 'QUIESCENT', 'Unrecorded Core boot blocks maintenance');
  }
  need(expectedBoots.every(row => rows.some(item => item.bootNonce === row.bootNonce)), 'Recorded Core boot disappeared during maintenance');
  const visibility = (await client.query("SELECT rolsuper OR pg_has_role(current_user,'pg_read_all_stats','MEMBER') AS visible FROM pg_roles WHERE rolname=current_user")).rows[0];
  need(visibility?.visible, 'Insufficient database session visibility');
  const sessions = (await client.query('SELECT pid, application_name FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows;
  need(sessions.length === 0, 'Database sessions still hold work; maintenance is not proven');
  need(Number((await client.query('SELECT count(*) FROM pg_prepared_xacts WHERE database=current_database()')).rows[0].count) === 0, 'Prepared database transactions block maintenance');
  need(Number((await client.query('SELECT count(*) FROM public.plugin_operation_leases')).rows[0].count) === 0, 'In-flight plugin markers or operation leases block maintenance');
  need(Number((await client.query("SELECT count(*) FROM public.plugin_migration_operations WHERE phase NOT IN ('SUCCESS','FAILED','RECOVERED')")).rows[0].count) === 0, 'Incomplete plugin operations block maintenance');
  need(Number((await client.query("SELECT count(*) FROM public.plugin_migration_attempts WHERE status='UNKNOWN'")).rows[0].count) === 0, 'Unknown plugin attempts block maintenance');
  return { proven: true, at: new Date().toISOString(), boots: rows, containers: own.map(c => ({ id: c.Id, service: c.Config.Labels['com.docker.compose.service'], state: c.State.Status })) };
}

const tables = {
  plugin_installs: ['slug', ['id']], plugin_installations: ['pluginSlug', ['id']], plugin_event_subscriptions: ['pluginSlug', ['pluginSlug', 'eventType', 'version']], plugin_package_blobs: ['pluginSlug', ['id']],
  themes: ['slug', ['id']], theme_configurations: ['slug', ['slug']], theme_config_revisions: ['slug', ['id']], theme_package_blobs: ['themeSlug', ['id']], theme_active: [null, ['target']],
};
async function snapshot(client, plan) {
  const result = { version: 1, pluginSlugs: plan.pluginSlugs, themeSlugs: plan.themeSlugs, tables: {}, registry: (await client.query('SELECT "pluginRegistryVersion" FROM public.system_settings WHERE id=$1', ['system'])).rows[0]?.pluginRegistryVersion ?? null };
  for (const [table, [column]] of Object.entries(tables)) {
    const slugs = table.startsWith('plugin_') ? plan.pluginSlugs : plan.themeSlugs;
    result.tables[table] = (await client.query(`SELECT row_to_json(t)::text AS row FROM public.${quote(table)} t${column ? ` WHERE ${quote(column)}=ANY($1::text[])` : ''}`, column ? [slugs] : [])).rows.map(row => row.row).sort();
  }
  result.pendingEvents = (await client.query('SELECT row_to_json(d)::text AS row FROM public.event_deliveries d JOIN public.plugin_installations i ON i.id=d."installationId" WHERE i."pluginSlug"=ANY($1::text[]) AND d.status=\'PENDING\'', [plan.pluginSlugs])).rows.map(row => row.row);
  need(Buffer.byteLength(JSON.stringify(result)) <= limit, 'Managed snapshot exceeds the update resource limit');
  return result;
}

async function restoreSnapshot(client, snap) {
  need(snap.version === 1, 'Unsupported managed snapshot');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");
    // Delete only update-created metadata, never business rows or audit history.
    for (const table of ['theme_config_revisions', 'theme_configurations', 'theme_package_blobs', 'plugin_event_subscriptions', 'plugin_package_blobs', 'plugin_installations', 'themes', 'plugin_installs']) {
      const [column, keys] = tables[table], rows = snap.tables[table], slugs = table.startsWith('plugin_') ? snap.pluginSlugs : snap.themeSlugs;
      await client.query(`DELETE FROM public.${quote(table)} t WHERE ${quote(column)}=ANY($1::text[]) AND NOT EXISTS(SELECT 1 FROM json_populate_recordset(NULL::public.${quote(table)},$2::json) old WHERE ${keys.map(key => `old.${quote(key)}=t.${quote(key)}`).join(' AND ')})`, [slugs, '[' + rows.join(',') + ']']);
    }
    for (const [table, [, keys]] of Object.entries(tables)) {
      const columns = (await client.query('SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum', ['public.' + table])).rows.map(row => row.attname);
      const values = columns.filter(column => !keys.includes(column)).map(column => `${quote(column)}=EXCLUDED.${quote(column)}`).join(',');
      await client.query(`INSERT INTO public.${quote(table)} SELECT * FROM json_populate_recordset(NULL::public.${quote(table)},$1::json) ON CONFLICT(${keys.map(quote).join(',')}) DO ${values ? 'UPDATE SET ' + values : 'NOTHING'}`, ['[' + snap.tables[table].join(',') + ']']);
    }
    if (snap.registry !== null) await client.query('UPDATE public.system_settings SET "pluginRegistryVersion"=$1 WHERE id=$2', [snap.registry, 'system']);
    // Reverse only the subscription-removal side effect, not processed business work.
    await client.query('UPDATE public.event_deliveries d SET status=old.status,"skipReason"=old."skipReason","finishedAt"=old."finishedAt" FROM json_populate_recordset(NULL::public.event_deliveries,$1::json) old WHERE d.id=old.id AND d.status=\'SKIPPED\' AND d."skipReason"=\'subscription_removed\'', ['[' + snap.pendingEvents.join(',') + ']']);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
}

async function main() {
  require('module-alias')('/app/apps/api');
  const [command, project, mode, phase = ''] = process.argv.slice(2);
  const source = release('/current', mode), target = release('/target', mode);
  const containers = json('/work/state.json');
  if (command === 'plan') {
    configureRuntime(containers);
    const current = json('/work/current-config.json'), next = json('/work/target-config.json');
    // Host paths are normalized explicitly, not inferred from untrusted release paths.
    const paths = json('/work/paths.json');
    for (const config of [current, next]) for (const service of Object.values(config.services)) for (const volume of service.volumes ?? []) if (volume.type === 'bind') {
      for (const [native, alias] of [[paths.current, '/current'], [paths.target, '/target']]) if (volume.source.startsWith(native + '/')) volume.source = alias + volume.source.slice(native.length);
    }
    assertConfiguration(current, next, source, target, containers.filter(c => c.Config.Labels?.['io.jiffoo.host-helper'] !== 'true'), project);
    const targetInventory = inventory('/app/apps/api/prisma/migrations');
    const plan = await database(containers, async client => {
      const history = (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name')).rows;
      assertNoMigrations(history, json('/work/current-inventory.json'));
      assertNoMigrations(history, targetInventory);
      const plugins = await pluginPlan(client, existsSync('/plugins') ? '/plugins' : undefined);
      const boots = (await client.query('SELECT "bootNonce",hostname,state,"databaseRole" FROM public.core_processes ORDER BY "bootNonce"')).rows;
      const live = boots.filter(row => !['QUIESCENT','DEAD_CONFIRMED'].includes(row.state));
      const core = containers.filter(c => /^(api|worker)-[12]$/.test(c.Config.Labels?.['com.docker.compose.service'] ?? ''));
      need(live.every(row => core.some(c => c.State.Running && c.Config.Hostname === row.hostname)), 'Unknown Core process blocks update planning');
      return { version: 1, project, currentCommit: source.sourceCommit, targetCommit: target.sourceCommit, images: target.images, migrations: [], history, ...plugins, boots, paths };
    });
    plan.digest = hash({ ...plan, boots: undefined, paths: { ...plan.paths, token: undefined } });
    durableJson('/work/plan.json', plan);
    const clean = config => { for (const service of Object.values(config.services)) { delete service.build; for (const mount of service.volumes ?? []) if (mount.type === 'bind') {
      if (mount.source.startsWith('/current/')) mount.source = paths.current + mount.source.slice('/current'.length);
      if (mount.source.startsWith('/target/')) mount.source = paths.state + '/deployment/release' + mount.source.slice('/target'.length);
    } } return config; };
    durableJson('/work/prior-config.json', clean(current)); durableJson('/work/next-config.json', clean(next));
    console.info(`Update plan: ${plan.digest}\nCurrent commit: ${source.sourceCommit}\nTarget commit: ${target.sourceCommit}\nPending Core migrations: 0\nPending plugin migrations: 0`);
  } else if (command === 'image-plan') {
    for (const [kind, manifest] of [['current', source], ['target', target]]) for (const [role, image] of Object.entries(manifest.images)) console.info(`${kind}\t${role}\t${image.reference}`);
  } else if (command === 'paths') {
    const [current, target, state, backup, actor, token] = process.argv.slice(6);
    durableJson('/work/paths.json', { current, target, state, backup, actor, token });
  } else if (command === 'initialize') {
    need(!existsSync('/state/journal.json'), 'Update journal already exists; use --resume or --restore-prior');
    const plan = json('/work/plan.json');
    for (const file of ['plan.json','prior-config.json','next-config.json']) durableJson('/state/' + file, json('/work/' + file));
    mkdirSync('/state/deployment/release', { recursive: true, mode: 0o700 }); cpSync('/target', '/state/deployment/release', { recursive: true });
    cpSync('/current/deploy/compose/.env', '/state/deployment/release/deploy/compose/.env');
    durableJson('/state/journal.json', { version: 1, operationId: randomUUID(), project, phase: 'prepared', result: null, planHash: hash(plan), priorConfigHash: hash(json('/state/prior-config.json')), nextConfigHash: hash(json('/state/next-config.json')), token: plan.paths.token, paths: plan.paths });
  } else if (command === 'journal') {
    const journal = json('/state/journal.json'); journal.phase = phase; journal.updatedAt = new Date().toISOString();
    if (['success','rolled-back','rollback-failed'].includes(phase)) journal.result = phase;
    durableJson('/state/journal.json', journal); console.info('Update phase: ' + phase);
  } else if (command === 'resume-proof') {
    const journal = json('/state/journal.json'), plan = json('/state/plan.json'), paths = json('/work/paths.json');
    need(journal.version === 1 && journal.project === project && journal.planHash === hash(plan), 'Update journal or plan integrity mismatch');
    need(journal.priorConfigHash === hash(json('/state/prior-config.json')) && journal.nextConfigHash === hash(json('/state/next-config.json')), 'Recorded deployment configuration checksum mismatch');
    for (const key of ['current','target','state','backup']) need(paths[key] === journal.paths[key], 'Resume paths differ from the recorded update');
    console.info(journal.phase);
  } else if (command === 'health') {
    const selected = phase === 'prior' ? source : target;
    const config = json('/state/' + (phase === 'prior' ? 'prior-config.json' : 'next-config.json'));
    for (const [service, role] of Object.entries(serviceRoles)) {
      const items = containers.filter(c => c.Config.Labels?.['com.docker.compose.service'] === service && c.Config.Labels?.['com.docker.compose.oneoff'] !== 'True');
      need(items.length === 1 && items[0].Image === json('/work/' + (phase === 'prior' ? 'current' : 'target') + '-' + role + '.json')[0].Id && items[0].Config.Image === config.services[service].image, 'Release service image or replica identity mismatch: ' + service);
      if (['db-init','silo-init','silo-volume-init'].includes(service)) need(!items[0].State.Running && items[0].State.ExitCode === 0, 'Bootstrap service did not complete: ' + service);
      else need(items[0].State.Running && items[0].State.Health?.Status === 'healthy', 'Service health proof failed: ' + service);
    }
    await database(containers, async client => {
      const live = (await client.query("SELECT hostname,kind FROM public.core_processes WHERE state NOT IN ('QUIESCENT','DEAD_CONFIRMED')")).rows;
      need(live.length === 4 && live.filter(row => row.kind === 'api').length === 2 && live.filter(row => row.kind === 'worker').length === 2, 'Two API and two worker live registrations are required');
      need(live.every(row => containers.some(c => c.Config.Hostname === row.hostname && c.State.Running)), 'Live registry contains an unknown process');
      assertNoMigrations((await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name')).rows, inventory('/app/apps/api/prisma/migrations'));
    });
    console.info('Every release service and all two API two worker process identities are healthy');
  } else if (command === 'maintenance' || command === 'audit' || command === 'snapshot' || command === 'restore') {
    const plan = json('/state/plan.json');
    await database(containers, async client => {
      const proof = await maintenance(client, containers, project, plan.boots); durableJson('/state/maintenance.json', proof);
      if (command === 'maintenance') { console.info('Docker registry database sessions and in-flight maintenance proof passed'); return; }
      assertNoMigrations((await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name')).rows, inventory('/app/apps/api/prisma/migrations'));
      if (command === 'audit') {
        const env = environment(containers), url = new URL(env.DATABASE_URL); url.hostname = '127.0.0.1'; url.port = '5432';
        const drift = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-url', url.toString(), '--to-schema-datamodel', 'prisma/schema', '--exit-code'], { cwd: '/app/apps/api', env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 60000 });
        need(drift.status === 0, 'Database drift or unavailable schema inspection blocks update');
        const { auditPluginDatabase, pluginDatabaseAuditExitCode } = require('/app/apps/api/dist/core/admin/extension-installer/plugin-database-audit.js');
        const report = await auditPluginDatabase(client); durableJson('/state/audit.json', report);
        need(pluginDatabaseAuditExitCode(report) === 0, 'Plugin database pre-write audit blocked update; inspect audit.json');
        console.info('Core and plugin pre-write audit passed; zero pending migrations');
      } else if (command === 'snapshot') {
        const snap = await snapshot(client, plan); durableJson('/state/managed.json', snap);
        const journal = json('/state/journal.json'); journal.managedHash = hash(snap); durableJson('/state/journal.json', journal);
      } else {
        const snap = json('/state/managed.json'); need(json('/state/journal.json').managedHash === hash(snap), 'Managed snapshot checksum mismatch');
        await restoreSnapshot(client, snap); console.info('Managed package bytes installations subscriptions registry and theme state restored');
      }
    });
  } else if (command === 'plugins') {
    const plan = json('/state/plan.json');
    if (!plan.packages.some(item => item.changed)) return;
    configureRuntime(containers);
    const { previewPluginUpload } = require('/app/apps/api/dist/core/admin/extension-installer/plugin-upload.js');
    const { startPluginInstallOperation, getPluginInstallOperation, drainPluginInstallOperations } = require('/app/apps/api/dist/core/admin/extension-installer/plugin-migration-operation.js');
    const { finishCoreProcess } = require('/app/apps/api/dist/infra/core-process.js');
    const { prisma } = require('/app/apps/api/dist/config/database.js');
    try {
      for (const item of plan.packages.filter(item => item.changed)) {
        const bytes = readFileSync('/plugins/' + item.filename); need(sha256(bytes) === item.hash, 'Target plugin bytes changed after audit');
        const preview = await previewPluginUpload(bytes, plan.paths.actor);
        need(!preview.migrationPlan.changesDatabase, 'Target needs a migration-capable update (B16c2)');
        const result = await startPluginInstallOperation(bytes, { actorUserId: plan.paths.actor, previewToken: preview.previewToken, confirmMigrations: false });
        await drainPluginInstallOperations(); const operation = await getPluginInstallOperation(result.operationId);
        need(operation.phase === 'SUCCESS', 'Target plugin publication failed: ' + item.manifest.slug);
      }
    } finally { await finishCoreProcess(); await prisma.$disconnect(); }
  } else fail('Unknown update helper command');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) {
    const reason = error.code === 'MODULE_NOT_FOUND' ? error.message.split('\n')[0] : error instanceof SyntaxError || error instanceof TypeError ? 'Invalid update metadata' : error.code ?? error.message;
    console.error('Update helper refused: ' + reason); process.exitCode = 1;
  } finally {
    const loaded = path => require.cache[path]?.exports;
    await loaded('/app/apps/api/dist/config/database.js')?.prisma?.$disconnect();
    loaded('/app/apps/api/dist/infra/shared-protection.js')?.sharedProtection?.close();
    loaded('/app/apps/api/dist/core/cache/redis.js')?.redisCache?.getRawClient()?.disconnect();
  }
}
