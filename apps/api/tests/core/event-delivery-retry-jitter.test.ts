import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  EVENT_MAX_ATTEMPTS,
  EVENT_RETRY_JITTER_RATIO,
  EVENT_RETRY_SECONDS,
  eventRetryDelaySeconds,
  eventRetryJitterSeconds,
} from '@/infra/events/delivery';

afterEach(() => { vi.restoreAllMocks(); });

describe('the retry of an event delivery', () => {
  it('A keeps the ladder and the attempt budget of the delivery', () => {
    expect([...EVENT_RETRY_SECONDS]).toEqual([60, 300, 900, 3600, 10800, 21600, 43200]);
    expect(EVENT_MAX_ATTEMPTS).toBe(8);
    expect(EVENT_RETRY_JITTER_RATIO).toBe(0.2);
  });

  it('B schedules the next attempt with the ladder plus a jitter inside the window', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    for (const [index, base] of EVENT_RETRY_SECONDS.entries()) {
      expect(eventRetryDelaySeconds(index + 1)).toBe(base);
    }
    vi.spyOn(Math, 'random').mockReturnValue(0.999_999);
    for (const [index, base] of EVENT_RETRY_SECONDS.entries()) {
      const delay = eventRetryDelaySeconds(index + 1);
      // The jitter is bounded by a fifth of the ladder value and it only delays.
      expect(delay).toBeGreaterThanOrEqual(base);
      expect(delay).toBeLessThan(base * 1.2);
    }
  });

  it('C never shortens a delay with its jitter', () => {
    for (const value of [0, 0.25, 0.5, 0.75, 0.999_999]) {
      vi.spyOn(Math, 'random').mockReturnValue(value);
      for (const [index, base] of EVENT_RETRY_SECONDS.entries()) {
        const jitter = eventRetryJitterSeconds(base);
        const delay = eventRetryDelaySeconds(index + 1);
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThan(base * EVENT_RETRY_JITTER_RATIO + 1);
        expect(delay).toBeGreaterThanOrEqual(base);
        expect(delay).toBeLessThan(base * 1.2 + 1);
      }
    }
  });

  it('D schedules the failure of a delivery with the jittered ladder', () => {
    const source = readFileSync(path.resolve('src/infra/events/delivery.ts'), 'utf8');
    expect(source).toContain('eventRetryDelaySeconds(delivery.attempts)');
    expect(source).not.toContain('EVENT_RETRY_SECONDS[delivery.attempts - 1]');
    // The terminal state and the budget are unchanged.
    expect(source).toContain('delivery.attempts >= EVENT_MAX_ATTEMPTS');
    expect(source).toContain("'FAILED'");
  });
});
