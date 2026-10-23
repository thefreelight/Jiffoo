import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { ComposeVolumeLedger, RecordedAcceptanceChecks, assertDeploymentConfig } from './compose-volumes.mjs';
import { BackupHostEmulator, emulatorImage } from './backup-host-emulator.mjs';
import { makeRelease } from '../deploy/release/prepare.mjs';
import { sha256 } from '../deploy/release/identity.mjs';
import { archiveComposeStartup, withComposeStartupDiagnostics, redactComposeOutput } from './compose-startup.mjs';
import { generateStorageSecret } from './storage-secret.mjs';

export function updateProfile(args) {
  const profiles = args.filter(value => value.startsWith('--profile='));
  const partitions = args.filter(value => value.startsWith('--partition='));
  assert.ok(profiles.length <= 1 && partitions.length <= 1 && args.length === profiles.length + partitions.length && profiles.every(value => /^--profile=(core|full)$/.test(value)) && partitions.every(value => /^--partition=(no-migration|migration)$/.test(value)), 'Usage: pnpm verify:update [--profile=core|full] [--partition=no-migration|migration]');
  assert.ok(!partitions.length || profiles[0] !== '--profile=full', 'Partitions are supported only for the core profile');
  return profiles[0]?.slice('--profile='.length) ?? 'core';
}
export function bumpThemePatch(version) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const [major, minor, patch] = version.split('.');
  const nextPatch = Number(patch) + 1;
  assert.ok(Number.isSafeInteger(nextPatch), 'Theme patch must remain a safe integer');
  return major + '.' + minor + '.' + nextPatch;
}
export function guardUpdateDatabase(url) {
  assert.equal(url, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test', 'Update acceptance requires the exact jiffoo_core_test DATABASE_URL_TEST');
}
// Keep the existing full-gate catalogue identity while extending its actual checks.
export const updateStep = 'Run no-migration update acceptance';
async function main() {
  const profile = updateProfile(process.argv.slice(2)); guardUpdateDatabase(process.env.DATABASE_URL_TEST);
  const partition = process.argv.slice(2).find(value => value.startsWith('--partition='))?.slice('--partition='.length);
  const group = partition ? 'update-' + partition : 'update';
  const step = partition === 'migration' ? 'Run migration update acceptance' : updateStep;
  const started = new Date().toISOString(), start = performance.now(), project = 'jiffoo-update-' + randomUUID();
  const native = mkdtempSync(join(tmpdir(), project + '-'));
  const evidence = resolve(process.env.GITHUB_ACTIONS === 'true' ? join(process.env.RUNNER_TEMP, 'verification') : join('e2e/test-results', project));
  mkdirSync(evidence, { recursive: true });
  const emulator = process.platform === 'win32' ? new BackupHostEmulator(project, process.cwd(), native) : undefined;
  const root = emulator ? '/workspace' : process.cwd();
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  const version = JSON.parse(readFileSync('package.json')).version.replace(/-opensource$/, '');
  const targetThemeVersion = bumpThemePatch(JSON.parse(readFileSync('apps/api/builtin-themes/default-shop/theme.json', 'utf8')).version);
  const tags = [], commands = [], ports = [], manifests = {};
  let directory, old, target, failure, baseline, foreignBefore, activeConfig, migrationBaseline, actor='acceptance-operator', secrets = [];
  const fixtureSql = {
    first:"CREATE TABLE public.b16c2_update_probe (id integer PRIMARY KEY, value text NOT NULL);\nINSERT INTO public.b16c2_update_probe (id,value) VALUES (1,'core-first-commit');\n",
    second:"ALTER TABLE public.b16c2_update_probe ADD COLUMN execution_count integer NOT NULL DEFAULT 0;\nUPDATE public.b16c2_update_probe SET value='core-second-commit',execution_count=execution_count+1 WHERE id=1;\n",
    checked:"DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM public.b16c2_update_probe WHERE id = 1) THEN\n    RAISE EXCEPTION 'probe row missing';\n  END IF;\nEND $$;\nUPDATE public.b16c2_update_probe SET value = value || '-checked' WHERE id = 1;\n",
    failed:"CREATE TABLE public.b16c2_should_rollback (id integer PRIMARY KEY);\nINSERT INTO public.b16c2_update_probe (id,value) VALUES (2,'must-rollback');\nSELECT 1 / 0;\n",
  };
  const run = async (command, args, { allowFailure = false, quiet = false } = {}) => {
    const tick = performance.now();
    const result = emulator ? await emulator.run(command, args) : await new Promise((done, reject) => {
      const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = '';
      child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
      child.once('error', reject); child.once('close', code => done({ code, stdout, output: stdout + stderr }));
    });
    result.duration = ((performance.now() - tick) / 1000).toFixed(2) + 's';
    commands.push({ command, args: args.map(value => redactComposeOutput(value,secrets)), code: result.code, duration: result.duration, ...(!quiet || result.code !== 0 ? { output: redactComposeOutput(result.output, secrets) } : {}) });
    if (result.code !== 0 && !allowFailure) throw new Error(`${command} ${args.slice(0, 2).join(' ')} exited ${result.code}\n${redactComposeOutput(result.output, secrets)}`);
    return result;
  };
  const docker = (args, options) => run('docker', args, options);
  const volumes = new ComposeVolumeLedger(project, async args => (await docker(args, { quiet: true })).stdout);
  const checks = new RecordedAcceptanceChecks(volumes, async (events, owned) => writeFileSync(join(evidence, 'volume-mounts.json'), JSON.stringify({ project, events, owned }, null, 2)));
  const resources = async () => {
    const ids = (await docker(['ps','-aq'], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
    const rows = ids.length ? JSON.parse((await docker(['inspect', ...ids], { quiet: true })).stdout) : [];
    return {
      containers: rows.filter(c => c.Config.Labels?.['com.docker.compose.project'] !== project && c.Config.Labels?.['io.jiffoo.acceptance.project'] !== project).map(c => ({ id: c.Id, running: c.State.Running, startedAt: c.State.StartedAt, mounts: c.Mounts.map(m => m.Name ?? m.Source).sort() })).sort((a, b) => a.id.localeCompare(b.id)),
      networks: (await docker(['network','ls','--format','{{.ID}} {{.Name}}'], { quiet: true })).stdout.trim().split('\n').filter(line => !line.includes(project)).sort(),
      volumes: (await docker(['volume','ls','--format','{{.Name}}'], { quiet: true })).stdout.trim().split('\n').filter(line => !line.includes(project)).sort(),
    };
  };
  const compose = (args, options) => docker(['compose','--project-name',project, ...(activeConfig ? ['-f', activeConfig] : ['--env-file',old + '/deploy/compose/.env','-f',old + '/deploy/compose/compose.yml','-f',old + '/deploy/compose/compose.release.yml']), ...args], options);
  const diagnostics = () => ({ project, query: async args => (await docker(args, { quiet: true })).stdout,
    logs: async service => (await compose(['logs','--no-color','--no-log-prefix', ...(service ? [service] : [])], { quiet: true })).output,
    save: async (name, output) => writeFileSync(join(evidence, name), output), secrets });
  const updateArgs = (name, release = target) => ['update','--project',project,'--current-release',old,'--target-release',release,'--target-commit',commit,'--state-dir',directory + '/' + name,'--backup-dir',directory + '/' + name + '-backup','--actor',actor];
  const host = (args, options) => run('sh', [(args[0] === 'update' ? target : old) + '/bin/jiffoo-host', ...args, '--acceptance'], options);
  const managed = async () => {
    const result = await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','managed']);
    const line = result.stdout.split('\n').find(line => line.startsWith('UPDATE_MANAGED ')); assert.ok(line);
    return JSON.parse(line.slice('UPDATE_MANAGED '.length));
  };
  const recorded = async name => JSON.parse((await run('cat', [directory + '/' + name + '/journal.json'], { quiet: true })).stdout);
  const proof = async () => {const result=await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','migration-proof']);return JSON.parse(result.stdout.split('\n').find(line=>line.startsWith('UPDATE_PROOF ')).slice(13));};
  const auditRows = async () => {
    const postgres = (await docker(['ps', '-q', '--filter', 'label=com.docker.compose.project=' + project, '--filter', 'label=com.docker.compose.service=postgres'], { quiet: true })).stdout.trim();
    const result = await docker(['run', '--rm', '--label', 'com.docker.compose.project=' + project, '--network', 'container:' + postgres, '--read-only', '--tmpfs', '/tmp',
      '-e', 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test', '-e', 'DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test',
      '--entrypoint', 'node', manifests.old.verifierImage, '/app/deploy/compose/host-audit-check.mjs'], { quiet: true });
    const rows = JSON.parse(result.stdout.split('\n').find(line => line.startsWith('HOST_AUDITS ')).slice(12));
    for (const secret of secrets) assert.ok(!JSON.stringify(rows).includes(secret));
    writeFileSync(join(evidence, 'merchant-audits.json'), JSON.stringify(rows, null, 2)); return rows;
  };
  const migrationArgs = (name,generation='migration') => [...updateArgs(name,directory+'/'+generation),'--plugin-packages',directory+'/packages'];
  const confirmed = async (name,generation='migration') => {
    const args=migrationArgs(name,generation), result=await host([...args,'--plan'],{quiet:true});
    const hash=result.stdout.match(/Update plan: ([a-f0-9]{64})/)[1];
    return [...args,'--confirm',hash];
  };
  const archiveJournal = async name => {const journal=await recorded(name);writeFileSync(join(evidence,name+'-journal.json'),JSON.stringify(journal,null,2));return journal;};
  const migrationOutcome = async () => {
    const postgres=(await docker(['ps','--no-trunc','-q','--filter','label=com.docker.compose.project='+project,'--filter','label=com.docker.compose.service=postgres'],{quiet:true})).stdout.trim();assert.match(postgres,/^[a-f0-9]{64}$/);
    const code="const {createRequire}=await import('node:module');const assert=(await import('node:assert/strict')).default;const {Client}=createRequire('/app/apps/api/package.json')('pg');assert.equal(process.env.DATABASE_URL_TEST,'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');const client=new Client({connectionString:process.env.DATABASE_URL});try{await client.connect();assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name,'jiffoo_core_test');await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const history=(await client.query('SELECT id,migration_name,checksum FROM public._prisma_migrations ORDER BY migration_name')).rows;const rows=(await client.query('SELECT * FROM public.b16c2_update_probe ORDER BY id')).rows;await client.query('COMMIT');console.log('UPDATE_OUTCOME '+JSON.stringify({history,rows}));}finally{await client.end();}";
    const result=await docker(['run','--rm','--label','com.docker.compose.project='+project,'--label','io.jiffoo.host-helper=true','--network','container:'+postgres,'--read-only','--tmpfs','/tmp','-e','DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test','-e','DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test','--entrypoint','node',manifests.old.verifierImage,'--input-type=module','-e',code],{quiet:true});
    return JSON.parse(result.stdout.split('\n').find(line=>line.startsWith('UPDATE_OUTCOME ')).slice(15));
  };
  const backupRestore = async (name,output) => {
    const command=output.split('\n').find(line=>line.startsWith('Restore command: '));assert.ok(command,'Failure must print the exact restore command');
    await compose(['stop','-t','45']);
    const result=await run('sh',['-c',command.slice('Restore command: '.length)]);process.stdout.write(result.output);
    activeConfig=directory+'/'+name+'-restore/compose.restore.json';
    await assertDeploymentConfig(async args => (await docker(args, {quiet:true})).stdout, project, activeConfig);
    await compose(['stop','-t','45','edge','shop','admin','api-lb','worker-1','worker-2','api-1','api-2','redis','silo']);
    const subsequent=directory+'/'+name+'-restored-backup';
    const backedUp=await host(['backup',directory+'/'+name+'-restore/release',project,subsequent]);process.stdout.write(backedUp.output);
    const manifest=JSON.parse((await run('cat',[subsequent+'/backup.json'],{quiet:true})).stdout);
    const configBytes=(await run('cat',[subsequent+'/config.json'],{quiet:true})).stdout;
    assert.equal(manifest.files.find(row=>row.path==='config.json').sha256,sha256(Buffer.from(configBytes)));
    const restoredConfig=JSON.parse((await run('cat',[activeConfig],{quiet:true})).stdout);
    for(const [logical,volume] of Object.entries(restoredConfig.volumes))assert.equal(manifest.oldVolumes[logical],volume.name);
    await compose(['up','-d','--force-recreate','--no-build','--wait','--wait-timeout','600']);
    await assertDeploymentConfig(async args => (await docker(args, {quiet:true})).stdout, project, activeConfig);
    assert.deepEqual(await proof(),migrationBaseline);
  };
  const restore = async name => {
    const result = await host([...updateArgs(name), '--restore-prior']); process.stdout.write(result.output);
    activeConfig = directory + '/' + name + '/prior-config.json';
    await assertDeploymentConfig(async args => (await docker(args, {quiet:true})).stdout, project, activeConfig);
    assert.equal((await recorded(name)).result, 'rolled-back'); assert.deepEqual(await managed(), baseline);
  };
  try {
    await checks.run('Host plan identity and confirmation unit checks',[],async()=>{
      const result=spawnSync(process.execPath,['--test','scripts/update.test.mjs'],{encoding:'utf8',windowsHide:true});
      writeFileSync(join(evidence,'host-unit-tests.txt'),result.stdout+result.stderr);assert.equal(result.status,0,result.stdout+result.stderr);
    });
    await checks.run('Docker Linux host and foreign-resource preflight', [], async () => {
      if (emulator) { await emulator.start(); console.info('Local Linux host emulator: ' + emulatorImage); }
      await docker(['version']); await docker(['compose','version']); assert.equal((await run('uname',['-s'])).stdout.trim(),'Linux');
      directory = (await run('mktemp',['-d',(emulator?.root ?? '/tmp') + '/' + project + '-XXXXXX'])).stdout.trim();
      old = directory + '/old'; target = directory + '/target'; failure = directory + '/failure';
      foreignBefore = await resources(); writeFileSync(join(evidence,'resources-before.json'), JSON.stringify(foreignBefore,null,2));
      const ids = (await docker(['network','ls','-q'], { quiet: true })).stdout.trim().split(/\s+/).filter(Boolean);
      if (ids.length) assert.ok(!JSON.parse((await docker(['network','inspect',...ids], { quiet: true })).stdout).some(n => n.IPAM?.Config?.some(c => c.Subnet === '172.30.65.0/24')), 'Acceptance subnet is already in use');
    });
    await checks.run('Build two local releases and a real failing target', ['Docker Linux host and foreign-resource preflight'], async () => {
      const inspections = join(native,'inspection'); mkdirSync(inspections);
      for (const role of ['backend','admin','shop']) {
        const tag = project + '-old-' + role; tags.push(tag);
        const result = await docker(['build','--platform','linux/amd64','-f',root + '/deploy/compose/Dockerfile','--target',role,'--build-arg','REVISION=' + commit,'--build-arg','RELEASE_VERSION=' + version,'-t',tag,root]);
        process.stdout.write(result.output.split(/\r?\n/).slice(-2).join('\n') + '\n');
        writeFileSync(join(inspections,role + '.json'), (await docker(['image','inspect',tag], { quiet: true })).stdout);
      }
      const key=()=>{const pair=generateKeyPairSync('ed25519');return{publicKey:pair.publicKey.export({type:'spki',format:'der'}).toString('base64url'),privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})};};
      const keys={root:key(),publisher:key()}, signingContext=join(native,'signing-context');mkdirSync(signingContext);
      writeFileSync(join(signingContext,'keys.json'),JSON.stringify(keys));
      const signedTag=project+'-signed-backend';tags.push(signedTag);
      writeFileSync(join(signingContext,'Dockerfile'),'FROM '+project+'-old-backend\nENV EXTENSION_TEST_SIGNING_MODE=true JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY='+keys.root.publicKey+'\nCOPY keys.json /app/deploy/compose/update-fixture-keys.json\n');
      await docker(['build','--platform','linux/amd64','-t',signedTag,signingContext]);
      // Give the source version its own exact inventory before generating its release fixture.
      const sourceMember = 'deploy/release/source-inventory-fixture.json', sourceBytes = Buffer.from('{"version":"source"}\n');
      const sourceIdentity = readFileSync('deploy/release/identity.mjs', 'utf8').replace('export const roles =', 'deploymentFiles.push(' + JSON.stringify(sourceMember) + ');\nexport const roles =');
      writeFileSync(join(signingContext, 'identity.mjs'), sourceIdentity);
      writeFileSync(join(signingContext, 'source-inventory-fixture.json'), sourceBytes);
      writeFileSync(join(signingContext, 'Dockerfile-source'), 'FROM ' + signedTag + '\nCOPY identity.mjs /app/deploy/release/identity.mjs\nCOPY source-inventory-fixture.json /app/' + sourceMember + '\n');
      const sourceTag = project + '-source-backend'; tags.push(sourceTag);
      await docker(['build', '--platform', 'linux/amd64', '-f', join(signingContext, 'Dockerfile-source'), '-t', sourceTag, signingContext]);
      writeFileSync(join(inspections,'backend.json'),(await docker(['image','inspect',sourceTag],{quiet:true})).stdout);
      const yaml = readFileSync('deploy/compose/compose.yml','utf8');
      for (const role of ['postgres','redis','silo','nginx']) {
        const reference = yaml.match(new RegExp('image: (' + (role === 'silo' ? 'pgsty/silo' : role) + ':[^\\s]+@sha256:[a-f0-9]{64})'))[1];
        if ((await docker(['image','inspect',reference], { allowFailure: true, quiet: true })).code !== 0) await docker(['pull','--platform','linux/amd64',reference]);
        writeFileSync(join(inspections,role + '.json'), (await docker(['image','inspect',reference], { quiet: true })).stdout);
      }
      const adjust = (bundle, manifest) => {
        const path = join(bundle,'deploy/compose/compose.release.yml'); let content = readFileSync(path,'utf8');
        for (const service of ['api-1','api-2','worker-1','worker-2','db-init','silo-volume-init']) content = content.replace('  ' + service + ':\n', '  ' + service + ':\n    environment:\n      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/jiffoo_core_test\n');
        content += '\n  postgres:\n    image: '+manifest.images.postgres.reference+'\n    environment:\n      POSTGRES_DB: jiffoo_core_test\n';
        for(const [role,services] of [['redis',['redis']],['silo',['silo','silo-init']],['nginx',['edge','api-lb']]])for(const service of services)content+='\n  '+service+':\n    image: '+manifest.images[role].reference+'\n';
        writeFileSync(path,content);
        const member = manifest.deployment.find(row => row.path.endsWith('compose.release.yml')), bytes = readFileSync(path); member.sha256 = sha256(bytes); member.size = bytes.length;
        writeFileSync(join(bundle,'release.json'), JSON.stringify(manifest,null,2) + '\n');
      };
      const bundle = join(native,'old'); manifests.old = makeRelease({ root: process.cwd(), output: bundle, inspections, commit, version, mode:'acceptance' }); adjust(bundle,manifests.old);
      writeFileSync(join(bundle, sourceMember), sourceBytes);
      manifests.old.deployment.push({ path: sourceMember, size: sourceBytes.length, sha256: sha256(sourceBytes) });
      writeFileSync(join(bundle, 'release.json'), JSON.stringify(manifests.old, null, 2) + '\n');
      const fixtureTime=new Date(Math.max(Date.now(),Date.UTC(2026,9,10,16,18,3)+60000));
      const fixtureNames=[0,1,2].map(index=>new Date(fixtureTime.getTime()+index*60000).toISOString().replace(/[-:T]/g,'').slice(0,14)+'_b16c2_'+(index+1));
      const generations=[['target',version+'-update'],['failure',version+'-failure'],['migration',version+'-migration'],['migration-health',version+'-migration-health'],...(profile==='full'?[['migration-failure',version+'-migration-failure'],['migration-crash',version+'-migration-crash']]:[])];
      for (const [generation, newVersion] of generations) {
        const context = join(native,generation + '-context'); mkdirSync(context);
        const shipping = JSON.parse(readFileSync('apps/api/builtin-plugins/free-shipping/manifest.json','utf8')); shipping.version = '1.0.1';
        const theme = JSON.parse(readFileSync('apps/api/builtin-themes/default-shop/theme.json','utf8')); theme.version = targetThemeVersion;
        writeFileSync(join(context,'shipping.json'),JSON.stringify(shipping)); writeFileSync(join(context,'theme.json'),JSON.stringify(theme));
        writeFileSync(join(context,'failure.mjs'), "throw new Error('Intentional update acceptance startup failure');\n");
        const migrating=generation.startsWith('migration');
        if(migrating){
          for(const [index,sql]of [fixtureSql.first,generation==='migration-failure'?fixtureSql.failed:fixtureSql.second,fixtureSql.checked].entries())writeFileSync(join(context,'migration-'+index+'.sql'),sql);
          writeFileSync(join(context,'schema.prisma'),'model B16c2UpdateProbe {\n  id Int @id\n  value String\n  execution_count Int @default(0)\n  @@map("b16c2_update_probe")\n  @@schema("public")\n}\n');
          writeFileSync(join(context,'crash-checkpoint'),'acceptance-only\n');
        }
        for (const role of ['backend','admin','shop']) {
          const base = generation === 'failure' ? project + '-target-' + role : role==='backend'?signedTag:project + '-old-' + role;
          const contents = 'FROM ' + base + '\nLABEL org.opencontainers.image.revision="' + commit + '" org.opencontainers.image.version="' + newVersion + '"\n' + (role === 'backend' ? 'ENV APP_VERSION=' + newVersion + ' BUILD_SHA=' + commit + '\n' : '') + (role === 'backend' ? migrating ? [0,1,2].map(index=>'COPY migration-'+index+'.sql /app/apps/api/prisma/migrations/'+fixtureNames[index]+'/migration.sql\n').join('')+'COPY schema.prisma /app/apps/api/prisma/schema/b16c2.prisma\n'+(generation==='migration-crash'?'COPY crash-checkpoint /app/deploy/compose/update-crash-checkpoint\n':'') : 'COPY shipping.json /app/apps/api/builtin-plugins/free-shipping/manifest.json\nCOPY theme.json /app/apps/api/builtin-themes/default-shop/theme.json\n' : ['failure','migration-health'].includes(generation) && role === 'shop' ? 'COPY failure.mjs /app/apps/shop/server.mjs\n' : '');
          writeFileSync(join(context,'Dockerfile-' + role),contents);
          const tag = project + '-' + generation + '-' + role; tags.push(tag);
          await docker(['build','--platform','linux/amd64','-f',join(context,'Dockerfile-' + role),'-t',tag,context]);
          writeFileSync(join(inspections,role + '.json'),(await docker(['image','inspect',tag], { quiet: true })).stdout);
        }
        const output = join(native,generation); manifests[generation] = makeRelease({ root: process.cwd(), output, inspections, commit, version:newVersion, mode:'acceptance' }); adjust(output,manifests[generation]);
      }
      const env = { COMPOSE_PROJECT_NAME:project, REVISION:commit, POSTGRES_PASSWORD:'postgres', JWT_SECRET:randomBytes(48).toString('base64url'), PLUGIN_SECRETS_KEY:randomBytes(32).toString('base64'),
        PLUGIN_PAGE_TOKEN_SECRET: randomBytes(32).toString('base64'),
        PLUGIN_FILE_URL_SECRET: randomBytes(32).toString('base64'),
        MINIO_ROOT_USER:'update-' + randomUUID(), MINIO_ROOT_PASSWORD:generateStorageSecret(), UPLOAD_S3_BUCKET:'update-' + randomUUID(), SILO_APP_ACCESS_KEY_ID:'app-' + randomUUID(), SILO_APP_SECRET_ACCESS_KEY:generateStorageSecret(),
        STOREFRONT_URL:'https://update-shop.test', ADMIN_URL:'https://update-admin.test', EDGE_PORT:'0', TLS_CERT_FILE:old + '/cert.pem', TLS_KEY_FILE:old + '/key.pem' };
      secrets = [env.JWT_SECRET,env.PLUGIN_SECRETS_KEY,env.PLUGIN_PAGE_TOKEN_SECRET, env.PLUGIN_FILE_URL_SECRET,env.MINIO_ROOT_USER,env.MINIO_ROOT_PASSWORD,env.SILO_APP_ACCESS_KEY_ID,env.SILO_APP_SECRET_ACCESS_KEY];
      writeFileSync(join(native,'old/deploy/compose/.env'),Object.entries(env).map(([key,value]) => key + '=' + value).join('\n') + '\n',{mode:0o600});
      for (const generation of ['old',...generations.map(([name])=>name)]) {
        const to = directory + '/' + generation; await run('cp',['-R',emulator ? '/input/' + generation : join(native,generation),to]);
        await run('chmod',['-R','u=rwX,go=',to]);
        for (const file of ['api-lb.conf','edge.conf.template','silo-init.sh']) await run('chmod',['644',to + '/deploy/compose/' + file]);
        await run('chmod',['755',to + '/deploy/compose/15-edge-hosts.envsh']);
      }
      await run('chmod',['777',old]);
      await docker(['run','--rm','--label','com.docker.compose.project=' + project,'--network','none','--user','1000:1000','--mount','type=bind,source=' + old + ',target=/tls','--entrypoint','openssl',manifests.old.verifierImage,'req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout','/tls/key.pem','-out','/tls/cert.pem','-subj','/CN=update-shop.test','-addext','subjectAltName=DNS:update-shop.test,DNS:update-admin.test'], { quiet: true });
      await docker(['run','--rm','--label','com.docker.compose.project=' + project,'--network','none','--user','1000:1000','--mount','type=bind,source=' + old + ',target=/tls','--entrypoint','chmod',manifests.old.verifierImage,'644','/tls/cert.pem','/tls/key.pem']);
      await run('chmod',['700',old]);
    });
    await checks.run('Replay all Core migrations from empty database with executor and schema parity', ['Build two local releases and a real failing target'], async()=>{
      await compose(['up','-d','--no-build','--wait','--wait-timeout','180','postgres']);
      const id=(await compose(['ps','-q','postgres'])).stdout.trim();
      const result=await docker(['run','--rm','--label','com.docker.compose.project='+project,'--network','container:'+id,'--read-only','--tmpfs','/tmp','-e','DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test','-e','DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/jiffoo_core_test','--entrypoint','node',manifests.old.verifierImage,'/app/deploy/compose/core-migration-parity.mjs']);
      writeFileSync(join(evidence,'core-parity.txt'),result.output);assert.match(result.stdout,/"schemaDiff":"no difference"/);
    });
    await checks.run('Start old release with two API and two worker instances', ['Replay all Core migrations from empty database with executor and schema parity'], () => withComposeStartupDiagnostics(() => compose(['up','-d','--no-build','--wait','--wait-timeout','600','edge']), diagnostics()));
    await checks.run('Seed merchant and theme configuration through real API', ['Start old release with two API and two worker instances'], async () => {
      const password = randomUUID() + 'Aa1!'; secrets.push(password);
      const code = "const r=await fetch('http://127.0.0.1:3001/api/v1/install/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({siteName:'Update acceptance',adminEmail:'update-owner@example.test',adminPassword:process.argv[1]})});if(r.status!==200)throw new Error(await r.text());";
      await compose(['exec','-T','api-1','node','--input-type=module','-e',code,password], { quiet: true });
      const configured=await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','configure',password], { quiet: true });
      const data=JSON.parse(configured.stdout.split('\n').find(line=>line.startsWith('UPDATE_FIXTURE ')).slice(15));actor=data.actor;
      mkdirSync(join(native,'packages'));writeFileSync(join(native,'packages/probe.zip'),Buffer.from(data.package,'base64'));
      await run('cp',['-R',emulator?'/input/packages':join(native,'packages'),directory+'/packages']);
      migrationBaseline=await proof();writeFileSync(join(evidence,'migration-baseline.json'),JSON.stringify(migrationBaseline,null,2));
      baseline = await managed(); writeFileSync(join(evidence,'managed-before.json'),JSON.stringify(baseline,null,2));
    });
    if (partition !== 'migration') {
    await checks.run('Reject unknown and missing CLI options', ['Seed merchant and theme configuration through real API'], async () => {
      const missingActor = updateArgs('missing-actor'); missingActor.splice(missingActor.indexOf('--actor'), 2);
      assert.notEqual((await host(missingActor, { allowFailure: true })).code, 0);
      for (const args of [['update','--unknown'],['update','--project',project]]) { const result = await host(args,{allowFailure:true}); assert.notEqual(result.code,0); assert.match(result.output,/Usage:/); }
    });
    await checks.run('Read-only plan proves zero pending migrations without stopping instances', ['Seed merchant and theme configuration through real API'], async () => {
      const result = await host([...updateArgs('plan'), '--plan']); assert.match(result.output,/Pending Core migrations: 0/); assert.match(result.output,/Pending plugin migrations: 0/);
      assert.notEqual((await run('test',['-e',directory + '/plan'], {allowFailure:true})).code,0); assert.deepEqual(await managed(),baseline);
    });
    await checks.run('Tampered target is refused before deployment changes', ['Read-only plan proves zero pending migrations without stopping instances'], async () => {
      const copy = directory + '/tampered'; await run('cp',['-R',target,copy]);
      await run('sh',['-c','printf tampered >> "$1/deploy/compose/silo-init.sh"','fixture',copy]);
      const result = await host(updateArgs('tampered-state',copy),{allowFailure:true}); assert.notEqual(result.code,0); assert.match(result.output,/checksum mismatch/);
      assert.notEqual((await run('test',['-e',directory + '/tampered-state'],{allowFailure:true})).code,0); assert.deepEqual(await managed(),baseline);
    });
    await checks.run('No-migration update backs up audits and starts target release', ['Tampered target is refused before deployment changes'], async () => {
      const result = await host(updateArgs('success')); process.stdout.write(result.output); activeConfig = directory + '/success/next-config.json';
      assert.match(result.output,/zero pending migrations/); assert.match(result.output,/Update completed/);
      assert.equal((await recorded('success')).result,'success');
      const event = (await auditRows()).findLast(row => row.summary.runKind === 'update');
      assert.equal(event.actorId, actor); assert.equal(event.summary.result, 'succeeded'); assert.equal(event.summary.migrationsRan, false);
      assert.equal(event.summary.from.commit, commit); assert.equal(event.summary.to.commit, commit); assert.equal(event.summary.backupReference, 'success-backup');
      assert.equal(event.summary.planHash, (await recorded('success')).planHash);
      const after = await managed(); assert.equal(after.pluginVersion,'1.0.1'); assert.equal(after.themeVersion,targetThemeVersion); assert.notDeepEqual(after,baseline);
      writeFileSync(join(evidence,'successful-update-duration.json'),JSON.stringify({duration:result.duration,managed:after},null,2));
    });
    await checks.run('Successful update retains a verified prior-release restore path', ['No-migration update backs up audits and starts target release'], () => restore('success'));
    await checks.run('Target startup failure automatically restores images and complete managed state', ['Successful update retains a verified prior-release restore path'], async () => {
      const result = await host(updateArgs('failed',failure),{allowFailure:true}); process.stdout.write(result.output); assert.notEqual(result.code,0); assert.match(result.output,/Prior release restored and healthy/);
      activeConfig = directory + '/failed/prior-config.json'; assert.equal((await recorded('failed')).result,'rolled-back'); assert.deepEqual(await managed(),baseline);
      assert.equal((await auditRows()).at(-1).summary.result, 'rolled_back_before_migration');
    });
    await checks.run('Concurrent second host operation is refused while the real first update runs', ['Target startup failure automatically restores images and complete managed state'], async () => {
      const first = host(updateArgs('concurrent'),{allowFailure:true});
      let firstResult; void first.then(value => { firstResult=value; });
      try {
        const deadline = Date.now() + 30000;
        for (;;) { if ((await run('test',['-d','/tmp/.jiffoo-host-' + project + '.lock'],{allowFailure:true,quiet:true})).code === 0) break; assert.ok(!firstResult && Date.now()<deadline,'First update did not acquire its lock'); await new Promise(done => setTimeout(done,100)); }
        const second = await host(updateArgs('second'),{allowFailure:true}); assert.notEqual(second.code,0); assert.match(second.output,/Another host operation holds/);
        const result = await first; assert.equal(result.code,0,result.output); activeConfig = directory + '/concurrent/next-config.json';
      } finally { await first; }
    });
    await checks.run('Restore prior release after concurrent-operation proof', ['Concurrent second host operation is refused while the real first update runs'], () => restore('concurrent'));
    if (profile === 'full') await checks.run('Crash re-run verifies journal and restores the no-migration prior release', ['Restore prior release after concurrent-operation proof'], async () => {
      const first = host(updateArgs('recovery'),{allowFailure:true});
      try {
        const deadline=Date.now()+60000;
        for(;;){
          if((await run('test',['-f',directory + '/recovery/journal.json'],{allowFailure:true,quiet:true})).code===0){
            const journal=await recorded('recovery');
            if(journal.phase==='maintenance-intent'&&(await docker(['ps','-q','--filter','label=com.docker.compose.project='+project,'--filter','label=io.jiffoo.host-helper=true'],{quiet:true})).stdout.trim()==='')break;
          }
          assert.ok(Date.now()<deadline,'Crash checkpoint was not reached');await new Promise(done=>setTimeout(done,50));
        }
        const owner=(await run('cat',['/tmp/.jiffoo-host-'+project+'.lock/pid'],{quiet:true})).stdout.trim();assert.match(owner,/^[1-9][0-9]*$/);
        await run('kill',['-KILL',owner]);const killed=await first;assert.notEqual(killed.code,0);
        const resumed=await host([...updateArgs('recovery'),'--resume']);assert.match(resumed.output,/Prior release restored and healthy/);
        activeConfig=directory+'/recovery/prior-config.json';assert.deepEqual(await managed(),baseline);assert.equal((await recorded('recovery')).result,'rolled-back');
      }finally{await first;}
    });
    }
    if (partition !== 'no-migration') {
    const priorProof=partition === 'migration' ? 'Seed merchant and theme configuration through real API' : 'Restore prior release after concurrent-operation proof';
    await checks.run('Missing and wrong migration confirmation are refused without stopping applications',[priorProof],async()=>{
      const args=migrationArgs('missing-confirmation');
      for(const suffix of [[],['--confirm','0'.repeat(64)]]){
        const result=await host([...args,...suffix],{allowFailure:true});assert.notEqual(result.code,0);assert.match(result.output,/Migration confirmation must equal/);
        assert.notEqual((await run('test',['-e',directory+'/missing-confirmation'],{allowFailure:true})).code,0);
        assert.deepEqual(await proof(),migrationBaseline);
        assert.equal((await auditRows()).at(-1).summary.result, 'refused');
      }
    });
    if(profile==='full'){
      await checks.run('Core checksum and prefix mismatch block before migration writes',[priorProof],async()=>{
        const first=migrationBaseline.coreHistory[0],data={id:first.id,name:first.migration_name,checksum:first.checksum};
        for(const kind of ['core-checksum','core-prefix']){
          try{
            await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','corrupt',kind,JSON.stringify(data)]);
            const result=await host([...migrationArgs(kind),'--plan'],{allowFailure:true});assert.notEqual(result.code,0);assert.match(result.output,/Core migration history mismatch/);
            assert.notEqual((await run('test',['-e',directory+'/'+kind],{allowFailure:true})).code,0);
          }finally{await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','corrupt','core-reset',JSON.stringify(data)]);}
        }
        assert.deepEqual(await proof(),migrationBaseline);
      });
      await checks.run('Plugin ledger mismatch blocks before any migration write',[priorProof],async()=>{
        try{
          await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','corrupt','plugin-ledger']);
          const result=await host([...migrationArgs('plugin-mismatch'),'--plan'],{allowFailure:true});assert.notEqual(result.code,0);
        }finally{await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','corrupt','plugin-reset',migrationBaseline.pluginLedger[0].sha256]);}
        assert.deepEqual(await proof(),migrationBaseline);
      });
      await checks.run('Failure after first committed Core migration stays in maintenance and printed restore recovers data and objects',[priorProof],async()=>{
        const args=await confirmed('migration-failed','migration-failure');
        const result=await host(args,{allowFailure:true});process.stdout.write(result.output);assert.notEqual(result.code,0);assert.match(result.output,/No application rollback/);assert.doesNotMatch(result.output,/Update rollback started|Prior release restored/);
        const journal=await archiveJournal('migration-failed');assert.equal(journal.events.filter(event=>event.kind==='core'&&event.status==='committed').length,1);
        const running=(await docker(['ps','--format','{{.Label "com.docker.compose.service"}}','--filter','label=com.docker.compose.project='+project])).stdout.trim().split('\n');assert.deepEqual(running,['postgres']);
        await backupRestore('migration-failed',result.output);
      });
      await checks.run('Crash between committed migrations refuses resume and never repeats SQL',[priorProof],async()=>{
        const args=await confirmed('migration-crashed','migration-crash');
        const first=host(args,{allowFailure:true});let firstResult;void first.then(value=>{firstResult=value;});
        try{
          const deadline=Date.now()+180000;
          for(;;){
            if((await run('test',['-f',directory+'/migration-crashed/journal.json'],{allowFailure:true,quiet:true})).code===0){const journal=await recorded('migration-crashed');if(journal.events.some(event=>event.kind==='core'&&event.status==='committed'))break;}
            assert.ok(!firstResult&&Date.now()<deadline,'Migration crash checkpoint not reached');await new Promise(done=>setTimeout(done,100));
          }
          const owner=(await run('cat',['/tmp/.jiffoo-host-'+project+'.lock/pid'],{quiet:true})).stdout.trim();assert.match(owner,/^[1-9][0-9]*$/);
          await run('kill',['-KILL',owner]);
          const helpers=(await docker(['ps','-q','--filter','label=com.docker.compose.project='+project,'--filter','label=io.jiffoo.host-helper=true'],{quiet:true})).stdout.trim().split(/\s+/).filter(Boolean);assert.equal(helpers.length,1);
          await docker(['kill',...helpers]);await first;
          const before=await archiveJournal('migration-crashed');assert.equal(before.events.filter(event=>event.kind==='core'&&event.status==='committed').length,1);
          const committed=await migrationOutcome();assert.deepEqual(committed.rows,[{id:1,value:'core-first-commit'}]);writeFileSync(join(evidence,'crash-before-outcome.json'),JSON.stringify(committed,null,2));
          const resumed=await host([...args,'--resume'],{allowFailure:true});process.stdout.write(resumed.output);assert.notEqual(resumed.code,0);assert.match(resumed.output,/forbids resume and application rollback/);
          assert.deepEqual((await recorded('migration-crashed')).events,before.events);
          const after=await migrationOutcome();assert.deepEqual(after,committed);writeFileSync(join(evidence,'crash-after-outcome.json'),JSON.stringify(after,null,2));
          await backupRestore('migration-crashed',resumed.output);
        }finally{await first;}
      });
    }
    await checks.run('Health failure after migrations records maintenance audit and restores the backup',[priorProof],async()=>{
      const result=await host(await confirmed('migration-unhealthy','migration-health'),{allowFailure:true});process.stdout.write(result.output);assert.notEqual(result.code,0);assert.match(result.output,/No application rollback/);assert.doesNotMatch(result.output,/Prior release restored/);
      const journal=await archiveJournal('migration-unhealthy');assert.equal(journal.events.filter(event=>event.kind==='core'&&event.status==='committed').length,3);
      const event = (await auditRows()).at(-1); assert.equal(event.summary.result, 'stopped_in_maintenance_after_migration'); assert.equal(event.summary.migrationsRan, true);
      await backupRestore('migration-unhealthy',result.output);
    });
    await checks.run('Confirmed Core and plugin migrations succeed with durable audit before every migration intent',['Missing and wrong migration confirmation are refused without stopping applications'],async()=>{
      const result=await host(await confirmed('migrated'));process.stdout.write(result.output);activeConfig=directory+'/migrated/next-config.json';
      const journal=await archiveJournal('migrated');assert.equal(journal.result,'success');
      const event = (await auditRows()).at(-1); assert.equal(event.action, 'CORE_UPDATE'); assert.equal(event.summary.operationId, journal.operationId);
      assert.equal(event.summary.result, 'succeeded'); assert.equal(event.summary.migrationsRan, true); assert.equal(event.summary.migrations.filter(row => row.kind === 'core').length, 3);
      assert.equal(event.summary.migrations.filter(row => row.kind === 'plugin').length, 1); assert.ok(event.summary.migrations.every(row => typeof row.name === 'string'));
      const audit=journal.events.findLast(event=>event.kind==='audit');assert.ok(audit.backupHash);
      const intents=journal.events.filter(event=>event.status==='intent');assert.equal(intents.filter(event=>event.kind==='core').length,3);assert.equal(intents.filter(event=>event.kind==='plugin').length,1);
      for(const event of intents){assert.ok(audit.sequence<event.sequence);assert.equal(event.auditHash,audit.auditHash);assert.equal(event.backupHash,audit.backupHash);assert.equal(event.planHash,journal.planHash);}
      const actual=await proof();assert.deepEqual(actual.coreRows,[{id:1,value:'core-second-commit-checked',execution_count:1}]);assert.equal(actual.pluginLedger.length,2);assert.deepEqual(actual.pluginRows,[{id:1,value:'after-update'}]);
      await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','mutate-object']);assert.notEqual((await proof()).objectHash,migrationBaseline.objectHash);
    });
    await checks.run('Restore-prior is refused after committed migrations and printed restore command recovers the backup',['Confirmed Core and plugin migrations succeed with durable audit before every migration intent'],async()=>{
      const result=await host([...migrationArgs('migrated'),'--restore-prior'],{allowFailure:true});process.stdout.write(result.output);assert.notEqual(result.code,0);assert.match(result.output,/forbids resume and application rollback/);assert.doesNotMatch(result.output,/Prior release restored/);
      await backupRestore('migrated',result.output);
    });
    }
  } finally {
    await checks.run('Archive stack logs journal results and published ports', [], async () => {
      let archiveError;
      if (old) try { await archiveComposeStartup(diagnostics()); } catch (error) { archiveError = error; }
      const ids=(await docker(['ps','-aq','--filter','label=com.docker.compose.project=' + project],{quiet:true})).stdout.trim().split(/\s+/).filter(Boolean);
      if(ids.length) for(const c of JSON.parse((await docker(['inspect',...ids],{quiet:true})).stdout)) {
        for(const bindings of Object.values(c.NetworkSettings.Ports ?? {})) for(const binding of bindings ?? []) ports.push(Number(binding.HostPort));
        const logs=await docker(['logs',c.Id],{allowFailure:true,quiet:true});writeFileSync(join(evidence,'container-'+c.Id+'.log'),redactComposeOutput(logs.output,secrets));
      }
      if(archiveError)throw archiveError;
    });
    await checks.run('Remove only UUID update project resources', [], async () => {
      assert.match(project,/^jiffoo-update-[a-f0-9-]{36}$/);
      const ids=(await docker(['ps','-aq','--filter','label=com.docker.compose.project=' + project],{quiet:true})).stdout.trim().split(/\s+/).filter(Boolean);
      if(ids.length){
        const rows=JSON.parse((await docker(['inspect',...ids],{quiet:true})).stdout), data=['postgres','redis','silo'];
        const applications=rows.filter(row=>!data.includes(row.Config.Labels['com.docker.compose.service'])).map(row=>row.Id), infrastructure=rows.filter(row=>data.includes(row.Config.Labels['com.docker.compose.service'])).map(row=>row.Id);
        if(applications.length)await docker(['stop','-t','45',...applications],{quiet:true});
        if(infrastructure.length)await docker(['stop','-t','45',...infrastructure],{quiet:true});
        await docker(['rm','--volumes',...ids],{quiet:true});
      }
      const networks=(await docker(['network','ls','-q','--filter','label=com.docker.compose.project=' + project],{quiet:true})).stdout.trim().split(/\s+/).filter(Boolean);if(networks.length)await docker(['network','rm',...networks],{quiet:true});
      for(const tag of tags.reverse())await docker(['image','rm',tag],{allowFailure:true,quiet:true});
      if(directory){assert.ok(directory.startsWith((emulator?.root ?? '/tmp') + '/' + project + '-'));await run('rm',['-rf',directory]);}
      if(emulator)await emulator.close();await volumes.removeVolumes(name=>docker(['volume','rm',name],{quiet:true}));rmSync(native,{recursive:true,force:true});
    });
    for(const [kind,args] of [['containers',['ps','-aq']],['networks',['network','ls','-q']],['volumes',['volume','ls','-q']]])await checks.run('No UUID ' + kind + ' remain',[],async()=>assert.equal((await docker([...args,'--filter','label=com.docker.compose.project=' + project])).stdout.trim(),''));
    await checks.run('No UUID image tags remain',[],async()=>assert.equal((await docker(['image','ls','-q','--filter','reference=' + project + '-*'])).stdout.trim(),''));
    await checks.run('No published listeners remain',[],async()=>{for(const port of ports){const listening=await new Promise(done=>{const socket=connect({host:'127.0.0.1',port});socket.setTimeout(1000);socket.once('connect',()=>{socket.destroy();done(true);});socket.once('error',()=>done(false));socket.once('timeout',()=>{socket.destroy();done(false);});});assert.equal(listening,false);}});
    await checks.run('Foreign containers networks and volumes are unchanged',['Docker Linux host and foreign-resource preflight'],async()=>{const after=await resources();writeFileSync(join(evidence,'resources-after.json'),JSON.stringify(after,null,2));assert.deepEqual(after,foreignBefore);});
    writeFileSync(join(evidence,'commands.json'),JSON.stringify(commands,null,2));writeFileSync(join(evidence,'checks.json'),JSON.stringify(checks.rows,null,2));
  }
  const duration=((performance.now()-start)/1000).toFixed(2)+'s',counts=checks.counts();
  const summary=`Update start time: ${started}\nUpdate results: ${counts.PASS} passed, ${counts.FAIL} failed, ${counts.SKIPPED} skipped\nUpdate profile: ${profile}\nUpdate partition: ${partition ?? 'all'}\nUpdate source commit: ${commit}\nUpdate project: ${project}\nUpdate duration: ${duration}\n\n${checks.table()}`;
  const block=`=== Final test summary ===\n${summary}\n| Step | Result | Duration |\n| --- | --- | --- |\n| ${step} | ${checks.passed?'PASS':'FAIL'} | ${duration} |\n`;
  writeFileSync('verify-summary.txt',block);writeFileSync(join(evidence,'verify-summary.txt'),block);writeFileSync(join(evidence,'verify-result.json'),JSON.stringify({group,profile,partition,commit,valid:checks.passed,results:[[step,checks.passed?'PASS':'FAIL',duration]],outputs:[{name:step,kind:'update',output:summary}],apiFiles:[],fullApiFiles:[]},null,2));
  process.stdout.write(block);if(!checks.passed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
