import { BackupMonitor } from '@/infra/backup';
import { logger } from '@/core/logger/unified-logger';

type BackupHealthJobOptions = {
  intervalMs?: number;
};

/**
 * Backup Health Job
 *
 * Periodically checks backup freshness and integrity.
 * Sends alerts via BackupMonitor when configured.
 */
export class BackupHealthJob {
  private static isRunning = false;
  private static updateInterval: NodeJS.Timeout | null = null;
  private static monitor = new BackupMonitor();

  static start(options: BackupHealthJobOptions = {}) {
    if (this.isRunning) return;
    this.isRunning = true;

    const intervalMs = options.intervalMs ?? 86_400_000; // 24 hours
    logger.info(`Backup health job started (every ${Math.round(intervalMs / 1000)}s)`);

    this.runOnce();

    this.updateInterval = setInterval(async () => {
      await this.runOnce();
    }, intervalMs);
  }

  static stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    logger.info('Backup health job stopped');
  }

  static async runOnce(): Promise<void> {
    const startTime = Date.now();
    try {
      const result = await this.monitor.runHealthChecks();
      logger.info('Backup health check completed', {
        ...result,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error('Backup health check failed', { error });
    }
  }

  static getStatus() {
    return {
      isRunning: this.isRunning,
      hasScheduledUpdates: this.updateInterval !== null,
    };
  }
}
