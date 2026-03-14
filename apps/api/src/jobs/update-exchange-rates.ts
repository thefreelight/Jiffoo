import { CurrencyService } from '@/core/currency/service';
import { logger } from '@/core/logger/unified-logger';

/**
 * Exchange Rate Update Job (Cron Job)
 *
 * Periodically updates exchange rates from external API.
 * Runs as a background job to keep currency conversion rates current.
 */
export class ExchangeRateUpdateJob {
    private static isRunning = false;
    private static updateInterval: NodeJS.Timeout | null = null;
    private static currencyService = new CurrencyService();

    /**
     * Start the exchange rate update cron job
     *
     * @param intervalMs Update interval in milliseconds (default: 6 hours = 21600000ms)
     */
    static start(intervalMs = 21600000) {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info(`Exchange Rate Update Job started (cron schedule: every ${intervalMs / 1000 / 60 / 60} hours)`);

        // Run immediately on start
        this.updateRates();

        // Schedule periodic updates
        this.updateInterval = setInterval(async () => {
            await this.updateRates();
        }, intervalMs);
    }

    /**
     * Stop the exchange rate update job
     */
    static stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.isRunning = false;
        logger.info('Exchange Rate Update Job stopped');
    }

    /**
     * Update exchange rates from external API
     *
     * Fetches latest rates and stores them in the database.
     * Handles errors gracefully to prevent job crashes.
     */
    private static async updateRates() {
        try {
            logger.info('Starting exchange rate update...');

            const startTime = Date.now();
            const updatedCount = await this.currencyService.updateExchangeRates('USD');
            const duration = Date.now() - startTime;

            logger.info(`Successfully updated ${updatedCount} exchange rates (duration: ${duration}ms)`);

            // Log performance metric
            (logger as any).logPerformance?.('exchange_rate_update', duration, {
                updatedCount,
                baseCurrency: 'USD'
            });
        } catch (error) {
            logger.error('Failed to update exchange rates:', error);

            // Log the error but don't crash the job
            if (error instanceof Error) {
                (logger as any).logError?.(error, {
                    job: 'exchange_rate_update',
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Get job status
     */
    static getStatus() {
        return {
            isRunning: this.isRunning,
            hasScheduledUpdates: this.updateInterval !== null
        };
    }

    /**
     * Manually trigger an exchange rate update
     *
     * Useful for testing or manual refresh via admin interface.
     */
    static async triggerUpdate(): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
        try {
            logger.info('Manual exchange rate update triggered');
            const updatedCount = await this.currencyService.updateExchangeRates('USD');
            return { success: true, updatedCount };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Manual exchange rate update failed:', error);
            return { success: false, error: errorMessage };
        }
    }
}
