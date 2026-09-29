import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { loadOpenApiSpec, setOpenApiSpec, validateResponse } from '../helpers/openapi';

describe('Admin audit event viewer', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  const userIds: string[] = [];
  const eventIds: string[] = [];
  const target = `audit-${randomUUID()}`;
  const route = '/api/v1/admin/audit-events';
  async function event(overrides: Partial<Prisma.AdminAuditEventCreateInput> = {}) {
    const row = await prisma.adminAuditEvent.create({ data: {
      actorId: admin.user.id, action: 'theme.install', targetType: target, targetId: 'fixture',
      summary: {}, ...overrides,
    } });
    eventIds.push(row.id);
    return row;
  }
  const get = (query = '', token = admin.token, suffix = '') => app.inject({
    method: 'GET', url: `${route}${suffix}${query ? `?${query}` : ''}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  async function list(query: string) {
    const response = await get(query);
    expect(response.statusCode).toBe(200);
    expect(validateResponse(route, 'GET', 200, response.json()).valid).toBe(true);
    return response.json().data;
  }
  beforeAll(async () => {
    app = await createTestApp({ enableSwagger: true });
    setOpenApiSpec(app.swagger() as ReturnType<typeof loadOpenApiSpec> & {});
    admin = await createAdminWithToken();
    userIds.push(admin.user.id);
  });
  beforeEach(async () => {
    await prisma.adminAuditEvent.deleteMany({ where: { id: { in: eventIds } } });
    eventIds.length = 0;
  });
  afterAll(async () => {
    await prisma.adminAuditEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('A paginates with createdAt and id descending order and enforces page and limit bounds', async () => {
    const at = new Date('2026-01-02T12:00:00Z');
    await event({ id: `${target}-a`, createdAt: at });
    await event({ id: `${target}-b`, createdAt: at });
    const newest = await event({ createdAt: new Date('2026-01-03T12:00:00Z') });
    const filter = `actorId=${admin.user.id}`;
    expect(await list(filter)).toMatchObject({ page: 1, limit: 20, total: 3, totalPages: 1 });
    const first = await list(`${filter}&page=1&limit=2`);
    expect(first.items.map((row: { id: string }) => row.id)).toEqual([newest.id, `${target}-b`]);
    expect(first).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect((await list(`${filter}&page=2&limit=2`)).items.map((row: { id: string }) => row.id)).toEqual([`${target}-a`]);
    expect((await list(`${filter}&page=3&limit=2`)).items).toEqual([]);
    for (const limit of [1, 100]) expect(await list(`${filter}&limit=${limit}`)).toMatchObject({ limit });
    for (const invalid of ['page=0', 'page=-1', 'page=1.5', 'limit=0', 'limit=101', 'limit=1.5', 'page=no']) {
      expect((await get(invalid)).statusCode).toBe(400);
    }
  });

  it('B applies individual and combined filters and rejects unknown fields and invalid time ranges', async () => {
    const second = await createAdminWithToken();
    userIds.push(second.user.id);
    const one = await event({ action: `${target}.one`, createdAt: new Date('2026-01-02T00:00:00Z') });
    const two = await event({ actorId: second.user.id, action: `${target}.two`, targetType: `${target}-other`,
      createdAt: new Date('2026-01-04T00:00:00Z') });
    const ids = async (query: string) => (await list(query)).items.map((row: { id: string }) => row.id);
    expect(await ids(`actorId=${admin.user.id}`)).toEqual([one.id]);
    expect(await ids(`action=${target}.two`)).toEqual([two.id]);
    expect(await ids(`targetType=${target}`)).toEqual([one.id]);
    const fromOnly = await ids('from=2026-01-03T00:00:00Z');
    expect(fromOnly).toContain(two.id);
    expect(fromOnly).not.toContain(one.id);
    const toOnly = await ids('to=2026-01-02T00:00:00Z');
    expect(toOnly).toContain(one.id);
    expect(toOnly).not.toContain(two.id);
    expect(await ids(`from=2026-01-03T00:00:00Z&targetType=${target}-other`)).toEqual([two.id]);
    expect(await ids(`to=2026-01-02T00:00:00Z&targetType=${target}`)).toEqual([one.id]);
    expect(await ids(`actorId=${admin.user.id}&action=${target}.one&targetType=${target}&from=2026-01-02T00:00:00Z&to=2026-01-02T00:00:00Z`)).toEqual([one.id]);
    expect(await ids(`actorId=${admin.user.id}&action=${target}.two`)).toEqual([]);
    for (const invalid of ['from=bad', 'to=bad', 'from=2026-02-30T00:00:00Z', 'to=2026-01-02',
      'from=2026-01-03T00:00:00Z&to=2026-01-02T00:00:00Z', 'unknown=value']) {
      const response = await get(invalid);
      expect(response.statusCode).toBe(400);
      expect(validateResponse(route, 'GET', 400, response.json()).valid).toBe(true);
    }
  });

  it('C resolves active and deactivated actors at read time and returns null for a deleted user', async () => {
    const inactive = await createAdminWithToken();
    const deleted = await createAdminWithToken();
    userIds.push(inactive.user.id, deleted.user.id);
    const activeEvent = await event();
    const inactiveEvent = await event({ actorId: inactive.user.id });
    const deletedEvent = await event({ actorId: deleted.user.id });
    await prisma.user.update({ where: { id: inactive.user.id }, data: { isActive: false, username: 'Changed name' } });
    await prisma.user.delete({ where: { id: deleted.user.id } });
    const rows = (await list(`targetType=${target}`)).items;
    expect(rows.find((row: { id: string }) => row.id === activeEvent.id).actor).toEqual({
      id: admin.user.id, email: admin.user.email, username: admin.user.username, isActive: true,
    });
    expect(rows.find((row: { id: string }) => row.id === inactiveEvent.id).actor).toEqual({
      id: inactive.user.id, email: inactive.user.email, username: 'Changed name', isActive: false,
    });
    expect(rows.find((row: { id: string }) => row.id === deletedEvent.id).actor).toBeNull();
  });

  it('D returns summaries exactly as stored including nested values and literal HTML-like strings', async () => {
    const summaries = [{ nested: { values: [1, '<b>literal</b>', false] } }, '<b>plain string</b>', {}];
    for (const summary of summaries) {
      const saved = await event({ summary });
      const row = (await list(`targetType=${target}`)).items.find((item: { id: string }) => item.id === saved.id);
      expect(row.summary).toEqual(summary);
    }
  });

  it('E requires authentication and rejects customer access on both read endpoints', async () => {
    const customer = await createUserWithToken();
    userIds.push(customer.user.id);
    for (const suffix of ['', '/filters']) {
      expect((await get('', '', suffix)).statusCode).toBe(401);
      expect((await get('', customer.token, suffix)).statusCode).toBe(403);
    }
  });

  it('F derives distinct filter options only from existing audit rows and current users', async () => {
    const unused = await createAdminWithToken();
    userIds.push(unused.user.id);
    await event({ action: `${target}.future` });
    await event({ action: `${target}.future` });
    await event({ action: `${target}.other`, actorId: `${target}-missing`, targetType: `${target}-other` });
    const response = await get('', admin.token, '/filters');
    expect(response.statusCode).toBe(200);
    expect(validateResponse(`${route}/filters`, 'GET', 200, response.json()).valid).toBe(true);
    const rows = await prisma.adminAuditEvent.findMany();
    const data = response.json().data;
    expect(data.actions).toEqual([...new Set(rows.map((row) => row.action))].sort());
    expect(data.targetTypes).toEqual([...new Set(rows.map((row) => row.targetType))].sort());
    const actors = await prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.actorId) } }, orderBy: [{ email: 'asc' }, { id: 'asc' }],
      select: { id: true, email: true, username: true, isActive: true },
    });
    expect(data.actors).toEqual(actors);
    expect(data.actors.some((actor: { id: string }) => actor.id === unused.user.id)).toBe(false);
    expect((await get('unknown=value', admin.token, '/filters')).statusCode).toBe(400);
  });
});
