import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, realpathSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertManifest, assertDeployment, sha256 } from './identity.mjs';
import { serviceRoles, guardState, verifyBackup } from './backup.mjs';
import { readCoreMigrations, assertCorePrefix, executeCoreMigrations, coreHistorySql } from './core-migrations.mjs';

const require = createRequire('/app/apps/api/package.json');
const limit = 128 * 1024 * 1024;
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const fail = message => { throw new Error(message); };
const need = (condition, message) => { if (!condition) fail(message); };
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = value => sha256(Buffer.from(JSON.stringify(value)));
export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(item => canonicalJson(item)).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function planDigest(plan) {
  const { digest, boots, paths, ...stable } = plan;
  const { token, confirmation, ...stablePaths } = paths;
  return sha256(Buffer.from(canonicalJson({ ...stable, paths: stablePaths })));
}
function confirmedPlan(plan) {
  need(plan.digest===planDigest(plan),'Plan digest mismatch');
  need(!plan.migrations.length && !plan.packages.some(item=>item.pending.length || item.provisionNamespace) || plan.paths.confirmation===plan.digest,'Migration confirmation must equal PLAN_SHA256; use --confirm');
}
const migrationInventory = () => readCoreMigrations('/app/apps/api/prisma/migrations');
const identities = sources => sources.map(({ name, checksum }) => ({ name, checksum }));
function record(event) {
  const journal = json('/state/journal.json');
  journal.events.push({ sequence: journal.events.length + 1, at: new Date().toISOString(), ...event });
  durableJson('/state/journal.json', journal);
}
function migrationEvent(event) {
  const journal = json('/state/journal.json');
  const plan=json('/state/plan.json');confirmedPlan(plan);
  need(journal.planHash===plan.digest,'Migration plan integrity mismatch');
  need(journal.auditHash && journal.backupHash, 'Migration requires durable pre-write audit and backup evidence');
  record({ ...event, planHash: journal.planHash, auditHash: journal.auditHash, backupHash: journal.backupHash });
}

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

function configuredClient(containers, queryTimeout = 60000) {
  const env = environment(containers), url = new URL(env.DATABASE_URL);
  // The helper shares only PostgreSQL's network namespace, never the Docker socket.
  url.hostname = '127.0.0.1'; url.port = '5432';
  for (const name of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(name);
  url.searchParams.set('application_name', 'jiffoo-host-update');
  const { Client } = require('pg');
  return new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000, query_timeout: queryTimeout });
}

async function database(containers, action, queryTimeout = 60000) {
  const client = configuredClient(containers,queryTimeout); client.on('error', () => undefined);
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
    const provisionNamespace = Boolean(inspected.manifest.database) && !namespace?.provisionedAt;
    targets.set(inspected.manifest.slug, { filename: entry.name, hash: inspected.hash, manifest: inspected.manifest, manifestDigest: inspected.manifestDigest, changed: current.zipHash !== inspected.hash, applied, provisionNamespace, pending: declarations.slice(applied.length) });
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

/** Resolve logical resources to the currently installed bindings, including restored stacks. */
export function installedBindings(config, containers, volumes, project) {
  const bindings={volumes:{},tls:{}};
  for(const [service,definition] of Object.entries(config.services)) {
    const actual=containers.find(item=>item.Config?.Labels?.['com.docker.compose.service']===service && item.Config.Labels['com.docker.compose.oneoff']!=='True');
    need(actual,'Installed resource identity is missing: '+service);
    for(const volume of definition.volumes ?? []) {
      if(volume.type==='volume') {
        const mount=actual.Mounts.find(item=>item.Destination===volume.target), metadata=volumes.find(item=>item.Name===mount?.Name);
        need(mount?.Type==='volume' && metadata?.Labels?.['com.docker.compose.project']===project && metadata.Labels['com.docker.compose.volume']===volume.source,'Unowned or mismatched installed data volume');
        const declared=config.volumes[volume.source];
        need(declared && metadata.Driver===(declared.driver ?? 'local') && hash(metadata.Options ?? {})===hash(declared.driver_opts ?? {}),'Installed volume driver or options mismatch');
        need(!bindings.volumes[volume.source] || bindings.volumes[volume.source]===metadata.Name,'Conflicting installed volume bindings');
        bindings.volumes[volume.source]=metadata.Name;
      } else if(service==='edge' && volume.type==='bind' && ['/etc/nginx/tls/cert.pem','/etc/nginx/tls/key.pem'].includes(volume.target)) {
        const mount=actual.Mounts.find(item=>item.Destination===volume.target);
        need(mount?.Type==='bind' && !mount.RW && typeof mount.Source==='string','Installed TLS binding mismatch');
        bindings.tls[volume.target]=mount.Source;
      }
    }
  }
  return bindings;
}

function preserveBindings(config,bindings) {
  for(const [logical,name] of Object.entries(bindings.volumes))config.volumes[logical]={name,external:true};
  for(const volume of config.services.edge.volumes ?? [])if(bindings.tls[volume.target])volume.source=bindings.tls[volume.target];
}

async function maintenance(client, containers, project, expectedBoots, owned) {
  const own = containers.filter(c => c.Config.Labels?.['io.jiffoo.host-helper'] !== 'true');
  if (!owned) guardState(own, project, 'backup');
  else {
    need(own.every(c => c.Config.Labels?.['com.docker.compose.project'] === project && !c.State.Paused && !c.State.Restarting
      && (!c.State.Running || ['postgres','redis'].includes(c.Config.Labels['com.docker.compose.service']))), 'Unexpected running container blocks plugin migration');
    need(Object.keys(serviceRoles).every(service => own.filter(c => c.Config.Labels['com.docker.compose.service'] === service && c.Config.Labels['com.docker.compose.oneoff'] !== 'True').length === 1), 'Plugin migration requires the complete installed stack');
  }
  const rows = (await client.query('SELECT "bootNonce", hostname, state, "databaseRole" FROM public.core_processes ORDER BY "bootNonce"')).rows;
  const prior = new Map(expectedBoots.map(row => [row.bootNonce, row]));
  for (const row of rows) {
    const executor = owned && row.bootNonce === owned.bootNonce && row.state === 'LIVE';
    need(executor || ['QUIESCENT', 'DEAD_CONFIRMED'].includes(row.state), 'Unknown or undrained Core boot blocks maintenance: ' + row.bootNonce);
    need(executor || prior.has(row.bootNonce) || row.state === 'QUIESCENT', 'Unrecorded Core boot blocks maintenance');
  }
  need(expectedBoots.every(row => rows.some(item => item.bootNonce === row.bootNonce)), 'Recorded Core boot disappeared during maintenance');
  const visibility = (await client.query("SELECT rolsuper OR pg_has_role(current_user,'pg_read_all_stats','MEMBER') AS visible FROM pg_roles WHERE rolname=current_user")).rows[0];
  need(visibility?.visible, 'Insufficient database session visibility');
  const sessions = (await client.query('SELECT pid, application_name,usename FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows;
  const executorRole = owned && rows.find(row => row.bootNonce === owned.bootNonce && row.state === 'LIVE')?.databaseRole;
  need(sessions.every(row => owned && executorRole && row.usename === executorRole && row.application_name.startsWith(owned.applicationPrefix)), 'Database sessions still hold unknown work; maintenance is not proven');
  need(Number((await client.query('SELECT count(*) FROM pg_prepared_xacts WHERE database=current_database()')).rows[0].count) === 0, 'Prepared database transactions block maintenance');
  const leases=(await client.query('SELECT slug,token,"ownerBootNonce" FROM public.plugin_operation_leases')).rows;
  need(leases.every(row=>owned && row.slug===owned.slug && row.token===owned.leaseToken && row.ownerBootNonce===owned.bootNonce), 'In-flight plugin markers or operation leases block maintenance');
  const operations=(await client.query("SELECT id,phase,\"ownerBootNonce\" FROM public.plugin_migration_operations WHERE phase NOT IN ('SUCCESS','FAILED','RECOVERED')")).rows;
  need(operations.every(row=>owned && row.id===owned.operationId && row.phase==='MIGRATING' && row.ownerBootNonce===owned.bootNonce), 'Incomplete plugin operations block maintenance');
  const attempts=(await client.query("SELECT id FROM public.plugin_migration_attempts WHERE status='UNKNOWN'")).rows;
  need(attempts.every(row=>owned && row.id===owned.attemptId), 'Unknown plugin attempts block maintenance');
  return { proven: true, at: new Date().toISOString(), boots: rows, containers: own.map(c => ({ id: c.Id, service: c.Config.Labels['com.docker.compose.service'], state: c.State.Status })) };
}

async function proveRollback(client,containers,project,plan,journal,stopped) {
  need(journal.planHash===planDigest(plan),'Rollback plan integrity mismatch');
  assertCorePrefix((await client.query(coreHistorySql)).rows,plan.currentInventory,true);
  const intents=journal.events.filter(item=>item.status==='intent');
  if(intents.length || stopped) {
    await maintenance(client,containers,project,plan.boots);
    await client.query("SET lock_timeout='5s'");await client.query('SELECT pg_advisory_lock(824301550)');
    assertCorePrefix((await client.query(coreHistorySql)).rows,plan.currentInventory,true);
  }
  for(const intent of intents) {
    need(!journal.events.some(item=>item.id===intent.id && ['committed','unknown'].includes(item.status)),'Committed or unknown migration forbids application rollback');
    if(intent.kind==='plugin') {
      const attempt=(await client.query('SELECT status FROM public.plugin_migration_attempts WHERE id=$1',[intent.attemptId])).rows[0];
      need(attempt?.status==='FAILED' || attempt?.status==='ABORTED','Plugin migration outcome forbids application rollback');
      const item=plan.packages.find(item=>item.manifest.slug===intent.slug);
      const namespace=(await client.query('SELECT id,"provisionedAt" FROM public.plugin_namespaces WHERE slug=$1',[intent.slug])).rows[0];
      need(item && (!item.provisionNamespace || !namespace?.provisionedAt),'Committed namespace forbids application rollback');
      const successes=namespace?(await client.query('SELECT "migrationId" AS id,"order",path,sha256 FROM public.plugin_migration_successes WHERE "namespaceId"=$1 ORDER BY "order"',[namespace.id])).rows:[];
      need(canonicalJson(successes)===canonicalJson(item.applied),'Committed plugin migration forbids application rollback');
    }
  }
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
    const bindings=installedBindings(current,containers,json('/work/volumes.json'),project);
    const targetSources = migrationInventory(), targetInventory = identities(targetSources);
    const { validateCoreMigrationSql } = require('/app/packages/shared/dist/shared/src/core-migration-sql.js');
    const plan = await database(containers, async client => {
      const history = (await client.query(coreHistorySql)).rows;
      const currentInventory = json('/work/current-inventory.json');
      assertCorePrefix(history, currentInventory, true);
      assertCorePrefix(history, targetInventory);
      for (const item of targetSources) validateCoreMigrationSql(item.sql);
      const plugins = await pluginPlan(client, existsSync('/plugins') ? '/plugins' : undefined);
      const boots = (await client.query('SELECT "bootNonce",hostname,state,"databaseRole" FROM public.core_processes ORDER BY "bootNonce"')).rows;
      const live = boots.filter(row => !['QUIESCENT','DEAD_CONFIRMED'].includes(row.state));
      const core = containers.filter(c => /^(api|worker)-[12]$/.test(c.Config.Labels?.['com.docker.compose.service'] ?? ''));
      need(live.every(row => core.some(c => c.State.Running && c.Config.Hostname === row.hostname)), 'Unknown Core process blocks update planning');
      return { version: 2, project, currentCommit: source.sourceCommit, targetCommit: target.sourceCommit, currentImages: source.images, images: target.images, currentReleaseHash: hash(source), targetReleaseHash: hash(target), configurationHash: hash({ current, next }), currentInventory, targetInventory, migrations: targetInventory.slice(history.length), history: history.map(({ migration_name, checksum }) => ({ migration_name, checksum })), rollbackPolicy: 'No application rollback after any committed or unknown migration', ...plugins, boots, paths };
    });
    plan.strippedWrappers = targetSources.filter(item => validateCoreMigrationSql(item.sql).wrapperStripped).map(item => item.name);
    plan.currentVersion = source.version; plan.targetVersion = target.version;
    plan.bindings=bindings;
    plan.digest = planDigest(plan);
    durableJson('/work/plan.json', plan);
    preserveBindings(current,bindings);preserveBindings(next,bindings);
    const clean = config => { for (const service of Object.values(config.services)) { delete service.build; for (const mount of service.volumes ?? []) if (mount.type === 'bind') {
      if (mount.source.startsWith('/current/')) mount.source = paths.current + mount.source.slice('/current'.length);
      if (mount.source.startsWith('/target/')) mount.source = paths.state + '/deployment/release' + mount.source.slice('/target'.length);
    } } return config; };
    durableJson('/work/prior-config.json', clean(current)); durableJson('/work/next-config.json', clean(next));
    const displayed={currentCommit:plan.currentCommit,currentVersion:plan.currentVersion,currentImages:plan.currentImages,targetCommit:plan.targetCommit,targetVersion:plan.targetVersion,images:plan.images,migrations:plan.migrations,strippedWrappers:plan.strippedWrappers,
      plugins:plan.packages.map(item=>({slug:item.manifest.slug,currentVersion:plan.installed.find(row=>row.slug===item.manifest.slug).version,targetVersion:item.manifest.version,hash:item.hash,manifestDigest:item.manifestDigest,applied:item.applied,pending:item.pending,provisionNamespace:item.provisionNamespace})),backup:paths.backup,rollbackPolicy:plan.rollbackPolicy};
    console.info(`Update plan: ${plan.digest}\nCurrent commit: ${source.sourceCommit}\nTarget commit: ${target.sourceCommit}\nPending Core migrations: ${plan.migrations.length}\nPending plugin migrations: ${plan.packages.reduce((n, item) => n + item.pending.length + Number(item.provisionNamespace), 0)}\nBackup: ${paths.backup}\n${plan.rollbackPolicy}\nPlan details: ${canonicalJson(displayed)}`);
  } else if (command === 'image-plan') {
    for (const [kind, manifest] of [['current', source], ['target', target]]) for (const [role, image] of Object.entries(manifest.images)) console.info(`${kind}\t${role}\t${image.reference}`);
  } else if (command === 'paths') {
    const [current, target, state, backup, actor, token, confirmation] = process.argv.slice(6);
    durableJson('/work/paths.json', { current, target, state, backup, actor, token, confirmation });
  } else if (command === 'confirm') {
    const plan = json('/work/plan.json');
    confirmedPlan(plan);
  } else if (command === 'initialize') {
    need(!existsSync('/state/journal.json'), 'Update journal already exists; use --resume or --restore-prior');
    const plan = json('/work/plan.json');
    confirmedPlan(plan);
    for (const file of ['plan.json','prior-config.json','next-config.json']) durableJson('/state/' + file, json('/work/' + file));
    mkdirSync('/state/deployment/release', { recursive: true, mode: 0o700 }); cpSync('/target', '/state/deployment/release', { recursive: true });
    cpSync('/current/deploy/compose/.env', '/state/deployment/release/deploy/compose/.env');
    durableJson('/state/journal.json', { version: 2, operationId: randomUUID(), project, phase: 'prepared', result: null, events: [], strippedWrappers: plan.strippedWrappers, planHash: plan.digest, priorConfigHash: hash(json('/state/prior-config.json')), nextConfigHash: hash(json('/state/next-config.json')), token: plan.paths.token, paths: plan.paths });
  } else if (command === 'journal') {
    const journal = json('/state/journal.json'); journal.phase = phase; journal.updatedAt = new Date().toISOString();
    if (['success','rolled-back','rollback-failed'].includes(phase)) journal.result = phase;
    durableJson('/state/journal.json', journal); console.info('Update phase: ' + phase);
    record({ kind: 'phase', phase });
  } else if (command === 'resume-proof') {
    const journal = json('/state/journal.json'), plan = json('/state/plan.json'), paths = json('/work/paths.json');
    need(journal.version === 2 && journal.project === project && journal.planHash === planDigest(plan) && plan.digest === journal.planHash, 'Update journal or plan integrity mismatch');
    need(journal.priorConfigHash === hash(json('/state/prior-config.json')) && journal.nextConfigHash === hash(json('/state/next-config.json')), 'Recorded deployment configuration checksum mismatch');
    for (const key of ['current','target','state','backup']) need(paths[key] === journal.paths[key], 'Resume paths differ from the recorded update');
    console.info(journal.phase);
  } else if (command === 'rollback-proof') {
    const plan = json('/state/plan.json'), journal = json('/state/journal.json');
    await database(containers,client=>proveRollback(client,containers,project,plan,journal,phase==='stopped'));
  } else if (command === 'restore-command') {
    const journal = json('/state/journal.json');
    const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    need(/^[a-f0-9]{64}$/.test(journal.backupHash ?? ''), 'Verified pre-update backup confirmation is unavailable');
    const applicationsRunning = containers.some(item => /^(api|worker)-[12]$/.test(item.Config?.Labels?.['com.docker.compose.service'] ?? '') && item.State.Running);
    console.error('No application rollback. ' + (applicationsRunning ? 'Stop every project container before backup restore.' : 'Stack remains in maintenance.'));
    console.error('Backup: ' + journal.paths.backup);
    console.error('Restore command: sh ' + [journal.paths.current + '/bin/jiffoo-host', 'restore', journal.paths.backup, project, journal.paths.state + '-restore', journal.backupHash, ...(mode === 'acceptance' ? ['--acceptance'] : [])].map(shellQuote).join(' '));
  } else if (command === 'core-migrations') {
    const plan = json('/state/plan.json');
    const sources = migrationInventory();
    need(canonicalJson(identities(sources)) === canonicalJson(plan.targetInventory), 'Target Core inventory changed after audit');
    const { validateCoreMigrationSql } = require('/app/packages/shared/dist/shared/src/core-migration-sql.js');
    await database(containers, async client => {
      await client.query("SET lock_timeout='5s'");
      await client.query('SELECT pg_advisory_lock(1246316110,1)');
      await maintenance(client, containers, project, plan.boots);
      await executeCoreMigrations(client, sources, plan.currentInventory, validateCoreMigrationSql, async event => {
        if(event.status==='intent')await maintenance(client,containers,project,plan.boots);
        migrationEvent(event);
        if (mode === 'acceptance' && event.status === 'committed' && existsSync('/app/deploy/compose/update-crash-checkpoint')) {
          // Only disposable acceptance images contain this deterministic crash checkpoint.
          while (!existsSync('/state/acceptance-release')) await new Promise(done => setTimeout(done,100));
        }
      });
    },610000);
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
      assertCorePrefix((await client.query(coreHistorySql)).rows, phase === 'prior' ? json('/state/plan.json').currentInventory : identities(migrationInventory()), true);
    });
    console.info('Every release service and all two API two worker process identities are healthy');
  } else if (command === 'maintenance' || command === 'audit' || command === 'snapshot' || command === 'restore') {
    if(command==='audit')configureRuntime(containers);
    const plan = json('/state/plan.json');
    await database(containers, async client => {
      const proof = await maintenance(client, containers, project, plan.boots); durableJson('/state/maintenance.json', proof);
      if (command === 'maintenance') { console.info('Docker registry database sessions and in-flight maintenance proof passed'); return; }
      assertCorePrefix((await client.query(coreHistorySql)).rows, plan.currentInventory, true);
      if (command === 'audit') {
        need(hash(source) === plan.currentReleaseHash && hash(target) === plan.targetReleaseHash, 'Release identity changed after confirmation');
        need(canonicalJson(installedBindings(json('/work/current-config.json'),containers,json('/work/volumes.json'),project))===canonicalJson(plan.bindings),'Installed volume or TLS bindings changed after confirmation');
        need(canonicalJson(identities(migrationInventory())) === canonicalJson(plan.targetInventory), 'Core target inventory changed after confirmation');
        const plugins = await pluginPlan(client, existsSync('/plugins') ? '/plugins' : undefined);
        need(canonicalJson(plugins) === canonicalJson({ installed: plan.installed, packages: plan.packages, pluginSlugs: plan.pluginSlugs, themeSlugs: plan.themeSlugs }), 'Plugin plan changed after confirmation');
        const { auditPluginDatabaseForUpdate, pluginDatabaseAuditExitCode } = require('/app/apps/api/dist/core/admin/extension-installer/plugin-database-audit.js');
        const report = await auditPluginDatabaseForUpdate(client, plan.currentInventory); durableJson('/state/audit.json', report);
        need(pluginDatabaseAuditExitCode(report) === 0, 'Plugin database pre-write audit blocked update; inspect audit.json');
        const journal = json('/state/journal.json'); journal.auditHash = hash(report);
        if (existsSync('/backup/backup.sha256')) {
          journal.backupHash = readFileSync('/backup/backup.sha256', 'utf8').trim();
          const backup = verifyBackup('/backup',journal.backupHash,mode);
          need(backup.sourceCommit === plan.currentCommit && backup.project === project, 'Backup identity differs from the confirmed update');
        }
        durableJson('/state/journal.json', journal); record({ kind: 'audit', auditHash: journal.auditHash, backupHash: journal.backupHash ?? null });
        console.info('Core and plugin pre-write audit passed; ' + (plan.migrations.length || plan.packages.some(item => item.pending.length || item.provisionNamespace) ? 'confirmed migration plan' : 'zero pending migrations'));
      } else if (command === 'snapshot') {
        const snap = await snapshot(client, plan); durableJson('/state/managed.json', snap);
        const journal = json('/state/journal.json'); journal.managedHash = hash(snap); durableJson('/state/journal.json', journal);
      } else {
        const snap = json('/state/managed.json'); need(json('/state/journal.json').managedHash === hash(snap), 'Managed snapshot checksum mismatch');
        await proveRollback(client,containers,project,plan,json('/state/journal.json'),true);
        await restoreSnapshot(client, snap); console.info('Managed package bytes installations subscriptions registry and theme state restored');
      }
    });
  } else if (command === 'plugins') {
    const plan = json('/state/plan.json');
    if (!plan.packages.some(item => item.changed)) return;
    configureRuntime(containers);
    const { previewPluginUpload } = require('/app/apps/api/dist/core/admin/extension-installer/plugin-upload.js');
    const { startPluginInstallOperation, getPluginInstallOperation, drainPluginInstallOperations } = require('/app/apps/api/dist/core/admin/extension-installer/plugin-migration-operation.js');
    const { finishCoreProcess,ensureCoreProcess } = require('/app/apps/api/dist/infra/core-process.js');
    const { prisma } = require('/app/apps/api/dist/config/database.js');
    const { coreProcessIdentity,processApplicationPrefix } = require('/app/apps/api/dist/infra/core-process-identity.js');
    let guard;
    try {
      for (const item of plan.packages.filter(item => item.changed)) {
        const bytes = readFileSync('/plugins/' + item.filename); need(sha256(bytes) === item.hash, 'Target plugin bytes changed after audit');
        confirmedPlan(plan);
        await ensureCoreProcess();
        if(!guard){guard=configuredClient(containers);guard.on('error',()=>undefined);await guard.connect();await guard.query("SET lock_timeout='5s'");await guard.query('SELECT pg_advisory_lock(1246316110,1)');}
        await maintenance(guard,containers,project,plan.boots,{bootNonce:coreProcessIdentity.bootNonce,applicationPrefix:processApplicationPrefix()});
        const preview = await previewPluginUpload(bytes, plan.paths.actor);
        need(canonicalJson(preview.migrationPlan.pending) === canonicalJson(item.pending) && preview.migrationPlan.provisionNamespace === item.provisionNamespace, 'Plugin migration plan changed after audit');
        const result = await startPluginInstallOperation(bytes, { actorUserId: plan.paths.actor, previewToken: preview.previewToken, confirmMigrations: preview.migrationPlan.changesDatabase }, undefined, async event => {
          need(event.order === 0 ? item.provisionNamespace : item.pending.some(row => row.order === event.order && row.id === event.migrationId && row.path === event.path && row.sha256 === event.sha256), 'Unplanned plugin migration intent');
          const operation=await prisma.pluginMigrationOperation.findUniqueOrThrow({where:{id:event.operationId}});
          need(operation.ownerBootNonce===coreProcessIdentity.bootNonce && operation.packageHash===item.hash && operation.manifestDigest===item.manifestDigest, 'Plugin executor identity changed after audit');
          await maintenance(guard,containers,project,plan.boots,{slug:item.manifest.slug,operationId:event.operationId,attemptId:event.attemptId,leaseToken:operation.leaseToken,bootNonce:coreProcessIdentity.bootNonce,applicationPrefix:processApplicationPrefix()});
          migrationEvent({ kind: 'plugin', status: 'intent', slug: item.manifest.slug, ...event });
        });
        await drainPluginInstallOperations(); const operation = await prisma.pluginMigrationOperation.findUniqueOrThrow({where:{id:result.operationId}});
        need(operation.phase === 'SUCCESS', 'Target plugin publication failed: ' + item.manifest.slug);
      }
    } finally { try { await finishCoreProcess(); } finally { await guard?.end(); await prisma.$disconnect(); } }
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
