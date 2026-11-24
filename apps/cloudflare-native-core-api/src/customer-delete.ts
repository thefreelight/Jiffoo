/**
 * Account deletion guard for native customers.
 *
 * `native_users` is the parent of dozens of child tables and most of them
 * cascade on delete: a plain `DELETE FROM native_users` silently wipes a
 * customer's orders, payments, wallets, and subscriptions. A customer may
 * therefore only be removed while the account is still bare.
 *
 * The references are discovered from the instance's own schema instead of a
 * hardcoded list, so a table added later — including one created by an
 * extension migration — blocks deletion by default. Only the personal or
 * ephemeral state listed in CUSTOMER_DELETE_ERASES goes away with the account,
 * and only after the delete has actually gone through.
 */

export type UserReference = readonly [table: string, column: string];

export type SchemaRow = { name: string; sql: string | null };

const referenceKey = (reference: UserReference): string => `${reference[0]}:${reference[1]}`;

/** Personal or ephemeral state that is erased together with the account. */
export const CUSTOMER_DELETE_ERASES: readonly UserReference[] = [
  ['native_carts', 'user_id'],
  ['native_address_book', 'user_id'],
  ['native_bokmoo_notifications', 'user_id'],
  ['native_user_security_events', 'user_id'],
  ['native_external_identities', 'user_id'],
  ['native_identity_transactions', 'user_id'],
  ['native_support_hub_admin_reads', 'admin_user_id'],
];

/** References that must outlive the account: audit trails and diagnostic logs. */
export const CUSTOMER_DELETE_KEEPS: readonly UserReference[] = [
  ['native_admin_staff_audit_logs', 'staff_user_id'],
  ['native_admin_staff_audit_logs', 'actor_user_id'],
  ['native_error_logs', 'user_id'],
  ['native_admin_memberships', 'created_by_user_id'],
  ['native_admin_memberships', 'updated_by_user_id'],
];

const ERASABLE = new Set(CUSTOMER_DELETE_ERASES.map(referenceKey));
const KEPT = new Set(CUSTOMER_DELETE_KEEPS.map(referenceKey));

// A column definition such as `user_id TEXT NOT NULL` (with or without a
// FOREIGN KEY clause) or `admin_user_id TEXT`. The lookbehind keeps the match
// on an identifier boundary, so it also works for inline (single-line) bodies.
const USER_REFERENCE_COLUMN = /(?<![\w"])([a-z0-9_]*user_id)\s+(?:TEXT|INTEGER|BLOB)\b/gi;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function identifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error(`Unexpected schema identifier: ${value}`);
  return `"${value}"`;
}

/** Every `*user_id` column of every table in the given schema, except native_users itself. */
export function discoverUserReferences(schema: readonly SchemaRow[]): UserReference[] {
  const found = new Map<string, UserReference>();
  for (const { name, sql } of schema) {
    if (!sql || name === 'native_users') continue;
    for (const match of sql.matchAll(USER_REFERENCE_COLUMN)) {
      const reference: UserReference = [name, match[1]!];
      found.set(referenceKey(reference), reference);
    }
  }
  return [...found.values()].sort(
    ([aTable, aColumn], [bTable, bColumn]) => aTable.localeCompare(bTable) || aColumn.localeCompare(bColumn),
  );
}

export type CustomerDeletePlan = {
  /** Any row here keeps the account from being deleted. */
  blockers: UserReference[];
  /** Removed once the account is gone. */
  erases: UserReference[];
};

export function buildCustomerDeletePlan(schema: readonly SchemaRow[]): CustomerDeletePlan {
  const references = discoverUserReferences(schema);
  return {
    blockers: references.filter((reference) => !ERASABLE.has(referenceKey(reference)) && !KEPT.has(referenceKey(reference))),
    erases: references.filter((reference) => ERASABLE.has(referenceKey(reference))),
  };
}

// Core tables present on every native instance. If any of them is missing from
// a plan, the schema could not be read and the plan must not be trusted.
const REQUIRED_BLOCKERS = [
  'native_admin_memberships:user_id',
  'native_order_metadata:user_id',
  'native_order_snapshots:user_id',
];

/** False means "do not delete": an unreadable schema must fail closed, never open. */
export function isCustomerDeletePlanTrustworthy(plan: CustomerDeletePlan): boolean {
  const blockers = new Set(plan.blockers.map(referenceKey));
  return REQUIRED_BLOCKERS.every((key) => blockers.has(key));
}

/**
 * One atomic statement: the row disappears only while nothing references it,
 * so there is no gap between the check and the delete for an order to slip in.
 */
export function buildGuardedCustomerDeleteSql(blockers: readonly UserReference[]): string {
  return [
    'DELETE FROM native_users',
    "WHERE id = ?1 AND role = 'USER'",
    ...blockers.map(([table, column]) => `  AND NOT EXISTS (SELECT 1 FROM ${identifier(table)} WHERE ${identifier(column)} = ?1)`),
  ].join('\n');
}

/** Erases one piece of personal state, but only if the account really was deleted. */
export function buildCustomerEraseSql([table, column]: UserReference): string {
  return `DELETE FROM ${identifier(table)} WHERE ${identifier(column)} = ?1 AND NOT EXISTS (SELECT 1 FROM native_users WHERE id = ?1)`;
}

/** Audit trail for the deletion, written in the same transaction and only when the delete happened. */
export const CUSTOMER_DELETE_AUDIT_ACTION = 'customer.delete';
export const CUSTOMER_DELETE_AUDIT_SQL = `
INSERT INTO native_admin_staff_audit_logs
  (id, staff_user_id, staff_email, staff_username, actor_user_id, actor_email, actor_username, action, metadata, created_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
WHERE NOT EXISTS (SELECT 1 FROM native_users WHERE id = ?2)`;

/** Counts the rows that kept the account from being deleted, for the error response. */
export function buildCustomerBlockerCountSql([table, column]: UserReference): string {
  return `SELECT ?1 AS table_name, ?2 AS column_name, COUNT(*) AS count FROM ${identifier(table)} WHERE ${identifier(column)} = ?3`;
}
