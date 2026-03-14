import { logger } from '@/core/logger/unified-logger';
import { reconcilePendingPayments, type PaymentReconciliationOptions } from '@/core/payment/reconciliation';

type PaymentReconciliationJobOptions = PaymentReconciliationOptions & {
  intervalMs?: number;
};

/**
 * Payment Reconciliation Job
 *
 * Periodically re-checks pending payment sessions against payment plugins
 * to reconcile provider status with local records.
 */
export class PaymentReconciliationJob {
  private static isRunning = false;
  private static updateInterval: NodeJS.Timeout | null = null;
  private static options: PaymentReconciliationJobOptions = {};

  /**
   * Start the reconciliation cron job
   */
  static start(options: PaymentReconciliationJobOptions = {}) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.options = options;

    const intervalMs = options.intervalMs ?? 600_000;
    logger.info(`Payment reconciliation job started (every ${Math.round(intervalMs / 1000)}s)`);

    this.reconcileNow();

    this.updateInterval = setInterval(async () => {
      await this.reconcileNow();
    }, intervalMs);
  }

  /**
   * Stop the reconciliation job
   */
  static stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    logger.info('Payment reconciliation job stopped');
  }

  /**
   * Run reconciliation once
   */
  static async reconcileNow(): Promise<void> {
    const startTime = Date.now();
    try {
      const { limit, maxAgeMinutes, minAgeMinutes } = this.options;
      const { scanned, updated, failed } = await reconcilePendingPayments({
        limit,
        maxAgeMinutes,
        minAgeMinutes,
      });
      const duration = Date.now() - startTime;
      logger.info('Payment reconciliation completed', {
        scanned,
        updated,
        failed,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Payment reconciliation failed', { error });
    }
  }

  /**
   * Job status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      hasScheduledUpdates: this.updateInterval !== null,
      options: this.options,
    };
  }
}
