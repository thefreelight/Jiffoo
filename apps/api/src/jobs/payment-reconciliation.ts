import { logger } from '@/core/logger/unified-logger';
import { reconcilePendingPayments, type PaymentReconciliationOptions, type PaymentReconciliationResult } from '@/core/payment/reconciliation';

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
  private static pending = new Set<Promise<void>>();

  static async drain(): Promise<void> {
    await Promise.all(this.pending);
  }

  private static run(): void {
    const operation = this.reconcileNow().then(() => undefined);
    this.pending.add(operation);
    void operation.finally(() => this.pending.delete(operation));
  }

  /**
   * Start the reconciliation cron job
   */
  static start(options: PaymentReconciliationJobOptions = {}) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.options = options;

    const intervalMs = options.intervalMs ?? 600_000;
    logger.info(`Payment reconciliation job started (every ${Math.round(intervalMs / 1000)}s)`);

    this.run();

    this.updateInterval = setInterval(() => {
      this.run();
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
  static async reconcileNow(): Promise<PaymentReconciliationResult | undefined> {
    const startTime = Date.now();
    try {
      const { limit, maxAgeMinutes, minAgeMinutes } = this.options;
      const { scanned, updated, failed, skipped } = await reconcilePendingPayments({
        limit,
        maxAgeMinutes,
        minAgeMinutes,
      });
      const duration = Date.now() - startTime;
      logger.info('Payment reconciliation completed', {
        scanned,
        updated,
        failed,
        skipped,
        durationMs: duration,
      });
      return { scanned, updated, failed, skipped };
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
      inFlight: this.pending.size,
      hasScheduledUpdates: this.updateInterval !== null,
      options: this.options,
    };
  }
}
