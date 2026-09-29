import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import type { CodeValues } from '@/core/admin/storefront-code/service';

const prisma = getTestPrisma();
const url = '/api/v1/admin/storefront-code';
const publicUrl = '/api/v1/store/storefront-code';
const defaults: CodeValues = {
  enabled: true, ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null,
  headCode: '', bodyStartCode: '', bodyEndCode: '',
};
const configured: CodeValues = {
  enabled: true, ga4MeasurementId: 'G-ABC123', metaPixelId: '123456',
  baiduSiteKey: '0123456789abcdef0123456789abcdef',
  headCode: '<script>headMarker()</script>', bodyStartCode: '<div>startMarker</div>',
  bodyEndCode: '<script>endMarker()</script>',
};
const { enabled: _enabled, ...configuredInput } = configured;
const publicKeys = ['ga4MeasurementId', 'metaPixelId', 'baiduSiteKey', 'headCode', 'bodyStartCode', 'bodyEndCode'].sort();
const emptyPublic = {
  ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null,
  headCode: '', bodyStartCode: '', bodyEndCode: '',
};

describe('Scenario 14 storefront code API', () => {
  let app: FastifyInstance;
  let actorId: string;
  let token: string;
  const ownUserIds: string[] = [];
  const ownThemeSlugs: string[] = [];
  const admin = (method: 'GET' | 'PUT' | 'POST', path = url, payload?: unknown) =>
    app.inject({ method, url: path, payload, headers: { authorization: `Bearer ${token}` } });
  const save = (values = configured, expectedRevision = 0) => {
    const { enabled: _enabled, ...input } = values;
    return admin('PUT', url, { ...input, expectedRevision });
  };
  const counts = async () => ({
    current: await prisma.storefrontCodeConfiguration.count({ where: { updatedById: actorId } }),
    revisions: await prisma.storefrontCodeRevision.count({ where: { createdById: actorId } }),
    audit: await prisma.adminAuditEvent.count({ where: { actorId, targetType: 'storefront-code' } }),
  });
  const assertEmpty = async () => expect(await counts()).toEqual({ current: 0, revisions: 0, audit: 0 });
  beforeAll(async () => { app = await createTestApp(); });
  beforeEach(async () => {
    expect(await prisma.storefrontCodeConfiguration.count()).toBe(0);
    expect(await prisma.storefrontCodeRevision.count()).toBe(0);
    const actor = await createAdminWithToken();
    actorId = actor.user.id;
    token = actor.token;
    ownUserIds.push(actorId);
  });
  afterEach(async () => {
    await prisma.storefrontCodeConfiguration.deleteMany({ where: { updatedById: actorId } });
    await prisma.storefrontCodeRevision.deleteMany({ where: { createdById: actorId } });
    await prisma.adminAuditEvent.deleteMany({ where: { actorId } });
    await prisma.theme.deleteMany({ where: { slug: { in: ownThemeSlugs } } });
    await prisma.user.deleteMany({ where: { id: { in: ownUserIds } } });
    ownUserIds.length = 0;
    ownThemeSlugs.length = 0;
  });
  afterAll(async () => { await app.close(); });

  it('A saves the first full configuration as revision 1 and reads it exactly', async () => {
    const initial = await admin('GET');
    expect(initial.statusCode).toBe(200);
    expect(initial.json().data).toEqual({ ...defaults, revision: 0, updatedById: null, updatedAt: null });
    const saved = await save();
    expect(saved.statusCode).toBe(200);
    const data = saved.json().data;
    expect(data).toEqual({ ...configured, revision: 1, updatedById: actorId, updatedAt: expect.any(String) });
    expect((await admin('GET')).json().data).toEqual(data);
    const snapshot = await admin('GET', `${url}/revisions/1`);
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.json().data).toEqual({
      ...data, id: expect.any(String), createdById: actorId,
      createdAt: expect.any(String), restoredFromRevision: null,
    });
    expect(await counts()).toEqual({ current: 1, revisions: 1, audit: 1 });
  });

  it('C records the save audit writer time within the request interval', async () => {
    const requestStart = Date.now();
    const response = await save();
    const responseEnd = Date.now();
    expect(response.statusCode).toBe(200);
    const events = await prisma.adminAuditEvent.findMany({
      where: { actorId, action: 'storefront-code.save', targetType: 'storefront-code', targetId: 'system' },
    });
    expect(events).toHaveLength(1);
    expect(events[0].createdAt).toBeInstanceOf(Date);
    expect(events[0].createdAt.getTime()).toBeGreaterThanOrEqual(requestStart);
    expect(events[0].createdAt.getTime()).toBeLessThanOrEqual(responseEnd);
  });

  it('B rejects stale saves with 409 without changing configuration, history or audit', async () => {
    const saved = await save();
    expect(saved.statusCode).toBe(200);
    const stale = await save({ ...configured, headCode: 'stale' });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      success: false, error: { code: 'STOREFRONT_CODE_CONFIG_CONFLICT', message: 'Configuration revision conflict' },
    });
    expect((await admin('GET')).json().data).toEqual(saved.json().data);
    expect(await counts()).toEqual({ current: 1, revisions: 1, audit: 1 });
  });

  it.each([
    ['lowercase GA4', { ga4MeasurementId: 'G-abc123' }],
    ['invalid GA4 prefix', { ga4MeasurementId: 'UA-123' }],
    ['padded GA4', { ga4MeasurementId: ' G-ABC123 ' }],
    ['GA4 trailing newline', { ga4MeasurementId: 'G-ABC123\n' }],
    ['oversized GA4', { ga4MeasurementId: `G-${'A'.repeat(33)}` }],
    ['invalid Meta Pixel', { metaPixelId: 'pixel123' }],
    ['padded Meta Pixel', { metaPixelId: ' 123456 ' }],
    ['Meta Pixel trailing newline', { metaPixelId: '123456\n' }],
    ['oversized Meta Pixel', { metaPixelId: '1'.repeat(33) }],
    ['invalid Baidu key', { baiduSiteKey: '0123456789ABCDEF0123456789ABCDEF' }],
    ['short Baidu key', { baiduSiteKey: 'abcdef' }],
    ['padded Baidu key', { baiduSiteKey: ' 0123456789abcdef0123456789abcdef ' }],
    ['Baidu trailing newline', { baiduSiteKey: '0123456789abcdef0123456789abcdef\n' }],
    ['oversized head slot', { headCode: 'x'.repeat(65537) }],
    ['oversized body start slot', { bodyStartCode: 'x'.repeat(65537) }],
    ['oversized body end slot', { bodyEndCode: 'x'.repeat(65537) }],
    ['numeric Meta Pixel', { metaPixelId: 123456 }],
    ['enabled in PUT body', { enabled: true }],
    ['nonstring code slot', { headCode: 123 }],
    ['unknown field', { orderData: true }],
  ])('C rejects %s with 400 and writes nothing', async (_name, invalid) => {
    const response = await admin('PUT', url, { ...configuredInput, expectedRevision: 0, ...invalid });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await assertEmpty();
  });

  it('C accepts 65536 characters in every slot without inspecting or normalizing content', async () => {
    const values = {
      ...configured, ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null,
      headCode: ` ${'x'.repeat(65534)} `, bodyStartCode: 's'.repeat(65536), bodyEndCode: 'e'.repeat(65536),
    };
    const response = await save(values);
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ ...values, revision: 1, updatedById: actorId, updatedAt: expect.any(String) });
    expect((await app.inject({ url: publicUrl })).json().data).toEqual({
      ...emptyPublic, headCode: values.headCode, bodyStartCode: values.bodyStartCode, bodyEndCode: values.bodyEndCode,
    });
  });

  it('D audits save, switch and restore once each with revisions and field names but no code contents', async () => {
    expect((await save()).statusCode).toBe(200);
    expect((await admin('POST', `${url}/switch`, { enabled: false })).statusCode).toBe(200);
    expect((await admin('POST', `${url}/restore`, { revision: 1, expectedRevision: 2 })).statusCode).toBe(200);
    const events = await prisma.adminAuditEvent.findMany({
      where: { actorId, targetType: 'storefront-code' }, orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(3);
    expect(events.map((event) => ({
      actorId: event.actorId, action: event.action, targetType: event.targetType, targetId: event.targetId, summary: event.summary,
    }))).toEqual([
      { actorId, action: 'storefront-code.save', targetType: 'storefront-code', targetId: 'system',
        summary: { fromRevision: 0, toRevision: 1,
          changedFields: ['ga4MeasurementId', 'metaPixelId', 'baiduSiteKey', 'headCode', 'bodyStartCode', 'bodyEndCode'] } },
      { actorId, action: 'storefront-code.switch', targetType: 'storefront-code', targetId: 'system',
        summary: { fromRevision: 1, toRevision: 2, changedFields: ['enabled'] } },
      { actorId, action: 'storefront-code.restore', targetType: 'storefront-code', targetId: 'system',
        summary: { fromRevision: 2, toRevision: 3, changedFields: [], restoredFromRevision: 1 } },
    ]);
    expect(JSON.stringify(events.map((event) => event.summary))).not.toMatch(/headMarker|startMarker|endMarker/);
    expect(await counts()).toEqual({ current: 1, revisions: 3, audit: 3 });
  });

  it('E restores snapshot business values as a new revision and rejects unknown or stale restores atomically', async () => {
    expect((await save()).statusCode).toBe(200);
    const original = (await admin('GET', `${url}/revisions/1`)).json().data;
    expect((await save(defaults, 1)).statusCode).toBe(200);
    const restored = await admin('POST', `${url}/restore`, { revision: 1, expectedRevision: 2 });
    expect(restored.statusCode).toBe(200);
    const current = restored.json().data;
    expect(current).toEqual({ ...configured, revision: 3, updatedById: actorId, updatedAt: expect.any(String) });
    const history = (await admin('GET', `${url}/revisions/3`)).json().data;
    expect(history).toEqual({
      ...current, id: expect.any(String), createdById: actorId,
      createdAt: expect.any(String), restoredFromRevision: 1,
    });
    expect((await admin('GET', `${url}/revisions/1`)).json().data).toEqual(original);
    const unknown = await admin('POST', `${url}/restore`, { revision: 999, expectedRevision: 3 });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('NOT_FOUND');
    const stale = await admin('POST', `${url}/restore`, { revision: 1, expectedRevision: 2 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('STOREFRONT_CODE_CONFIG_CONFLICT');
    expect((await admin('GET', `${url}/revisions/999`)).statusCode).toBe(404);
    expect((await admin('GET')).json().data).toEqual(current);
    expect(await counts()).toEqual({ current: 1, revisions: 3, audit: 3 });
  });

  it('F applies the master switch publicly while keeping all stored admin values', async () => {
    expect((await save()).statusCode).toBe(200);
    const off = await admin('POST', `${url}/switch`, { enabled: false });
    expect(off.statusCode).toBe(200);
    expect(off.json().data).toEqual({ ...configured, enabled: false, revision: 2, updatedById: actorId, updatedAt: expect.any(String) });
    const publicOff = await app.inject({ url: publicUrl });
    expect(publicOff.statusCode).toBe(200);
    expect(publicOff.json().data).toEqual(emptyPublic);
    expect((await admin('GET')).json().data).toEqual(off.json().data);
    const on = await admin('POST', `${url}/switch`, { enabled: true });
    expect(on.statusCode).toBe(200);
    expect(on.json().data.revision).toBe(3);
    expect((await app.inject({ url: publicUrl })).json().data).toEqual({
      ga4MeasurementId: configured.ga4MeasurementId, metaPixelId: configured.metaPixelId,
      baiduSiteKey: configured.baiduSiteKey, headCode: configured.headCode,
      bodyStartCode: configured.bodyStartCode, bodyEndCode: configured.bodyEndCode,
    });
  });

  it('G exposes exactly the six public keys with no-store both before and after configuration', async () => {
    const initial = await app.inject({ url: publicUrl });
    expect(initial.statusCode).toBe(200);
    expect(initial.headers['cache-control']).toBe('no-store');
    expect(initial.json().data).toEqual(emptyPublic);
    expect(Object.keys(initial.json().data).sort()).toEqual(publicKeys);
    expect((await save()).statusCode).toBe(200);
    const response = await app.inject({ url: publicUrl });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Object.keys(response.json().data).sort()).toEqual(publicKeys);
  });

  it.each([
    ['GET', '', undefined],
    ['PUT', '', { ...configuredInput, expectedRevision: 0 }],
    ['POST', '/switch', { enabled: false }],
    ['POST', '/restore', { revision: 1, expectedRevision: 0 }],
    ['GET', '/revisions', undefined],
    ['GET', '/revisions/1', undefined],
  ] as const)('H rejects unauthenticated and customer access to %s %s', async (method, route, payload) => {
    const customer = await createUserWithToken();
    ownUserIds.push(customer.user.id);
    const anonymous = await app.inject({ method, url: `${url}${route}`, payload });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json().error.code).toBe('UNAUTHORIZED');
    const denied = await app.inject({ method, url: `${url}${route}`, payload,
      headers: { authorization: `Bearer ${customer.token}` } });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('FORBIDDEN');
    await assertEmpty();
  });

  it('I paginates revision history newest first with an id tie-break and validates bounds', async () => {
    expect((await save()).statusCode).toBe(200);
    expect((await admin('POST', `${url}/switch`, { enabled: false })).statusCode).toBe(200);
    expect((await admin('POST', `${url}/switch`, { enabled: true })).statusCode).toBe(200);
    const newestFirst = await admin('GET', `${url}/revisions`);
    expect(newestFirst.statusCode).toBe(200);
    expect(newestFirst.json().data).toMatchObject({ page: 1, limit: 20, total: 3, totalPages: 1 });
    expect(newestFirst.json().data.items.map((item: { revision: number }) => item.revision)).toEqual([3, 2, 1]);
    const first = (await admin('GET', `${url}/revisions/1`)).json().data;
    const second = (await admin('GET', `${url}/revisions/2`)).json().data;
    const third = (await admin('GET', `${url}/revisions/3`)).json().data;
    const tiedAt = new Date('2026-09-28T00:00:00.000Z');
    await prisma.storefrontCodeRevision.updateMany({ where: { createdById: actorId }, data: { createdAt: tiedAt } });
    const expected = [first, second, third].sort((a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
      .map((item) => ({ ...item, createdAt: tiedAt.toISOString() }));
    const page1 = await admin('GET', `${url}/revisions?page=1&limit=2`);
    expect(page1.statusCode).toBe(200);
    expect(page1.json().data).toEqual({ items: expected.slice(0, 2), page: 1, limit: 2, total: 3, totalPages: 2 });
    const page2 = await admin('GET', `${url}/revisions?page=2&limit=2`);
    expect(page2.statusCode).toBe(200);
    expect(page2.json().data).toEqual({ items: expected.slice(2), page: 2, limit: 2, total: 3, totalPages: 2 });
    expect((await admin('GET', `${url}/revisions?page=3&limit=2`)).json().data.items).toEqual([]);
    expect((await admin('GET', `${url}/revisions?limit=100`)).statusCode).toBe(200);
    expect((await admin('GET', `${url}/revisions?limit=101`)).statusCode).toBe(400);
    expect((await admin('GET', `${url}/revisions?limit=0`)).statusCode).toBe(400);
    expect((await admin('GET', `${url}/revisions?page=0`)).statusCode).toBe(400);
  });

  it('J serializes concurrent first saves into one success, one conflict and one revision', async () => {
    const competing = { ...configured, headCode: 'second-writer' };
    const results = await Promise.all([save(), save(competing)]);
    expect(results.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const success = results.find((response) => response.statusCode === 200)!;
    const failure = results.find((response) => response.statusCode === 409)!;
    expect(failure.json().error.code).toBe('STOREFRONT_CODE_CONFIG_CONFLICT');
    expect((await admin('GET')).json().data).toEqual(success.json().data);
    expect(await counts()).toEqual({ current: 1, revisions: 1, audit: 1 });
  });

  it('K preserves the existing theme audit target, action and summary for configuration saves', async () => {
    const slug = `code-audit-${randomUUID()}`;
    ownThemeSlugs.push(slug);
    const manifest = {
      ...JSON.parse(readFileSync(path.resolve('builtin-themes/default-shop/theme.json'), 'utf8')),
      slug,
    };
    await prisma.theme.create({
      data: { slug, version: '1.0.0', target: 'shop', name: slug, packageHash: 'test',
        source: 'uploaded', trustLevel: 'unsigned', manifestJson: manifest },
    });
    const response = await app.inject({
      method: 'PUT', url: `/api/v1/extensions/themes/${slug}/config`,
      headers: { authorization: `Bearer ${token}` }, payload: { values: {}, expectedRevision: 0 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ values: {}, revision: 1 });
    const events = await prisma.adminAuditEvent.findMany({ where: { actorId, targetId: slug } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorId, action: 'theme.config.update', targetType: 'theme', targetId: slug, summary: { revision: 1 },
    });
    await assertEmpty();
  });

  it('L saves business values with the switch off without enabling public code or auditing enabled', async () => {
    expect((await save()).statusCode).toBe(200);
    expect((await admin('POST', `${url}/switch`, { enabled: false })).statusCode).toBe(200);
    const saved = await save(defaults, 2);
    expect(saved.statusCode).toBe(200);
    expect((await admin('GET')).json().data).toEqual({
      ...defaults, enabled: false, revision: 3, updatedById: actorId, updatedAt: expect.any(String),
    });
    const publicResponse = await app.inject({ url: publicUrl });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data).toEqual(emptyPublic);
    expect((await admin('GET', `${url}/revisions/3`)).json().data.enabled).toBe(false);
    const event = await prisma.adminAuditEvent.findFirstOrThrow({
      where: { actorId, action: 'storefront-code.save' }, orderBy: { createdAt: 'desc' },
    });
    expect(event.summary).toEqual({
      fromRevision: 2, toRevision: 3,
      changedFields: ['ga4MeasurementId', 'metaPixelId', 'baiduSiteKey', 'headCode', 'bodyStartCode', 'bodyEndCode'],
    });
    expect(await counts()).toEqual({ current: 1, revisions: 3, audit: 3 });
  });

  it('M restores an enabled snapshot with the switch off without enabling public code or auditing enabled', async () => {
    expect((await save()).statusCode).toBe(200);
    const snapshot = (await admin('GET', `${url}/revisions/1`)).json().data;
    expect(snapshot.enabled).toBe(true);
    expect((await admin('POST', `${url}/switch`, { enabled: false })).statusCode).toBe(200);
    expect((await save(defaults, 2)).statusCode).toBe(200);
    const restored = await admin('POST', `${url}/restore`, { revision: 1, expectedRevision: 3 });
    expect(restored.statusCode).toBe(200);
    const expectedValues = Object.fromEntries(publicKeys.map((key) => [key, snapshot[key]]));
    expect((await admin('GET')).json().data).toEqual({
      ...expectedValues, enabled: false, revision: 4, updatedById: actorId, updatedAt: expect.any(String),
    });
    const publicResponse = await app.inject({ url: publicUrl });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data).toEqual(emptyPublic);
    expect((await admin('GET', `${url}/revisions/1`)).json().data).toEqual(snapshot);
    expect((await admin('GET', `${url}/revisions/4`)).json().data).toMatchObject({
      ...expectedValues, enabled: false, restoredFromRevision: 1,
    });
    const event = await prisma.adminAuditEvent.findFirstOrThrow({
      where: { actorId, action: 'storefront-code.restore' },
    });
    expect(event.summary).toEqual({
      fromRevision: 3, toRevision: 4, restoredFromRevision: 1,
      changedFields: ['ga4MeasurementId', 'metaPixelId', 'baiduSiteKey', 'headCode', 'bodyStartCode', 'bodyEndCode'],
    });
    expect(await counts()).toEqual({ current: 1, revisions: 4, audit: 4 });
  });
});
