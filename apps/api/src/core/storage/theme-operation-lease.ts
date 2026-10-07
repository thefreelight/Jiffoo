import { ApiError } from '@/utils/api-errors';
import { prisma } from '@/config/database';
import { acquirePluginOperationLease, fencePluginOperationLease, releasePluginOperationLease } from './plugin-operation-lease';
import { themeTestBarrier } from './theme-test-hooks';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type ThemeLease = { resource: string; token: string };

function mapped(error: unknown): never {
  if (error instanceof ApiError && error.code === 'PLUGIN_OPERATION_IN_PROGRESS') throw new ApiError('THEME_OPERATION_IN_PROGRESS');
  if (error instanceof ApiError && error.code === 'PLUGIN_OPERATION_LEASE_LOST') throw new ApiError('THEME_OPERATION_LEASE_LOST');
  throw error;
}

export async function withThemeLeases<T>(target: string | null, slug: string | null, operation: string, run: (leases: ThemeLease[]) => Promise<T>): Promise<T> {
  // Every caller acquires target before package; the prefix isolates plugin keys.
  const resources = [...(target ? [`theme:target:${target}`] : []), ...(slug ? [`theme:package:${slug}`] : [])];
  const leases: ThemeLease[] = [];
  try {
    for (const resource of resources) {
      try { leases.push({ resource, token: await acquirePluginOperationLease(resource, operation) }); }
      catch (error) { mapped(error); }
    }
    if (slug) await themeTestBarrier('lease', slug);
    // Reject a stale holder before preflight reads; mutations fence again at commit.
    await prisma.$transaction(tx => fenceThemeLeases(tx, leases));
    return await run(leases);
  } finally {
    for (const lease of leases.reverse()) await releasePluginOperationLease(lease.resource, lease.token);
  }
}

export async function fenceThemeLeases(tx: Transaction, leases: ThemeLease[]): Promise<void> {
  for (const lease of leases) {
    try { await fencePluginOperationLease(tx, lease.resource, lease.token); }
    catch (error) { mapped(error); }
  }
}
