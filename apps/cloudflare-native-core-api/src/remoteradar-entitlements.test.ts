import { describe, expect, it } from 'vitest';
import {
  processRemoteRadarPaidOrder, REMOTERADAR_PRICING_USD, REMOTERADAR_PRODUCTS, remoteRadarAllowanceStatus,
} from './remoteradar-entitlements';

function statement(first: unknown = null, results: unknown[] = []) {
  return { bind: () => ({ first: async () => first, all: async () => ({ results }), run: async () => ({ success: true }) }) };
}

describe('RemoteRadar entitlements', () => {
  it('provisions the free monthly allowance and reports purchased credits separately', async () => {
    const db = {
      prepare: (sql: string) => {
        if (sql.includes('FROM remoteradar_entitlements')) return statement(null);
        if (sql.includes('FROM remoteradar_credit_grants')) return statement(null, [
          { grant_type: 'free_monthly', credits_total: 2, credits_remaining: 2, expires_at: '2026-09-01' },
          { grant_type: 'credit_pack', credits_total: 10, credits_remaining: 7, expires_at: '2026-10-01' },
        ]);
        return statement();
      },
    };
    await expect(remoteRadarAllowanceStatus({ DB: db } as never, 'user-1', new Date('2026-08-05T00:00:00Z')))
      .resolves.toMatchObject({ plan: 'free', includedCredits: 2, includedRemaining: 2, purchasedRemaining: 7, totalRemaining: 9 });
  });

  it('reports the active annual Pro allowance as 20 credits per month', async () => {
    const db = {
      prepare: (sql: string) => {
        if (sql.includes('FROM remoteradar_entitlements')) return statement({
          plan_code: 'pro_beta', billing_interval: 'year', starts_at: '2026-08-01', ends_at: '2027-08-01',
        });
        if (sql.includes('FROM remoteradar_credit_grants')) return statement(null, [
          { grant_type: 'pro_monthly', credits_total: 20, credits_remaining: 18, expires_at: '2026-09-01' },
        ]);
        return statement();
      },
    };
    await expect(remoteRadarAllowanceStatus({ DB: db } as never, 'user-1', new Date('2026-08-05T00:00:00Z')))
      .resolves.toMatchObject({ plan: 'pro_beta', billingInterval: 'year', includedCredits: 20, includedRemaining: 18 });
  });

  it('grants a paid ten-credit pack once with a ninety-day expiry', async () => {
    const prepared: string[] = [];
    let batches = 0;
    const db = {
      prepare: (sql: string) => {
        prepared.push(sql);
        if (sql.includes('WHERE order_id = ?1 OR provider_event_id')) return statement(null);
        if (sql.includes('FROM native_order_metadata')) return statement({ user_id: 'user-1', payment_status: 'PAID' });
        if (sql.includes('FROM native_order_items')) return statement(null, [{
          product_id: REMOTERADAR_PRODUCTS.CREDIT_PACK_10,
          quantity: 1,
          unit_price: REMOTERADAR_PRICING_USD[REMOTERADAR_PRODUCTS.CREDIT_PACK_10],
        }]);
        if (sql.includes('SELECT product_code, provider_event_id')) return statement({
          product_code: REMOTERADAR_PRODUCTS.CREDIT_PACK_10, provider_event_id: 'evt-1',
        });
        return statement();
      },
      batch: async (statements: unknown[]) => { batches += 1; expect(statements).toHaveLength(2); },
    };
    await expect(processRemoteRadarPaidOrder({ DB: db } as never, 'order-1', 'evt-1', new Date('2026-08-05T00:00:00Z')))
      .resolves.toEqual({ applied: true, productCode: REMOTERADAR_PRODUCTS.CREDIT_PACK_10 });
    expect(batches).toBe(1);
    expect(prepared.some((sql) => sql.includes("'credit_pack', 10, 10"))).toBe(true);
  });

  it('returns an idempotent result without a second grant', async () => {
    const db = { prepare: () => statement({ product_code: REMOTERADAR_PRODUCTS.PRO_MONTHLY }) };
    await expect(processRemoteRadarPaidOrder({ DB: db } as never, 'order-1', 'evt-1'))
      .resolves.toEqual({ applied: false, productCode: REMOTERADAR_PRODUCTS.PRO_MONTHLY });
  });

  it('refuses unpaid and mixed eligible orders', async () => {
    const unpaidDb = {
      prepare: (sql: string) => sql.includes('WHERE order_id = ?1 OR provider_event_id')
        ? statement(null)
        : statement({ user_id: 'user-1', payment_status: 'PENDING' }),
    };
    await expect(processRemoteRadarPaidOrder({ DB: unpaidDb } as never, 'order-1', 'evt-1'))
      .rejects.toThrow('REMOTERADAR_ORDER_NOT_PAID');
  });

  it('refuses a forged catalog price', async () => {
    const db = {
      prepare: (sql: string) => {
        if (sql.includes('WHERE order_id = ?1 OR provider_event_id')) return statement(null);
        if (sql.includes('FROM native_order_metadata')) return statement({ user_id: 'user-1', payment_status: 'PAID' });
        if (sql.includes('FROM native_order_items')) return statement(null, [{
          product_id: REMOTERADAR_PRODUCTS.PRO_MONTHLY, quantity: 1, unit_price: 1,
        }]);
        return statement();
      },
    };
    await expect(processRemoteRadarPaidOrder({ DB: db } as never, 'order-1', 'evt-1'))
      .rejects.toThrow('REMOTERADAR_ORDER_PRICE_MISMATCH');
  });
});
