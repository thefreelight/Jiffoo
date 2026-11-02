import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-errors';
import { eventRegistry, type PaidOrder } from '@jiffoo/shared';
import { sharedProtection } from '@/infra/shared-protection';
import { canonicalAmount, paidOrderItems } from '@/core/shared/paid-order';

/**
 * The read-only paid-order reconciliation of G4-R.
 *
 * A provider that credits a customer for a paid order needs to find the orders
 * it never received an event for. The query is a permissioned read of the
 * durable payment ledger, not an event replay: the ledger is the source of the
 * first accepted capture, and the order lines carry the snapshot of the moment
 * of the purchase.
 *
 * The read reaches the order rows and the payment ledger directly. The module
 * graph has no acyclic path from the plugin runtime to the commerce domains,
 * so a projection of the paid orders would close hundreds of new module
 * rings; the admin read modules of the tree read the same tables the same way.
 */

export const COMMERCE_READ_PERMISSION = 'commerce:orders.read';
/** The published item schema of `order.paid`, so the query returns that shape exactly. */
const itemSchema = eventRegistry['order.paid'].shape.order.shape.items;
const MAX_WINDOW_DAYS = 31;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const CURSOR_TTL_MS = 60 * 60 * 1000;
/** The page budget of one installation, shared by every instance of Core. */
const PAGE_RATE_LIMIT = 30;
const PAGE_RATE_WINDOW_MS = 60_000;
/** The budget of one page, from the first statement to the last. */
const QUERY_TIMEOUT_MS = 5_000;

/**
 * The installation a page is read for.
 *
 * The module owns the decision that the installation may read: it holds the
 * grant, it is enabled, and its generation is the one the cursor binds.
 */
interface PaidOrderReadContext {
  installationId: string;
  /** The revision of the granted permissions. */
  grantRevision: string;
  /** The protection generation of the installation. */
  generation: string;
}

interface CursorPayload {
  installationId: string;
  grantRevision: string;
  generation: string;
  from: string;
  to: string;
  paidAt: string;
  orderId: string;
  exp: number;
}

interface PaidOrderRow {
  orderId: string;
  orderNumber: string;
  userId: string;
  paidAt: string;
  currency: string;
  paymentStatus: string;
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
}

function cursorSecret(): Buffer | null {
  const raw = process.env.PLUGIN_COMMERCE_CURSOR_SECRET;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length < 32) throw new Error('PLUGIN_COMMERCE_CURSOR_SECRET requires a dedicated strong base64 key of at least 32 bytes');
  // The cursor is signed with a dedicated key: reusing the key of another
  // signing surface would make the two signatures interchangeable. The other
  // keys are compared as they are written and as the bytes they decode to, so
  // another base64 spelling of the same key is caught as well.
  //
  // Both the typed environment and the live environment are read: the typed one is
  // the snapshot of the process start, the live one holds a value that was
  // assigned after it. A key that only one of them knows is still a reused key.
  const reused = [
    env.JWT_SECRET, env.PLUGIN_SECRETS_KEY, env.PLUGIN_PAGE_TOKEN_SECRET, env.PLUGIN_FILE_URL_SECRET,
    process.env.PLUGIN_SECRETS_KEY, process.env.PLUGIN_PAGE_TOKEN_SECRET, process.env.PLUGIN_FILE_URL_SECRET,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .some(other => other === raw || other === key.toString('utf8') || sameBytes(Buffer.from(other, 'base64'), key));
  if (reused) throw new Error('PLUGIN_COMMERCE_CURSOR_SECRET requires a dedicated strong base64 key of at least 32 bytes');
  return key;
}

/** Whether two keys are the same bytes. */
function sameBytes(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && left.equals(right);
}

function sign(payload: CursorPayload, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const mac = createHmac('sha256', key).update(body).digest();
  return `${body.toString('base64url')}.${mac.toString('base64url')}`;
}

/**
 * The revision of the granted permissions. A cursor belongs to the grant it
 * was issued under, so a changed grant ends the traversal.
 */
function grantRevisionOf(permissions: string[]): string {
  const digest = createHash('sha256').update([...permissions].sort().join('\n'), 'utf8').digest('hex');
  return digest.slice(0, 32);
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

function verifyCursor(
  cursor: string,
  key: Buffer,
  binding: { installationId: string; grantRevision: string; generation: string; from: string; to: string },
): CursorPayload {
  const [body, mac] = cursor.split('.');
  if (!body || !mac) throw new ApiError('VALIDATION_ERROR');
  const expected = createHmac('sha256', key).update(Buffer.from(body, 'base64url')).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ApiError('VALIDATION_ERROR');
  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CursorPayload;
  } catch {
    throw new ApiError('VALIDATION_ERROR');
  }
  if (payload.installationId !== binding.installationId) throw new ApiError('VALIDATION_ERROR');
  if (payload.grantRevision !== binding.grantRevision) throw new ApiError('VALIDATION_ERROR');
  if (payload.generation !== binding.generation) throw new ApiError('VALIDATION_ERROR');
  if (payload.from !== binding.from || payload.to !== binding.to) throw new ApiError('VALIDATION_ERROR');
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
 * The amounts are the canonical decimal strings of the stored order, and the
 * item lines carry the snapshot of the purchase, even when the catalogue entry
 * is gone.
 */
export async function listPaidOrders(installationId: string, request: {
  from: string; to: string; cursor?: string | null; limit?: number;
}): Promise<{ items: PaidOrder[]; nextCursor: string | null; from: string; to: string }> {
  const installation = await prisma.pluginInstallation.findUnique({ where: { id: installationId } });
  if (!installation) throw new ApiError('FORBIDDEN');
  if (!installation.enabled || installation.deletedAt) throw new ApiError('PLUGIN_DISABLED');
  const granted = parseJsonArray(installation.grantedPermissions);
  if (!granted.includes(COMMERCE_READ_PERMISSION)) throw new ApiError('FORBIDDEN');
  const context: PaidOrderReadContext = {
    installationId,
    grantRevision: grantRevisionOf(granted),
    generation: installation.protectionGeneration.toString(),
  };
  const key = cursorSecret();
  if (!key) throw new ApiError('FORBIDDEN');
  const { from, to } = parseWindow(request.from, request.to);
  const limit = Math.min(Math.max(Math.trunc(request.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const binding = {
    installationId: context.installationId,
    grantRevision: context.grantRevision,
    generation: context.generation,
    from: request.from,
    to: request.to,
  };
  const cursor = request.cursor ? verifyCursor(request.cursor, key, binding) : null;

  // The page budget of the installation. It is shared by every instance of
  // Core, because the limit protects the store, not one process.
  const permit = await sharedProtection.rate(`commerce:paid:${context.installationId}`, PAGE_RATE_WINDOW_MS, PAGE_RATE_LIMIT);
  if (!permit.allowed) throw new ApiError('RATE_LIMITED');

  const { rows, lines } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    // The accepted capture of an order is unique, so the earliest accepted
    // capture in the window is the paid moment of that order. A capture that
    // landed after the cancellation of its order is a late capture of a
    // cancelled order, and that order is not a paid order.
    const statement = Prisma.sql`
      SELECT o."id" AS "orderId", o."order_number" AS "orderNumber", o."userId" AS "userId",
        to_char((MIN(l."createdAt")) AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "paidAt",
        o."currency" AS "currency", o."paymentStatus"::text AS "paymentStatus",
        o."subtotalAmount"::text AS "subtotal", o."shippingAmount"::text AS "shipping",
        o."taxAmount"::text AS "tax", o."totalAmount"::text AS "total"
      FROM public.payment_ledger l
      JOIN public.orders o ON o."id" = l."orderId"
      WHERE l."eventType" = 'SUCCEEDED' AND l."refundRequired" = false
        AND l."createdAt" >= ${from} AND l."createdAt" < ${to}
        AND (o."cancelledAt" IS NULL OR l."createdAt" <= o."cancelledAt")
        AND (${cursor === null}::boolean
          OR (l."createdAt", o."id") < (${cursor?.paidAt ?? null}::timestamptz, ${cursor?.orderId ?? ''}::text))
      GROUP BY o."id"
      ORDER BY MIN(l."createdAt") DESC, o."id" DESC
      LIMIT ${limit + 1}`;
    const page = await tx.$queryRaw<Array<PaidOrderRow>>(statement);
    const orderIds = page.map(row => row.orderId);
    const orderLines = orderIds.length
      ? await tx.orderItem.findMany({ where: { orderId: { in: orderIds } }, orderBy: { id: 'asc' } })
      : [];
    return { rows: page, lines: orderLines };
  }, { timeout: QUERY_TIMEOUT_MS, isolationLevel: 'RepeatableRead' });

  const page = rows.slice(0, limit);
  const linesByOrder = new Map<string, typeof lines>();
  for (const line of lines) {
    const bucket = linesByOrder.get(line.orderId);
    if (bucket) bucket.push(line);
    else linesByOrder.set(line.orderId, [line]);
  }
  const items: PaidOrder[] = [];
  for (const row of page) {
    const orderLines = linesByOrder.get(row.orderId) ?? [];
    items.push({
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      customerId: row.userId,
      paidAt: row.paidAt,
      currency: row.currency,
      paymentStatus: row.paymentStatus,
      amounts: {
        subtotal: canonicalAmount(row.subtotal, row.currency),
        shipping: canonicalAmount(row.shipping, row.currency),
        tax: canonicalAmount(row.tax, row.currency),
        total: canonicalAmount(row.total, row.currency),
      },
      items: itemSchema.parse(paidOrderItems(orderLines)),
    });
  }
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last
    ? sign({ ...binding, paidAt: last.paidAt, orderId: last.orderId, exp: Date.now() + CURSOR_TTL_MS }, key)
    : null;
  return { items, nextCursor, from: request.from, to: request.to };
}
