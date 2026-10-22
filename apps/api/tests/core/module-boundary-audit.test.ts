/**
 * Module boundary audit (WP-D2 / D-3).
 *
 * A static, source-level audit of `apps/api/src/core/**`. It needs no database,
 * no Redis instance and no network: it reads the source tree, parses it with the
 * TypeScript compiler API and compares the result with two explicit, reviewed
 * registers that live in this file.
 *
 * Check 1 — cross-module import graph
 *   Every import that crosses a module boundary must be an approved edge
 *   (`from -> to`) and must bind to a *publicly exported* symbol of the target
 *   module. Reaching into another module's private helper file is a violation.
 *
 * Check 2 — cross-domain table writes
 *   Every table has exactly one owning module. A write (`prisma.<model>.<write>`,
 *   `tx.<model>.<write>` or a raw `INSERT`/`UPDATE`/`DELETE` against
 *   `public.<table>`) from a module that does not own the table is a violation.
 *   Reads are never violations.
 *
 * ── How to add an entry ──────────────────────────────────────────────────────
 * LEGAL_EDGES        one key per approved cross-module edge (`from -> to`) plus a
 *                    one-line reason saying why the dependency is legitimate.
 *                    A new cross-module import fails the audit until its edge is
 *                    added here with a reason.
 * TABLE_OWNERS       one owning module per table. A table that is written from a
 *                    second module fails the audit until that module is either
 *                    removed as a writer or the table is recorded below.
 * KNOWN_VIOLATIONS   the still-open exceptions. Every entry names the file, what
 *                    is wrong, and the batch/decision that owns the follow-up.
 *                    An entry that no longer matches a real violation fails the
 *                    audit, so the list cannot go stale.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { apiSourceFiles } from '../helpers/module-state-audit';

const CORE_ROOT = path.resolve('src/core');
const SCHEMA_ROOT = path.resolve('prisma/schema');

/**
 * Section 1 — approved cross-module edges.
 *
 * A key is `<from module> -> <to module>`. A module is the directory path of a
 * file below `src/core` (`core/order/service.ts` → `order`,
 * `core/admin/order-management/service.ts` → `admin/order-management`).
 */
const LEGAL_EDGES: Record<string, string> = {
  'account -> admin/staff-management': 'the account routes translate the public `StaffManagementError` of the staff module into the shared error shape.',
  'account -> auth': 'the account module uses the auth module\'s public middleware and email-verification service.',
  'account -> upload': 'the account routes publish profile media through the public upload service.',
  'admin/audit-events -> audit': 'the admin audit-events routes read the audit module\'s public record projection.',
  'admin/dashboard -> admin/order-management': 'the dashboard reuses the order-management module\'s public `paymentReviewWhere` filter builder.',
  'admin/dashboard -> cache': 'the dashboard reads cached metrics through the public cache service.',
  'admin/dashboard -> settings': 'the dashboard reads system settings through the public settings service.',
  'admin/extension-installer -> admin/plugin-management': 'the installer calls the plugin-management module\'s public service, config crypto and lifecycle hooks.',
  'admin/extension-installer -> audit': 'the installer records audit events through the single audit write outlet.',
  'admin/extension-installer -> auth': 'the installer routes authenticate through the public auth middleware.',
  'admin/extension-installer -> cache': 'the installer invalidates cache entries through the public cache service.',
  'admin/extension-installer -> extensions/shared': 'the installer re-exports the neutral extension helpers that B-BOUND-C moved out of this module.',
  'admin/extension-installer -> plugin-pages': 'the plugin runtime enforces the public plugin-page origin policy.',
  'admin/extension-installer -> plugins': 'the installer uses the public durable-task API (`assertTaskClaim`, `withTaskScope`, task policy).',
  'admin/extension-installer -> storage': 'the installer resolves package blobs, current packages and operation leases through the public storage stores.',
  'admin/health-monitoring -> admin/extension-installer': 'the health monitor reads the public plugin runtime state.',
  'admin/health-monitoring -> plugins': 'the health monitor reads the public plugin task health projection.',
  'admin/notifications -> audit': 'the admin notification routes record audit events through the audit outlet.',
  'admin/notifications -> auth': 'the admin notification routes resolve recipients through the public email-verification service.',
  'admin/order-management -> admin/extension-installer': 'the admin order module reads the public plugin runtime state.',
  'admin/order-management -> admin/system-settings': 'the admin order export reads system settings through the re-export shim of the relocated settings module.',
  'admin/order-management -> audit': 'the admin order module records audit events through the audit outlet.',
  'admin/order-management -> cache': 'the admin order module invalidates cached catalog and order entries.',
  'admin/order-management -> inventory': 'the admin order module reads stock through the public inventory service.',
  'admin/order-management -> order': 'the admin order module drives the order state machine through the order module\'s public service.',
  'admin/order-management -> payment': 'the admin order module uses the payment module\'s public service and reconciliation entry points.',
  'admin/order-management -> settings': 'the admin order module reads system settings through the public settings service.',
  'admin/order-management -> shared': 'the admin order module takes the neutral row-lock helper from the shared layer.',
  'admin/plugin-management -> admin/extension-installer': 'plugin management calls the installer\'s public upload, manifest, migration, registry-version and runtime API.',
  'admin/plugin-management -> cache': 'plugin management invalidates cached plugin entries.',
  'admin/plugin-management -> extensions/registry': 'plugin management reads the read-only provider registry.',
  'admin/plugin-management -> logger': 'plugin management logs through the unified logger.',
  'admin/plugin-management -> plugins': 'plugin management uses the public durable-task API.',
  'admin/plugin-management -> storage': 'plugin management resolves packages and operation leases through the public storage stores.',
  'admin/product-management -> admin/system-settings': 'the admin product module reads system settings through the re-export shim of the relocated settings module.',
  'admin/product-management -> cache': 'the admin product module invalidates the product cache.',
  'admin/product-management -> inventory': 'the admin product module sets variant stock through the public inventory service.',
  'admin/product-management -> order': 'the admin product module asks the order module whether a product is referenced by an order item.',
  'admin/product-management -> settings': 'the admin product module reads system settings through the public settings service.',
  'admin/product-management -> upload': 'the admin product routes publish product media through the public upload service.',
  'admin/staff-management -> auth': 'the staff module uses the public account-recovery and email-verification services.',
  'admin/system-settings -> settings': 'the old admin path is a pure re-export shim of the relocated settings module.',
  'admin/user-management -> admin/system-settings': 'the admin user module reads system settings through the re-export shim of the relocated settings module.',
  'admin/user-management -> audit': 'the admin user module records audit events through the audit outlet.',
  'admin/user-management -> auth': 'the admin user module issues password-reset links through the public auth account-recovery service.',
  'admin/user-management -> cache': 'the admin user module invalidates cached user entries.',
  'auth -> cache': 'the auth module caches token and settings entries.',
  'auth -> logger': 'the auth module logs through the shared logger.',
  'auth -> notifications': 'the auth module sends verification and recovery notifications through the public notification service.',
  'auth -> plugin-pages': 'the auth middleware enforces the public plugin-page origin policy.',
  'cart -> auth': 'the cart routes authenticate through the public auth middleware.',
  'cart -> product': 'the cart service reads the sellable catalog through the product module\'s public projection.',
  'checkout -> admin/extension-installer': 'the checkout service records plugin failures and calls plugin contracts through the public plugin runtime.',
  'checkout -> auth': 'the checkout routes authenticate through the public auth middleware.',
  'checkout -> cart': 'the checkout service consumes the cart through the public cart service.',
  'checkout -> extensions/registry': 'the checkout service resolves payment providers through the read-only registry.',
  'checkout -> settings': 'the checkout service reads system settings through the public settings service.',
  'checkout -> shared': 'the checkout service uses the neutral money helper.',
  'extensions/registry -> extensions/shared': 'the registry reuses the neutral extension helpers.',
  'extensions/shared -> storage': 'the neutral extension helpers resolve package roots through the public plugin package store.',
  'inventory -> cache': 'the inventory service bumps the product cache version.',
  'notifications -> admin/extension-installer': 'the notification delivery calls plugins through the public plugin runtime and gateway-protection helpers.',
  'notifications -> extensions/registry': 'the notification delivery resolves the notification provider through the read-only registry.',
  'notifications -> order': 'the notification service reads the order through the order module\'s public projection.',
  'order -> admin/extension-installer': 'the order service calls plugin contracts and records plugin failures through the public plugin runtime.',
  'order -> auth': 'the order routes authenticate through the public auth middleware.',
  'order -> cart': 'the order service consumes purchased cart lines through the public cart service (`CartService.consumePurchasedItems`).',
  'order -> checkout': 'the order service re-quotes the purchased lines through the public checkout service.',
  'order -> extensions/registry': 'the order service resolves payment providers through the read-only registry.',
  'order -> inventory': 'the order service checks and reserves stock through the public inventory service.',
  'order -> logger': 'the order service logs through the unified logger.',
  'order -> payment': 'the order service drives the payment module through its public service.',
  'order -> product': 'the order service reads the sellable catalog through the product module\'s public projection.',
  'order -> settings': 'the order service reads system settings through the public settings service.',
  'order -> shared': 'the order module uses the neutral money, pricing and row-lock helpers.',
  'payment -> admin/extension-installer': 'the payment module calls plugin contracts and uses the public gateway-protection and plugin-runtime helpers.',
  'payment -> audit': 'the payment module records audit events through the audit outlet.',
  'payment -> auth': 'the payment routes authenticate through the public auth middleware.',
  'payment -> cache': 'the payment routes invalidate cached entries.',
  'payment -> extensions/registry': 'the payment module resolves providers through the read-only registry.',
  'payment -> logger': 'the payment routes log through the unified logger.',
  'payment -> notifications': 'the payment module emits notifications through the public notification service.',
  'payment -> order': 'the payment module reports payment outcomes through the order module\'s public service.',
  'payment -> settings': 'the payment routes read system settings through the public settings service.',
  'payment -> shared': 'the payment module uses the neutral money and row-lock helpers.',
  'plugin-pages -> admin/extension-installer': 'the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  'plugin-pages -> storage': 'the plugin-page asset routes read package blobs through the public storage stores.',
  'plugins -> admin/extension-installer': 'the task worker invokes plugin tasks through the public plugin runtime.',
  'plugins -> audit': 'the task module records audit events through the audit outlet.',
  'product -> cache': 'the product module reads and invalidates cached catalog entries.',
  'product -> inventory': 'the product projection reads stock through the public inventory service.',
  'product -> settings': 'the product module reads system settings through the public settings service.',
  'settings -> audit': 'the settings module records audit events through the audit outlet.',
  'settings -> cache': 'the settings module invalidates cached settings entries.',
  'storage -> admin/extension-installer': 'the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  'storage -> extensions/shared': 'the storage module uses the neutral extension types and helpers.',
  'store -> settings': 'the storefront routes read system settings through the public settings service.',
  'upload -> storage': 'the upload service publishes media through the public uploaded-media set store.',
};

/**
 * Section 2 — table ownership.
 *
 * Exactly one module may write a table. The key is the physical table name
 * (`@@map`), the value is the owning module. `infra` marks a table that is owned
 * outside `apps/api/src/core` (the outbox and the core-process registry).
 */
const TABLE_OWNERS: Record<string, string> = {
  // catalogue
  categories: 'admin/product-management',
  category_translations: 'admin/product-management',
  products: 'admin/product-management',
  product_translations: 'admin/product-management',
  product_variants: 'admin/product-management',
  inventory_adjustments: 'inventory',
  // cart
  carts: 'cart',
  cart_items: 'cart',
  // order
  orders: 'order',
  order_items: 'order',
  order_shipping_addresses: 'order',
  order_status_history: 'order',
  order_number_counters: 'order',
  order_purchase_claims: 'order',
  shipments: 'order',
  shipment_items: 'order',
  // payment
  payments: 'payment',
  refunds: 'payment',
  payment_ledger: 'payment',
  refund_ledger: 'payment',
  payment_observations: 'payment',
  payment_provider_accounts: 'payment',
  payment_provider_bindings: 'payment',
  // identity
  users: 'auth',
  auth_tokens: 'auth',
  // platform
  system_settings: 'settings',
  notifications: 'notifications',
  admin_audit_events: 'audit',
  admin_staff_audit_logs: 'audit',
  storefront_code_configurations: 'admin/storefront-code',
  storefront_code_revisions: 'admin/storefront-code',
  // plugins and themes
  plugin_installs: 'admin/plugin-management',
  plugin_installations: 'admin/plugin-management',
  plugin_package_blobs: 'storage',
  plugin_operation_leases: 'storage',
  plugin_namespaces: 'admin/extension-installer',
  plugin_migration_attempts: 'admin/extension-installer',
  plugin_migration_operations: 'admin/extension-installer',
  plugin_migration_successes: 'admin/extension-installer',
  themes: 'admin/extension-installer',
  theme_active: 'admin/extension-installer',
  theme_activations: 'admin/extension-installer',
  theme_configurations: 'admin/extension-installer',
  theme_config_revisions: 'admin/extension-installer',
  theme_package_blobs: 'storage',
  plugin_principals: 'plugins',
  plugin_tasks: 'plugins',
  plugin_task_attempts: 'plugins',
  plugin_task_final_failures: 'plugins',
  plugin_task_execution_slots: 'plugins',
  plugin_task_scheduler: 'plugins',
  plugin_task_fairness: 'plugins',
  // written outside apps/api/src/core
  event_records: 'infra',
  event_deliveries: 'infra',
  plugin_event_subscriptions: 'infra',
  core_processes: 'infra',
};

/**
 * Section 3 — the still-open violations.
 *
 * Each entry is one tracked exception. `file` is relative to `src/core`;
 * `module` pins a module edge (`from -> to`) or a writing module; `table` pins a
 * physical table; `specifier` pins one import specifier. `owner` names the
 * batch or decision that owns the follow-up. An entry that no longer matches a
 * real violation fails the audit.
 */
type KnownViolation = {
  file: string;
  module?: string;
  table?: string;
  specifier?: string;
  reason: string;
  owner: string;
};

const KNOWN_VIOLATIONS: KnownViolation[] = [
  {
    file: 'admin/storefront-code/service.ts',
    module: 'admin/storefront-code -> admin/extension-installer',
    specifier: '@/core/admin/extension-installer/theme-runtime',
    reason: 'the storefront-code module imports the generic `audit` helper that happens to live in the theme runtime; that helper is an internal helper of another module and belongs in the neutral `core/audit` module.',
    owner: 'B-BOUND-D follow-up: move the shared audit helper into `core/audit` and import it from there.',
  },
  {
    file: 'admin/extension-installer/plugin-migration-executor.ts',
    table: 'admin_audit_events',
    reason: 'the migration executor writes the `admin_audit_events` row with raw SQL inside its own manual transaction instead of going through the `core/audit` write outlet.',
    owner: 'B-BOUND-D follow-up: extend the audit outlet so the migration executor can use it instead of raw SQL.',
  },
  {
    file: 'account/service.ts',
    table: 'users',
    reason: 'the account module updates the `users` row directly instead of calling a public service of the auth module that owns the table.',
    owner: 'B-BOUND-D follow-up: decide the owner of the `users` table and route the profile update through it.',
  },
  {
    file: 'admin/staff-management/service.ts',
    table: 'users',
    reason: 'the staff module creates and updates `users` rows directly instead of calling the auth module that owns the table.',
    owner: 'B-BOUND-D follow-up: decide the owner of the `users` table and route staff writes through it.',
  },
  {
    file: 'admin/user-management/service.ts',
    table: 'users',
    reason: 'the admin user module creates, updates and deletes `users` rows directly instead of calling the auth module that owns the table.',
    owner: 'B-BOUND-D follow-up: decide the owner of the `users` table and route admin user writes through it.',
  },
  {
    file: 'install/service.ts',
    table: 'users',
    reason: 'the installer creates the first administrator `users` row directly instead of calling the auth module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the bootstrap administrator creation through the auth module.',
  },
  {
    file: 'admin/staff-management/service.ts',
    table: 'auth_tokens',
    reason: 'the staff module revokes `auth_tokens` rows directly instead of calling the auth module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the staff token revocation through the auth module.',
  },
  {
    file: 'admin/extension-installer/builtin-sync.ts',
    table: 'admin_staff_audit_logs',
    reason: 'the builtin sync writes the legacy staff audit table directly; the audit write outlet only covers `admin_audit_events`.',
    owner: 'B-BOUND-D follow-up: route the remaining audit tables through the `core/audit` outlet.',
  },
  {
    file: 'admin/extension-installer/theme-service.ts',
    table: 'admin_staff_audit_logs',
    reason: 'the theme service writes the legacy staff audit table directly; the audit write outlet only covers `admin_audit_events`.',
    owner: 'B-BOUND-D follow-up: route the remaining audit tables through the `core/audit` outlet.',
  },
  {
    file: 'admin/staff-management/service.ts',
    table: 'admin_staff_audit_logs',
    reason: 'the staff module writes the legacy staff audit table directly; the audit write outlet only covers `admin_audit_events`.',
    owner: 'B-BOUND-D follow-up: route the remaining audit tables through the `core/audit` outlet.',
  },
  {
    file: 'auth/account-recovery.ts',
    table: 'admin_staff_audit_logs',
    reason: 'the account-recovery flow writes the legacy staff audit table directly; the audit write outlet only covers `admin_audit_events`.',
    owner: 'B-BOUND-D follow-up: route the remaining audit tables through the `core/audit` outlet.',
  },
  {
    file: 'admin/notifications/routes.ts',
    table: 'notifications',
    reason: 'the admin notification routes create and update `notifications` rows directly instead of calling the notifications module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the admin notification actions through the notification service.',
  },
  {
    file: 'inventory/service.ts',
    table: 'product_variants',
    reason: 'the inventory module writes the `product_variants` stock level; B-BOUND-A moved the stock write into `InventoryService.applyDesiredStock` on purpose, so the table still has a second writer.',
    owner: 'B-BOUND-A decision (accepted): the stock field of `product_variants` is owned by the inventory module; the guard cannot express field-level ownership.',
  },
  {
    file: 'admin/extension-installer/plugin-registry-version.ts',
    table: 'system_settings',
    reason: 'the installer bumps the plugin registry version by writing the `system_settings` row directly instead of calling the settings module that owns the table.',
    owner: 'B-BOUND-D follow-up: expose the registry version through the settings module.',
  },
  {
    file: 'auth/api-token.ts',
    table: 'system_settings',
    reason: 'the api-token module persists the token list into the `system_settings` JSON blob directly instead of calling the settings module that owns the table.',
    owner: 'B-BOUND-D follow-up: move the API-token setting into a table owned by the auth module.',
  },
  {
    file: 'install/service.ts',
    table: 'system_settings',
    reason: 'the installer writes the `system_settings` row directly instead of calling the settings module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the installation settings write through the settings module.',
  },
  {
    file: 'admin/extension-installer/plugin-fs-installer.ts',
    table: 'plugin_installations',
    reason: 'the filesystem installer creates and updates the `plugin_installations` row directly instead of calling the plugin-management module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the installation writes through `PluginManagementService`.',
  },
  {
    file: 'admin/extension-installer/plugin-failure.ts',
    table: 'plugin_installations',
    reason: 'the failure recorder writes the last-failure fields of the `plugin_installations` row directly instead of calling the plugin-management module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the failure bookkeeping through `PluginManagementService`.',
  },
  {
    file: 'plugins/tasks.ts',
    table: 'plugin_installations',
    reason: 'the durable-task module writes the `plugin_installations` dependency flag directly instead of calling the plugin-management module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the dependency flag through `PluginManagementService`.',
  },
  {
    file: 'admin/extension-installer/plugin-fs-installer.ts',
    table: 'plugin_installs',
    reason: 'the filesystem installer creates and updates the `plugin_installs` row directly instead of calling the plugin-management module that owns the table.',
    owner: 'B-BOUND-D follow-up: route the installation writes through `PluginManagementService`.',
  },
  {
    file: 'admin/extension-installer/plugin-migration-gate.ts',
    table: 'plugin_operation_leases',
    reason: 'the migration gate deletes `plugin_operation_leases` rows directly instead of using the storage module that owns the lease.',
    owner: 'B-BOUND-D follow-up: expose a lease-reclaim entry point in the storage module.',
  },
  {
    file: 'admin/extension-installer/plugin-recovery.ts',
    table: 'plugin_operation_leases',
    reason: 'the recovery sweep deletes `plugin_operation_leases` rows directly instead of using the storage module that owns the lease.',
    owner: 'B-BOUND-D follow-up: expose a lease-reclaim entry point in the storage module.',
  },
  {
    file: 'admin/extension-installer/plugin-recovery.ts',
    table: 'plugin_task_execution_slots',
    reason: 'the recovery sweep deletes released `plugin_task_execution_slots` rows with raw SQL instead of calling the durable-task module that owns the table.',
    owner: 'B-BOUND-D follow-up: expose a slot-prune entry point in the durable-task module.',
  },
  {
    file: 'admin/extension-installer/plugin-recovery.ts',
    table: 'core_processes',
    reason: 'the recovery sweep prunes `core_processes` rows with raw SQL; the table is owned by the core-process registry in `src/infra`.',
    owner: 'B-BOUND-D follow-up: expose a retention sweep in the infra core-process registry.',
  },
];

// ── analysis ────────────────────────────────────────────────────────────────

const coreFiles = apiSourceFiles(CORE_ROOT);
const config = ts.readConfigFile(path.resolve('tsconfig.json'), ts.sys.readFile);
const compilerOptions = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
const program = ts.createProgram(coreFiles, compilerOptions);
const checker = program.getTypeChecker();

const relative = (file: string) => path.relative(CORE_ROOT, file).replaceAll('\\', '/');

/** The module of a core file: its directory path below `src/core`. */
function moduleOf(file: string): string {
  const dir = path.posix.dirname(relative(file));
  return dir === '.' ? 'core' : dir;
}

/** Resolve an import specifier to the core file it points at. */
function resolveCoreFile(specifier: string, importer: string): string | null {
  let base: string | null = null;
  if (specifier.startsWith('@/core/')) base = path.join(CORE_ROOT, specifier.slice('@/core/'.length));
  else if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(importer), specifier);
    if (resolved === CORE_ROOT || resolved.startsWith(CORE_ROOT + path.sep)) base = resolved;
  }
  if (!base) return null;
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

type ImportSite = {
  file: string;
  specifier: string;
  from: string;
  to: string;
  target: string;
  line: number;
  typeOnly: boolean;
  names: string[];
};

function collectImports(): ImportSite[] {
  const sites: ImportSite[] = [];
  for (const file of coreFiles) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const from = moduleOf(file);
    const visit = (node: ts.Node) => {
      let specifier: string | null = null;
      let typeOnly = false;
      let names: string[] = [];
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifier = node.moduleSpecifier.text;
        typeOnly = node.importClause?.isTypeOnly === true;
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          names = bindings.elements.map(element => (element.isTypeOnly ? '' : element.name.text)).filter(Boolean);
          if (names.length === 0) typeOnly = true;
        } else if (bindings && ts.isNamespaceImport(bindings)) {
          names = [bindings.name.text];
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifier = node.moduleSpecifier.text;
        typeOnly = node.isTypeOnly;
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        specifier = node.argument.literal.text;
        typeOnly = true;
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        specifier = node.arguments[0].text;
      }
      if (specifier) {
        const target = resolveCoreFile(specifier, file);
        if (target) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          sites.push({ file: relative(file), specifier, from, to: moduleOf(target), target, line: line + 1, typeOnly, names });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
}

/** The publicly exported names of a module file (re-exports included). */
function exportedNames(file: string): Set<string> {
  const source = program.getSourceFile(file);
  if (!source) return new Set();
  const symbol = checker.getSymbolAtLocation(source);
  if (!symbol) return new Set();
  return new Set(checker.getExportsOfModule(symbol).map(entry => entry.getName()));
}

type TableWrite = { file: string; module: string; table: string; line: number; call: string };

const WRITE_METHODS = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

function schemaTables(): Map<string, string> {
  const tables = new Map<string, string>();
  for (const entry of readdirSync(SCHEMA_ROOT)) {
    if (!entry.endsWith('.prisma')) continue;
    const text = readFileSync(path.join(SCHEMA_ROOT, entry), 'utf8');
    const models = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
    let match: RegExpExecArray | null;
    while ((match = models.exec(text))) {
      const mapped = /@@map\("([^"]+)"\)/.exec(match[2]);
      tables.set(mapped ? mapped[1] : match[1], match[1]);
    }
  }
  return tables;
}

function collectWrites(): TableWrite[] {
  const tables = schemaTables();
  const clientNames = new Map<string, string>();
  for (const [table, model] of tables) clientNames.set(model[0].toLowerCase() + model.slice(1), table);
  const writes: TableWrite[] = [];
  for (const file of coreFiles) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const module = moduleOf(file);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const target = node.expression.expression;
        if (ts.isPropertyAccessExpression(target) && clientNames.has(target.name.text)
          && WRITE_METHODS.includes(node.expression.name.text)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          writes.push({
            file: relative(file), module, table: clientNames.get(target.name.text)!,
            line: line + 1, call: `${target.expression.getText(source)}.${target.name.text}.${node.expression.name.text}`,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    // Raw SQL writes against a public core table (`public.<table>`).
    const text = source.getFullText();
    const sql = /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?public\.(\w+)/gi;
    let match: RegExpExecArray | null;
    while ((match = sql.exec(text))) {
      const table = match[1];
      if (!tables.has(table)) continue;
      const { line } = source.getLineAndCharacterOfPosition(match.index);
      writes.push({ file: relative(file), module, table, line: line + 1, call: `raw SQL against public.${table}` });
    }
  }
  return writes;
}

const importSites = collectImports();
const crossModuleImports = importSites.filter(site => site.from !== site.to);
const edges = [...new Set(crossModuleImports.map(site => `${site.from} -> ${site.to}`))].sort();
const writes = collectWrites();

const knownList = KNOWN_VIOLATIONS
  .map(entry => `  - ${entry.file}${entry.table ? ` [${entry.table}]` : ''}${entry.module ? ` [${entry.module}]` : ''}: ${entry.reason} (owner: ${entry.owner})`)
  .join('\n');

function matchesKnown(entry: KnownViolation, file: string, module?: string, table?: string, specifier?: string): boolean {
  if (entry.file !== file) return false;
  if (entry.table && entry.table !== table) return false;
  if (entry.module && entry.module !== module) return false;
  if (entry.specifier && entry.specifier !== specifier) return false;
  return true;
}

describe('module boundary audit', () => {
  it('has an owner for every table of the Prisma schema', () => {
    const tables = [...schemaTables().keys()].sort();
    const unowned = tables.filter(table => !TABLE_OWNERS[table]);
    expect(unowned).toEqual([]);
    const unused = Object.keys(TABLE_OWNERS).filter(table => !tables.includes(table));
    expect(unused).toEqual([]);
  });

  it('has a reason for every approved edge and every known violation', () => {
    const withoutReason = Object.entries(LEGAL_EDGES)
      .filter(([, reason]) => reason.trim().length < 10)
      .map(([edge]) => edge);
    expect(withoutReason).toEqual([]);
    const badViolations = KNOWN_VIOLATIONS.filter(entry =>
      entry.reason.trim().length < 10 || entry.owner.trim().length < 3 || !entry.file.trim());
    expect(badViolations).toEqual([]);
  });

  it('approves exactly the cross-module edges that exist in the tree', () => {
    const knownEdges = KNOWN_VIOLATIONS.map(entry => entry.module).filter((edge): edge is string => !!edge && edge.includes(' -> '));
    expect(edges).toEqual([...new Set([...Object.keys(LEGAL_EDGES), ...knownEdges])].sort());
  });

  it('rejects every cross-module import that is not an approved edge', () => {
    const violations: string[] = [];
    for (const site of crossModuleImports) {
      const edge = `${site.from} -> ${site.to}`;
      if (LEGAL_EDGES[edge]) continue;
      const known = KNOWN_VIOLATIONS.find(entry => matchesKnown(entry, site.file, edge, undefined, site.specifier));
      if (known) continue;
      violations.push(`${site.file}:${site.line} imports "${site.specifier}" (module ${edge}) which is not an approved cross-module edge`);
    }
    expect(violations, `Unapproved cross-module imports:\n${violations.join('\n')}\n\nKnown violations still open:\n${knownList}`).toEqual([]);
  });

  it('rejects cross-module imports that do not bind to a public export', () => {
    const violations: string[] = [];
    for (const site of crossModuleImports) {
      if (!LEGAL_EDGES[`${site.from} -> ${site.to}`]) continue;
      if (site.typeOnly || site.names.length === 0) continue;
      const exported = exportedNames(site.target);
      if (exported.size === 0) continue;
      const missing = site.names.filter(name => !exported.has(name));
      if (missing.length > 0) {
        violations.push(`${site.file}:${site.line} imports "${site.specifier}" which is not publicly exported by ${relative(site.target)} (${missing.join(', ')})`);
      }
    }
    expect(violations, `Cross-module imports that are not public exports:\n${violations.join('\n')}`).toEqual([]);
  });

  it('rejects every cross-domain table write', () => {
    const violations: string[] = [];
    for (const write of writes) {
      const owner = TABLE_OWNERS[write.table];
      if (!owner) {
        violations.push(`${write.file}:${write.line} writes "${write.table}" which has no owning module`);
        continue;
      }
      if (owner === write.module) continue;
      const known = KNOWN_VIOLATIONS.find(entry => matchesKnown(entry, write.file, undefined, write.table));
      if (known) continue;
      violations.push(`${write.file}:${write.line} writes "${write.table}" (${write.call}) but the table is owned by "${owner}"`);
    }
    expect(violations, `Cross-domain table writes:\n${violations.join('\n')}\n\nKnown violations still open:\n${knownList}`).toEqual([]);
  });

  it('keeps every known violation anchored to a real violation', () => {
    const stale: string[] = [];
    for (const entry of KNOWN_VIOLATIONS) {
      const matches = entry.table
        ? writes.some(write => matchesKnown(entry, write.file, undefined, write.table))
        : crossModuleImports.some(site => matchesKnown(entry, site.file, entry.module, undefined, entry.specifier));
      if (!matches) stale.push(`${entry.file}${entry.table ? ` [${entry.table}]` : ''}${entry.module ? ` [${entry.module}]` : ''}`);
    }
    expect(stale, `Known violations that no longer match a real violation:\n${stale.join('\n')}\n\nKnown violations still open:\n${knownList}`).toEqual([]);
  });

  it('scans the whole core tree', () => {
    // An independent walk proves that the file enumeration is complete.
    const walk = (directory: string): number => readdirSync(directory, { withFileTypes: true })
      .reduce((total, entry) => total + (entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : /\.[cm]?tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? 1 : 0), 0);
    const summary = `files=${coreFiles.length} edges=${edges.length} writes=${writes.length} known=${KNOWN_VIOLATIONS.length}`;
    expect(coreFiles.length, summary).toBe(walk(CORE_ROOT));
    expect(coreFiles.length, summary).toBeGreaterThan(150);
    expect(edges.length, summary).toBeGreaterThan(50);
    expect(writes.length, summary).toBeGreaterThan(150);
  });
});
