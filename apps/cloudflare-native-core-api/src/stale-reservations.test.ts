import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

import { releaseStaleInventoryReservations } from './checkout';

describe('releaseStaleInventoryReservations', () => {
  it('deactivates only active reservations of unpaid orders and reports the count', async () => {
    const run = vi.fn(async () => ({ success: true, meta: { changes: 7 } }));
    const bound: unknown[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => {
          bound.push(...values);
          expect(sql).toContain('UPDATE native_inventory_reservations SET active = 0');
          expect(sql).toContain('active = 1');
          expect(sql).toContain("metadata.payment_status = 'PENDING'");
          return { run };
        },
      }),
    } as never;

    const result = await releaseStaleInventoryReservations({ DB: db });

    expect(result).toEqual({ released: 7 });
    expect(run).toHaveBeenCalledTimes(1);
    expect(bound).toHaveLength(1);
    // cutoff is 24h before "now": stale only
    const cutoff = bound[0] as string;
    expect(Date.now() - new Date(cutoff).getTime()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(Date.now() - new Date(cutoff).getTime()).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });
});
