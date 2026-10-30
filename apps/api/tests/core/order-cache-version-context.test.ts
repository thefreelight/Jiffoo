import { describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { OrderService } from '@/core/order/service';
import { createNumberedOrder } from '../helpers/numbered-order';
import { createUserWithToken, deleteTestUser } from '../helpers/auth';

const sourceRoot = path.resolve(__dirname, '../../src');

/** The arguments of every order cache version bump of a source file. */
async function cacheVersionCalls(relative: string): Promise<string[]> {
  const source = await fs.readFile(path.join(sourceRoot, relative), 'utf-8');
  return [...source.matchAll(/CacheService\.incrementOrderVersion\(([^)]*)\)/g)].map(match => match[1].trim());
}

describe('The caller context of the order cache version bump', () => {
  it('every order write names its caller and its order', async () => {
    const calls = await cacheVersionCalls(path.join('core', 'order', 'service.ts'));
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call).toMatch(/^\{ scope: 'order\.service', reference: .+ \}$/);
    // The cancellation of one order names the order.
    expect(calls.some(call => call.includes('reference: updatedOrder.id'))).toBe(true);
    // The sweep of the expired unpaid orders has no single order: it names
    // the operation and the number of orders it cancelled.
    expect(calls.some(call => call.includes('reference: `cancel-expired-unpaid:${cancelled}`'))).toBe(true);
  });

  it('every admin order write names its caller and its order', async () => {
    const calls = await cacheVersionCalls(path.join('core', 'admin', 'order-management', 'service.ts'));
    expect(calls).toHaveLength(8);
    for (const call of calls) expect(call).toMatch(/^\{ scope: 'admin\.order-management', reference: orderId \}$/);
  });

  it('the unpaid sweep reports the operation and the number of cancelled orders', async () => {
    const user = await createUserWithToken();
    const order = await createNumberedOrder(prisma, { data: {
      userId: user.user.id, status: 'PENDING', paymentStatus: 'PENDING',
      subtotalAmount: 0, totalAmount: 0, currency: 'USD',
      unpaidExpiresAt: new Date(Date.now() - 60_000),
    } });
    const bump = vi.spyOn(CacheService, 'incrementOrderVersion').mockResolvedValue(1);
    try {
      const cancelled = await OrderService.cancelExpiredUnpaidOrders();
      expect(cancelled).toBeGreaterThanOrEqual(1);
      // The lost bump of the sweep is locatable: the operator knows the
      // operation and how many orders it cancelled.
      expect(bump).toHaveBeenCalledWith({ scope: 'order.service', reference: `cancel-expired-unpaid:${cancelled}` });
    } finally {
      bump.mockRestore();
      await prisma.order.deleteMany({ where: { id: order.id } });
      await deleteTestUser(user.user.id);
    }
  });
});
