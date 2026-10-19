import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { AdminUserService } from '@/core/admin/user-management/service';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';

vi.mock('@/config/database', async original => {
  const actual = await original<typeof import('@/config/database')>();
  const transaction = vi.fn(actual.prisma.$transaction.bind(actual.prisma));
  return { ...actual, prisma: new Proxy(actual.prisma, {
    get: (target, key) => key === '$transaction' ? transaction : Reflect.get(target, key),
  }) };
});

describe('Customer administration audit events', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  const ids: string[] = [];
  const customer = async () => {
    const result = await createUserWithToken();
    ids.push(result.user.id);
    return result.user;
  };
  const events = (targetId: string) => prisma.adminAuditEvent.findMany({ where: { targetId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const update = (id: string, payload: object) => app.inject({ method: 'PUT', url: `/api/v1/admin/users/${id}`, headers: { authorization: `Bearer ${admin.token}` }, payload });
  const remove = (id: string) => app.inject({ method: 'DELETE', url: `/api/v1/admin/users/${id}`, headers: { authorization: `Bearer ${admin.token}` } });
  beforeAll(async () => { app = await createTestApp(); admin = await createAdminWithToken(); ids.push(admin.user.id); });
  afterAll(async () => {
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('records exactly one event per status, rename and delete action with the authenticated actor and snapshot', async () => {
    const user = await customer();
    for (const [payload, action, username, extra] of [
      [{ isActive: false }, 'customer.deactivated', user.username, {}],
      [{ isActive: true }, 'customer.reactivated', user.username, {}],
      [{ username: 'Updated Name' }, 'customer.renamed', 'Updated Name', { from: user.username, to: 'Updated Name' }],
    ] as const) {
      const before = await events(user.id);
      expect((await update(user.id, payload)).statusCode).toBe(200);
      const rows = (await events(user.id)).filter(row => !before.some(previous => previous.id === row.id));
      expect(rows).toEqual([expect.objectContaining({ actorId: admin.user.id, action, targetType: 'customer', targetId: user.id,
        summary: { email: user.email, username, ...extra } })]);
    }
    expect((await remove(user.id)).statusCode).toBe(200);
    const rows = await events(user.id);
    expect(rows).toHaveLength(4);
    expect(rows.filter(row => row.action === 'customer.deleted')).toEqual([expect.objectContaining({ actorId: admin.user.id, targetType: 'customer', targetId: user.id,
      summary: { email: user.email, username: 'Updated Name' } })]);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it('does not record no-ops, validation failures, protected accounts or missing customers', async () => {
    const user = await customer();
    expect((await update(user.id, { username: user.username, isActive: true })).statusCode).toBe(200);
    for (const payload of [{ username: '' }, { role: 'ADMIN' }, { email: 'forbidden@example.com' }]) {
      expect((await update(user.id, payload)).statusCode).toBe(400);
    }
    expect((await update(admin.user.id, { isActive: false })).statusCode).toBe(409);
    expect((await remove(admin.user.id)).statusCode).toBe(409);
    expect((await update('missing-customer', { username: 'Missing' })).statusCode).toBe(404);
    expect((await remove('missing-customer')).statusCode).toBe(404);
    expect(await events(user.id)).toEqual([]);
    expect(await events(admin.user.id)).toEqual([]);
    expect(await events('missing-customer')).toEqual([]);
  });

  it.each(['deactivate', 'reactivate', 'rename', 'delete'])('rolls back both the %s change and its audit event on transaction failure', async action => {
    const user = await customer();
    if (action === 'reactivate') await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const transaction = vi.mocked(prisma.$transaction).getMockImplementation()!;
    vi.mocked(prisma.$transaction).mockImplementationOnce(((callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      transaction(async tx => { await callback(tx); throw new Error('Injected transaction failure after audit write'); })) as typeof prisma.$transaction);
    await expect(action === 'delete' ? AdminUserService.deleteUser(user.id, admin.user.id)
        : AdminUserService.updateUser(user.id, action === 'rename' ? { username: 'Rolled Back' } : { isActive: action === 'reactivate' }, admin.user.id)).rejects.toThrow('Injected transaction failure');
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toEqual(before);
    expect(await events(user.id)).toEqual([]);
  });
});
