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
type FilterRow = { action: string; targetType: string; actorId: string; actorSnapshot: Actor | null };

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

/**
 * The staff audit log as the audit relation projects it.
 *
 * The columns are the ones the audit filters and counts on, with the same
 * expressions the audit relation uses, so a staff row is read the same way
 * whether it is read through the relation or through this projection. The
 * projection lets the staff side be read with its own index instead of
 * scanning the union of both audit tables.
 *
 * The raw conditions are part of the projection, so they constrain the raw
 * columns of the table and its index can serve them. The projected conditions
 * of the caller still apply on top of them.
 */
function staffAuditProjection(rawConditions: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT COALESCE("actorUserId", 'system') AS "actorId",
      CASE WHEN action = 'ADMIN_INVITED' AND metadata->>'reinvite' = 'true' THEN 'ADMIN_REINVITED' ELSE action END AS action,
      CASE WHEN action = 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED' THEN 'customer'
        WHEN action = 'THEME_UNSIGNED_INSTALL_CONFIRMED' THEN 'theme'
        WHEN action = 'BUILTIN_PLUGIN_INSTALLED' THEN 'plugin' ELSE 'staff' END AS "targetType",
      "createdAt"
    FROM public.admin_staff_audit_logs
    ${rawConditions}
  `;
}

/**
 * The staff audit log as the audit relation projects it, with the actor
 * snapshot the filter list reports.
 */
function staffAuditActorProjection(): Prisma.Sql {
  return Prisma.sql`
    SELECT COALESCE("actorUserId", 'system') AS "actorId",
      CASE WHEN action = 'ADMIN_INVITED' AND metadata->>'reinvite' = 'true' THEN 'ADMIN_REINVITED' ELSE action END AS action,
      CASE WHEN action = 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED' THEN 'customer'
        WHEN action = 'THEME_UNSIGNED_INSTALL_CONFIRMED' THEN 'theme'
        WHEN action = 'BUILTIN_PLUGIN_INSTALLED' THEN 'plugin' ELSE 'staff' END AS "targetType",
      CASE WHEN "actorUserId" IS NULL OR "actorUserId" = 'system' THEN NULL::jsonb
        ELSE jsonb_build_object('id', "actorUserId", 'email', COALESCE("actorEmail", ''),
          'username', COALESCE("actorUsername", ''), 'isActive', false) END AS "actorSnapshot"
    FROM public.admin_staff_audit_logs
  `;
}

/**
 * The raw condition of the staff rows that project to a target type.
 *
 * The staff rows project their target type from their action, so the target
 * type is constrained through the actions that project to it. A target type
 * that the staff rows never project has no raw condition.
 */
function staffTargetTypeCondition(targetType: string): Prisma.Sql | null {
  if (targetType === 'customer') return Prisma.sql`action = 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED'`;
  if (targetType === 'theme') return Prisma.sql`action = 'THEME_UNSIGNED_INSTALL_CONFIRMED'`;
  if (targetType === 'plugin') return Prisma.sql`action = 'BUILTIN_PLUGIN_INSTALLED'`;
  if (targetType === 'staff') return Prisma.sql`action NOT IN ('CUSTOMER_PASSWORD_RESET_LINK_GENERATED', 'THEME_UNSIGNED_INSTALL_CONFIRMED', 'BUILTIN_PLUGIN_INSTALLED')`;
  return null;
}

/**
 * The raw condition of the staff rows of a category.
 *
 * The projected condition of a category combines a target type and an action
 * prefix. The staff rows project their target type from their action, so the
 * target type part is constrained through the actions that project to it.
 */
function staffCategoryCondition(category: string): Prisma.Sql | null {
  if (category === 'accounts') {
    return Prisma.sql`(action NOT IN ('THEME_UNSIGNED_INSTALL_CONFIRMED', 'BUILTIN_PLUGIN_INSTALLED') OR starts_with(action, 'STAFF_') OR starts_with(action, 'CUSTOMER_'))`;
  }
  if (category === 'system') return Prisma.sql`starts_with(action, 'CORE_')`;
  if (category === 'code') return Prisma.sql`action LIKE 'storefront-code.%'`;
  const prefix = category === 'settings' ? 'STORE_' : category === 'notification' ? 'NOTIFICATION_' : category === 'payment' ? 'PAYMENT_' : category + '.';
  const targetType = staffTargetTypeCondition(category);
  return targetType ? Prisma.sql`(${targetType} OR starts_with(action, ${prefix}))` : Prisma.sql`starts_with(action, ${prefix})`;
}

/**
 * The conditions of the staff audit log, on its raw columns.
 *
 * The staff rows are projected into the audit relation, so a condition on a
 * projected column cannot use an index of the table: the actor of the
 * projection is an expression, and so are the action and the target type.
 * The conditions below constrain the raw columns instead, so the index of the
 * table can serve them. Every condition covers the rows the projected
 * conditions of the caller keep:
 *
 * - the actor is the raw `actorUserId`; the rows without an actor report
 *   "system" in the projection;
 * - the action is the raw `action`; the projection reports a reinvited
 *   administrator as "ADMIN_REINVITED";
 * - the target type and the category of a row follow from its raw action.
 */
function staffConditions(query: AuditQuery): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (query.actorId) {
    clauses.push(query.actorId === 'system'
      ? Prisma.sql`("actorUserId" = ${query.actorId} OR "actorUserId" IS NULL)`
      : Prisma.sql`"actorUserId" = ${query.actorId}`);
  }
  if (query.action) {
    if (query.action === 'ADMIN_REINVITED') {
      clauses.push(Prisma.sql`((action = 'ADMIN_INVITED' AND metadata->>'reinvite' = 'true') OR action = 'ADMIN_REINVITED')`);
    } else if (query.action === 'ADMIN_INVITED') {
      clauses.push(Prisma.sql`action = 'ADMIN_INVITED' AND (metadata->>'reinvite' IS DISTINCT FROM 'true')`);
    } else {
      clauses.push(Prisma.sql`action = ${query.action}`);
    }
  }
  if (query.targetType) {
    const targetType = staffTargetTypeCondition(query.targetType);
    if (targetType) clauses.push(targetType);
  }
  if (query.category) {
    const category = staffCategoryCondition(query.category);
    if (category) clauses.push(category);
  }
  return clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}` : Prisma.empty;
}

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
  const [records, eventCounts, staffCounts] = await prisma.$transaction([
    prisma.$queryRaw<AuditRecord[]>`SELECT * FROM (${union}) AS events ${where}
      ORDER BY "createdAt" ${direction}, id ${direction} LIMIT ${query.limit ?? 20} OFFSET ${((query.page ?? 1) - 1) * (query.limit ?? 20)}`,
    prisma.$queryRaw<Array<{ total: number }>>`SELECT count(*)::integer AS total FROM public.admin_audit_events ${where}`,
    prisma.$queryRaw<Array<{ total: number }>>`SELECT count(*)::integer AS total FROM (${staffAuditProjection(staffConditions(query))}) AS events ${where}`,
  ], { isolationLevel: 'RepeatableRead' });
  return { records, total: eventCounts[0].total + staffCounts[0].total };
}

/**
 * The distinct filter values of the audit records.
 *
 * Every table is asked for its own distinct values, so each side is read with
 * its own index instead of scanning and sorting the union of both audit tables.
 * The values are merged in the application, so the reported actions, target
 * types and actors stay the same.
 */
export async function auditRecordFilters() {
  const [eventRows, staffRows] = await Promise.all([
    prisma.$queryRaw<FilterRow[]>`SELECT DISTINCT action, "targetType", "actorId", NULL::jsonb AS "actorSnapshot" FROM public.admin_audit_events`,
    prisma.$queryRaw<FilterRow[]>`SELECT DISTINCT action, "targetType", "actorId", "actorSnapshot" FROM (${staffAuditActorProjection()}) AS events`,
  ]);
  const rows = [...eventRows, ...staffRows];
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
