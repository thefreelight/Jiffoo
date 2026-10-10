import { beforeAll, afterAll, expect, it } from 'vitest';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { randomUUID } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { errorHttpFixture } from '../helpers/error-http-fixture';
import { createTestUser } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { uploadPluginZip } from '../helpers/plugin-upload';
import { pluginProtectionScope } from '@/infra/shared-protection';
import { ApiErrorCodes } from 'shared';
import { ApiClient } from '../../../../packages/shared/api/client';
import { MemoryStorageAdapter } from '../../../../packages/shared/api/storage-adapters';
import { unwrapApiResponse, AdminApiError } from '../../../admin/lib/api';
import { pluginLifecycleErrorKey } from '../../../admin/lib/plugin-lifecycle';
import { resolveApiErrorMessage } from '../../../admin/lib/error-utils';
import { merchant as en } from '../../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { common as enCommon } from '../../../../packages/shared/src/i18n/messages/en/common';
import { common as hansCommon } from '../../../../packages/shared/src/i18n/messages/zh-Hans/common';
import { common as hantCommon } from '../../../../packages/shared/src/i18n/messages/zh-Hant/common';

const prisma = getTestPrisma();
let fixture: Awaited<ReturnType<typeof errorHttpFixture>>;
let admin: Awaited<ReturnType<typeof createTestUser>>;
let token: string;
const slug = `b2a-${randomUUID().slice(0, 12)}`;
const restoreSlug = `${slug}-restore`;
let installationId: string;
let generation: bigint;
const ownBody = { success: false, error: { code: 'PAYMENT_DECLINED', message: 'Payment was declined.' } };
beforeAll(async () => {
  admin = await createTestUser({ role: 'ADMIN' });
  token = jwt.sign({ userId: admin.id, sv: 0 }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  fixture = await errorHttpFixture({ testSigningMode: false }); fixture.users.add(admin.id);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'b2a-plugin-'));
  try {
    await fs.mkdir(path.join(directory, 'server'));
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, slug, name: slug, version: '1.0.0', description: 'HTTP error fixture', category: 'payment', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [], contracts: [{ name: 'payment', version: 2 }] }));
    const source = `module.exports={register(ctx){
      ctx.http.route({method:'GET',path:'/payload/:kind',handler:async(req,reply)=>{
        const kind=req.params.kind;
        if(kind==='success')return reply.code(201).header('x-plugin-proof','unchanged').send({ok:true});
        if(kind==='business')return reply.code(409).send(${JSON.stringify(ownBody)});
        if(kind==='nonconforming')return reply.code(422).send({error:'PRIVATE_PLUGIN_BUSINESS_TEXT'});
        if(kind==='long-message')return reply.code(400).send({success:false,error:{code:'PAYMENT_DECLINED',message:'x'.repeat(513)}});
        if(kind==='malformed')return reply.code(400).type('text/plain').send('PRIVATE_PLUGIN_BODY');
        if(kind==='oversized')return reply.code(400).send({value:'x'.repeat(5*1024*1024+1)});
        if(kind==='timeout'){process.send?.({kind:'fixture-entered',slug:ctx.plugin.slug});await new Promise(resolve=>process.once('b2a-release-'+ctx.plugin.slug,resolve));return {ok:true};}
        return reply.code(500).send({secret:'PRIVATE_PLUGIN_BODY',sql:'PRIVATE_SQL'});
      }});
      ctx.contracts.implement('payment',2,{describe:()=>({displayName:'Fixture',requiresManualConfirmation:false,unpaidTimeoutMinutes:30,supportedCurrencies:['USD']}),createSession:()=>({sessionId:'fixture',action:{type:'none'}}),queryByRequestKey:()=>({status:'pending'}),handleWebhook:()=>({verification:'verified',events:[]})});
    }};`;
    await fs.writeFile(path.join(directory, 'server/index.js'), source);
    const zip = path.join(directory, 'plugin.zip');
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zip); const archive = archiver('zip');
      output.on('close', resolve); output.on('error', reject); archive.on('error', reject); archive.pipe(output);
      archive.file(path.join(directory, 'manifest.json'), { name: 'manifest.json' }); archive.file(path.join(directory, 'server/index.js'), { name: 'server/index.js' }); void archive.finalize();
    });
    const installed = await uploadPluginZip(fixture.base, token, await fs.readFile(zip));
    expect(installed.status).toBe(200);
    const installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } }); installationId = installation.id;
    const enabled = await fixture.request(`/api/v1/extensions/plugin/${slug}/instances/${installationId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
    expect(enabled.status).toBe(200);
    generation = (await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } })).protectionGeneration;
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, slug: restoreSlug, name: restoreSlug, version: '1.0.0', description: 'Restore error fixture', category: 'integration', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [], contracts: [] }));
    await fs.writeFile(path.join(directory, 'server/index.js'), 'module.exports={register(){}};');
    const restoreZip = path.join(directory, 'restore.zip');
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(restoreZip); const archive = archiver('zip');
      output.on('close', resolve); output.on('error', reject); archive.on('error', reject); archive.pipe(output);
      archive.file(path.join(directory, 'manifest.json'), { name: 'manifest.json' }); archive.file(path.join(directory, 'server/index.js'), { name: 'server/index.js' }); void archive.finalize();
    });
    expect((await uploadPluginZip(fixture.base, token, await fs.readFile(restoreZip))).status).toBe(200);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}, 90000);
afterAll(async () => {
  await fixture?.send({ kind: 'release', slug });
  await fixture?.close();
  const redis = new Redis(process.env.REDIS_URL!);
  try { if (installationId) { const keys = await redis.keys(`${pluginProtectionScope(installationId, generation)}:*`); if (keys.length) await redis.del(...keys); } } finally { redis.disconnect(); }
  await prisma.pluginInstall.deleteMany({ where: { slug: { in: [slug, restoreSlug] } } }); await prisma.user.deleteMany({ where: { id: admin?.id } });
  for (const ownedSlug of [slug, restoreSlug]) await cleanupPluginMigrationFixture(ownedSlug);
}, 60000);

it('F real plugin success and bounded JSON business errors pass through unchanged', async () => {
  const success = await fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/success`);
  expect(success.status).toBe(201); expect(success.headers.get('x-plugin-proof')).toBe('unchanged'); expect(await success.json()).toEqual({ ok: true });
  const business = await fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/business`);
  expect(business.status).toBe(409); expect(await business.json()).toEqual(ownBody);
});

it('M real plugin gateway decoding preserves conforming business text and status, localizes invalid envelopes, and keeps 5xx sanitized', async () => {
  const client = new ApiClient({ baseURL: `${fixture.base}/api/v1`, defaultHeaders: { 'x-forwarded-for': fixture.ip } }, new MemoryStorageAdapter());
  const business = await client.get(`/extensions/plugin/${slug}/api/payload/business`);
  expect(business.httpStatus).toBe(409); expect(business.error).toEqual(ownBody.error);
  let visible: AdminApiError | undefined;
  try { unwrapApiResponse(business); } catch (error) { expect(error).toBeInstanceOf(AdminApiError); visible = error as AdminApiError; }
  expect(visible?.source).toBe('plugin-business');
  for (const common of [enCommon, hansCommon, hantCommon]) {
    const translate = (key: string) => key.split('.').slice(1).reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], common) as string;
    expect(resolveApiErrorMessage(visible, translate)).toBe(ownBody.error.message);
    for (const [kind, status] of [['nonconforming', 422], ['long-message', 400]] as const) {
      const invalid = await client.get(`/extensions/plugin/${slug}/api/payload/${kind}`);
      expect(invalid.httpStatus).toBe(status); expect(invalid.pluginBusinessError).toBe(false);
      expect(() => unwrapApiResponse(invalid)).toThrow(AdminApiError);
      try { unwrapApiResponse(invalid); } catch (error) {
        expect(resolveApiErrorMessage(error, translate)).toBe(common.errors.requestCouldNotBeCompleted);
        expect((error as AdminApiError).status).toBe(status);
      }
    }
  }
  const server = await client.get(`/extensions/plugin/${slug}/api/payload/server`);
  expect(server.httpStatus).toBe(502); expect(server.error?.code).toBe(ApiErrorCodes.PLUGIN_ERROR);
  expect(server.pluginBusinessError).toBe(false); expect(JSON.stringify(server)).not.toContain('PRIVATE_PLUGIN_BODY');
});

it.each(['server', 'malformed', 'oversized'])('F real plugin %s errors become sanitized 502 PLUGIN_ERROR', async (kind) => {
  const response = await fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/${kind}`);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ success: false, error: { code: 'PLUGIN_ERROR', message: 'Plugin request failed' } });
});

it('F a never-installed callback is 404 and a disabled installed provider is retryable 503', async () => {
  const missing = await fixture.request(`/api/v1/payments/webhook/missing-${randomUUID().slice(0, 8)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  expect(missing.status).toBe(404); expect((await missing.json()).error.code).toBe('PLUGIN_NOT_FOUND');
  await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: false } });
  try {
    const disabled = await fixture.request(`/api/v1/payments/webhook/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(disabled.status).toBe(503); expect(disabled.headers.get('Retry-After')).toBe('5'); expect(disabled.headers.get('Cache-Control')).toBe('no-store'); expect((await disabled.json()).error.code).toBe('PLUGIN_DISABLED');
    const contract = await fixture.request(`/api/v1/__fixture/contract/${slug}/describe`);
    expect(contract.status).toBe(503); expect((await contract.json()).error.code).toBe('PLUGIN_DISABLED');
  } finally { await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: true } }); }
});

it('F a real held plugin HTTP invocation times out as 504 PLUGIN_TIMEOUT', async () => {
  const entered = new Promise<void>((resolve) => { const receive = (message: { kind: string; slug: string }) => { if (message.kind === 'fixture-entered' && message.slug === slug) { fixture.child.off('message', receive); resolve(); } }; fixture.child.on('message', receive); });
  const request = fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/timeout`);
  await entered;
  try { const response = await request; expect(response.status).toBe(504); expect((await response.json()).error.code).toBe('PLUGIN_TIMEOUT'); }
  finally { await fixture.send({ kind: 'release', slug }); }
}, 45000);

it('F a real lifecycle change latched before the permit resumes returns 503 without a plugin sample', async () => {
  const scope = pluginProtectionScope(installationId, generation);
  const redis = new Redis(process.env.REDIS_URL!);
  const latch = fixture.redis.holdNext((frame) => frame.includes(Buffer.from(`${scope}:breaker`)));
  const pending = fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/success`);
  try {
    await latch.entered;
    const samples = await redis.zcard(`${scope}:samples`);
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: false } });
    latch.release();
    const response = await pending;
    expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('PLUGIN_DISABLED');
    expect(await redis.zcard(`${scope}:samples`)).toBe(samples);
  } finally { latch.release(); await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: true } }); redis.disconnect(); }
}, 30000);

it('F a real shared breaker opens as distinct retryable 503 for gateway and contract calls', async () => {
  const redis = new Redis(process.env.REDIS_URL!);
  const scope = pluginProtectionScope(installationId, generation);
  try {
    let opened = false;
    for (let index = 0; index < 12; index++) {
      const failure = await fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/server`);
      if (failure.status === 503) { expect((await failure.json()).error.code).toBe('PLUGIN_CIRCUIT_OPEN'); opened = true; break; }
      expect(failure.status).toBe(502);
    }
    expect(opened).toBe(true);
    const gateway = await fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/success`);
    expect(gateway.status).toBe(503); expect((await gateway.json()).error.code).toBe('PLUGIN_CIRCUIT_OPEN');
    const contract = await fixture.request(`/api/v1/__fixture/contract/${slug}/describe`);
    expect(contract.status).toBe(503); expect((await contract.json()).error.code).toBe('PLUGIN_CIRCUIT_OPEN');
  } finally { await redis.del(`${scope}:breaker`); redis.disconnect(); }
});

it('E a real protection relay outage denies gateway work without consuming breaker samples', async () => {
  const redis = new Redis(process.env.REDIS_URL!);
  const scope = pluginProtectionScope(installationId, generation);
  try {
    const failures = await redis.zcard(`${scope}:failures`);
    const samples = await redis.zcard(`${scope}:samples`);
    fixture.redis.drop();
    try {
      const response = await fixture.request(`/api/v1/extensions/plugin/${slug}/api/payload/success`);
      expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('SHARED_PROTECTION_UNAVAILABLE');
      expect(await redis.zcard(`${scope}:failures`)).toBe(failures);
      expect(await redis.zcard(`${scope}:samples`)).toBe(samples);
    } finally { fixture.redis.recover(); }
  } finally { redis.disconnect(); }
}, 60000);

it('L real restore HTTP errors use shared conflict codes and yield specific Admin lifecycle text in all three locales', async () => {
  const request = (operation: '' | '/restore', method: 'DELETE' | 'POST') => fixture.request(`/api/v1/extensions/plugin/${restoreSlug}${operation}`, { method, headers: { Authorization: `Bearer ${token}` } });
  expect((await request('', 'DELETE')).status).toBe(200);
  try {
    for (const [root, code, key] of [
      [null, ApiErrorCodes.PLUGIN_REINSTALL_CONFLICT, 'reinstallRequired'],
      ['test', ApiErrorCodes.PLUGIN_TEST_SIGNING_CONFLICT, 'testSigningDisabled'],
    ] as const) {
      await prisma.pluginInstall.update({ where: { slug: restoreSlug }, data: { trustLevel: 'signed', signingRoot: root } });
      const response = await request('/restore', 'POST'); expect(response.status).toBe(409);
      const body = await response.json(); expect(body.error.code).toBe(code);
      const mapped = pluginLifecycleErrorKey(body.error); expect(mapped).toBe(key);
      for (const dictionary of [en, hans, hant]) {
        expect(dictionary.plugins.lifecycle[mapped as typeof key]).toBe(dictionary.plugins.lifecycle[key]);
        expect(dictionary.plugins.lifecycle[key]).not.toBe(dictionary.plugins.lifecycle.failed);
      }
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: restoreSlug } })).deletedAt).not.toBeNull();
    }
  } finally {
    await prisma.pluginInstall.update({ where: { slug: restoreSlug }, data: { trustLevel: 'unsigned', signingRoot: null } });
    expect((await request('/restore', 'POST')).status).toBe(200);
  }
});
