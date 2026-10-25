import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { formatStoreTimestamp, storeLocalToUtc } from 'shared';
import { systemSettingsService } from '@/core/settings/service';
import { closedOrderStatuses, PaymentStatus } from '@/core/order/policy';

export interface CustomerQuery {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  registered?: 'all' | 'today' | 'last7' | 'last30' | 'custom';
  start?: string;
  end?: string;
  sortBy?: 'createdAt' | 'orderCount' | 'paidTotal' | 'lastOrderAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
export type CustomerSelection = { mode: 'ids'; ids: string[] }
  | { mode: 'filter'; filters: CustomerQuery; excludedIds?: string[] };
export interface CustomerRow {
  id: string; email: string; username: string; avatar: string | null;
  isActive: boolean; emailVerified: boolean; locale: string | null;
  createdAt: Date; updatedAt: Date; orderCount: bigint; paidTotal: Prisma.Decimal; lastOrderAt: Date | null;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export async function customerConditions(query: CustomerQuery, now = new Date()) {
  const conditions = [Prisma.sql`u.role = 'USER'`];
  const search = query.search?.trim();
  if (search) {
    const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
    conditions.push(Prisma.sql`(u.username ILIKE ${pattern} OR u.email ILIKE ${pattern})`);
  }
  const registered = query.registered ?? 'all';
  if (registered !== 'all') {
    const timezone = await systemSettingsService.getTimezone();
    const shift = (day: string, count: number) => {
      const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10);
    };
    const today = formatStoreTimestamp(now, timezone).slice(0, 10);
    const start = registered === 'custom' ? query.start ?? '' : shift(today, registered === 'today' ? 0 : registered === 'last7' ? -6 : -29);
    const end = registered === 'custom' ? query.end ?? '' : today;
    if (!validDate(start) || !validDate(end) || start > end) throw new ApiError('INVALID_TIME_RANGE');
    // Prisma's Date parameters are timestamptz; schema timestamps store UTC without a timezone.
    conditions.push(Prisma.sql`u."createdAt" >= (${new Date(storeLocalToUtc(start + 'T00:00', timezone))} AT TIME ZONE 'UTC') AND u."createdAt" < (${new Date(storeLocalToUtc(shift(end, 1) + 'T00:00', timezone))} AT TIME ZONE 'UTC')`);
  }
  return Prisma.join(conditions, ' AND ');
}
export function customerStatus(query: CustomerQuery) {
  return query.status === 'active' ? Prisma.sql`AND "isActive" = true` : query.status === 'inactive' ? Prisma.sql`AND "isActive" = false` : Prisma.empty;
}
export function customerSort(query: CustomerQuery) {
  const columns = { createdAt: Prisma.sql`"createdAt"`, orderCount: Prisma.sql`"orderCount"`, paidTotal: Prisma.sql`"paidTotal"`, lastOrderAt: Prisma.sql`"lastOrderAt"` };
  const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return Prisma.sql`${columns[query.sortBy ?? 'createdAt']} ${direction} NULLS LAST, id ${direction}`;
}
export function customerBase(conditions: Prisma.Sql) {
  const paidTotalFilter = Prisma.sql`o."paymentStatus" = ${Prisma.raw(`'${PaymentStatus.PAID}'`)} AND o.status NOT IN (${Prisma.raw(closedOrderStatuses().map(status => `'${status}'`).join(', '))})`;
  return Prisma.sql`SELECT u.id, u.email, u.username, u.avatar, u.locale, u."isActive", u."emailVerified", u."createdAt", u."updatedAt",
    COALESCE(a."orderCount", 0)::bigint AS "orderCount", COALESCE(a."paidTotal", 0) AS "paidTotal", a."lastOrderAt"
    FROM public.users u LEFT JOIN LATERAL (
      SELECT count(*) AS "orderCount", max(o."createdAt") AS "lastOrderAt",
        sum(o."totalAmount") FILTER (WHERE ${paidTotalFilter}) AS "paidTotal"
      FROM public.orders o WHERE o."userId" = u.id
    ) a ON true WHERE ${conditions}`;
}
export function customerItem(row: CustomerRow, currency: string) {
  return { ...row, orderCount: Number(row.orderCount), paidTotal: Number(row.paidTotal), currency,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), lastOrderAt: row.lastOrderAt?.toISOString() ?? null };
}
export async function customerList(query: CustomerQuery) {
  const conditions = await customerConditions(query), page = query.page ?? 1, limit = query.limit ?? 20;
  const currency = await systemSettingsService.getShopCurrency();
  const [rows, counts] = await prisma.$transaction([
    prisma.$queryRaw<CustomerRow[]>(Prisma.sql`WITH customers AS (${customerBase(conditions)}) SELECT * FROM customers WHERE true ${customerStatus(query)} ORDER BY ${customerSort(query)} LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    prisma.$queryRaw<{ all: bigint; active: bigint; inactive: bigint }[]>(Prisma.sql`SELECT count(*) AS all, count(*) FILTER (WHERE u."isActive") AS active, count(*) FILTER (WHERE NOT u."isActive") AS inactive FROM public.users u WHERE ${conditions}`),
  ], { isolationLevel: 'RepeatableRead' });
  const statusCounts = { all: Number(counts[0].all), active: Number(counts[0].active), inactive: Number(counts[0].inactive) };
  const total = statusCounts[query.status ?? 'all'];
  return { items: rows.map(row => customerItem(row, currency)), statusCounts, page, limit, total, totalPages: Math.ceil(total / limit) };
}
export async function customerNeighbors(id: string, query: CustomerQuery) {
  if (!await prisma.user.findUnique({ where: { id, role: 'USER' }, select: { id: true } })) throw new ApiError('NOT_FOUND');
  const conditions = await customerConditions(query);
  const rows = await prisma.$queryRaw<{ position: bigint | null; total: bigint; previousId: string | null; nextId: string | null }[]>(Prisma.sql`
    WITH customers AS (${customerBase(conditions)}), ranked AS (
      SELECT id, row_number() OVER w AS position, lag(id) OVER w AS "previousId", lead(id) OVER w AS "nextId"
      FROM customers WHERE true ${customerStatus(query)} WINDOW w AS (ORDER BY ${customerSort(query)})
    ) SELECT r.position, r."previousId", r."nextId", c.total FROM (SELECT count(*) AS total FROM ranked) c LEFT JOIN ranked r ON r.id = ${id}`);
  return { ...rows[0], position: rows[0].position === null ? null : Number(rows[0].position), total: Number(rows[0].total) };
}
