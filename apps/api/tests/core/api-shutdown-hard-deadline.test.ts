/**
 * The hard deadline of the graceful shutdown of the API.
 *
 * The handler that answers SIGTERM and SIGINT waits for the drain of the
 * runtime. The drain carries an inner deadline of its own, so the graceful
 * path is expected to settle well before the hard deadline of the handler.
 * The hard deadline is the outer bound of the whole shutdown: it ends a drain
 * that never settles, so the process leaves with a recorded state instead of
 * being killed by the orchestrator with an unknown one.
 *
 * The decision of the shutdown is a pure function, so it is tested here
 * instead of in a process test that would have to hang on purpose.
 */

import { describe, expect, it } from 'vitest';
import {
  API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS,
  apiShutdownHardDeadlineMs,
  decideApiShutdown,
} from '@/server';
import { workerShutdownDeadlineMs } from '@/infra/worker-shutdown';

describe('the hard deadline of the API shutdown', () => {
  it('is clearly above the inner drain deadline of the runtime', () => {
    const drainDeadlineMs = workerShutdownDeadlineMs();
    const hardDeadlineMs = apiShutdownHardDeadlineMs(drainDeadlineMs);

    expect(hardDeadlineMs).toBeGreaterThan(drainDeadlineMs);
    expect(hardDeadlineMs - drainDeadlineMs).toBe(API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS);
    // The margin is at least half of the drain deadline, so the graceful path
    // is always preferred over the hard deadline.
    expect(API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS).toBeGreaterThanOrEqual(drainDeadlineMs / 2);
    expect(apiShutdownHardDeadlineMs()).toBe(apiShutdownHardDeadlineMs(drainDeadlineMs));
  });

  it('exits with 0 when the drain settled in time', () => {
    expect(decideApiShutdown({ drainSettled: true, drainFailed: false, elapsedMs: 10, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: false,
      exitCode: 0,
      forced: false,
    });
  });

  it('exits with 1 and does not force the plugin work when the drain failed', () => {
    expect(decideApiShutdown({ drainSettled: false, drainFailed: true, elapsedMs: 10, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: false,
      exitCode: 1,
      forced: false,
    });
  });

  it('exits with 1 and forces the plugin work when the drain missed the hard deadline', () => {
    expect(decideApiShutdown({ drainSettled: false, drainFailed: false, elapsedMs: 45_000, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: true,
      exitCode: 1,
      forced: true,
    });
    expect(decideApiShutdown({ drainSettled: false, drainFailed: false, elapsedMs: 46_000, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: true,
      exitCode: 1,
      forced: true,
    });
  });

  it('does not force the plugin work while the drain is still inside the hard deadline', () => {
    expect(decideApiShutdown({ drainSettled: false, drainFailed: false, elapsedMs: 44_999, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: false,
      exitCode: 1,
      forced: false,
    });
  });
});
