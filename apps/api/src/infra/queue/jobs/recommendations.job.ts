import { Job } from 'bull';
import { RecommendationService } from '@/core/recommendations/service';
import { QueueService } from '../queue.service';
import winston from 'winston';

/**
 * Recommendation Data Processing Job
 *
 * Periodically computes product affinities from order history to power
 * collaborative filtering recommendations. Should run daily or on-demand.
 *
 * Job Data:
 * - minCoOccurrences (optional): Minimum number of co-occurrences to consider (default: 2)
 * - batchSize (optional): Number of products to process per batch (default: 100)
 */

export const RECOMMENDATIONS_JOB_NAME = 'compute-recommendations-affinities';

/**
 * Job processor for computing recommendation affinities
 */
export async function processRecommendationsJob(
  job: Job,
  queueService: QueueService
): Promise<void> {
  await queueService.processJob(job, async (job: Job, logger: winston.Logger) => {
    const { minCoOccurrences, batchSize } = job.data;

    logger.info('Starting recommendation affinity computation', {
      minCoOccurrences,
      batchSize,
    });

    try {
      // Compute product affinities from order history
      const result = await RecommendationService.computeAffinities({
        minCoOccurrences,
        batchSize,
      });

      logger.info('Recommendation affinity computation completed', {
        processed: result.processed,
        created: result.created,
        updated: result.updated,
      });
    } catch (error) {
      logger.error('Failed to compute recommendation affinities', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

/**
 * Register the recommendations job with the queue
 */
export function registerRecommendationsJob(
  queueService: QueueService,
  queue: any
): void {
  queue.process(RECOMMENDATIONS_JOB_NAME, async (job: Job) => {
    await processRecommendationsJob(job, queueService);
  });
}

/**
 * Schedule recommendations job to run daily at 2 AM
 */
export async function scheduleRecommendationsJob(
  queueService: QueueService
): Promise<void> {
  // Schedule daily at 2 AM (cron: '0 2 * * *')
  await queueService.addJob(
    RECOMMENDATIONS_JOB_NAME,
    {
      minCoOccurrences: 2,
      batchSize: 100,
    },
    undefined
  );
}
