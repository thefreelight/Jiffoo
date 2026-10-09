import { z } from 'zod';
import { redisCache } from '@/core/cache/redis';
import { winstonLogger } from '@/core/logger/unified-logger';

export const WORKER_HEARTBEAT_PREFIX = 'worker:heartbeat:';
export const WORKER_HEARTBEAT_TTL_SECONDS = 30;
export const WORKER_HEARTBEAT_INTERVAL_MS = 10_000;
export const WORKER_TASKS = ['eventDelivery', 'eventCleanup', 'notifications', 'unpaidOrders', 'paymentReconciliation', 'pluginRecovery'] as const;

export const workerHeartbeatSchema = z.object({
  instanceId: z.string().uuid(),
  hostname: z.string().min(1),
  pid: z.number().int().positive(),
  startedAt: z.string().datetime(),
  lastBeatAt: z.string().datetime(),
});
export type WorkerHeartbeat = z.infer<typeof workerHeartbeatSchema>;
export interface WorkerHealthSummary {
  running: boolean;
  instances: number;
  lastBeatAt: string | null;
}

export async function getWorkerHealthSummary(): Promise<WorkerHealthSummary> {
  const empty = { running: false, instances: 0, lastBeatAt: null };
  const client = redisCache.getRawClient();
  if (!redisCache.getConnectionStatus() || client.status !== 'ready') return empty;
  try {
    let cursor = '0';
    const instances = new Map<string, WorkerHeartbeat>();
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', `${WORKER_HEARTBEAT_PREFIX}*`, 'COUNT', 200);
      cursor = next;
      if (!keys.length) continue;
      const values = await client.mget(...keys);
      values.forEach((value, index) => {
        if (!value) return;
        try {
          const parsed = workerHeartbeatSchema.safeParse(JSON.parse(value));
          if (parsed.success && keys[index] === `${WORKER_HEARTBEAT_PREFIX}${parsed.data.instanceId}`) {
            instances.set(parsed.data.instanceId, parsed.data);
          }
        } catch {
          // Ignore malformed values and keys that expired during the scan.
        }
      });
    } while (cursor !== '0');
    return {
      running: instances.size > 0,
      instances: instances.size,
      lastBeatAt: [...instances.values()].map((instance) => instance.lastBeatAt).sort().at(-1) ?? null,
    };
  } catch (error) {
    winstonLogger.error('Worker heartbeat scan failed', {
      component: 'WorkerHealth', error: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }
}
