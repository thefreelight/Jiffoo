import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PAYMENT_RECONCILIATION_MAX_ATTEMPTS,
  PAYMENT_RECONCILE_BASE_INTERVAL_MS,
  PAYMENT_RECONCILE_JITTER_RATIO,
  PAYMENT_RECONCILE_MAX_INTERVAL_MS,
  paymentNextReconcileAt,
  paymentReconcileDelayMs,
  paymentReconcileIntervalMs,
  paymentReconcileJitterMs,
} from '@/core/payment/reconciliation';

afterEach(() => { vi.restoreAllMocks(); });

describe('the retry of a payment whose provider cannot be queried', () => {
  it('A grows the interval with the attempts and caps it at one hour', () => {
    expect(PAYMENT_RECONCILE_BASE_INTERVAL_MS).toBe(60_000);
    expect(PAYMENT_RECONCILE_MAX_INTERVAL_MS).toBe(3_600_000);
    expect(PAYMENT_RECONCILE_JITTER_RATIO).toBe(0.2);
    const intervals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(attempts => paymentReconcileIntervalMs(attempts));
    expect(intervals).toEqual([
      60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000, 3_600_000, 3_600_000, 3_600_000, 3_600_000,
    ]);
    // The budget of the payment is unchanged.
    expect(PAYMENT_RECONCILIATION_MAX_ATTEMPTS).toBe(10);
  });

  it('B schedules the next attempt inside the jitter window of its interval', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const now = new Date('2026-01-01T00:00:00.000Z');
    for (const attempts of [1, 2, 3, 7, 10]) {
      const interval = paymentReconcileIntervalMs(attempts);
      const scheduled = paymentNextReconcileAt(attempts, now);
      // Without jitter the retry happens exactly at the interval.
      expect(scheduled.getTime()).toBe(now.getTime() + interval);
    }
    vi.spyOn(Math, 'random').mockReturnValue(0.999_999);
    for (const attempts of [1, 2, 3, 7, 10]) {
      const interval = paymentReconcileIntervalMs(attempts);
      const scheduled = paymentNextReconcileAt(attempts, now);
      // The jitter is bounded by a fifth of the interval and it only delays.
      expect(scheduled.getTime()).toBeGreaterThanOrEqual(now.getTime() + interval);
      expect(scheduled.getTime()).toBeLessThan(now.getTime() + interval * 1.2);
    }
  });

  it('C never shortens a delay with its jitter', () => {
    for (const value of [0, 0.25, 0.5, 0.75, 0.999_999]) {
      vi.spyOn(Math, 'random').mockReturnValue(value);
      for (const attempts of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const interval = paymentReconcileIntervalMs(attempts);
        const jitter = paymentReconcileJitterMs(interval);
        const delay = paymentReconcileDelayMs(attempts);
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThan(interval * PAYMENT_RECONCILE_JITTER_RATIO + 1);
        expect(delay).toBeGreaterThanOrEqual(interval);
        expect(delay).toBeLessThan(interval * 1.2 + 1);
      }
    }
  });

  it('D schedules the retry of the failure path with the growing interval', () => {
    const source = readFileSync(path.resolve('src/core/payment/reconciliation.ts'), 'utf8');
    // The fixed interval of one minute is gone from the failure path.
    expect(source).not.toMatch(/nextReconcileAt: new Date\(\(await paymentNow\(tx\)\)\.getTime\(\) \+ 60_000\)/);
    expect(source).toContain('paymentNextReconcileAt(payment.attempts');
    expect(source).toContain('paymentReconcileDelayMs(payment.attempts)');
    // The budget and the terminal state are unchanged.
    expect(source).toContain("payment.attempts >= PAYMENT_RECONCILIATION_MAX_ATTEMPTS ? 'REQUIRES_REVIEW'");
    expect(source).toContain("reason: 'query_budget_exhausted'");
  });
});
