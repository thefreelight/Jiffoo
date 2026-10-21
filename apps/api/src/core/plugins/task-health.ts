import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';

export async function pluginTaskHealth() {
  const [queue, slots, hooks, failures, finalFailures] = await Promise.all([
    prisma.$queryRaw<Array<{ queued: bigint; running: bigint; oldestAgeSeconds: number }>>`SELECT count(*) FILTER (WHERE status='PENDING') AS queued, count(*) FILTER (WHERE status='RUNNING') AS running, coalesce(max(extract(epoch FROM clock_timestamp()-"nextAttemptAt")) FILTER (WHERE status='PENDING' AND "nextAttemptAt" <= clock_timestamp()),0)::double precision AS "oldestAgeSeconds" FROM public.plugin_tasks`,
    prisma.pluginTaskExecutionSlot.groupBy({ by: ['installationId', 'state'], where: { state: { in: ['ACTIVE', 'LINGERING'] } }, _count: true }),
    prisma.pluginTaskFinalFailure.groupBy({ by: ['status'], _count: true }),
    prisma.pluginTask.findMany({ where: { lastError: { not: Prisma.DbNull } }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, installationId: true, lastError: true } }),
    prisma.pluginTaskFinalFailure.findMany({where:{status:{in:['FAILED','UNKNOWN']}},orderBy:{updatedAt:'desc'},take:50,select:{taskId:true,status:true,safeError:true,task:{select:{installationId:true}}}}),
  ]);
  return { queued: Number(queue[0].queued), running: Number(queue[0].running), oldestAgeSeconds: queue[0].oldestAgeSeconds, occupiedSlots: slots.map(s => ({ installationId: s.installationId, state: s.state, count: s._count })), finalFailureOutcomes: hooks.map(h => ({ status: h.status, count: h._count })), failures: failures.map(t => ({ taskId: t.id, installationId: t.installationId, error: t.lastError })), finalFailures:finalFailures.map(h=>({taskId:h.taskId,installationId:h.task.installationId,status:h.status,error:h.safeError})) };
}
