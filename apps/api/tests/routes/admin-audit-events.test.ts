import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { allocateOrderNumber } from '@/core/order/number';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { loadOpenApiSpec, setOpenApiSpec, validateResponse } from '../helpers/openapi';

describe('Admin audit event viewer', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  const userIds: string[] = [];
  const eventIds: string[] = [];
  const staffIds: string[] = [];
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
    await prisma.adminStaffAuditLog.deleteMany({ where: { id: { in: staffIds } } });
    staffIds.length = 0;
    eventIds.length = 0;
  });
  afterAll(async () => {
    await prisma.adminAuditEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.adminStaffAuditLog.deleteMany({ where: { id: { in: staffIds } } });
    staffIds.length = 0;
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
  it('merges historical staff rows before filtering, counting, pagination and export reads', async () => {
    const at = new Date('2039-01-01T00:00:00Z');
    const core = await event({ id: target + '-core', createdAt: at, targetType: 'staff' });
    const staff = await prisma.adminStaffAuditLog.create({ data: {
      id: target + '-staff', createdAt: at, action: 'ADMIN_INVITED', metadata: { reinvite: true },
      staffUserId: 'deleted-staff', staffEmail: 'past@example.com', staffUsername: 'Past Staff',
      actorUserId: admin.user.id, actorEmail: 'historical-owner@example.com', actorUsername: 'Historical Owner',
    } });
    staffIds.push(staff.id);
    const system = await prisma.adminStaffAuditLog.create({ data: {
      action: 'ADMIN_REMOVED', staffUserId: 'deleted-staff', staffEmail: 'past@example.com',
      createdAt: at, actorUserId: null,
    } });
    staffIds.push(system.id);
    const query = `actorId=${admin.user.id}&category=accounts&from=${at.toISOString()}&to=${at.toISOString()}`;
    const ordered = [core.id, 'staff:' + staff.id].sort().reverse();
    const first = await list(query + '&page=1&limit=1');
    expect(first).toMatchObject({ total: 2, totalPages: 2 });
    expect(first.items[0].id).toBe(ordered[0]);
    expect((await list(query + '&page=2&limit=1')).items[0].id).toBe(ordered[1]);
    const exported = await list(query + '&limit=100');
    expect(exported.items.map((row: any) => row.id)).toEqual(ordered);
    expect(exported.items.find((row: any) => row.id === 'staff:' + staff.id)).toMatchObject({
      action: 'ADMIN_REINVITED', targetLabel: 'Past Staff · past@example.com',
      actor: { email: 'historical-owner@example.com', username: 'Historical Owner' },
    });
    expect((await list(query + '&action=ADMIN_REINVITED&targetType=staff')).total).toBe(1);
    const systemRows = await list(`actorId=system&action=ADMIN_REMOVED&from=${at.toISOString()}&to=${at.toISOString()}`);
    expect(systemRows.items).toEqual([expect.objectContaining({ id: 'staff:' + system.id, actorId: 'system', actor: null })]);
    const filters = (await get('', admin.token, '/filters')).json().data;
    expect(filters.actions).toContain('ADMIN_REINVITED');
    expect(filters.targetTypes).toContain('staff');
  });
  it('filters board categories and supports ascending chronological order without removing existing filters', async () => {
    const first = await event({ action: 'STAFF_INVITED', targetType: 'staff', createdAt: new Date('2026-01-01T00:00:00Z') });
    const second = await event({ action: 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED', targetType: 'customer', createdAt: new Date('2026-01-02T00:00:00Z') });
    await event({ action: 'theme.activate', targetType: 'theme' });
    const result = await list(`actorId=${admin.user.id}&category=accounts&sort=oldest`);
    expect(result.items.map((row: { id: string }) => row.id)).toEqual([first.id, second.id]);
    expect((await list(`actorId=${admin.user.id}&category=accounts&action=STAFF_INVITED`)).total).toBe(1);
    expect((await get('category=unknown')).statusCode).toBe(400);
  });

  it('B applies individual and combined filters and rejects unknown fields and invalid time ranges', async () => {
    const second = await createAdminWithToken();
    userIds.push(second.user.id);
    const one = await event({ action: `${target}.one`, createdAt: new Date('2026-01-02T00:00:00Z') });
    const two = await event({ actorId: second.user.id, action: `${target}.two`, targetType: `${target}-other`,
      createdAt: new Date('2026-01-04T00:00:00Z') });
    const ids = async (query: string) => {
      const first = await list(`${query}&limit=100`);
      const records = [...first.items];
      for (let page = 2; page <= first.totalPages; page++) records.push(...(await list(`${query}&limit=100&page=${page}`)).items);
      return records.map((row: { id: string }) => row.id);
    };
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
  it('includes customer changes and deleted snapshots in account filters and export reads', async () => {
    const actions = ['customer.deactivated', 'customer.reactivated', 'customer.renamed', 'customer.deleted'];
    for (const action of actions) await event({ action, targetType: 'customer', targetId: 'deleted-customer',
      summary: { email: 'customer@example.com', username: 'Recorded Name', ...(action === 'customer.renamed' ? { from: 'Old Name', to: 'Recorded Name' } : {}) } });
    const query = `actorId=${admin.user.id}&category=accounts&targetType=customer`;
    const exported = await list(query + '&limit=100');
    expect(exported.total).toBe(4);
    expect(exported.items.map((row: any) => row.action).sort()).toEqual([...actions].sort());
    for (const row of exported.items) {
      expect(row.targetLabel).toBe('Recorded Name · customer@example.com');
      expect(row.context).toBeUndefined();
      expect((await list(query + '&action=' + row.action)).items).toEqual([row]);
    }
    const filters = (await get('', admin.token, '/filters')).json().data;
    expect(filters.actions).toEqual(expect.arrayContaining(actions));
    expect(filters.targetTypes).toContain('customer');
  });
  it('resolves a recorded actor id when historical staff rows have no name or email snapshot', async () => {
    const staff = await prisma.adminStaffAuditLog.create({ data: {
      action: 'ADMIN_REMOVED', actorUserId: admin.user.id, staffUserId: 'historical-target', staffEmail: 'past@example.com',
    } });
    staffIds.push(staff.id);
    const row = (await list(`actorId=${admin.user.id}&action=ADMIN_REMOVED`)).items.find((record: any) => record.id === 'staff:' + staff.id);
    expect(row.actor).toMatchObject({ id: admin.user.id, email: admin.user.email, username: admin.user.username });
    expect(row.targetLabel).toBe('past@example.com');
  });

  it('links only existing accounts in their canonical role route and preserves historical context', async () => {
    const customer = await createUserWithToken();
    userIds.push(customer.user.id);
    const existing = await event({ targetType: 'customer', targetId: customer.user.id, summary: { version: '1.2.3', revision: 6 } });
    const missing = await event({ targetType: 'order', targetId: 'missing-order' });
    const wrongRole = await event({ targetType: 'staff', targetId: customer.user.id });
    const rows = (await list(`actorId=${admin.user.id}`)).items;
    expect(rows.find((row: { id: string }) => row.id === existing.id)).toMatchObject({ context: { path: `/customers/${customer.user.id}`, label: customer.user.username }, summary: { version: '1.2.3', revision: 6 } });
    expect(rows.find((row: { id: string }) => row.id === missing.id).context).toBeUndefined();
    expect(rows.find((row: { id: string }) => row.id === wrongRole.id).context).toBeUndefined();
  });

  it('resolves real payment amount and attempt number without changing the stored summary', async () => {
    const { order, account, payment } = await prisma.$transaction(async tx => {
      const order = await tx.order.create({ data: { ...await allocateOrderNumber(tx), id: randomUUID(), userId: admin.user.id, status: 'PENDING', paymentStatus: 'PENDING', subtotalAmount: 459, taxAmount: 0, totalAmount: 459, currency: 'CNY' } });
      const account = await tx.paymentProviderAccount.create({ data: { namespace: randomUUID(), merchantAccount: 'audit', environment: 'test' } });
      const payment = await tx.payment.create({ data: { orderId: order.id, providerKey: account.providerKey, idempotencyKey: randomUUID(), paymentMethod: 'audit', amount: 459, currency: 'CNY', attemptNumber: 2 } });
      return { order, account, payment };
    });
    try {
      const summary = { paymentId: payment.id, orderId: order.id, reference: 'verified-reference', outcome: 'PAID' };
      const saved = await event({ targetType: 'payment', targetId: payment.id, summary });
      const row = (await list(`actorId=${admin.user.id}`)).items.find((row: { id: string }) => row.id === saved.id);
      expect(row).toMatchObject({ context: { path: `/orders/${order.id}`, label: order.orderNumber }, paymentContext: { amount: '459.00', currency: 'CNY', attemptNumber: 2 }, summary });
    } finally {
      await prisma.$transaction([
        prisma.payment.delete({ where: { id: payment.id } }),
        prisma.order.delete({ where: { id: order.id } }),
        prisma.paymentProviderAccount.delete({ where: { providerKey: account.providerKey } }),
      ]);
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
    const staffRows = await prisma.adminStaffAuditLog.findMany();
    const data = response.json().data;
    expect(data.actions).toEqual([...new Set([...rows.map(row => row.action), ...staffRows.map(row => row.action === 'ADMIN_INVITED' && (row.metadata as any)?.reinvite ? 'ADMIN_REINVITED' : row.action)])].sort());
    expect(data.targetTypes).toEqual([...new Set([...rows.map(row => row.targetType), ...staffRows.map(row => row.action === 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED' ? 'customer' : row.action === 'THEME_UNSIGNED_INSTALL_CONFIRMED' ? 'theme' : row.action === 'BUILTIN_PLUGIN_INSTALLED' ? 'plugin' : 'staff')])].sort());
    const actors = await prisma.user.findMany({
      where: { id: { in: [...rows.map(row => row.actorId), ...staffRows.flatMap(row => row.actorUserId ? [row.actorUserId] : [])] } }, orderBy: [{ email: 'asc' }, { id: 'asc' }],
      select: { id: true, email: true, username: true, isActive: true },
    });
    const expectedActors = new Map(actors.map(actor => [actor.id, actor]));
    for (const row of staffRows) if (row.actorUserId && row.actorUserId !== 'system' && !expectedActors.has(row.actorUserId)) expectedActors.set(row.actorUserId, { id: row.actorUserId, email: row.actorEmail ?? '', username: row.actorUsername ?? '', isActive: false });
    expect(data.actors).toEqual([...expectedActors.values()].sort((a, b) => a.email.localeCompare(b.email) || a.id.localeCompare(b.id)));
    expect(data.actors.some((actor: { id: string }) => actor.id === unused.user.id)).toBe(false);
    expect((await get('unknown=value', admin.token, '/filters')).statusCode).toBe(400);
  });
});
