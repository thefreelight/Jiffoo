import type { Prisma } from '@prisma/client';
import type { prisma } from '@/config/database';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function writePluginAudit(
  tx: Transaction,
  actorId: string,
  action: string,
  slug: string,
  summary: Prisma.InputJsonObject,
) {
  let id: string | undefined;
  if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_LEASE_BARRIER === 'audit' && process.send) {
    process.send({ kind: 'plugin-audit-ready', action });
    id = await new Promise<string | undefined>((resolve) => {
      const receive = (message: unknown) => {
        const value = message as { kind?: string; eventId?: string };
        if (value.kind !== 'plugin-audit-release') return;
        process.off('message', receive);
        resolve(value.eventId);
      };
      process.on('message', receive);
    });
  }
  await tx.adminAuditEvent.create({
    data: { ...(id ? { id } : {}), actorId, action, targetType: 'plugin', targetId: slug, summary },
  });
}
