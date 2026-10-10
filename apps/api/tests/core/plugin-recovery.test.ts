import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { Client } from 'pg';
import { prisma } from '@/config/database';
import { recoverPluginOperation, sweepPluginRecovery, listPluginRecovery } from '@/core/admin/extension-installer/plugin-recovery';
import { getPluginInstallOperation, waitPluginInstallOperation, retryPluginInstallOperation } from '@/core/admin/extension-installer/plugin-migration-operation';
import { reclaimInvocationMarkers, type CompleteStopEvidence } from '@/core/admin/extension-installer/plugin-marker-reclaim';
import { processApplicationPrefix, processDatabaseUrl, processApplicationName } from '@/infra/core-process-identity';
import { withRecoveryTestControl } from '@/core/admin/extension-installer/plugin-recovery-test-control';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { pluginSchemaName } from 'shared/plugin-signing';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { tcpRelay } from '../helpers/error-http-fixture';
import { assertRecoveryTestControl } from '@/core/admin/extension-installer/plugin-recovery-test-control';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { getTestPrisma } from '../helpers/db';

const databaseUrl = process.env.DATABASE_URL_TEST!;
const slugs = new Set<string>(), boots = new Set<string>();
const own = () => { const slug = `recover-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };
const switches: Record<string, string | undefined> = {};
beforeAll(() => { for (const name of ['JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL','JIFFOO_TEST_PLUGIN_DATABASE_CONTROL']) { switches[name] = process.env[name]; process.env[name] = '1'; } });
afterAll(() => { for (const [name, value] of Object.entries(switches)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
afterEach(async () => {
  for (const slug of slugs) {
    await prisma.pluginOperationLease.deleteMany({ where: { OR: [{ slug }, { operation: `plugin-invocation:${slug}` }] } });
    await clearTestPluginCache(slug); await prisma.pluginInstall.deleteMany({ where: { slug } }); await cleanupPluginMigrationFixture(slug);
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
  }
  for (const bootNonce of boots) await prisma.coreProcess.deleteMany({ where: { bootNonce, leases: { none: {} }, operations: { none: {} } } });
  slugs.clear(); boots.clear();
});
async function owner(state = 'LIVE') {
  const bootNonce = randomUUID(); boots.add(bootNonce);
  await prisma.coreProcess.create({ data: { bootNonce, instanceId: randomUUID(), hostname: 'fixture', pid: 1, kind: 'api', databaseRole: 'postgres', state } });
  return bootNonce;
}
async function operation(phase = 'QUEUED', expired = true) {
  const slug = own(), token = randomUUID(), ownerBootNonce = await owner();
  const row = await prisma.pluginMigrationOperation.create({ data: { slug, actorId: 'fixture', packageHash: 'a'.repeat(64), packageVersion: '1.0.0', manifestDigest: 'b'.repeat(64), manifest: {}, declarations: [], expectedInstall: {}, installOptions: {}, artifactBytes: new Uint8Array([1]), leaseToken: token, confirmed: true, phase, ownerBootNonce } });
  await prisma.$executeRaw`INSERT INTO public.plugin_operation_leases (slug,token,operation,"acquiredAt","expiresAt","ownerBootNonce") VALUES (${slug},${token},'migration-install',clock_timestamp() AT TIME ZONE 'UTC',(clock_timestamp() AT TIME ZONE 'UTC') + ${expired ? -1 : 60_000} * interval '1 millisecond',${ownerBootNonce}::uuid)`;
  return row;
}
async function fixture(role = 'worker', heldStage?: string, databaseUrlOverride = process.env.DATABASE_URL) {
  const child = fork(path.resolve('tests/helpers/plugin-recovery-child.ts'), [role], { execArgv: ['--import','tsx'], env: { ...process.env, DATABASE_URL: databaseUrlOverride, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL: '1', JIFFOO_TEST_PLUGIN_DATABASE_CONTROL: '1', JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL:'1' }, stdio: ['ignore','pipe','pipe','ipc'] });
  const messages: any[] = []; const listeners = new Set<() => void>(); let diagnostics = '';
  child.stdout?.on('data', value => { diagnostics += String(value); }); child.stderr?.on('data', value => { diagnostics += String(value); });
  child.on('exit',()=>{for(const resolve of listeners)resolve();});
  child.on('message', value => { const message = value as any; if (message.kind === 'plugin-recovery-barrier' && message.stage !== heldStage) { child.send({ ...message, kind:'plugin-recovery-release' }); return; } if(message.kind==='plugin-migration-barrier'&&message.stage!==heldStage){child.send({...message,kind:'plugin-migration-release'});return;} messages.push(value); for (const resolve of listeners) resolve(); });
  const next = async (kind: string, id?: string) => {
    for (;;) {
      const index = messages.findIndex(value => value.kind === kind && (!id || value.id === id));
      if (index >= 0) return messages.splice(index, 1)[0];
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Recovery child exited: ${diagnostics}`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(async () => {
          listeners.delete(notify);
          const operations = await prisma.pluginMigrationOperation.findMany({ where: { ownerBootNonce: ready?.bootNonce }, select: { id: true, phase: true, errorCode: true, recoveryState: true } });
          reject(new Error(`Recovery fixture timed out waiting for ${kind}: ${JSON.stringify(operations)} ${diagnostics}`));
        }, 15_000);
        const notify = () => { clearTimeout(timer); listeners.delete(notify); resolve(); }; listeners.add(notify);
      });
    }
  };
  let ready: any;
  ready = await next('ready'); boots.add(ready.bootNonce);
  return { child, ready, next, stop: async () => { if (child.connected) {
    const exited = once(child,'exit');
    for (const message of messages) {
      if (message.kind === 'plugin-recovery-barrier') child.send({ ...message, kind: 'plugin-recovery-release' });
      if (message.kind === 'plugin-migration-barrier') child.send({ ...message, kind: 'plugin-migration-release' });
    }
    child.send({ kind:'stop' }); await exited;
  } }, kill: async () => { const exited = once(child,'exit'); child.kill(); await exited; } };
}
async function archive(slug: string) {
  const sql='CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);';
  const manifest={schemaVersion:1,slug,name:slug,version:'1.0.0',description:'Recovery fixture',category:'integration',runtimeType:'internal-fastify',hostProtocol:'internal-fastify-v1',entryModule:'index.js',permissions:[],lifecycle:{onInstall:true},database:{apiVersion:1,migrations:[{id:'first',order:1,path:'migrations/001.sql',sha256:createHash('sha256').update(sql).digest('hex')}]}};
  const output=new PassThrough(), chunks:Buffer[]=[];
  const done=new Promise<Buffer>((resolve,reject)=>{output.on('data',chunk=>chunks.push(chunk));output.on('end',()=>resolve(Buffer.concat(chunks)));output.on('error',reject);});
  const zip=archiver('zip');zip.on('error',error=>output.destroy(error));zip.pipe(output);zip.append(JSON.stringify(manifest),{name:'manifest.json'});zip.append("module.exports={register(){},__lifecycle_onInstall(){process.send?.({kind:'hook-called'});}}",{name:'index.js'});zip.append(sql,{name:'migrations/001.sql'});await zip.finalize();return done;
}
it('A two real worker processes make one effective recovery transition and one audit', async () => {
  const row = await operation(), a = await fixture(), b = await fixture();
  try {
    const id = randomUUID(); a.child.send({kind:'sweep',id}); b.child.send({kind:'sweep',id}); await Promise.all([a.next('done',id),b.next('done',id)]);
    expect((await getPluginInstallOperation(row.id)).phase).toBe('NEEDS_RECOVERY');
    expect(await prisma.adminAuditEvent.count({where:{targetId:row.slug,action:'PLUGIN_RECOVERY_REQUIRED'}})).toBe(1);
    expect((await prisma.pluginMigrationOperation.findUniqueOrThrow({where:{id:row.id}})).artifactBytes).not.toBeNull();
  } finally { await a.stop(); await b.stop(); }
});
it.each(['QUEUED','VALIDATING','PAUSING','MIGRATING','PUBLISHING'])('B C expired %s operations retain their candidate without executing migrations', async phase => {
  const row = await operation(phase); await recoverPluginOperation(row.id);
  expect((await getPluginInstallOperation(row.id)).phase).toBe('NEEDS_RECOVERY');
  expect(await prisma.pluginMigrationSuccess.count({where:{operationId:row.id}})).toBe(0);
  expect((await prisma.pluginMigrationOperation.findUniqueOrThrow({where:{id:row.id}})).artifactBytes).toEqual(new Uint8Array([1]));
});
it('A a live fenced lease and a replacement lease are never deleted by an old recovery CAS', async () => {
  const live = await operation('QUEUED',false); await recoverPluginOperation(live.id); expect((await getPluginInstallOperation(live.id)).phase).toBe('QUEUED');
  const old = await operation(), replacement = randomUUID(); await prisma.pluginOperationLease.update({where:{slug:old.slug},data:{token:replacement,expiresAt:new Date(Date.now()+60_000)}});
  await recoverPluginOperation(old.id); expect((await prisma.pluginOperationLease.findUniqueOrThrow({where:{slug:old.slug}})).token).toBe(replacement);
});
it('B a killed installer strands its queued third operation until a real worker sweep recovers it', async()=>{
  const child=await fixture('api'), ids:string[]=[];
  try {
    for(let index=0;index<3;index++){const slug=own(),id=randomUUID();ids.push(id);child.child.send({kind:'install',id,slug,actorId:'fixture',bytes:(await archive(slug)).toString('base64'),hold:true});await child.next('accepted',id);if(index<2)await child.next('held',id);}
    const rows=await prisma.pluginMigrationOperation.findMany({where:{slug:{in:[...slugs]}},orderBy:{createdAt:'asc'}});expect(rows.map(row=>row.phase)).toEqual(['VALIDATING','VALIDATING','QUEUED']);
    await child.kill();
    let expired=false;while(!expired){const leases=await prisma.$queryRaw<Array<{active:boolean}>>`SELECT EXISTS(SELECT 1 FROM public.plugin_operation_leases WHERE "ownerBootNonce"=${child.ready.bootNonce}::uuid AND "expiresAt">clock_timestamp() AT TIME ZONE 'UTC') AS active`;expired=!leases[0].active;}
    const worker=await fixture();try{const id=randomUUID();worker.child.send({kind:'sweep',id});await worker.next('done',id);}finally{await worker.stop();}
    for(const row of rows){expect((await getPluginInstallOperation(row.id)).phase).toBe('NEEDS_RECOVERY');expect(await prisma.pluginMigrationSuccess.count({where:{operationId:row.id}})).toBe(0);}
  } finally {if(child.child.connected)await child.stop();}
},60_000);
it('C a killed process after real publication completes from proof without replaying its lifecycle hook',async()=>{
  const slug=own(),child=await fixture('api','publication-committed'),id=randomUUID();
  try{
    child.child.send({kind:'install',id,slug,actorId:'fixture',bytes:(await archive(slug)).toString('base64')});const accepted=await child.next('accepted',id);await child.next('plugin-recovery-barrier');
    expect((await prisma.pluginMigrationOperation.findUniqueOrThrow({where:{id:accepted.operationId}})).phase).toBe('PUBLISHED');
    await child.kill();
    await prisma.$executeRaw`UPDATE public.plugin_operation_leases SET "expiresAt"=(clock_timestamp() AT TIME ZONE 'UTC')-interval '1 millisecond' WHERE slug=${slug}`;
    await recoverPluginOperation(accepted.operationId);const state=await getPluginInstallOperation(accepted.operationId);expect(state.phase).toBe('SUCCESS');expect(state.result!.warnings).toEqual(['PLUGIN_POST_COMMIT_WARNING']);
    expect(await prisma.pluginMigrationSuccess.count({where:{operationId:accepted.operationId}})).toBe(1);
    expect(await prisma.adminAuditEvent.count({where:{targetId:slug,action:'PLUGIN_PUBLICATION_RECOVERED'}})).toBe(1);
  }finally{if(child.child.connected)await child.stop();}
},60_000);
it('D UNKNOWN attempts without committed proof remain UNKNOWN after a sweep', async () => {
  const row = await operation(), namespace = await prisma.pluginNamespace.create({data:{slug:row.slug,schemaName:pluginSchemaName(row.slug),publisherKind:'unsigned'}});
  const attempt = await prisma.pluginMigrationAttempt.create({data:{namespaceId:namespace.id,operationId:row.id,order:1,migrationId:'one',path:'migrations/001.sql',sha256:'a'.repeat(64)}});
  await sweepPluginRecovery(); expect((await prisma.pluginMigrationAttempt.findUniqueOrThrow({where:{id:attempt.id}})).status).toBe('UNKNOWN');
});
it('D retry cannot abort UNKNOWN while the old migration session exists and only replays after fenced end proof',async()=>{
  const slug=own(),child=await fixture('api','before-file'),id=randomUUID();let oldId='';
  try{
    child.child.send({kind:'install',id,slug,actorId:'fixture',bytes:(await archive(slug)).toString('base64')});const accepted=await child.next('accepted',id);oldId=accepted.operationId;await child.next('plugin-migration-barrier');await child.kill();
    await prisma.$executeRaw`UPDATE public.plugin_operation_leases SET "expiresAt"=(clock_timestamp() AT TIME ZONE 'UTC')-interval '1 millisecond' WHERE slug=${slug}`;await recoverPluginOperation(oldId);
    const attempt=await prisma.pluginMigrationAttempt.findFirstOrThrow({where:{operationId:oldId}});expect(attempt.status).toBe('UNKNOWN');
    const lingering=new Client({connectionString:databaseUrl,application_name:processApplicationName('migration',child.ready.bootNonce,oldId)});await lingering.connect();
    try{const blocked=await retryPluginInstallOperation(oldId,'fixture',true);await expect(waitPluginInstallOperation(blocked.operationId)).rejects.toMatchObject({code:'PLUGIN_MIGRATION_RECOVERY_REQUIRED'});expect((await prisma.pluginMigrationAttempt.findUniqueOrThrow({where:{id:attempt.id}})).status).toBe('UNKNOWN');}
    finally{await lingering.end();}
    const recovery=await retryPluginInstallOperation(oldId,'fixture',true);expect((await waitPluginInstallOperation(recovery.operationId)).slug).toBe(slug);
    expect((await prisma.pluginMigrationAttempt.findUniqueOrThrow({where:{id:attempt.id}})).status).toBe('ABORTED');expect(await prisma.pluginMigrationSuccess.count({where:{operationId:recovery.operationId}})).toBe(1);
  }finally{if(child.child.connected)await child.stop();}
},60_000);
it('C PUBLISHED with an atomic result and complete package proof finishes with a warning', async () => {
  const row = await operation('PUBLISHED');
  const bytes = Buffer.from('published-archive'), hash = createHash('sha256').update(bytes).digest('hex');
  await prisma.pluginNamespace.create({data:{slug:row.slug,schemaName:pluginSchemaName(row.slug),publisherKind:'unsigned',provisionedAt:new Date()}});
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${pluginSchemaName(row.slug)}"`);
  await prisma.pluginInstall.create({data:{slug:row.slug,name:row.slug,version:'1.0.0',zipHash:hash,manifestJson:{}}});
  await prisma.$transaction(tx=>pluginPackageBlobStore.put(tx,row.slug,hash,bytes));
  await prisma.pluginMigrationOperation.update({where:{id:row.id},data:{packageHash:hash,result:{slug:row.slug,version:'1.0.0',zipHash:hash,installedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),warnings:[]},installOptions:{uploadMetadata:{filename:'fixture.zip',size:bytes.length,mimetype:'application/zip'}}}});
  await recoverPluginOperation(row.id); const result=await getPluginInstallOperation(row.id);
  expect(result.phase).toBe('SUCCESS'); expect(result.result!.warnings).toEqual(['PLUGIN_POST_COMMIT_WARNING']);
  expect((await prisma.pluginMigrationOperation.findUniqueOrThrow({where:{id:row.id}})).artifactBytes).toBeNull();
  expect((await waitPluginInstallOperation(row.id)).slug).toBe(row.slug);
});
it('C an unproven PUBLISHED result is not guessed to be successful', async () => {
  const row=await operation('PUBLISHED'); await recoverPluginOperation(row.id); expect((await getPluginInstallOperation(row.id)).phase).toBe('NEEDS_RECOVERY');
});
it('F a killed invocation owner leaves its marker and requires a maintenance window', async () => {
  const slug=own(), child=await fixture('api'), id=randomUUID();
  child.child.send({kind:'marker',slug,id}); await child.next('held',id); await child.kill();
  await prisma.coreProcess.update({where:{bootNonce:child.ready.bootNonce},data:{heartbeatAt:new Date(0)}});
  await sweepPluginRecovery(); expect(await prisma.pluginOperationLease.count({where:{operation:`plugin-invocation:${slug}`}})).toBe(1);
  expect((await listPluginRecovery()).items.find(item=>item.slug===slug)).toMatchObject({maintenanceRequired:true,markerCount:1});
});
it('F a frozen live invocation is never reclaimed because its heartbeat stops', async () => {
  const slug=own(), child=await fixture('api'), id=randomUUID();
  try {
    child.child.send({kind:'marker',slug,id}); await child.next('held',id); child.child.send({kind:'freeze'}); await child.next('frozen');
    await prisma.coreProcess.update({where:{bootNonce:child.ready.bootNonce},data:{heartbeatAt:new Date(0)}});
    await sweepPluginRecovery(); expect(await prisma.pluginOperationLease.count({where:{operation:`plugin-invocation:${slug}`}})).toBe(1);
    expect((await prisma.coreProcess.findUniqueOrThrow({where:{bootNonce:child.ready.bootNonce}})).state).toBe('LIVE');
  } finally { await child.kill(); }
});
it('E a killed owner with a real long SQL statement keeps its marker even after the backend exits',async()=>{
  const slug=own();await prisma.pluginNamespace.create({data:{slug,schemaName:pluginSchemaName(slug),publisherKind:'unsigned',provisionedAt:new Date()}});await prisma.$executeRawUnsafe(`CREATE SCHEMA "${pluginSchemaName(slug)}"`);
  const child=await fixture('api'),id=randomUUID();
  try{
    child.child.send({kind:'marker',slug,id,sql:true});const held=await child.next('held',id);
    let active=false;while(!active){const rows=await prisma.$queryRaw<Array<{active:boolean}>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=${held.pid}::integer AND state='active' AND query LIKE '%pg_sleep%') AS active`;active=rows[0].active;}
    await child.kill();await sweepPluginRecovery();expect(await prisma.pluginOperationLease.count({where:{operation:`plugin-invocation:${slug}`}})).toBe(1);
    let remains=true;while(remains){const rows=await prisma.$queryRaw<Array<{active:boolean}>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=${held.pid}::integer) AS active`;remains=rows[0].active;}
    await sweepPluginRecovery();expect(await prisma.pluginOperationLease.count({where:{operation:`plugin-invocation:${slug}`}})).toBe(1);
  }finally{if(child.child.connected)await child.stop();}
},60_000);
it('G boot application names override URL input and remain within PostgreSQL limits', () => {
  const url=new URL(processDatabaseUrl(`${databaseUrl}?application_name=wrong`,'migration',randomUUID(),true));
  expect(url.searchParams.get('application_name')).toContain(processApplicationPrefix()); expect(Buffer.byteLength(url.searchParams.get('application_name')!)).toBeLessThanOrEqual(63);
});
it('H complete killed-fixture evidence reclaims atomically and the same request is idempotent', async () => {
  const slug=own(), child=await fixture('api'), id=randomUUID(); child.child.send({kind:'marker',slug,id}); await child.next('held',id); await child.kill();
  const testSchema=`test_reclaim_${randomUUID().replaceAll('-','')}`;
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${testSchema}"`);
  for(const table of ['core_processes','plugin_operation_leases','admin_audit_events'])await prisma.$executeRawUnsafe(`CREATE TABLE "${testSchema}".${table} (LIKE public.${table} INCLUDING ALL)`);
  await prisma.$executeRawUnsafe(`INSERT INTO "${testSchema}".core_processes SELECT * FROM public.core_processes WHERE "bootNonce"=$1::uuid`,child.ready.bootNonce);
  await prisma.$executeRawUnsafe(`INSERT INTO "${testSchema}".plugin_operation_leases SELECT * FROM public.plugin_operation_leases WHERE operation=$1`,`plugin-invocation:${slug}`);
  await prisma.$disconnect(); await getTestPrisma().$disconnect(); const client=new Client({connectionString:databaseUrl}); await client.connect();
  const evidence: CompleteStopEvidence={version:1,requestId:randomUUID(),actorId:'operator',reason:'Isolated killed fixture',composeFile:'fixture',project:'fixture',coreServices:['api','worker'],boots:[{bootNonce:child.ready.bootNonce,containerId:'fixture'}]};
  try {
    const verify=async()=>{expect(child.child.exitCode!==null||child.child.signalCode!==null).toBe(true);};
    const incomplete={...evidence,boots:[]}; await expect(reclaimInvocationMarkers(client,incomplete,verify,testSchema)).rejects.toThrow('every recorded boot');
    const reusedBoot=randomUUID(),newMarker=`invocation:reused-${randomUUID()}`;
    await client.query(`INSERT INTO "${testSchema}".core_processes ("bootNonce","instanceId",kind,hostname,pid,"databaseRole") SELECT $1::uuid,$2::uuid,kind,hostname,pid,"databaseRole" FROM "${testSchema}".core_processes WHERE "bootNonce"=$3::uuid`,[reusedBoot,randomUUID(),child.ready.bootNonce]);
    await client.query(`INSERT INTO "${testSchema}".plugin_operation_leases (slug,token,operation,"acquiredAt","expiresAt","ownerBootNonce") VALUES($1,$2,$3,clock_timestamp(),clock_timestamp()+interval '15 minutes',$4::uuid)`,[newMarker,randomUUID(),`plugin-invocation:${slug}`,reusedBoot]);
    await expect(reclaimInvocationMarkers(client,evidence,verify,testSchema)).rejects.toThrow('every recorded boot');
    expect((await client.query(`SELECT count(*)::integer AS count FROM "${testSchema}".plugin_operation_leases WHERE "ownerBootNonce"=$1::uuid`,[reusedBoot])).rows).toEqual([{count:1}]);
    await client.query(`DELETE FROM "${testSchema}".plugin_operation_leases WHERE slug=$1`,[newMarker]);await client.query(`DELETE FROM "${testSchema}".core_processes WHERE "bootNonce"=$1::uuid`,[reusedBoot]);
    const lingering=new Client({connectionString:databaseUrl,application_name:`${processApplicationPrefix(child.ready.bootNonce)}runtime`});await lingering.connect();
    const lingeringPid=(await lingering.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    try {await expect(reclaimInvocationMarkers(client,evidence,verify,testSchema)).rejects.toThrow('sessions are still present');expect((await client.query(`SELECT count(*)::integer AS count FROM "${testSchema}".plugin_operation_leases WHERE operation=$1`,[`plugin-invocation:${slug}`])).rows).toEqual([{count:1}]);}finally{await lingering.end();}
    while((await client.query('SELECT 1 FROM pg_stat_activity WHERE pid=$1',[lingeringPid])).rows.length){}
    expect(await reclaimInvocationMarkers(client,evidence,verify,testSchema)).toEqual({reclaimed:1,alreadyApplied:false});
    expect(await reclaimInvocationMarkers(client,evidence,verify,testSchema)).toEqual({reclaimed:1,alreadyApplied:true});
    expect((await client.query(`SELECT count(*)::integer AS count FROM "${testSchema}".admin_audit_events WHERE "targetId"=$1`,[evidence.requestId])).rows).toEqual([{count:1}]);
  } finally { await client.query(`DROP SCHEMA "${testSchema}" CASCADE`); await client.end(); }
});
it('I a real deletion outage retries only settled markers after reconnection while live work remains marked',async()=>{
  const relay=await tcpRelay(databaseUrl,5432), child=await fixture('api',undefined,relay.url), a=own(),b=own(),first=randomUUID(),second=randomUUID();
  try{
    child.child.send({kind:'marker',slug:a,id:first});await child.next('held',first);child.child.send({kind:'marker',slug:b,id:second});await child.next('held',second);
    relay.drop();child.child.send({kind:'release',id:first});await child.next('failed',first);
    expect(await prisma.pluginOperationLease.count({where:{operation:`plugin-invocation:${a}`}})).toBe(1);
    relay.recover();let count=1;while(count){count=await prisma.pluginOperationLease.count({where:{operation:`plugin-invocation:${a}`}});}
    expect(await prisma.pluginOperationLease.count({where:{operation:`plugin-invocation:${b}`}})).toBe(1);
    child.child.send({kind:'release',id:second});await child.next('done',second);
  }finally{relay.recover();await child.stop();await relay.close();}
},60_000);
it('R terminal process rows older than thirty days are pruned only when unreferenced', async () => {
  const free=await owner('QUIESCENT'), referenced=await operation('NEEDS_RECOVERY');
  await prisma.$executeRaw`UPDATE public.core_processes SET state='QUIESCENT', "drainedAt"=(clock_timestamp() AT TIME ZONE 'UTC')-interval '31 days' WHERE "bootNonce" IN (${free}::uuid,${referenced.ownerBootNonce}::uuid)`;
  await sweepPluginRecovery(); expect(await prisma.coreProcess.findUnique({where:{bootNonce:free}})).toBeNull();
  expect(await prisma.coreProcess.findUnique({where:{bootNonce:referenced.ownerBootNonce!}})).not.toBeNull();
});
it('P verified blob put rejects corrupted existing bytes without silently repairing them',async()=>{
  const slug=own(),bytes=Buffer.from('immutable-package'),hash=createHash('sha256').update(bytes).digest('hex');await prisma.pluginInstall.create({data:{slug,name:slug,version:'1.0.0'}});
  await prisma.$transaction(tx=>pluginPackageBlobStore.put(tx,slug,hash,bytes));await prisma.pluginPackageBlob.update({where:{pluginSlug_zipHash:{pluginSlug:slug,zipHash:hash}},data:{bytes:new Uint8Array([1])}});
  await expect(prisma.$transaction(tx=>pluginPackageBlobStore.put(tx,slug,hash,bytes))).rejects.toMatchObject({code:'PLUGIN_PACKAGE_CORRUPT'});
  expect((await prisma.pluginPackageBlob.findUniqueOrThrow({where:{pluginSlug_zipHash:{pluginSlug:slug,zipHash:hash}}})).bytes).toEqual(new Uint8Array([1]));
});
it('P builtin synchronization persists its immutable archive even on the unchanged-hash path',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'builtin-recovery-')),slug=own(),directory=path.join(root,slug);await fs.mkdir(directory);
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify({schemaVersion:1,slug,name:slug,version:'1.0.0',description:'Builtin fixture',category:'integration',runtimeType:'internal-fastify',hostProtocol:'internal-fastify-v1',entryModule:'index.js',permissions:[]}));await fs.writeFile(path.join(directory,'index.js'),'module.exports={register(){}};');
  try{await syncBuiltinPlugins(root);const install=await prisma.pluginInstall.findUniqueOrThrow({where:{slug}});const before=await prisma.pluginPackageBlob.findUniqueOrThrow({where:{pluginSlug_zipHash:{pluginSlug:slug,zipHash:install.zipHash!}}});expect(createHash('sha256').update(before.bytes).digest('hex')).toBe(install.zipHash);
    await syncBuiltinPlugins(root);expect((await prisma.pluginPackageBlob.findUniqueOrThrow({where:{id:before.id}})).bytes).toEqual(before.bytes);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
it('O non-test startup rejects the explicit recovery switch before starting work',()=>{
  const result=spawnSync(process.execPath,['--import','tsx','-e',"require('./src/config/env.ts')"],{env:{...process.env,NODE_ENV:'production',JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL:'1',JIFFOO_TEST_PLUGIN_DATABASE_CONTROL:undefined,JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL:undefined},encoding:'utf8',windowsHide:true});expect(result.status).toBe(1);expect(result.stderr).toContain('Recovery test controls are not permitted outside NODE_ENV=test');
});
it('O recovery test hooks reject a missing explicit switch',()=>{
  const original=process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL;delete process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL;try{expect(()=>assertRecoveryTestControl()).toThrow('explicit switch');}finally{process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL=original;}
});
