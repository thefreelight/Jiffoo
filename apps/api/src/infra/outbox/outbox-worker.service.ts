import { prisma } from '@/config/database';
import { OutboxService } from './outbox.service';
import { logger } from '@/core/logger/unified-logger';

/**
 * Outbox Worker Service
 * 
 * Periodically polls the OutboxEvent table and dispatches events.
 */
export class OutboxWorkerService {
    private static isRunning = false;
    private static pollInterval: NodeJS.Timeout | null = null;

    /**
     * Start the outbox worker
     */
    static start(intervalMs = 5000) {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info(`Outbox Worker started (polling every ${intervalMs}ms)`);

        this.pollInterval = setInterval(async () => {
            await this.processOutbox();
        }, intervalMs);
    }

    /**
     * Stop the outbox worker
     */
    static stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isRunning = false;
        logger.info('Outbox Worker stopped');
    }

    /**
     * Process a batch of outbox events
     */
    private static async processOutbox() {
        try {
            const events = await OutboxService.getUnpublishedEvents(50);
            if (events.length === 0) return;

            logger.info(`Processing ${events.length} outbox events...`);

            const publishedIds: string[] = [];

            for (const event of events) {
                try {
                    // --- Dispatch logic ---
                    await this.dispatch(event.payload as any);

                    publishedIds.push(event.id);
                } catch (error) {
                    logger.error(`Failed to dispatch event ${event.id}:`, error);
                    await OutboxService.markAsFailed(event.id, String(error));
                }
            }

            if (publishedIds.length > 0) {
                await OutboxService.markAsPublished(publishedIds);
                logger.info(`Successfully published ${publishedIds.length} events`);
            }
        } catch (error) {
            logger.error('Outbox worker encountered an error:', error);
        }
    }

    /**
     * Dispatch event to the external bus
     * 
     * @param event The full event payload
     */
    private static async dispatch(event: any) {
        // Dispatch logic (e.g., log, queue, webhook)
        logger.debug(`Dispatching event: ${event.type}`, { aggregateId: event.aggregateId });
    }
}
