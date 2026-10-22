import { expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { prisma } from '@/config/database';
import { assertCurrentDatabase } from '@/config/test-lane';
import { attachPluginTaskDrain } from '@/core/plugins/task-drain';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { createTestApp } from '../helpers/create-test-app';
import { uploadPluginZip } from '../helpers/plugin-upload';
import { pageZip } from '../fixtures/plugin-pages';
import { testRoot, testPublisher } from '../fixtures/plugin-signing-keys';
import { CERT_PATH, SIGNATURE_PATH, issuePublisherCertificate, signPackage, pluginSchemaName } from 'shared/plugin-signing';

it('the published SDK, signed ZIP installer, real worker and drain helper execute task SQL and one final hook', async () => {
  const slug = `g1-sdk-${randomUUID().slice(0, 8)}`;
  const require = createRequire(path.resolve('../../packages/plugin-sdk/package.json'));
  const runtime = require.resolve('@jiffoo-core/plugin-sdk');
  const sdk = require('@jiffoo-core/plugin-sdk') as { drainPluginTasks(options: object): Promise<{ completed: number; failed: number; unknownHooks: number }> };
  const app = await createTestApp({ disableFileSystem: false, disableRedis: false });
  const base = await app.listen({ host:'127.0.0.1',port:0 });
  const admin = await createAdminWithToken();
  let installationId: string | undefined;
  let detachDrain: (() => void) | undefined;
  const taskIds: string[] = [];
  try {
    const source = `import {TaskPermanentError} from '@jiffoo-core/plugin-sdk';
export function register(ctx) {
  ctx.tasks.handle('render',1,async input => {
    input.signal.throwIfAborted();
    if(input.payload.permanent) throw new TaskPermanentError('RENDER_REJECTED','Rendering rejected');
    await ctx.database.query('INSERT INTO results(id,principal_id,claim,fence) VALUES($1,$2,$3::uuid,$4::bigint) ON CONFLICT(id) DO UPDATE SET claim=$3::uuid,fence=$4::bigint WHERE results.fence < $4::bigint',[input.taskId,input.principal.id,input.claimId,input.fence]);
    return {rendered:true};
  },{concurrency:1,maxAttempts:3,maxRuntimeSeconds:300,onFinalFailure:{maxRuntimeSeconds:2,handler:async input => {
    await ctx.database.query('INSERT INTO refund_intents(id,principal_id) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[input.idempotencyKey,input.principal.id]);
  }}});
  ctx.http.route({method:'POST',path:'/tasks',handler:async(request,reply)=>{
    if(request.headers['x-user-role']!=='ADMIN') return reply.code(403).send({error:'Forbidden'});
    const task=await ctx.tasks.enqueue('render',1,request.body.payload,{idempotencyKey:request.body.key});
    return reply.code(202).send({taskId:task.id});
  }});
  ctx.http.route({method:'GET',path:'/tasks/:id',handler:async(request,reply)=>{
    if(request.headers['x-user-role']!=='ADMIN') return reply.code(403).send({error:'Forbidden'});
    return ctx.tasks.get(request.params.id);
  }});
}`;
    const bundled = await build({ stdin:{contents:source,resolveDir:process.cwd(),loader:'js'},alias:{'@jiffoo-core/plugin-sdk':runtime},bundle:true,platform:'node',format:'cjs',target:'node24',write:false });
    const migration = Buffer.from('CREATE TABLE results(id TEXT PRIMARY KEY,principal_id TEXT NOT NULL,claim UUID NOT NULL,fence BIGINT NOT NULL); CREATE TABLE refund_intents(id TEXT PRIMARY KEY,principal_id TEXT NOT NULL);\n');
    const manifest = { schemaVersion:1,slug,name:'G1 SDK fixture',version:'1.0.0',description:'G1 durable tasks',runtimeType:'internal-fastify',hostProtocol:'internal-fastify-v1',entryModule:'index.js',permissions:[],tasks:[{name:'render',version:1,concurrency:1,maxAttempts:3,maxRuntimeSeconds:300,onFinalFailure:{maxRuntimeSeconds:2}}],database:{apiVersion:1,migrations:[{id:'001_results',order:1,path:'migrations/001_results.sql',sha256:createHash('sha256').update(migration).digest('hex')}]}};
    const certificate = issuePublisherCertificate('g1-publisher','G1 Publisher',testPublisher.publicKey,testRoot.privateKey);
    const files = [{path:'manifest.json',content:Buffer.from(JSON.stringify(manifest))},{path:'index.js',content:Buffer.from(bundled.outputFiles[0].contents)},{path:'migrations/001_results.sql',content:migration},{path:CERT_PATH,content:Buffer.from(JSON.stringify(certificate))}];
    const listing = files.map(f=>({path:f.path,sha256:createHash('sha256').update(f.content).digest('hex')})).sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
    const bytes = await pageZip([...files,{path:SIGNATURE_PATH,content:Buffer.from(JSON.stringify(signPackage(listing,testPublisher.privateKey)))}]);
    expect((await uploadPluginZip(base,admin.token,bytes,false)).status).toBe(200);
    const installation = await prisma.pluginInstallation.findUniqueOrThrow({where:{pluginSlug_instanceKey:{pluginSlug:slug,instanceKey:'default'}}}); installationId=installation.id;
    await PluginManagementService.updateInstance(installation.id,{enabled:true});
    const enqueue = async (key:string,payload:object) => {
      const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/tasks`,{method:'POST',headers:{authorization:`Bearer ${admin.token}`,'content-type':'application/json'},body:JSON.stringify({key,payload})});
      expect(response.status,await response.clone().text()).toBe(202);
      const id=(await response.json()).taskId; taskIds.push(id); return id as string;
    };
    const normal=await enqueue('render-one',{}); const failed=await enqueue('render-failed',{permanent:true});
    expect(await enqueue('render-one',{})).toBe(normal);
    detachDrain = attachPluginTaskDrain();
    const result=await sdk.drainPluginTasks({installationIds:[installation.id],deadlineMs:15_000,includeFinalFailure:true});
    expect(result).toMatchObject({completed:1,failed:1,unknownHooks:0});
    const read=await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/tasks/${failed}`,{headers:{authorization:`Bearer ${admin.token}`}});
    expect(read.status).toBe(200); expect(await read.json()).toMatchObject({status:'failed',attempt:1,finalFailure:{status:'succeeded'}});
    const principal=await prisma.pluginPrincipal.findUniqueOrThrow({where:{installationId_principalType_principalId:{installationId:installation.id,principalType:'ADMIN',principalId:admin.user.id}}}); expect(principal.source).toBe('GATEWAY');
    const schema=pluginSchemaName(slug);
    expect((await prisma.$queryRawUnsafe<Array<{principal_id:string}>>(`SELECT principal_id FROM "${schema}".results`))[0].principal_id).toBe(admin.user.id);
    expect((await prisma.$queryRawUnsafe<Array<{principal_id:string}>>(`SELECT principal_id FROM "${schema}".refund_intents`))).toEqual([{principal_id:admin.user.id}]);
    await sdk.drainPluginTasks({installationIds:[installation.id],deadlineMs:1000,includeFinalFailure:true});
    expect(await prisma.pluginTaskFinalFailure.count({where:{taskId:failed}})).toBe(1);
    const invalidBundle=await build({stdin:{contents:source.replace('{concurrency:1,maxAttempts:3','{concurrency:2,maxAttempts:3'),resolveDir:process.cwd(),loader:'js'},alias:{'@jiffoo-core/plugin-sdk':runtime},bundle:true,platform:'node',format:'cjs',target:'node24',write:false});
    const invalidFiles=files.map(file=>file.path==='manifest.json'?{...file,content:Buffer.from(JSON.stringify({...manifest,version:'1.0.1'}))}:file.path==='index.js'?{...file,content:Buffer.from(invalidBundle.outputFiles[0].contents)}:file);
    const invalidListing=invalidFiles.map(file=>({path:file.path,sha256:createHash('sha256').update(file.content).digest('hex')})).sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
    const invalidZip=await pageZip([...invalidFiles,{path:SIGNATURE_PATH,content:Buffer.from(JSON.stringify(signPackage(invalidListing,testPublisher.privateKey)))}]);
    const rejected=await uploadPluginZip(base,admin.token,invalidZip,false,'FAILED');
    expect((await rejected.json()).data.errorCode).toBe('PLUGIN_TASK_DECLARATION_INVALID');
    expect((await prisma.pluginInstall.findUniqueOrThrow({where:{slug}})).version).toBe('1.0.0');
  } finally {
    detachDrain?.();
    await app.close();
    assertCurrentDatabase((await prisma.$queryRaw<Array<{name:string}>>`SELECT current_database() AS name`)[0].name);
    if(installationId) { await prisma.pluginTaskExecutionSlot.deleteMany({where:{installationId}}); await prisma.pluginTaskFairness.deleteMany({where:{installationId}}); }
    await prisma.pluginInstall.deleteMany({where:{slug}});
    await cleanupPluginMigrationFixture(slug); await clearTestPluginCache(slug);
    await prisma.adminAuditEvent.deleteMany({where:{targetId:{in:[slug,...taskIds]}}});
    await deleteTestUser(admin.user.id);
  }
},60_000);
