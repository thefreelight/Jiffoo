import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteTestUser } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app:FastifyInstance,admin:Awaited<ReturnType<typeof createAdminWithToken>>,customer:Awaited<ReturnType<typeof createUserWithToken>>;
const slug=`recovery-http-${randomUUID().slice(0,12)}`,bootNonce=randomUUID();let operationId:string;
beforeAll(async()=>{
  app=await createTestApp();admin=await createAdminWithToken();customer=await createUserWithToken();
  await prisma.coreProcess.create({data:{bootNonce,instanceId:randomUUID(),kind:'api',hostname:'fixture',pid:1,databaseRole:'postgres',heartbeatAt:new Date(0)}});
  const operation=await prisma.pluginMigrationOperation.create({data:{slug,actorId:admin.user.id,packageHash:'a'.repeat(64),packageVersion:'2.0.0',manifestDigest:'b'.repeat(64),manifest:{},declarations:[],expectedInstall:{},installOptions:{},artifactBytes:new Uint8Array([1]),leaseToken:randomUUID(),confirmed:true,phase:'NEEDS_RECOVERY',ownerBootNonce:bootNonce,committedPrefix:1}});operationId=operation.id;
});
afterAll(async()=>{await prisma.pluginOperationLease.deleteMany({where:{operation:`plugin-invocation:${slug}`}});await prisma.pluginMigrationOperation.deleteMany({where:{slug}});await prisma.coreProcess.delete({where:{bootNonce}});await app.close();await deleteTestUser(admin.user.id);await deleteTestUser(customer.user.id);});
it('N Admin reload reads durable recovery operations and never returns candidate bytes',async()=>{
  for(let reload=0;reload<2;reload++){const response=await app.inject({method:'GET',url:'/api/v1/extensions/plugin/recovery',headers:admin.authHeader});expect(response.statusCode).toBe(200);expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().data.items.find((item:any)=>item.slug===slug)).toMatchObject({maintenanceRequired:false,operations:[{operationId,phase:'NEEDS_RECOVERY',committedPrefix:1,retryAvailable:true}]});expect(response.body).not.toContain('artifactBytes');}
});
it('N orphan markers make the persistent feed require maintenance and disable retry',async()=>{
  await prisma.pluginOperationLease.create({data:{slug:`invocation:${slug}`,token:randomUUID(),operation:`plugin-invocation:${slug}`,ownerBootNonce:bootNonce,acquiredAt:new Date(),expiresAt:new Date(0)}});
  const response=await app.inject({method:'GET',url:'/api/v1/extensions/plugin/recovery',headers:admin.authHeader});expect(response.statusCode).toBe(200);expect(response.json().data.items.find((item:any)=>item.slug===slug)).toMatchObject({maintenanceRequired:true,markerCount:1,operations:[{retryAvailable:false}]});
});
it('N the dead cleanup rows are visible to the operator over HTTP',async()=>{
  const deadSlug=`recovery-dead-${randomUUID().slice(0,12)}`;
  const install=await prisma.pluginInstall.create({data:{slug:deadSlug,name:deadSlug,version:'1.0.0'}});
  const installation=await prisma.pluginInstallation.create({data:{pluginSlug:install.slug,instanceKey:'default',enabled:true}});
  const objectKey=`private/${installation.id}/CUSTOMER/${randomUUID()}`;
  await prisma.pluginFileCleanup.create({data:{installationId:installation.id,objectKey,status:'DEAD',attempts:12,lastError:'UPLOAD_STORAGE_UNAVAILABLE'}});
  try{
    const response=await app.inject({method:'GET',url:'/api/v1/extensions/plugin/recovery',headers:admin.authHeader});
    expect(response.statusCode).toBe(200);
    const item=response.json().data.items.find((entry:any)=>entry.slug===deadSlug);
    expect(item).toMatchObject({slug:deadSlug,maintenanceRequired:true,deadCleanupCount:1,deadCleanups:[{objectKey,attempts:12,lastError:'UPLOAD_STORAGE_UNAVAILABLE'}]});
  }finally{
    await prisma.pluginFileCleanup.deleteMany({where:{installationId:installation.id}});
    await prisma.pluginInstallation.deleteMany({where:{id:installation.id}});
    await prisma.pluginInstall.deleteMany({where:{slug:deadSlug}});
  }
});
it('N recovery listing requires Admin authorization',async()=>{
  expect((await app.inject({method:'GET',url:'/api/v1/extensions/plugin/recovery'})).statusCode).toBe(401);
  expect((await app.inject({method:'GET',url:'/api/v1/extensions/plugin/recovery',headers:customer.authHeader})).statusCode).toBe(403);
});
const resolveUrl='/api/v1/extensions/plugin/recovery/dead-cleanups/resolve';
async function deadCleanupFixture(status:'DEAD'|'PENDING'='DEAD'){
  const deadSlug=`recovery-resolve-${randomUUID().slice(0,12)}`;
  const install=await prisma.pluginInstall.create({data:{slug:deadSlug,name:deadSlug,version:'1.0.0'}});
  const installation=await prisma.pluginInstallation.create({data:{pluginSlug:install.slug,instanceKey:'default',enabled:true}});
  const objectKey=`private/${installation.id}/CUSTOMER/${randomUUID()}`;
  const cleanup=await prisma.pluginFileCleanup.create({data:{installationId:installation.id,objectKey,status,attempts:status==='DEAD'?12:0,lastError:status==='DEAD'?'UPLOAD_STORAGE_UNAVAILABLE':null}});
  return {deadSlug,installation,objectKey,cleanup};
}
async function removeFixture(fixture:Awaited<ReturnType<typeof deadCleanupFixture>>){
  await prisma.adminAuditEvent.deleteMany({where:{targetId:fixture.installation.id}});
  await prisma.pluginFileCleanup.deleteMany({where:{installationId:fixture.installation.id}});
  await prisma.pluginInstallation.deleteMany({where:{id:fixture.installation.id}});
  await prisma.pluginInstall.deleteMany({where:{slug:fixture.deadSlug}});
}
it('N the dead cleanup operator action validates its request body',async()=>{
  for(const payload of [{},{action:'retry'},{objectKey:'private/x'},{objectKey:'private/x',action:'delete'},{objectKey:'',action:'retry'}]){
    const response=await app.inject({method:'POST',url:resolveUrl,headers:admin.authHeader,payload});
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  }
});
it('N the dead cleanup operator action requires Admin authorization',async()=>{
  const payload={objectKey:`private/${randomUUID()}/CUSTOMER/${randomUUID()}`,action:'retry'};
  expect((await app.inject({method:'POST',url:resolveUrl,payload})).statusCode).toBe(401);
  expect((await app.inject({method:'POST',url:resolveUrl,headers:customer.authHeader,payload})).statusCode).toBe(403);
});
it('N an operator retry resets a dead cleanup row over HTTP',async()=>{
  const fixture=await deadCleanupFixture();
  try{
    const response=await app.inject({method:'POST',url:resolveUrl,headers:admin.authHeader,payload:{objectKey:fixture.objectKey,action:'retry'}});
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({objectKey:fixture.objectKey,action:'retry',status:'PENDING'});
    const row=await prisma.pluginFileCleanup.findUniqueOrThrow({where:{id:fixture.cleanup.id}});
    expect(row).toMatchObject({status:'PENDING',attempts:0,lastError:'UPLOAD_STORAGE_UNAVAILABLE'});
    expect(row.claimToken).toBeNull();
    expect(row.leaseUntil).toBeNull();
  }finally{await removeFixture(fixture);}
});
it('N the dead cleanup operator action answers not found for a live or missing row',async()=>{
  const fixture=await deadCleanupFixture('PENDING');
  try{
    const live=await app.inject({method:'POST',url:resolveUrl,headers:admin.authHeader,payload:{objectKey:fixture.objectKey,action:'retry'}});
    expect(live.statusCode).toBe(404);
    expect(live.json().error.code).toBe('PLUGIN_FILE_NOT_FOUND');
    const missing=await app.inject({method:'POST',url:resolveUrl,headers:admin.authHeader,payload:{objectKey:`private/${fixture.installation.id}/CUSTOMER/${randomUUID()}`,action:'release'}});
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('PLUGIN_FILE_NOT_FOUND');
  }finally{await removeFixture(fixture);}
});
