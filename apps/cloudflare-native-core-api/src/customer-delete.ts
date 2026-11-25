/**
 * Account deletion for native customers.
 *
 * `native_users` is the parent of dozens of child tables and most of them
 * cascade on delete: a plain `DELETE FROM native_users` silently wipes a
 * customer's orders, payments, wallets, and subscriptions, and leaves orphan
 * rows behind in the tables that reference the account without a foreign key.
 *
 * Two modes are built on one schema analysis:
 *
 *  - guarded (the default) removes the row only while nothing references it.
 *  - force removes the account together with everything it owns.
 *
 * The schema is read from the instance itself instead of a hardcoded list, so
 * a table added later — including one created by an extension migration — is
 * covered without a code change, and an unreadable schema fails closed.
 */

export type UserReference = readonly [table: string, column: string];

export type SchemaRow = { name: string; sql: string | null };

export type OnDeleteAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT' | 'NONE';

export interface ForeignKey {
  table: string;
  column: string;
  parentTable: string;
  parentColumn: string;
  onDelete: Exclude<OnDeleteAction, 'NONE'>;
}

/** A column that points at an account, and what the database does with the row when the account goes. */
export interface CustomerReference {
  table: string;
  column: string;
  action: OnDeleteAction;
}

export interface CustomerSchema {
  tables: Set<string>;
  foreignKeys: ForeignKey[];
  references: CustomerReference[];
  /** Tables that triggers insert into, which can gain a row while other rows are being deleted. */
  triggerTargets: Set<string>;
}

const referenceKey = (reference: UserReference): string => `${reference[0]}:${reference[1]}`;

/** Personal or ephemeral state that the guarded delete erases together with the account. */
export const CUSTOMER_DELETE_ERASES: readonly UserReference[] = [
  ['native_carts', 'user_id'],
  ['native_address_book', 'user_id'],
  ['native_bokmoo_notifications', 'user_id'],
  ['native_user_security_events', 'user_id'],
  ['native_external_identities', 'user_id'],
  ['native_identity_transactions', 'user_id'],
  ['native_support_hub_admin_reads', 'admin_user_id'],
];

/** References that must outlive the account in every mode: audit trails and diagnostic logs. */
export const CUSTOMER_DELETE_KEEPS: readonly UserReference[] = [
  ['native_admin_staff_audit_logs', 'staff_user_id'],
  ['native_admin_staff_audit_logs', 'actor_user_id'],
  ['native_error_logs', 'user_id'],
  ['native_admin_memberships', 'created_by_user_id'],
  ['native_admin_memberships', 'updated_by_user_id'],
];

/**
 * Rows that belong to one of the account's orders rather than to the account
 * itself. A force delete removes them, because the queues among them would
 * otherwise keep retrying work for orders that no longer exist.
 */
export const CUSTOMER_DELETE_BY_ORDER: readonly UserReference[] = [
  ['native_checkout_outbox', 'aggregate_id'],
  ['native_email_outbox', 'order_id'],
  ['native_affiliate_commissions', 'order_id'],
  ['native_shipping_provider_orders', 'order_id'],
  ['native_shipping_provider_webhook_events', 'matched_order_id'],
  ['crosspilot_orders', 'platform_order_id'],
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

// ---------------------------------------------------------------------------
// CREATE TABLE parsing
//
// D1 rejects the `pragma_foreign_key_list()` table-valued function, so the
// foreign keys are read from the stored CREATE TABLE text. The parser is
// checked against SQLite's own `PRAGMA foreign_key_list` on the whole
// migration line in admin-users.test.ts.

/** Drops SQL line and block comments that are outside string literals. */
function stripSqlComments(ddl: string): string {
  let out = '';
  let inString = false;
  for (let index = 0; index < ddl.length; index += 1) {
    const char = ddl[index]!;
    if (inString) {
      out += char;
      if (char !== "'") continue;
      if (ddl[index + 1] === "'") {
        out += "'";
        index += 1;
      } else {
        inString = false;
      }
    } else if (char === "'") {
      inString = true;
      out += char;
    } else if (char === '-' && ddl[index + 1] === '-') {
      while (index < ddl.length && ddl[index] !== '\n') index += 1;
      out += '\n';
    } else if (char === '/' && ddl[index + 1] === '*') {
      index += 2;
      while (index < ddl.length && !(ddl[index] === '*' && ddl[index + 1] === '/')) index += 1;
      index += 1;
      out += ' ';
    } else {
      out += char;
    }
  }
  return out;
}

/** The text between the parentheses of a CREATE TABLE statement. */
function tableBody(ddl: string): string | null {
  const text = stripSqlComments(ddl);
  const start = text.indexOf('(');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (char === "'") inString = false;
    } else if (char === "'") {
      inString = true;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(start + 1, index);
    }
  }
  return null;
}

/** Splits a table body into column definitions and table constraints. */
function splitDefinitions(body: string): string[] {
  const definitions: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]!;
    if (inString) {
      if (char === "'") inString = false;
    } else if (char === "'") {
      inString = true;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      definitions.push(body.slice(start, index));
      start = index + 1;
    }
  }
  definitions.push(body.slice(start));
  return definitions.map((definition) => definition.trim()).filter(Boolean);
}

function onDeleteAction(clause: string): Exclude<OnDeleteAction, 'NONE'> {
  const match = clause.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i);
  return match ? (match[1]!.replace(/\s+/g, ' ').toUpperCase() as Exclude<OnDeleteAction, 'NONE'>) : 'NO ACTION';
}

const TABLE_CONSTRAINT = /^FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+"?(\w+)"?\s*\(([^)]*)\)([\s\S]*)$/i;
const COLUMN_CONSTRAINT = /^"?(\w+)"?\s+\w+[\s\S]*?\bREFERENCES\s+"?(\w+)"?\s*\(\s*"?(\w+)"?\s*\)([\s\S]*)$/i;

/** Every foreign key declared by one CREATE TABLE statement. */
function splitNameList(list: string): string[] {
  return list
    .split(',')
    .map((name) => name.trim().replace(/^["[]/, '').replace(/["\]]$/, ''))
    .filter(Boolean);
}

export function parseForeignKeys(table: string, ddl: string | null): ForeignKey[] {
  const body = tableBody(ddl ?? '');
  if (!body) return [];

  const foreignKeys: ForeignKey[] = [];
  for (const definition of splitDefinitions(body)) {
    // `CONSTRAINT name FOREIGN KEY ...` starts like a column; skip the name.
    const clause = definition.replace(/^CONSTRAINT\s+"?\w+"?\s+/i, '');
    const tableLevel = clause.match(TABLE_CONSTRAINT);
    // PRIMARY KEY, UNIQUE, and CHECK constraints never reference another table.
    const columnLevel = /^(PRIMARY|UNIQUE|CHECK)\b/i.test(clause) ? null : clause.match(COLUMN_CONSTRAINT);
    const source = tableLevel ?? columnLevel;
    if (!source) continue;

    // A table-level key may span several columns; each pair is one foreign key.
    const columns = tableLevel ? splitNameList(tableLevel[1]!) : [columnLevel![1]!];
    const parentColumns = tableLevel ? splitNameList(tableLevel[3]!) : [columnLevel![3]!];
    for (const [index, column] of columns.entries()) {
      foreignKeys.push({
        table,
        column,
        parentTable: source[2]!,
        // `REFERENCES t` names no parent column: it is the parent's primary key, column for column.
        parentColumn: parentColumns[index] ?? column,
        onDelete: onDeleteAction(source[4]!),
      });
    }
  }
  return foreignKeys;
}

// ---------------------------------------------------------------------------
// Schema analysis

/** Reads every reference to an account from the instance's table definitions. */
const CREATE_TRIGGER = /^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i;
const TRIGGER_INSERT = /\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+"?([a-z_][a-z0-9_]*)/gi;

/** Reads the tables, their foreign keys, and the triggers from `sqlite_master` rows. */
export function analyzeCustomerSchema(schema: readonly SchemaRow[]): CustomerSchema {
  const references = new Map<string, CustomerReference>();
  const foreignKeys: ForeignKey[] = [];
  const tables = new Set<string>();
  const triggerTargets = new Set<string>();

  for (const { name, sql } of schema) {
    if (sql && CREATE_TRIGGER.test(sql)) {
      for (const match of sql.matchAll(TRIGGER_INSERT)) triggerTargets.add(match[1]!);
      continue;
    }
    tables.add(name);
    if (!sql || name === 'native_users') continue;

    for (const match of sql.matchAll(USER_REFERENCE_COLUMN)) {
      references.set(`${name}:${match[1]}`, { table: name, column: match[1]!, action: 'NONE' });
    }
    for (const foreignKey of parseForeignKeys(name, sql)) {
      foreignKeys.push(foreignKey);
      // A foreign key also covers columns that are not named like an account reference.
      if (foreignKey.parentTable === 'native_users' && foreignKey.parentColumn === 'id') {
        references.set(`${foreignKey.table}:${foreignKey.column}`, {
          table: foreignKey.table,
          column: foreignKey.column,
          action: foreignKey.onDelete,
        });
      }
    }
  }

  const byKey = (a: CustomerReference, b: CustomerReference) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column);
  return { tables, foreignKeys, references: [...references.values()].sort(byKey), triggerTargets };
}

const FOREIGN_KEY_PREDICATES: Array<Pick<ForeignKey, 'table' | 'column' | 'parentTable' | 'onDelete'>> = [
  { table: 'native_admin_memberships', column: 'user_id', parentTable: 'native_users', onDelete: 'CASCADE' },
  { table: 'native_order_snapshots', column: 'user_id', parentTable: 'native_users', onDelete: 'CASCADE' },
  { table: 'native_order_metadata', column: 'user_id', parentTable: 'native_users', onDelete: 'CASCADE' },
];
const REQUIRED_TABLES = ['native_admin_memberships', 'native_checkout_outbox', 'native_admin_staff_audit_logs'];
// The core schema declares well over a hundred foreign keys. Far fewer means
// the parser did not understand the stored definitions.
const MINIMUM_FOREIGN_KEYS = 20;

/** False means "do not delete": an unreadable schema must fail closed, never open. */
export function isCustomerSchemaTrustworthy(schema: CustomerSchema): boolean {
  const hasForeignKey = (wanted: Pick<ForeignKey, 'table' | 'column' | 'parentTable' | 'onDelete'>) =>
    schema.foreignKeys.some(
      (foreignKey) =>
        foreignKey.table === wanted.table
        && foreignKey.column === wanted.column
        && foreignKey.parentTable === wanted.parentTable
        && foreignKey.onDelete === wanted.onDelete,
    );
  return (
    schema.foreignKeys.length >= MINIMUM_FOREIGN_KEYS
    && FOREIGN_KEY_PREDICATES.every(hasForeignKey)
    && REQUIRED_TABLES.every((table) => schema.tables.has(table))
  );
}

// ---------------------------------------------------------------------------
// Guarded delete

export type CustomerDeletePlan = {
  /** Any row here keeps the account from being deleted. */
  blockers: UserReference[];
  /** Removed once the account is gone. */
  erases: UserReference[];
};

export function buildCustomerDeletePlan(schema: CustomerSchema): CustomerDeletePlan {
  const blockers = schema.references
    .filter((reference) => !ERASABLE.has(referenceKey([reference.table, reference.column])) && !KEPT.has(referenceKey([reference.table, reference.column])))
    .map((reference): UserReference => [reference.table, reference.column]);
  const erases = schema.references
    .filter((reference) => ERASABLE.has(referenceKey([reference.table, reference.column])))
    .map((reference): UserReference => [reference.table, reference.column]);
  return { blockers, erases };
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

/** Counts the rows that kept the account from being deleted, for the error response. */
export function buildCustomerBlockerCountSql([table, column]: UserReference): string {
  return `SELECT ?1 AS table_name, ?2 AS column_name, COUNT(*) AS count FROM ${identifier(table)} WHERE ${identifier(column)} = ?3`;
}

// ---------------------------------------------------------------------------
// Force delete

export type CustomerForceDeletePlan = {
  /** Run in this order inside one transaction; every statement takes the account id as `?1`. */
  statements: string[];
  /** Where in `statements` the account itself is deleted. */
  accountDelete: number;
  /**
   * What the wipe touches, for the audit trail: count these before deleting.
   * `detached` marks a table whose foreign key only unlinks its rows from the
   * account instead of removing them.
   */
  counted: Array<{ table: string; column: string; byOrder: boolean; detached: boolean }>;
};

// Only a customer account without a staff membership is deletable.
const DELETABLE_ACCOUNT = `native_users.id = ?1 AND native_users.role = 'USER'
  AND NOT EXISTS (SELECT 1 FROM native_admin_memberships WHERE user_id = ?1)`;

const ACCOUNT_DELETE_SQL = `DELETE FROM native_users
WHERE ${DELETABLE_ACCOUNT}`;

// Every other statement of the wipe waits on the same condition, so one that can
// no longer end with the account removes nothing at all.
const WHILE_DELETABLE = `SELECT 1 FROM native_users WHERE ${DELETABLE_ACCOUNT}`;

const wipeByAccount = (table: string, column: string): string =>
  `DELETE FROM ${identifier(table)} WHERE ${identifier(column)} = ?1 AND EXISTS (${WHILE_DELETABLE})`;

const wipeByOrder = (table: string, column: string): string =>
  `DELETE FROM ${identifier(table)} WHERE ${identifier(column)} IN (SELECT order_id FROM native_order_metadata WHERE user_id = ?1) AND EXISTS (${WHILE_DELETABLE})`;

// A sweep runs once the account is gone, so it also catches what a trigger added on the way.
const sweepAfterAccount = (table: string, column: string): string =>
  `DELETE FROM ${identifier(table)} WHERE ${identifier(column)} = ?1 AND NOT EXISTS (SELECT 1 FROM native_users WHERE id = ?1)`;

/**
 * A force delete lets the database cascade through every ON DELETE CASCADE
 * foreign key and removes the rest explicitly. Two kinds of rows need care:
 *
 *  - Rows whose foreign key is ON DELETE RESTRICT: the database refuses to
 *    delete their parent while they exist, so they go first.
 *  - Rows that reference the account without a foreign key: nothing would
 *    remove them, so they would be orphaned.
 *
 * Every other foreign key check is deferred to the end of the transaction,
 * which is what makes the order of the remaining statements irrelevant.
 */
export function buildCustomerForceDeletePlan(schema: CustomerSchema): CustomerForceDeletePlan {
  const tablesReachableFromAccount = new Set(['native_users']);
  for (let grew = true; grew;) {
    grew = false;
    for (const foreignKey of schema.foreignKeys) {
      if (tablesReachableFromAccount.has(foreignKey.parentTable) && !tablesReachableFromAccount.has(foreignKey.table)) {
        tablesReachableFromAccount.add(foreignKey.table);
        grew = true;
      }
    }
  }

  // Children that would block their parent's removal. They are deleted by the
  // account reference of their own table, so each of them needs one.
  const restrictChildren = new Map<string, Set<string>>();
  for (const foreignKey of schema.foreignKeys) {
    if (foreignKey.onDelete !== 'RESTRICT' || !tablesReachableFromAccount.has(foreignKey.parentTable)) continue;
    if (foreignKey.table === foreignKey.parentTable) continue;
    const parents = restrictChildren.get(foreignKey.table) ?? new Set<string>();
    parents.add(foreignKey.parentTable);
    restrictChildren.set(foreignKey.table, parents);
  }
  for (const table of restrictChildren.keys()) {
    if (!schema.references.some((reference) => reference.table === table)) {
      throw new Error(`Force delete cannot order the rows of "${table}"`);
    }
  }

  // A child goes before its parents: emit each table once nothing that it is a parent of is left.
  const restrictFirst: string[] = [];
  for (let pending = new Set(restrictChildren.keys()); pending.size > 0;) {
    const ready = [...pending].filter((table) => ![...pending].some((other) => restrictChildren.get(other)?.has(table)));
    if (ready.length === 0) throw new Error('Force delete cannot order circular RESTRICT foreign keys');
    for (const table of ready.sort()) {
      pending.delete(table);
      for (const { column } of schema.references.filter((reference) => reference.table === table)) {
        if (!KEPT.has(`${table}:${column}`)) restrictFirst.push(wipeByAccount(table, column));
      }
    }
  }

  const handledByRestrict = new Set(restrictFirst);
  const orphans = schema.references
    .filter((reference) => reference.action === 'NONE' && !KEPT.has(referenceKey([reference.table, reference.column])))
    .map((reference) => wipeByAccount(reference.table, reference.column))
    .filter((statement) => !handledByRestrict.has(statement));

  const byOrder = CUSTOMER_DELETE_BY_ORDER.filter(([table]) => schema.tables.has(table));

  // A trigger can add a row that names the account while the account's own rows go (an audit
  // event for each deleted resume, for instance), after the plan's own pass over that table.
  const sweptAfter = schema.references
    .filter((reference) => schema.triggerTargets.has(reference.table)
      && !KEPT.has(referenceKey([reference.table, reference.column]))
      && reference.action !== 'SET NULL')
    .map((reference) => sweepAfterAccount(reference.table, reference.column));

  const statements = [
    'PRAGMA defer_foreign_keys = on',
    ...byOrder.map(([table, column]) => wipeByOrder(table, column)),
    ...restrictFirst,
    ...orphans,
    ACCOUNT_DELETE_SQL,
    ...sweptAfter,
  ];

  return {
    statements,
    accountDelete: statements.indexOf(ACCOUNT_DELETE_SQL),
    counted: [
      ...byOrder.map(([table, column]) => ({ table, column, byOrder: true, detached: false })),
      ...schema.references
        .filter((reference) => !KEPT.has(referenceKey([reference.table, reference.column])))
        .map((reference) => ({
          table: reference.table,
          column: reference.column,
          byOrder: false,
          detached: reference.action === 'SET NULL' || reference.action === 'SET DEFAULT',
        })),
    ],
  };
}

/** One row per table: how many rows of that table belong to the account (directly, or through one of its orders). */
export function buildCustomerRowCountSql(
  { table, column, byOrder }: { table: string; column: string; byOrder: boolean },
): string {
  const scope = byOrder ? 'IN (SELECT order_id FROM native_order_metadata WHERE user_id = ?3)' : '= ?3';
  return `SELECT ?1 AS table_name, ?2 AS column_name, COUNT(*) AS count FROM ${identifier(table)} WHERE ${identifier(column)} ${scope}`;
}

// ---------------------------------------------------------------------------
// Audit trail

/** Written in the same transaction as the delete, and only when the account is really gone. */
export const CUSTOMER_DELETE_AUDIT_ACTION = 'customer.delete';
export const CUSTOMER_FORCE_DELETE_AUDIT_ACTION = 'customer.force_delete';
export const CUSTOMER_DELETE_AUDIT_SQL = `
INSERT INTO native_admin_staff_audit_logs
  (id, staff_user_id, staff_email, staff_username, actor_user_id, actor_email, actor_username, action, metadata, created_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
WHERE NOT EXISTS (SELECT 1 FROM native_users WHERE id = ?2)`;
