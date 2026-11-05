import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { hostCapabilityAdapters } from '@/core/extensions/host-capabilities/service';
import { sharedProtection } from '@/infra/shared-protection';

export const CUSTOMER_READ_PERMISSION = 'customers:read';
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

export type CustomerReadRequest = { ids: string[] } | { query: string; afterId?: string; limit?: number };

/** Installation permission plus a live administrator; this is not per-action user RBAC. */
export async function readPluginCustomers(installationId: string, request: CustomerReadRequest) {
  const adapters = hostCapabilityAdapters();
  const assertTaskOperation = adapters.assertOperation;
  const requireTaskPrincipal = adapters.principal;
  const validateTaskPrincipal = adapters.validatePrincipal;
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new ApiError('VALIDATION_ERROR');
  const lookup = 'ids' in request;
  let input: { ids?: string[]; query?: string; afterId?: string; limit: number };
  if (lookup) {
    if (Object.keys(request).some(key => key !== 'ids') || !Array.isArray(request.ids) || !request.ids.length || request.ids.length > 100 || !request.ids.every(validId)) throw new ApiError('VALIDATION_ERROR');
    input = { ids: [...new Set(request.ids)], limit: 100 };
  } else {
    if (Object.keys(request).some(key => !['query', 'afterId', 'limit'].includes(key)) || typeof request.query !== 'string' || request.query.trim().length < 2 || request.query.length > 128 || request.afterId !== undefined && !validId(request.afterId) || request.limit !== undefined && (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 50)) throw new ApiError('VALIDATION_ERROR');
    input = { query: request.query.trim(), afterId: request.afterId, limit: (request.limit ?? 25) + 1 };
  }
  const admittedPrincipal = await prisma.$transaction(async tx => {
    await assertTaskOperation(tx, installationId);
    const principal = await requireTaskPrincipal(tx, installationId);
    if (principal.type !== 'admin') throw new ApiError('FORBIDDEN');
    await validateTaskPrincipal(tx, installationId, principal);
    return principal;
  }, { timeout: 5000 });
  for (const key of [`plugin:customers:${installationId}`, `plugin:customers:${installationId}:${admittedPrincipal.id}`]) {
    if (!(await sharedProtection.rate(key, 60_000, 30)).allowed) throw new ApiError('RATE_LIMITED');
  }
  return prisma.$transaction(async tx => {
    await assertTaskOperation(tx, installationId);
    const principal = await requireTaskPrincipal(tx, installationId);
    if (principal.type !== 'admin') throw new ApiError('FORBIDDEN');
    await validateTaskPrincipal(tx, installationId, principal);
    const installation = await tx.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    const permissions = installation.grantedPermissions;
    if (!Array.isArray(permissions) || !permissions.includes(CUSTOMER_READ_PERMISSION)) throw new ApiError('FORBIDDEN');
    const rows = await adapters.customers(tx, input);
    const limit = lookup ? 100 : ('limit' in request ? request.limit : undefined) ?? 25;
    const items = rows.slice(0, limit).map(row => ({ id: row.id, displayName: row.username, email: row.email, accountPath: `/customers/${encodeURIComponent(row.id)}` }));
    await adapters.audit(tx, { actorId: principal.id, action: 'plugin.customers.read', targetType: 'plugin-installation', targetId: installationId, summary: { mode: lookup ? 'lookup' : 'search', count: items.length } });
    await assertTaskOperation(tx, installationId);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
  }, { timeout: 5000 });
}
