import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';

export type AuditQuery = {
  actorId?: string; action?: string; targetType?: string; category?: string;
  from?: string; to?: string; sort?: string; page?: number; limit?: number;
};
type Actor = { id: string; email: string; username: string; isActive: boolean };
export type AuditRecord = {
  id: string; actorId: string; action: string; targetType: string; targetId: string;
  summary: Prisma.JsonValue; createdAt: Date; actorSnapshot: Actor | null; targetLabel: string | null;
};

const union = Prisma.sql`
  SELECT id, "actorId", action, "targetType", "targetId", summary, "createdAt",
    NULL::jsonb AS "actorSnapshot", NULL::text AS "targetLabel"
  FROM public.admin_audit_events
  UNION ALL
  SELECT 'staff:' || id, COALESCE("actorUserId", 'system'),
    CASE WHEN action = 'ADMIN_INVITED' AND metadata->>'reinvite' = 'true' THEN 'ADMIN_REINVITED' ELSE action END,
    CASE WHEN action = 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED' THEN 'customer'
      WHEN action = 'THEME_UNSIGNED_INSTALL_CONFIRMED' THEN 'theme'
      WHEN action = 'BUILTIN_PLUGIN_INSTALLED' THEN 'plugin' ELSE 'staff' END,
    CASE WHEN action IN ('THEME_UNSIGNED_INSTALL_CONFIRMED', 'BUILTIN_PLUGIN_INSTALLED')
      THEN COALESCE(metadata->>'slug', "staffUserId") ELSE "staffUserId" END,
    COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('email', "staffEmail", 'username', "staffUsername"),
    "createdAt",
    CASE WHEN "actorUserId" IS NULL OR "actorUserId" = 'system' THEN NULL::jsonb
      ELSE jsonb_build_object('id', "actorUserId", 'email', COALESCE("actorEmail", ''),
        'username', COALESCE("actorUsername", ''), 'isActive', false) END,
    CASE WHEN action IN ('THEME_UNSIGNED_INSTALL_CONFIRMED', 'BUILTIN_PLUGIN_INSTALLED')
      THEN metadata->>'slug' ELSE concat_ws(' · ', NULLIF("staffUsername", ''), "staffEmail") END
  FROM public.admin_staff_audit_logs
`;

function conditions(query: AuditQuery) {
  const clauses: Prisma.Sql[] = [];
  if (query.actorId) clauses.push(Prisma.sql`"actorId" = ${query.actorId}`);
  if (query.action) clauses.push(Prisma.sql`action = ${query.action}`);
  if (query.targetType) clauses.push(Prisma.sql`"targetType" = ${query.targetType}`);
  if (query.from) clauses.push(Prisma.sql`"createdAt" >= (${query.from}::timestamptz AT TIME ZONE 'UTC')`);
  if (query.to) clauses.push(Prisma.sql`"createdAt" <= (${query.to}::timestamptz AT TIME ZONE 'UTC')`);
  if (query.category === 'accounts') clauses.push(Prisma.sql`("targetType" IN ('staff', 'user', 'customer', 'api_token') OR starts_with(action, 'STAFF_') OR starts_with(action, 'CUSTOMER_'))`);
  else if (query.category === 'system') clauses.push(Prisma.sql`("targetType" = 'core' OR starts_with(action, 'CORE_'))`);
  else if (query.category === 'code') clauses.push(Prisma.sql`action LIKE 'storefront-code.%'`);
  else if (query.category) {
    const prefix = query.category === 'settings' ? 'STORE_' : query.category === 'notification' ? 'NOTIFICATION_' : query.category === 'payment' ? 'PAYMENT_' : query.category + '.';
    clauses.push(Prisma.sql`("targetType" = ${query.category} OR starts_with(action, ${prefix}))`);
  }
  return clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}` : Prisma.empty;
}

export async function listAuditRecords(query: AuditQuery) {
  const where = conditions(query), direction = query.sort === 'oldest' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const [records, counts] = await prisma.$transaction([
    prisma.$queryRaw<AuditRecord[]>`SELECT * FROM (${union}) AS events ${where}
      ORDER BY "createdAt" ${direction}, id ${direction} LIMIT ${query.limit ?? 20} OFFSET ${((query.page ?? 1) - 1) * (query.limit ?? 20)}`,
    prisma.$queryRaw<Array<{ total: number }>>`SELECT count(*)::integer AS total FROM (${union}) AS events ${where}`,
  ], { isolationLevel: 'RepeatableRead' });
  return { records, total: counts[0].total };
}

export async function auditRecordFilters() {
  const rows = await prisma.$queryRaw<Array<{ action: string; targetType: string; actorId: string; actorSnapshot: Actor | null }>>`
    SELECT DISTINCT action, "targetType", "actorId", "actorSnapshot" FROM (${union}) AS events
  `;
  const users = await prisma.user.findMany({ where: { id: { in: rows.map(row => row.actorId) } },
    select: { id: true, email: true, username: true, isActive: true } });
  const actors = new Map(users.map(user => [user.id, user]));
  for (const row of rows) if (!actors.has(row.actorId) && row.actorSnapshot) actors.set(row.actorId, row.actorSnapshot);
  return {
    actions: [...new Set(rows.map(row => row.action))].sort(),
    targetTypes: [...new Set(rows.map(row => row.targetType))].sort(),
    actors: [...actors.values()].sort((a, b) => a.email.localeCompare(b.email) || a.id.localeCompare(b.id)),
  };
}
