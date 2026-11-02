import { prisma } from '@/config/database';
import { lockServiceGraph, serviceGraph } from '@/core/extensions/registry';
import { setTaskDependencyAvailability } from '@/core/plugins/tasks';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * The publication of the derived availability of the plugin registry.
 *
 * The service dependency graph is a projection: it is derived from the
 * installations and their manifests, and it changes whenever one of them
 * changes. The publication writes the derived state onto the installation
 * rows, so the runtime, the task worker and the page routes read one flag
 * instead of rebuilding the graph on every request.
 *
 * The publication runs inside the transaction of the lifecycle change, so the
 * flag it writes describes the state the transaction commits. It holds the
 * graph lock, so two lifecycle decisions never publish two versions of the
 * same graph.
 */
export async function publishServiceAvailability(tx: Transaction): Promise<void> {
  await lockServiceGraph(tx);
  const graph = await serviceGraph(tx);
  const rows = await tx.pluginInstallation.findMany({
    where: { instanceKey: 'default', deletedAt: null },
    select: { id: true, taskDependencyUnavailable: true },
  });
  const published = new Map(rows.map(row => [row.id, row.taskDependencyUnavailable]));
  for (const entry of graph.entries.values()) {
    const current = published.get(entry.installationId);
    if (current === undefined) continue;
    const available = entry.satisfied;
    if (current === !available) continue;
    await setTaskDependencyAvailability(tx, entry.installationId, available);
  }
}
