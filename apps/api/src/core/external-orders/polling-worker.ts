import { logger } from '@/core/logger/unified-logger';
import { ExternalOrderService } from './service';

type ExternalOrderPollingWorkerOptions = {
  activeIntervalMs?: number;
  idleIntervalMs?: number;
  idleThreshold?: number;
  limit?: number;
};

export class ExternalOrderPollingWorker {
  private static isRunning = false;
  private static timer: ReturnType<typeof setTimeout> | null = null;
  private static isTicking = false;
  private static wakeRequested = false;
  private static activeIntervalMs = 30_000;
  private static idleIntervalMs = 180_000;
  private static idleThreshold = 3;
  private static pollLimit = 50;
  private static emptyRounds = 0;
  private static isInIdleMode = false;

  static start(optionsOrInterval: ExternalOrderPollingWorkerOptions | number = 30_000): void {
    if (this.isRunning) return;

    if (typeof optionsOrInterval === 'number') {
      this.activeIntervalMs = optionsOrInterval > 0 ? optionsOrInterval : 30_000;
      this.idleIntervalMs = Math.max(this.activeIntervalMs * 6, this.activeIntervalMs);
      this.idleThreshold = 3;
      this.pollLimit = 50;
    } else {
      const activeInterval = Number(optionsOrInterval.activeIntervalMs);
      const idleInterval = Number(optionsOrInterval.idleIntervalMs);
      const idleThreshold = Number(optionsOrInterval.idleThreshold);
      const pollLimit = Number(optionsOrInterval.limit);

      this.activeIntervalMs = Number.isFinite(activeInterval) && activeInterval > 0 ? activeInterval : 30_000;
      this.idleIntervalMs =
        Number.isFinite(idleInterval) && idleInterval > 0 ? Math.max(idleInterval, this.activeIntervalMs) : Math.max(this.activeIntervalMs * 6, this.activeIntervalMs);
      this.idleThreshold = Number.isInteger(idleThreshold) && idleThreshold > 0 ? idleThreshold : 3;
      this.pollLimit = Number.isInteger(pollLimit) && pollLimit > 0 ? pollLimit : 50;
    }

    this.isRunning = true;
    this.emptyRounds = 0;
    this.isInIdleMode = false;

    logger.info('External order polling worker started', {
      activeIntervalMs: this.activeIntervalMs,
      idleIntervalMs: this.idleIntervalMs,
      idleThreshold: this.idleThreshold,
      pollLimit: this.pollLimit,
    });
    this.scheduleNext(0);
  }

  static stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.isRunning) {
      logger.info('External order polling worker stopped');
    }
    this.isRunning = false;
    this.isTicking = false;
    this.wakeRequested = false;
    this.emptyRounds = 0;
    this.isInIdleMode = false;
  }

  static wake(reason = 'external-order-update'): void {
    if (!this.isRunning) return;
    this.emptyRounds = 0;

    if (this.isTicking) {
      this.wakeRequested = true;
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.isInIdleMode) {
      this.isInIdleMode = false;
      logger.debug('External order polling worker resumed active mode', { reason });
    }

    this.scheduleNext(0);
  }

  private static scheduleNext(delayMs: number): void {
    if (!this.isRunning) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.timer = setTimeout(() => {
      void this.tick();
    }, Math.max(0, delayMs));
  }

  private static async tick(): Promise<void> {
    if (!this.isRunning || this.isTicking) return;
    this.isTicking = true;

    let nextDelay = this.activeIntervalMs;

    try {
      const result = await ExternalOrderService.pollExternalOrderLinks({ limit: this.pollLimit });
      if (result.pending === 0) {
        this.emptyRounds += 1;
      } else {
        this.emptyRounds = 0;
      }

      const shouldUseIdleMode = this.emptyRounds >= this.idleThreshold;
      if (result.pending > 0 && result.processed === 0 && result.suggestedDelayMs > 0) {
        nextDelay = Math.min(this.idleIntervalMs, Math.max(this.activeIntervalMs, result.suggestedDelayMs));
      } else {
        nextDelay = shouldUseIdleMode ? this.idleIntervalMs : this.activeIntervalMs;
      }

      if (result.processed > 0) {
        logger.info('External order polling processed links', {
          pending: result.pending,
          processed: result.processed,
          throttled: result.throttled,
        });
      }

      if (shouldUseIdleMode && !this.isInIdleMode) {
        this.isInIdleMode = true;
        logger.debug('External order polling worker switched to idle mode', {
          idleIntervalMs: this.idleIntervalMs,
          emptyRounds: this.emptyRounds,
        });
      } else if (!shouldUseIdleMode && this.isInIdleMode) {
        this.isInIdleMode = false;
        logger.debug('External order polling worker switched to active mode', {
          activeIntervalMs: this.activeIntervalMs,
          processed: result.processed,
        });
      }
    } catch (error) {
      nextDelay = this.activeIntervalMs;
      logger.error('External order polling worker failed:', error);
    } finally {
      this.isTicking = false;
      if (!this.isRunning) return;

      if (this.wakeRequested) {
        this.wakeRequested = false;
        this.scheduleNext(0);
        return;
      }

      this.scheduleNext(nextDelay);
    }
  }
}
