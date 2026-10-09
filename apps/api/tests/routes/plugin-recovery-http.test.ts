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
it('N recovery listing requires Admin authorization',async()=>{
  expect((await app.inject({method:'GET',url:'/api/v1/extensions/plugin/recovery'})).statusCode).toBe(401);
  expect((await app.inject({method:'GET',url:'/api/v1/extensions/plugin/recovery',headers:customer.authHeader})).statusCode).toBe(403);
});
