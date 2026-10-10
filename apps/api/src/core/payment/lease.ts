import type { Payment } from '@prisma/client';
import { paymentClockOffsetMs, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { getPluginTimeoutMs } from '@/core/admin/extension-installer/gateway-protection';
import { pluginDatabaseLimit } from '@/core/admin/extension-installer/plugin-database-test-control';

export const PAYMENT_RECONCILIATION_LEASE_MS = 60_000;
export const PAYMENT_RECONCILIATION_MARGIN_MS = 1_000;
export interface PaymentLeaseClient { query(sql: string, values?: unknown[]): Promise<{ rows: any[] }>; }
export function paymentQueryTimeoutMs(): number { return pluginDatabaseLimit('invocationMs', getPluginTimeoutMs()); }
export async function claimPaymentReconciliations(client: PaymentLeaseClient, claimedBy: string, options: { limit?: number; minAgeMinutes?: number; maxAgeMinutes?: number } = {}): Promise<Payment[]> {
  const budget = Math.max(1, Math.floor(PAYMENT_RECONCILIATION_LEASE_MS / (paymentQueryTimeoutMs() + PAYMENT_RECONCILIATION_MARGIN_MS)));
  const result = await client.query(`WITH clock AS (SELECT clock_timestamp() + $1 * interval '1 millisecond' AS now), picked AS (
    SELECT p.id FROM public.payments p, clock c
    WHERE p.status IN ('CREATING','PENDING') AND p."nextReconcileAt" <= c.now
      AND (p."leaseUntil" IS NULL OR p."leaseUntil" <= c.now)
      AND ((p.status = 'CREATING' AND p."sessionId" IS NULL AND p."createdAt" + $2 * interval '1 millisecond' <= c.now AT TIME ZONE 'UTC')
        OR (p.status = 'PENDING' AND p."sessionId" IS NOT NULL
          AND ($3 <= 0 OR p."createdAt" <= (c.now AT TIME ZONE 'UTC') - $3 * interval '1 minute')
          AND ($4 <= 0 OR p."createdAt" >= (c.now AT TIME ZONE 'UTC') - $4 * interval '1 minute')))
    ORDER BY p."nextReconcileAt", p.id LIMIT $5 FOR UPDATE OF p SKIP LOCKED
  ) UPDATE public.payments p SET "claimToken" = gen_random_uuid(), "claimedBy" = $6,
    "leaseUntil" = c.now + $7 * interval '1 millisecond', attempts = p.attempts + 1
    FROM picked, clock c WHERE p.id = picked.id RETURNING p.*`,
  [paymentClockOffsetMs(), PAYMENT_SESSION_LIFETIME_MS, options.minAgeMinutes ?? 2, options.maxAgeMinutes ?? 10_080, Math.max(0, Math.min(options.limit ?? 100, budget)), claimedBy, PAYMENT_RECONCILIATION_LEASE_MS]);
  return result.rows as Payment[];
}
export async function paymentLeaseAllowsQuery(client: PaymentLeaseClient, payment: Pick<Payment, 'id' | 'claimToken'>): Promise<boolean> {
  const result = await client.query(`SELECT id FROM public.payments WHERE id = $1 AND status IN ('CREATING','PENDING') AND "claimToken" = $2::uuid
    AND "leaseUntil" - (clock_timestamp() + $3 * interval '1 millisecond') >= $4 * interval '1 millisecond'`,
  [payment.id, payment.claimToken, paymentClockOffsetMs(), paymentQueryTimeoutMs() + PAYMENT_RECONCILIATION_MARGIN_MS]);
  return result.rows.length === 1;
}
export async function releasePaymentReconciliation(client: PaymentLeaseClient, payment: Pick<Payment, 'id' | 'claimToken'>, delayMs = 60_000): Promise<void> {
  await client.query(`UPDATE public.payments SET "claimToken" = NULL, "claimedBy" = NULL, "leaseUntil" = NULL,
    "nextReconcileAt" = clock_timestamp() + ($3 + $4) * interval '1 millisecond'
    WHERE id = $1 AND status IN ('CREATING','PENDING') AND "claimToken" = $2::uuid`,
  [payment.id, payment.claimToken, paymentClockOffsetMs(), delayMs]);
}
