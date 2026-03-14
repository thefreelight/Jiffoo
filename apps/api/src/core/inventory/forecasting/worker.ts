// @ts-nocheck
import Queue from 'bull';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import { logger } from '@/core/logger/unified-logger';
import { ForecastingService } from './service';

const prismaDb = prisma as any;

/**
 * Inventory Forecasting Worker
 *
 * Scheduled background job that runs daily to:
 * 1. Generate demand forecasts for all active products
 * 2. Create reorder alerts based on stock levels
 * 3. Track forecasting accuracy
 */
export class ForecastingWorker {
    private static queue: Queue.Queue | null = null;
    private static isRunning = false;

    /**
     * Initialize the forecasting worker and set up scheduled jobs
     */
    static async start() {
        if (this.isRunning) {
            logger.warn('Forecasting worker is already running');
            return;
        }

        try {
            // Initialize Bull queue with Redis connection
            this.queue = new Queue('inventory-forecasting', env.REDIS_URL, {
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            });

            // Set up job processor
            this.queue.process('inventory-forecasting-daily', async (job) => {
                const jobContext = {
                    requestId: job.data._requestId || `job-${job.id}`,
                    jobId: job.id,
                    jobName: job.name,
                };
                const jobLogger = {
                    info: (message: string, meta?: Record<string, unknown>) => logger.info(message, { ...jobContext, ...meta }),
                    warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, { ...jobContext, ...meta }),
                    error: (message: string, meta?: Record<string, unknown>) => logger.error(message, { ...jobContext, ...meta }),
                    debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, { ...jobContext, ...meta }),
                };

                jobLogger.info('Starting daily inventory forecasting job');

                try {
                    await this.processForecasting(jobLogger);
                    jobLogger.info('Daily inventory forecasting job completed successfully');
                } catch (error) {
                    jobLogger.error('Daily inventory forecasting job failed', { error });
                    throw error;
                }
            });

            // Schedule daily job to run at 2 AM
            await this.queue.add('inventory-forecasting-daily', {}, {
                repeat: {
                    cron: '0 2 * * *', // Daily at 2:00 AM
                },
            });

            this.isRunning = true;
            logger.info('Forecasting worker started successfully. Scheduled to run daily at 2:00 AM');
        } catch (error) {
            logger.error('Failed to start forecasting worker', { error });
            throw error;
        }
    }

    /**
     * Stop the forecasting worker and close queue connections
     */
    static async stop() {
        if (!this.isRunning || !this.queue) {
            logger.warn('Forecasting worker is not running');
            return;
        }

        try {
            await this.queue.close();
            this.queue = null;
            this.isRunning = false;
            logger.info('Forecasting worker stopped successfully');
        } catch (error) {
            logger.error('Error stopping forecasting worker', { error });
            throw error;
        }
    }

    /**
     * Process forecasting for all active products
     *
     * @param jobLogger - Logger instance with job context
     */
    private static async processForecasting(jobLogger: {
        info: (message: string, meta?: Record<string, unknown>) => void;
        warn: (message: string, meta?: Record<string, unknown>) => void;
        error: (message: string, meta?: Record<string, unknown>) => void;
        debug: (message: string, meta?: Record<string, unknown>) => void;
    }) {
        try {
            // Fetch all active products with their variants
            const products = await prismaDb.product.findMany({
                where: {
                    variants: {
                        some: {
                            isActive: true,
                        }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    variants: {
                        where: {
                            isActive: true,
                        },
                        select: {
                            id: true,
                            skuCode: true,
                        },
                    },
                },
            });

            if (products.length === 0) {
                jobLogger.info('No active products found for forecasting');
                return;
            }

            jobLogger.info(`Processing forecasts for ${products.length} products`);

            let successCount = 0;
            let errorCount = 0;

            // Process each product
            for (const product of products) {
                try {
                    jobLogger.debug(`Processing product: ${product.name} (${product.id})`);

                    // Process individual SKUs
                    if (product.variants.length > 0) {
                        for (const variant of product.variants) {
                            try {
                                await ForecastingService.generateForecast(
                                    product.id,
                                    variant.id,
                                    30,
                                    90
                                );

                                await ForecastingService.checkAndCreateAlerts(
                                    product.id,
                                    variant.id
                                );
                            } catch (variantError) {
                                jobLogger.error(`Error processing variant ${variant.skuCode || variant.id}`, {
                                    productId: product.id,
                                    variantId: variant.id,
                                    error: variantError,
                                });
                                errorCount++;
                            }
                        }
                    }

                    successCount++;
                } catch (productError) {
                    jobLogger.error(`Error processing product ${product.name}`, {
                        productId: product.id,
                        error: productError,
                    });
                    errorCount++;
                }
            }

            jobLogger.info('Forecasting job completed', {
                totalProducts: products.length,
                successCount,
                errorCount,
            });
        } catch (error) {
            jobLogger.error('Fatal error in processForecasting', { error });
            throw error;
        }
    }

    /**
     * Manually trigger forecasting job (for testing or admin-triggered forecasts)
     *
     * @returns Job instance
     */
    static async triggerManualForecast() {
        if (!this.queue) {
            throw new Error('Forecasting worker is not running. Call start() first.');
        }

        logger.info('Manually triggering inventory forecasting job');

        return this.queue.add('inventory-forecasting-daily', {
            _requestId: `manual-${Date.now()}`,
        }, {
            priority: 1, // Higher priority for manual triggers
        });
    }

    /**
     * Get queue instance (for monitoring/debugging)
     */
    static getQueue(): Queue.Queue | null {
        return this.queue;
    }
}
