import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthIdentityService } from '@/core/auth/identity-service';
import { getTestPrisma } from '../helpers/db';

describe('Customer directory owning projection', () => {
  const prisma = getTestPrisma();
  const prefix = `directory-${randomUUID()}`;
  const ids = ['a', 'b', 'admin', 'removed'].map(suffix => `${prefix}-${suffix}`);
  beforeAll(async () => {
    await prisma.user.createMany({ data: ids.map((id, index) => ({ id, email: `${id}@example.com`, username: `${prefix}-Name-${index}`, password: 'not-a-login-fixture', role: index === 2 ? 'ADMIN' : 'USER', removedAt: index === 3 ? new Date() : null })) });
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: ids } } }); });
  it('excludes administrators and removed accounts from explicit lookups', async () => {
    const rows = await AuthIdentityService.customerDirectory(prisma, { ids, limit: 100 });
    expect(rows.map(row => row.id)).toEqual(ids.slice(0, 2));
    expect(Object.keys(rows[0]).sort()).toEqual(['email', 'id', 'username']);
  });
  it('searches case-insensitively with deterministic keyset pagination', async () => {
    const rows = await AuthIdentityService.customerDirectory(prisma, { query: prefix.toUpperCase(), afterId: ids[0], limit: 1 });
    expect(rows.map(row => row.id)).toEqual([ids[1]]);
  });
  it('matches email and names without including unrelated customers', async () => {
    const rows = await AuthIdentityService.customerDirectory(prisma, { query: `${ids[0]}@example.com`, limit: 10 });
    expect(rows.map(row => row.id)).toEqual([ids[0]]);
  });
});
