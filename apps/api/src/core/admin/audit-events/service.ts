import type { Prisma } from '@prisma/client';
import type { prisma } from '@/config/database';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Public transactional audit writer; summaries must exclude credentials and contents. */
export class AdminAuditService {
  static record(tx: Transaction, event: { actorId: string; action: string; targetType: string; targetId: string; summary: Prisma.InputJsonObject }) {
    return tx.adminAuditEvent.create({ data: event });
  }
}
