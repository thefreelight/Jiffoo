import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { ComposeVolumeLedger, RecordedAcceptanceChecks } from './compose-volumes.mjs';
import { BackupHostEmulator, emulatorImage } from './backup-host-emulator.mjs';
import { makeRelease } from '../deploy/release/prepare.mjs';
import { sha256 } from '../deploy/release/identity.mjs';
import { archiveComposeStartup, withComposeStartupDiagnostics, redactComposeOutput } from './compose-startup.mjs';

export function updateProfile(args) {
  assert.ok(args.length <= 1 && (!args.length || /^--profile=(core|full)$/.test(args[0])), 'Usage: pnpm verify:update [--profile=core|full]');
  return args[0]?.slice('--profile='.length) ?? 'core';
}
export function guardUpdateDatabase(url) {
  assert.equal(url, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test', 'Update acceptance requires the exact jiffoo_core_test DATABASE_URL_TEST');
}
const step = 'Run no-migration update acceptance';
async function main() {
  const profile = updateProfile(process.argv.slice(2)); guardUpdateDatabase(process.env.DATABASE_URL_TEST);
  const started = new Date().toISOString(), start = performance.now(), project = 'jiffoo-update-' + randomUUID();
  const native = mkdtempSync(join(tmpdir(), project + '-'));
  const evidence = resolve(process.env.GITHUB_ACTIONS === 'true' ? join(process.env.RUNNER_TEMP, 'verification') : join('e2e/test-results', project));
  mkdirSync(evidence, { recursive: true });
  const emulator = process.platform === 'win32' ? new BackupHostEmulator(project, process.cwd(), native) : undefined;
  const root = emulator ? '/workspace' : process.cwd();
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  const version = JSON.parse(readFileSync('package.json')).version.replace(/-opensource$/, '');
  const tags = [], commands = [], ports = [], manifests = {};
  let directory, old, target, failure, baseline, foreignBefore, activeConfig, secrets = [];
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
  const updateArgs = (name, release = target) => ['update','--project',project,'--current-release',old,'--target-release',release,'--target-commit',commit,'--state-dir',directory + '/' + name,'--backup-dir',directory + '/' + name + '-backup','--actor','acceptance-operator'];
  const host = (args, options) => run('sh', [old + '/bin/jiffoo-host', ...args, '--acceptance'], options);
  const managed = async () => {
    const result = await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','managed']);
    const line = result.stdout.split('\n').find(line => line.startsWith('UPDATE_MANAGED ')); assert.ok(line);
    return JSON.parse(line.slice('UPDATE_MANAGED '.length));
  };
  const recorded = async name => JSON.parse((await run('cat', [directory + '/' + name + '/journal.json'], { quiet: true })).stdout);
  const restore = async name => {
    const result = await host([...updateArgs(name), '--restore-prior']); process.stdout.write(result.output);
    activeConfig = directory + '/' + name + '/prior-config.json';
    assert.equal((await recorded(name)).result, 'rolled-back'); assert.deepEqual(await managed(), baseline);
  };
  try {
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
      const yaml = readFileSync('deploy/compose/compose.yml','utf8');
      for (const role of ['postgres','redis','silo','nginx']) {
        const reference = yaml.match(new RegExp('image: (' + (role === 'silo' ? 'pgsty/silo' : role) + ':[^\\s]+@sha256:[a-f0-9]{64})'))[1];
        if ((await docker(['image','inspect',reference], { allowFailure: true, quiet: true })).code !== 0) await docker(['pull','--platform','linux/amd64',reference]);
        writeFileSync(join(inspections,role + '.json'), (await docker(['image','inspect',reference], { quiet: true })).stdout);
      }
      const adjust = (bundle, manifest) => {
        const path = join(bundle,'deploy/compose/compose.release.yml'); let content = readFileSync(path,'utf8');
        for (const service of ['api-1','api-2','worker-1','worker-2','db-init','silo-volume-init']) content = content.replace('  ' + service + ':\n', '  ' + service + ':\n    environment:\n      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/jiffoo_core_test\n');
        content += '\n  postgres:\n    environment:\n      POSTGRES_DB: jiffoo_core_test\n'; writeFileSync(path,content);
        const member = manifest.deployment.find(row => row.path.endsWith('compose.release.yml')), bytes = readFileSync(path); member.sha256 = sha256(bytes); member.size = bytes.length;
        writeFileSync(join(bundle,'release.json'), JSON.stringify(manifest,null,2) + '\n');
      };
      const bundle = join(native,'old'); manifests.old = makeRelease({ root: process.cwd(), output: bundle, inspections, commit, version, mode:'acceptance' }); adjust(bundle,manifests.old);
      for (const [generation, newVersion] of [['target', version + '-update'], ['failure', version + '-failure']]) {
        const context = join(native,generation + '-context'); mkdirSync(context);
        const shipping = JSON.parse(readFileSync('apps/api/builtin-plugins/free-shipping/manifest.json','utf8')); shipping.version = '1.0.1';
        const theme = JSON.parse(readFileSync('apps/api/builtin-themes/default-shop/theme.json','utf8')); theme.version = '1.1.1';
        writeFileSync(join(context,'shipping.json'),JSON.stringify(shipping)); writeFileSync(join(context,'theme.json'),JSON.stringify(theme));
        writeFileSync(join(context,'failure.mjs'), "throw new Error('Intentional update acceptance startup failure');\n");
        for (const role of ['backend','admin','shop']) {
          const base = generation === 'failure' ? project + '-target-' + role : project + '-old-' + role;
          const contents = 'FROM ' + base + '\nLABEL org.opencontainers.image.revision="' + commit + '" org.opencontainers.image.version="' + newVersion + '"\n' + (role === 'backend' ? 'COPY shipping.json /app/apps/api/builtin-plugins/free-shipping/manifest.json\nCOPY theme.json /app/apps/api/builtin-themes/default-shop/theme.json\n' : generation === 'failure' && role === 'shop' ? 'COPY failure.mjs /app/apps/shop/server.mjs\n' : '');
          writeFileSync(join(context,'Dockerfile-' + role),contents);
          const tag = project + '-' + generation + '-' + role; tags.push(tag);
          await docker(['build','--platform','linux/amd64','-f',join(context,'Dockerfile-' + role),'-t',tag,context]);
          writeFileSync(join(inspections,role + '.json'),(await docker(['image','inspect',tag], { quiet: true })).stdout);
        }
        const output = join(native,generation); manifests[generation] = makeRelease({ root: process.cwd(), output, inspections, commit, version:newVersion, mode:'acceptance' }); adjust(output,manifests[generation]);
      }
      const env = { COMPOSE_PROJECT_NAME:project, REVISION:commit, POSTGRES_PASSWORD:'postgres', JWT_SECRET:randomBytes(48).toString('base64url'), PLUGIN_SECRETS_KEY:randomBytes(32).toString('base64'),
        MINIO_ROOT_USER:'update-' + randomUUID(), MINIO_ROOT_PASSWORD:randomBytes(48).toString('base64url'), UPLOAD_S3_BUCKET:'update-' + randomUUID(), SILO_APP_ACCESS_KEY_ID:'app-' + randomUUID(), SILO_APP_SECRET_ACCESS_KEY:randomBytes(48).toString('base64url'),
        STOREFRONT_URL:'https://update-shop.test', ADMIN_URL:'https://update-admin.test', EDGE_PORT:'0', TLS_CERT_FILE:old + '/cert.pem', TLS_KEY_FILE:old + '/key.pem' };
      secrets = [env.JWT_SECRET,env.PLUGIN_SECRETS_KEY,env.MINIO_ROOT_USER,env.MINIO_ROOT_PASSWORD,env.SILO_APP_ACCESS_KEY_ID,env.SILO_APP_SECRET_ACCESS_KEY];
      writeFileSync(join(native,'old/deploy/compose/.env'),Object.entries(env).map(([key,value]) => key + '=' + value).join('\n') + '\n',{mode:0o600});
      for (const generation of ['old','target','failure']) {
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
    await checks.run('Start old release with two API and two worker instances', ['Build two local releases and a real failing target'], () => withComposeStartupDiagnostics(() => compose(['up','-d','--no-build','--wait','--wait-timeout','600','edge']), diagnostics()));
    await checks.run('Seed merchant and theme configuration through real API', ['Start old release with two API and two worker instances'], async () => {
      const password = randomUUID() + 'Aa1!'; secrets.push(password);
      const code = "const r=await fetch('http://127.0.0.1:3001/api/v1/install/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({siteName:'Update acceptance',adminEmail:'update-owner@example.test',adminPassword:process.argv[1]})});if(r.status!==200)throw new Error(await r.text());";
      await compose(['exec','-T','api-1','node','--input-type=module','-e',code,password], { quiet: true });
      await compose(['exec','-T','api-1','node','/app/deploy/compose/update-scenario.mjs','configure',password], { quiet: true });
      baseline = await managed(); writeFileSync(join(evidence,'managed-before.json'),JSON.stringify(baseline,null,2));
    });
    await checks.run('Reject unknown and missing CLI options', ['Seed merchant and theme configuration through real API'], async () => {
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
      const after = await managed(); assert.equal(after.pluginVersion,'1.0.1'); assert.equal(after.themeVersion,'1.1.1'); assert.notDeepEqual(after,baseline);
      writeFileSync(join(evidence,'successful-update-duration.json'),JSON.stringify({duration:result.duration,managed:after},null,2));
    });
    await checks.run('Successful update retains a verified prior-release restore path', ['No-migration update backs up audits and starts target release'], () => restore('success'));
    await checks.run('Target startup failure automatically restores images and complete managed state', ['Successful update retains a verified prior-release restore path'], async () => {
      const result = await host(updateArgs('failed',failure),{allowFailure:true}); process.stdout.write(result.output); assert.notEqual(result.code,0); assert.match(result.output,/Prior release restored and healthy/);
      activeConfig = directory + '/failed/prior-config.json'; assert.equal((await recorded('failed')).result,'rolled-back'); assert.deepEqual(await managed(),baseline);
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
      if(ids.length){await docker(['stop','-t','45',...ids],{quiet:true});await docker(['rm','--volumes',...ids],{quiet:true});}
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
  const summary=`Update start time: ${started}\nUpdate results: ${counts.PASS} passed, ${counts.FAIL} failed, ${counts.SKIPPED} skipped\nUpdate profile: ${profile}\nUpdate source commit: ${commit}\nUpdate project: ${project}\nUpdate duration: ${duration}\n\n${checks.table()}`;
  const block=`=== Final test summary ===\n${summary}\n| Step | Result | Duration |\n| --- | --- | --- |\n| ${step} | ${checks.passed?'PASS':'FAIL'} | ${duration} |\n`;
  writeFileSync('verify-summary.txt',block);writeFileSync(join(evidence,'verify-summary.txt'),block);writeFileSync(join(evidence,'verify-result.json'),JSON.stringify({group:'update',profile,commit,valid:checks.passed,results:[[step,checks.passed?'PASS':'FAIL',duration]],outputs:[{name:step,kind:'update',output:summary}],apiFiles:[],fullApiFiles:[]},null,2));
  process.stdout.write(block);if(!checks.passed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
