import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from '@/config/database';
import { validateDatabaseUrl } from '@/config/test-lane';
import { PluginTaskWorker } from './task-worker';
import { taskDatabaseTime } from './tasks';

type Options = { installationIds: string[]; deadlineMs: number; includeFinalFailure: true; advanceDueTo?: string };
export function attachPluginTaskDrain(): () => void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Task drain attachment is test-only');
  (globalThis as Record<symbol, unknown>)[Symbol.for('jiffoo.pluginTasks.drain')] = drainPluginTasks;
  return () => { delete (globalThis as Record<symbol, unknown>)[Symbol.for('jiffoo.pluginTasks.drain')]; };
}
export async function drainPluginTasks(options: Options) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Task drain is test-only');
  validateDatabaseUrl(process.env.DATABASE_URL!);
  if (!Array.isArray(options.installationIds) || !options.installationIds.length || options.installationIds.length > 100 || options.installationIds.some(id => typeof id !== 'string' || !id || id.length > 128) || !Number.isInteger(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 600_000 || options.includeFinalFailure !== true) throw new Error('Invalid task drain selection or deadline');
  const ids = (await prisma.pluginTask.findMany({ where: { installationId: { in: options.installationIds } }, select: { id: true } })).map(row => row.id);
  if (options.advanceDueTo !== undefined) {
    const instant = new Date(options.advanceDueTo);
    if (!Number.isFinite(instant.getTime())) throw new Error('Invalid test task clock');
    // Only this captured selection is advanced; newly enqueued/foreign work is untouched.
    const now = await prisma.$transaction(taskDatabaseTime);
    await prisma.pluginTask.updateMany({ where: { id: { in: ids }, status: 'PENDING', nextAttemptAt: { lte: instant } }, data: { nextAttemptAt: now } });
  }
  const worker = new PluginTaskWorker({ installationIds: options.installationIds });
  const deadline = performance.now() + options.deadlineMs;
  try {
    while (performance.now() < deadline) {
      await worker.tick();
      const now = await prisma.$transaction(taskDatabaseTime);
      const work = await prisma.pluginTask.count({ where: { installationId: { in: options.installationIds }, OR: [{ status: 'RUNNING' }, { status: 'PENDING', nextAttemptAt: { lte: now }, installation: { enabled: true, taskDependencyUnavailable: false } }] } });
      const hooks = await prisma.pluginTaskFinalFailure.count({ where: { status: { in: ['PENDING', 'RUNNING'] }, task: { installationId: { in: options.installationIds }, installation: { enabled: true, taskDependencyUnavailable: false } } } });
      if (!work && !hooks && !worker.unsettled().length) break;
      await delay(Math.min(10, Math.max(1, deadline - performance.now())));
    }
  } finally { worker.stopClaiming(); }
  if (worker.unsettled().length) {
    // Keep lease renewal/occupancy alive while the actual invocation drains.
    void worker.drain();
    throw new Error('Task drain deadline exceeded with unsettled invocations');
  }
  await worker.drain();
  const now = await prisma.$transaction(taskDatabaseTime);
  const tasks = await prisma.pluginTask.findMany({ where: { installationId: { in: options.installationIds } } });
  return { completed: tasks.filter(t => t.status === 'SUCCEEDED').length, failed: tasks.filter(t => t.status === 'FAILED').length, cancelled: tasks.filter(t => t.status === 'CANCELLED').length, pending: tasks.filter(t => t.status === 'PENDING' && t.nextAttemptAt <= now).length, future: tasks.filter(t => t.status === 'PENDING' && t.nextAttemptAt > now).length, unknownHooks: await prisma.pluginTaskFinalFailure.count({ where: { status: 'UNKNOWN', task: { installationId: { in: options.installationIds } } } }) };
}
