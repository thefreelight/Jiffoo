import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapPluginPolicyAuthority } from '@/core/auth/plugin-action-policy-bootstrap';
import type { PrismaClient } from '@prisma/client';
vi.mock('@/config/test-lane', () => ({ validateDatabaseUrl: vi.fn(), assertCurrentDatabase: vi.fn() }));

describe('Explicit plugin policy bootstrap', () => {
  const upsert = vi.fn(), existing = vi.fn(), count = vi.fn(), audit = vi.fn();
  const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn(), user: { findUnique: vi.fn().mockResolvedValue({ isActive: true, role: 'ADMIN' }) }, pluginPolicyAuthority: { findUnique: existing, count, upsert } };
  const client = { $queryRaw: vi.fn().mockResolvedValue([{ name: 'jiffoo_core_test' }]), $transaction: vi.fn(run => run(tx)) } as unknown as PrismaClient;
  beforeEach(() => { vi.clearAllMocks(); existing.mockResolvedValue(null); count.mockResolvedValue(0); });
  it('defaults to a read-only authority preflight', async () => {
    expect(await bootstrapPluginPolicyAuthority(client, { databaseUrl: 'postgresql://localhost/jiffoo_core_test', expectedDatabase: 'jiffoo_core_test', principalId: 'actor' }, audit)).toMatchObject({ applied: false });
    expect(upsert).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  });
  it('requires an explicit apply and records the authority bootstrap', async () => {
    expect(await bootstrapPluginPolicyAuthority(client, { databaseUrl: 'postgresql://localhost/jiffoo_core_test', expectedDatabase: 'jiffoo_core_test', principalId: 'actor', apply: true }, audit)).toMatchObject({ applied: true });
    expect(upsert).toHaveBeenCalledOnce(); expect(audit).toHaveBeenCalledOnce();
  });
  it('cannot bootstrap a second authority as an implicit bypass', async () => {
    count.mockResolvedValue(1);
    await expect(bootstrapPluginPolicyAuthority(client, { databaseUrl: 'postgresql://localhost/jiffoo_core_test', expectedDatabase: 'jiffoo_core_test', principalId: 'other', apply: true }, audit)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  it('rejects a URL database mismatch before any database access', async () => {
    await expect(bootstrapPluginPolicyAuthority(client, { databaseUrl: 'postgresql://localhost/other', expectedDatabase: 'jiffoo_core_test', principalId: 'actor' }, audit)).rejects.toThrow('explicitly expected');
    expect(client.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects a connection to a different database before authority lookup', async () => {
    vi.mocked(client.$queryRaw).mockResolvedValueOnce([{ name: 'other' }]);
    await expect(bootstrapPluginPolicyAuthority(client, { databaseUrl: 'postgresql://localhost/jiffoo_core_test', expectedDatabase: 'jiffoo_core_test', principalId: 'actor' }, audit)).rejects.toThrow('explicitly expected');
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});
