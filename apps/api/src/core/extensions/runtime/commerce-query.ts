import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { eventRegistry, type PaidOrder } from '@jiffoo/shared';

/**
 * The read-only paid-order reconciliation of G4-R.
 *
 * A provider that credits a customer for a paid order needs to find the orders
 * it never received an event for. The query is a permissioned read of the
 * durable payment ledger, not an event replay: the ledger is the source of the
 * first accepted capture, and the order lines carry the snapshot of the moment
 * of the purchase.
 */

export const COMMERCE_READ_PERMISSION = 'commerce:orders.read';
/** The published item schema of `order.paid`, so the query returns that shape exactly. */
const itemSchema = eventRegistry['order.paid'].shape.order.shape.items;
const MAX_WINDOW_DAYS = 31;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const CURSOR_TTL_MS = 60 * 60 * 1000;

interface CursorPayload {
  installationId: string;
  from: string;
  to: string;
  paidAt: string;
  orderId: string;
  exp: number;
}

function cursorSecret(): Buffer | null {
  const raw = process.env.PLUGIN_COMMERCE_CURSOR_SECRET;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length < 32) throw new Error('PLUGIN_COMMERCE_CURSOR_SECRET requires a dedicated strong base64 key of at least 32 bytes');
  return key;
}

function sign(payload: CursorPayload, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const mac = createHmac('sha256', key).update(body).digest();
  return `${body.toString('base64url')}.${mac.toString('base64url')}`;
}

function verifyCursor(cursor: string, key: Buffer, installationId: string, from: string, to: string): CursorPayload {
  const [body, mac] = cursor.split('.');
  if (!body || !mac) throw new ApiError('VALIDATION_ERROR');
  const expected = createHmac('sha256', key).update(Buffer.from(body, 'base64url')).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ApiError('VALIDATION_ERROR');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CursorPayload;
  if (payload.installationId !== installationId || payload.from !== from || payload.to !== to) throw new ApiError('VALIDATION_ERROR');
  if (!Number.isSafeInteger(payload.exp) || payload.exp < Date.now()) throw new ApiError('VALIDATION_ERROR');
  return payload;
}

function parseWindow(from: string, to: string): { from: Date; to: Date } {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new ApiError('VALIDATION_ERROR');
  if (start.getTime() >= end.getTime()) throw new ApiError('VALIDATION_ERROR');
  if (end.getTime() > Date.now()) throw new ApiError('VALIDATION_ERROR');
  if (end.getTime() - start.getTime() > MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000) throw new ApiError('VALIDATION_ERROR');
  return { from: start, to: end };
}

/**
 * The paid orders of a window, newest first, with an opaque cursor.
 *
 * The caller needs the permission `commerce:orders.read`. The amounts are the
 * canonical decimal strings of the stored order, and the item lines carry the
 * snapshot of the purchase, even when the catalogue entry is gone.
 */
export async function listPaidOrders(installationId: string, request: {
  from: string; to: string; cursor?: string | null; limit?: number;
}): Promise<{ items: PaidOrder[]; nextCursor: string | null; from: string; to: string }> {
  const installation = await prisma.pluginInstallation.findUnique({ where: { id: installationId } });
  if (!installation) throw new ApiError('FORBIDDEN');
  const granted = parseJsonArray(installation.grantedPermissions);
  if (!granted.includes(COMMERCE_READ_PERMISSION)) throw new ApiError('FORBIDDEN');
  const key = cursorSecret();
  if (!key) throw new ApiError('FORBIDDEN');
  const { from, to } = parseWindow(request.from, request.to);
  const limit = Math.min(Math.max(Math.trunc(request.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const cursor = request.cursor ? verifyCursor(request.cursor, key, installationId, request.from, request.to) : null;

  const rows = await prisma.$queryRaw<Array<{
    orderId: string; orderNumber: string; userId: string; paidAt: Date; currency: string;
    paymentStatus: string; subtotal: string; shipping: string; tax: string; total: string;
  }>>`
    SELECT o."id" AS "orderId", o."order_number" AS "orderNumber", o."userId" AS "userId",
      MIN(l."createdAt") AS "paidAt", o."currency" AS "currency", o."status"::text AS "paymentStatus",
      o."subtotalAmount"::text AS "subtotal", o."shippingAmount"::text AS "shipping",
      o."taxAmount"::text AS "tax", o."totalAmount"::text AS "total"
    FROM public.payment_ledgers l
    JOIN public.orders o ON o."id" = l."orderId"
    WHERE l."eventType" = 'SUCCEEDED' AND l."refundRequired" = false
      AND l."createdAt" >= ${from} AND l."createdAt" < ${to}
      AND (${cursor === null}::boolean OR (l."createdAt", o."id") < (${cursor.paidAt}::timestamptz, ${cursor.orderId}::text))
    GROUP BY o."id"
    ORDER BY MIN(l."createdAt") DESC, o."id" DESC
    LIMIT ${limit + 1}
  `;

  const page = rows.slice(0, limit);
  const items: PaidOrder[] = [];
  for (const row of page) {
    const lines = await prisma.orderItem.findMany({ where: { orderId: row.orderId } });
    items.push({
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      customerId: row.userId,
      paidAt: row.paidAt.toISOString(),
      currency: row.currency,
      paymentStatus: row.paymentStatus,
      amounts: { subtotal: row.subtotal, shipping: row.shipping, tax: row.tax, total: row.total },
      items: itemSchema.parse(lines.map(line => {
        const snapshot = (line.catalogSnapshot ?? {}) as Record<string, unknown>;
        return {
          id: line.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: Number(line.unitPrice),
          fulfillmentData: (line.fulfillmentData ?? null) as Record<string, unknown> | null,
          ...(typeof snapshot.productName === 'string' ? { productName: snapshot.productName } : {}),
          ...(typeof snapshot.variantName === 'string' ? { variantName: snapshot.variantName } : {}),
          ...(typeof snapshot.skuCode === 'string' ? { skuCode: snapshot.skuCode } : {}),
          productTypeData: (snapshot.productTypeData ?? {}) as Record<string, unknown>,
        };
      })),
    });
  }
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last
    ? sign({ installationId, from: request.from, to: request.to, paidAt: last.paidAt.toISOString(), orderId: last.orderId, exp: Date.now() + CURSOR_TTL_MS }, key)
    : null;
  return { items, nextCursor, from: request.from, to: request.to };
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}
