import type { TaskPrincipal } from '@jiffoo/shared';
import type { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { hostCapabilityAdapters } from '@/core/extensions/host-capabilities/service';

type TaskTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const BUILTIN_PLUGIN_ADMIN_ACTIONS = ['storage.publish', 'storage.delete'] as const;
export const validPluginAction = (action: unknown): action is string => typeof action === 'string' && action.length <= 96 && /^[a-z][a-z0-9]*(?:[.-][a-z][a-z0-9]*){0,7}$/.test(action);

async function activeAdmin(tx: TaskTransaction, id: string) {
  await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${id} FOR SHARE`;
  const user = await tx.user.findUnique({ where: { id }, select: { role: true, isActive: true, removedAt: true } });
  if (!user?.isActive || user.removedAt || user.role !== 'ADMIN') throw new ApiError('FORBIDDEN');
}

async function declaredAction(tx: TaskTransaction, installationId: string, action: string) {
  if (!validPluginAction(action)) throw new ApiError('VALIDATION_ERROR');
  await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${installationId} FOR SHARE`;
  const installation = await tx.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
  if (!installation?.enabled || installation.deletedAt || installation.plugin.deletedAt) throw new ApiError('FORBIDDEN');
  const manifest = installation.plugin.manifestJson as Record<string, unknown>;
  if (!(BUILTIN_PLUGIN_ADMIN_ACTIONS as readonly string[]).includes(action) && (!Array.isArray(manifest.adminActions) || !manifest.adminActions.includes(action))) throw new ApiError('FORBIDDEN');
  if (!Array.isArray(installation.grantedPermissions) || !installation.grantedPermissions.includes(`actions:${action}`)) throw new ApiError('FORBIDDEN');
}

/** Core callers supply the trusted scope principal, never a plugin request body. */
export async function requirePluginAction(tx: TaskTransaction, installationId: string, principal: TaskPrincipal | null, action: string): Promise<void> {
  if (principal?.type !== 'admin') throw new ApiError('FORBIDDEN');
  await activeAdmin(tx, principal.id);
  await declaredAction(tx, installationId, action);
  await tx.$queryRaw`SELECT "principalId" FROM public.plugin_action_grants WHERE "installationId" = ${installationId} AND "principalId" = ${principal.id} AND action = ${action} FOR SHARE`;
  if (!await tx.pluginActionGrant.findUnique({ where: { installationId_principalId_action: { installationId, principalId: principal.id, action } } })) throw new ApiError('FORBIDDEN');
}

/** Policy administration is distinct from administrator business authority. */
export async function requirePluginPolicyAuthority(tx: TaskTransaction, actorId: string): Promise<void> {
  await activeAdmin(tx, actorId);
  await tx.$queryRaw`SELECT "principalId" FROM public.plugin_policy_authorities WHERE "principalId" = ${actorId} FOR SHARE`;
  if (!await tx.pluginPolicyAuthority.findUnique({ where: { principalId: actorId } })) throw new ApiError('FORBIDDEN');
}

export async function setPluginActionGrant(tx: TaskTransaction, actorId: string, input: { installationId: string; principalId: string; action: string; granted: boolean }) {
  await requirePluginPolicyAuthority(tx, actorId);
  if (!validPluginAction(input.action)) throw new ApiError('VALIDATION_ERROR');
  if (input.granted) {
    await activeAdmin(tx, input.principalId);
    await declaredAction(tx, input.installationId, input.action);
  }
  const key = { installationId: input.installationId, principalId: input.principalId, action: input.action };
  if (input.granted) await tx.pluginActionGrant.upsert({ where: { installationId_principalId_action: key }, create: { ...key, grantedBy: actorId }, update: {} });
  else await tx.pluginActionGrant.deleteMany({ where: key });
  await hostCapabilityAdapters().audit(tx, { actorId, action: input.granted ? 'plugin.action.granted' : 'plugin.action.revoked', targetType: 'plugin-installation', targetId: input.installationId, summary: { principalId: input.principalId, action: input.action } });
  return { ...key, granted: input.granted };
}
