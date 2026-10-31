import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken } from '../helpers/auth';

describe('Admin list preferences', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  let other: Awaited<ReturnType<typeof createAdminWithToken>>;
  const viewsRoute = '/api/v1/admin/list-views';
  const preferencesRoute = '/api/v1/admin/list-preferences';
  const userIds: string[] = [];

  const headers = (token: string) => ({ authorization: `Bearer ${token}` });
  const inject = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, token: string, payload?: unknown) =>
    app.inject({ method, url, headers: headers(token), ...(payload === undefined ? {} : { payload }) });

  beforeAll(async () => {
    app = await createTestApp();
    admin = await createAdminWithToken();
    other = await createAdminWithToken();
    userIds.push(admin.user.id, other.user.id);
  });

  afterAll(async () => {
    await prisma.adminListView.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.adminListColumnPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('creates, lists, updates and deletes a saved view', async () => {
    const created = await inject('POST', viewsRoute, admin.token, { list: 'orders', name: 'Paid orders', query: { status: 'PAID', page: '2' } });
    expect(created.statusCode).toBe(201);
    const view = created.json().data;
    expect(view).toMatchObject({ listKey: 'orders', name: 'Paid orders', query: { status: 'PAID', page: '2' } });
    expect(typeof view.id).toBe('string');

    const listed = await inject('GET', `${viewsRoute}?list=orders`, admin.token);
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.views.map((entry: { id: string }) => entry.id)).toContain(view.id);

    const renamed = await inject('PUT', `${viewsRoute}/${view.id}`, admin.token, { name: 'Paid and shipped' });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().data).toMatchObject({ id: view.id, name: 'Paid and shipped' });

    const requeried = await inject('PUT', `${viewsRoute}/${view.id}`, admin.token, { query: { status: 'SHIPPED' } });
    expect(requeried.statusCode).toBe(200);
    expect(requeried.json().data).toMatchObject({ name: 'Paid and shipped', query: { status: 'SHIPPED' } });

    const removed = await inject('DELETE', `${viewsRoute}/${view.id}`, admin.token);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data).toBeNull();

    const afterDelete = await inject('GET', `${viewsRoute}?list=orders`, admin.token);
    expect(afterDelete.json().data.views.map((entry: { id: string }) => entry.id)).not.toContain(view.id);
  });

  it('rejects an unknown list, an empty name, a duplicate name and an unknown column', async () => {
    const unknownList = await inject('GET', `${viewsRoute}?list=invoices`, admin.token);
    expect(unknownList.statusCode).toBe(400);
    expect(unknownList.json().error.code).toBe('VALIDATION_ERROR');

    const unknownListBody = await inject('POST', viewsRoute, admin.token, { list: 'invoices', name: 'Nope', query: {} });
    expect(unknownListBody.statusCode).toBe(400);
    expect(unknownListBody.json().error.code).toBe('VALIDATION_ERROR');

    const emptyName = await inject('POST', viewsRoute, admin.token, { list: 'orders', name: '   ', query: {} });
    expect(emptyName.statusCode).toBe(400);
    expect(emptyName.json().error.code).toBe('VALIDATION_ERROR');

    const created = await inject('POST', viewsRoute, admin.token, { list: 'orders', name: 'Duplicate', query: {} });
    expect(created.statusCode).toBe(201);
    const duplicate = await inject('POST', viewsRoute, admin.token, { list: 'orders', name: 'Duplicate', query: {} });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('LIST_VIEW_NAME_TAKEN');

    const unknownColumn = await inject('PUT', preferencesRoute, admin.token, { list: 'orders', columns: ['orderNumber', 'invoice'] });
    expect(unknownColumn.statusCode).toBe(400);
    expect(unknownColumn.json().error.code).toBe('VALIDATION_ERROR');

    const emptyColumns = await inject('PUT', preferencesRoute, admin.token, { list: 'orders', columns: [] });
    expect(emptyColumns.statusCode).toBe(400);
    expect(emptyColumns.json().error.code).toBe('VALIDATION_ERROR');

    const duplicateColumn = await inject('PUT', preferencesRoute, admin.token, { list: 'orders', columns: ['orderNumber', 'orderNumber'] });
    expect(duplicateColumn.statusCode).toBe(400);
    expect(duplicateColumn.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('reads and writes the column preference of the signed-in administrator only', async () => {
    const initial = await inject('GET', `${preferencesRoute}?list=orders`, admin.token);
    expect(initial.statusCode).toBe(200);
    expect(initial.json().data).toEqual({ listKey: 'orders', columns: ['orderNumber', 'customer', 'status', 'payment', 'totalAmount', 'createdAt'] });

    const saved = await inject('PUT', preferencesRoute, admin.token, { list: 'orders', columns: ['orderNumber', 'totalAmount'] });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().data).toEqual({ listKey: 'orders', columns: ['orderNumber', 'totalAmount'] });

    const reread = await inject('GET', `${preferencesRoute}?list=orders`, admin.token);
    expect(reread.json().data.columns).toEqual(['orderNumber', 'totalAmount']);

    const otherUser = await inject('GET', `${preferencesRoute}?list=orders`, other.token);
    expect(otherUser.json().data.columns).toEqual(['orderNumber', 'customer', 'status', 'payment', 'totalAmount', 'createdAt']);

    const unknownList = await inject('GET', `${preferencesRoute}?list=invoices`, admin.token);
    expect(unknownList.statusCode).toBe(400);
  });

  it('never exposes or changes the saved views of another administrator', async () => {
    const created = await inject('POST', viewsRoute, admin.token, { list: 'products', name: 'Private view', query: { status: 'active' } });
    expect(created.statusCode).toBe(201);
    const view = created.json().data;

    const listed = await inject('GET', `${viewsRoute}?list=products`, other.token);
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.views).toEqual([]);

    const updated = await inject('PUT', `${viewsRoute}/${view.id}`, other.token, { name: 'Hijacked' });
    expect(updated.statusCode).toBe(404);
    expect(updated.json().error.code).toBe('NOT_FOUND');

    const removed = await inject('DELETE', `${viewsRoute}/${view.id}`, other.token);
    expect(removed.statusCode).toBe(404);

    const stillThere = await inject('GET', `${viewsRoute}?list=products`, admin.token);
    expect(stillThere.json().data.views.map((entry: { id: string }) => entry.id)).toContain(view.id);
  });
});
