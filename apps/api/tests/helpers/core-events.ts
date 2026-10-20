import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { EventDeliveryEngine } from '@/infra/events/delivery';
import { CORE_EVENT_TARGET } from '@/infra/events/core-subscribers';

/**
 * Deliver the core domain events that the outbox recorded but has not
 * processed yet. The worker performs this in production; tests drive it
 * explicitly so a core side effect is observable right after the request.
 */
export async function deliverCoreEvents(): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    const engine = new EventDeliveryEngine(`test-core-${randomUUID()}`);
    try {
      await engine.runOnce();
      await engine.drain();
    } finally {
      await engine.stop();
    }
    const pending = await prisma.eventDelivery.count({
      where: { installationId: CORE_EVENT_TARGET, status: { in: ['PENDING', 'RUNNING'] } },
    });
    if (pending === 0) return;
  }
  throw new Error('Core event deliveries did not settle');
}
