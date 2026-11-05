import type { Prisma, PrismaClient } from '@prisma/client';

type BootstrapAudit = (tx: Prisma.TransactionClient, event: { actorId: string; action: string; targetType: string; targetId: string; summary: Prisma.InputJsonObject }) => Promise<unknown>;

/** Explicit operator entry; the caller must finish migration and schema preflight first. */
export async function bootstrapPluginPolicyAuthority(client: PrismaClient, input: { databaseUrl: string; expectedDatabase: string; principalId: string; apply?: boolean }, audit: BootstrapAudit) {
  const url = new URL(input.databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !input.expectedDatabase || decodeURIComponent(url.pathname.slice(1)) !== input.expectedDatabase) throw new Error('Database URL does not match the explicitly expected database');
  const database = await client.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (database[0]?.name !== input.expectedDatabase) throw new Error('Connected database does not match the explicitly expected database');
  return client.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('plugin-policy-bootstrap'))`;
    await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${input.principalId} FOR SHARE`;
    const user = await tx.user.findUnique({ where: { id: input.principalId } });
    if (!user?.isActive || user.removedAt || user.role !== 'ADMIN') throw new Error('Policy bootstrap requires an active administrator');
    const existing = await tx.pluginPolicyAuthority.findUnique({ where: { principalId: input.principalId } });
    const count = await tx.pluginPolicyAuthority.count();
    if (count && !existing) throw new Error('A policy authority already exists; additional bootstrap is forbidden');
    if (!input.apply) return { applied: false, alreadyExists: !!existing, principalId: input.principalId, database: database[0].name };
    await tx.pluginPolicyAuthority.upsert({ where: { principalId: input.principalId }, create: { principalId: input.principalId }, update: {} });
    await audit(tx, { actorId: input.principalId, action: 'plugin.policy.bootstrapped', targetType: 'admin', targetId: input.principalId, summary: { alreadyExists: !!existing } });
    return { applied: true, alreadyExists: !!existing, principalId: input.principalId, database: database[0].name };
  }, { timeout: 5000 });
}
