import { prisma } from '@/config/database';
import { CoreEvent, EventTypes } from '@jiffoo/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Outbox Service
 * 
 * Implements the Transactional Outbox pattern to ensure reliable event publishing.
 */
export class OutboxService {
    /**
     * Create an outbox event within a Prisma transaction
     * 
     * @param tx Prisma transaction client
     * @param type Event type (from EventTypes)
     * @param aggregateId ID of the related entity
     * @param data Event payload
     * @param metadata Optional metadata
     */
    static async emit(
        tx: any,
        type: string,
        aggregateId: string,
        data: any,
        metadata: { traceId?: string; actorId?: string } = {}
    ) {
        const eventId = uuidv4();
        const occurredAt = Date.now();

        const event: CoreEvent = {
            id: eventId,
            type: type as any,
            aggregateId,
            occurredAt,
            version: 'v1',
            data,
            metadata: {
                ...metadata,
            }
        };

        return tx.outboxEvent.create({
            data: {
                id: eventId,
                type,
                aggregateId,
                payload: event as any,
                version: 'v1',
                occurredAt: new Date(occurredAt),
                traceId: metadata.traceId,
                actorId: metadata.actorId,
                published: false,
            }
        });
    }

    /**
     * Poll unpublished events and return them for publishing
     */
    static async getUnpublishedEvents(limit = 100) {
        return prisma.outboxEvent.findMany({
            where: { published: false },
            orderBy: { occurredAt: 'asc' },
            take: limit,
        });
    }

    /**
     * Mark events as published
     */
    static async markAsPublished(ids: string[]) {
        return prisma.outboxEvent.updateMany({
            where: { id: { in: ids } },
            data: {
                published: true,
                publishedAt: new Date(),
            }
        });
    }

    /**
     * Log failure for an event
     */
    static async markAsFailed(id: string, error: string) {
        return prisma.outboxEvent.update({
            where: { id },
            data: {
                retryCount: { increment: 1 },
                lastError: error,
            }
        });
    }
}
