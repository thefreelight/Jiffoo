/**
 * Module boundary audit (WP-D2 / D-3, WP-F8: scan roots extended).
 *
 * A static, source-level audit of `apps/api/src/core/**`, `apps/api/src/infra/**`
 * and `apps/api/src/jobs/**`. It needs no database, no Redis instance and no
 * network: it reads the source tree, parses it with the TypeScript compiler API
 * and compares the result with two explicit, reviewed registers that live in this
 * file.
 *
 * The scan roots are the Core tree, the neutral infrastructure layer and the job
 * layer. The Core tree keeps its directory-per-module naming; the infra and job
 * layers are file-scoped modules (see `moduleOf` below).
 *
 * Check 1 — cross-module import graph
 *   Every import that crosses a module boundary must be an approved edge
 *   (`from -> to`) and must bind to a *publicly exported* symbol of the target
 *   module. Reaching into another module's private helper file is a violation.
 *
 * Check 1b — module dependency cycles
 *   The cross-module import graph must not contain a directed cycle. A cycle
 *   (a ring of modules that import each other) is a violation even when every
 *   single edge of the ring is an approved edge, so the ring itself has to be
 *   registered in KNOWN_CYCLES with a reason.
 *
 * Check 2 — cross-domain table writes
 *   Every table has exactly one owner. The owner is either a module or a
 *   domain. A write (`prisma.<model>.<write>`, `tx.<model>.<write>` or a raw
 *   `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` against a core table) from a module
 *   that does not own the table is a violation. The raw form is recognised with
 *   an optional schema qualifier (`<table>`, `public.<table>`,
 *   `"public"."<table>"`); the table is the last identifier of the qualified
 *   name. A raw write counts as a write to a Core table only when the path is
 *   unqualified (the Core connection resolves it in `public`) or qualified with
 *   the literal schema `public`: a write into any other schema - a plugin
 *   namespace, for example - is not a write to a Core table. A domain owner is
 *   satisfied when the writing module is one of the domain's members, because
 *   some domains are deliberately split across several modules that share the
 *   same tables. Reads are never violations.
 *
 * ── How to add an entry ──────────────────────────────────────────────────────
 * LEGAL_EDGES        one key per approved cross-module edge (`from -> to`) plus a
 *                    one-line reason saying why the dependency is legitimate.
 *                    A new cross-module import fails the audit until its edge is
 *                    added here with a reason.
 * KNOWN_CYCLES       one entry per known module dependency cycle. `modules` is
 *                    the module sequence of the cycle, rotated so that the
 *                    lexicographically smallest module comes first (the first
 *                    module is not repeated at the end); `reason` says why the
 *                    mutual dependency is accepted. A new cycle fails the audit
 *                    until it is registered here, and a registered cycle that
 *                    no longer exists fails the audit too, so the list cannot
 *                    go stale. When a new cross-module edge forms a new ring,
 *                    the ring must be registered here as well.
 * TABLE_OWNERS       one owner per table — a module or a domain. A table that is
 *                    written from a second module fails the audit until that
 *                    module is either removed as a writer or the table is
 *                    recorded below.
 * DOMAIN_MEMBERS     the modules of every domain owner, and DOMAIN_TABLES the
 *                    tables every domain owns. A domain lets modules that
 *                    share one table set write it without that becoming a
 *                    known exception. The safety assertion below keeps a
 *                    domain from turning into a loophole.
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

const SRC_ROOT = path.resolve('src');
const CORE_ROOT = path.resolve('src/core');
const INFRA_ROOT = path.resolve('src/infra');
const JOBS_ROOT = path.resolve('src/jobs');
const SCHEMA_ROOT = path.resolve('prisma/schema');

/** The scan roots of the audit: the Core tree, the neutral infra layer and the job layer. */
const SCAN_ROOTS = [CORE_ROOT, INFRA_ROOT, JOBS_ROOT];

/**
 * Section 1 — approved cross-module edges.
 *
 * A key is `<from module> -> <to module>`. A Core module is the directory path of
 * a file below `src/core` (`core/order/service.ts` → `order`,
 * `core/admin/order-management/service.ts` → `admin/order-management`); a module
 * of the infra or job layer is the path of the file below `src` without its
 * extension (`infra/core-process`, `infra/events/emit`,
 * `jobs/payment-reconciliation`).
 */
const LEGAL_EDGES: Record<string, string> = {
  'admin/plugin-management -> audit': 'G1 repair bootstrap records rejected and allowed admissions through the public AuditService; allowed admission audit and task enqueue commit atomically in the same transaction.',
  'admin/plugin-management -> auth': 'G1 repair bootstrap re-admits the verified request as a trusted admin through the public AuthService inside the task transaction.',
  'account -> admin/staff-management': 'the account routes translate the public `StaffManagementError` of the staff module into the shared error shape.',
  'account -> auth': 'the account module uses the auth module\'s public middleware and email-verification service.',
  'account -> plugin-pages': 'the account service revokes the plugin-page sessions of a deleted account through the public plugin-page session service.',
  'account -> upload': 'the account routes publish profile media through the public upload service.',
  'admin/audit-events -> audit': 'the admin audit-events routes read the audit module\'s public record projection.',
  'admin/dashboard -> admin/order-management': 'the dashboard reuses the order-management module\'s public `paymentReviewWhere` filter builder.',
  'admin/dashboard -> cache': 'the dashboard reads cached metrics through the public cache service.',
  'admin/dashboard -> settings': 'the dashboard reads system settings through the public settings service.',
  'admin/extension-installer -> admin/plugin-management': 'the installer calls the plugin-management module\'s public service, config crypto and lifecycle hooks.',
  'admin/extension-installer -> audit': 'the installer records audit events through the single audit write outlet.',
  'admin/extension-installer -> auth': 'the installer routes authenticate through the public auth middleware.',
  'admin/extension-installer -> cache': 'the installer invalidates cache entries through the public cache service.',
  'admin/extension-installer -> extensions/registry': 'the installer reads the default plugin instance and the installed package list through the read-only provider registry instead of the plugin-management facade.',
  'admin/extension-installer -> extensions/runtime': 'the installer takes the neutral contract errors, contract versions, failure recording, plugin state, gateway protection and stored manifest helpers from the neutral runtime module instead of keeping its own copies.',
  'admin/extension-installer -> extensions/shared': 'the installer re-exports the neutral extension helpers that B-BOUND-C moved out of this module.',
  'admin/extension-installer -> infra/core-process': 'the installer registers its core process through the public process registry (`ensureCoreProcess`).',
  'admin/extension-installer -> infra/core-process-identity': 'the installer reads the process database URL and the registration identity through the public process-identity helpers.',
  'admin/extension-installer -> infra/database-clock': 'the migration executor reads the database clock through the public clock helper.',
  'admin/extension-installer -> infra/events/emit': 'the installer publishes its plugin events through the public outbox.',
  'admin/extension-installer -> infra/recovery-test-control': 'the installer re-exports the recovery test control of the neutral recovery helper.',
  'admin/extension-installer -> infra/shared-protection': 'the plugin runtime applies the shared protection through the public protection helpers.',
  'admin/extension-installer -> infra/worker-shutdown': 'the plugin runtime observes the worker shutdown through the public shutdown helper.',
  'admin/extension-installer -> plugin-pages': 'the plugin runtime enforces the public plugin-page origin policy.',
  'admin/extension-installer -> plugin-storage': 'the contract runtime hands the private plugin files to a plugin through the public plugin-storage service.',
  'admin/extension-installer -> plugins': 'the installer uses the public durable-task API (`assertTaskClaim`, `withTaskScope`, task policy).',
  'admin/extension-installer -> settings': 'the installer bumps the plugin registry version through the public settings module that owns the `system_settings` row.',
  'admin/extension-installer -> shared': 'the installer re-exports the platform-wide circuit breaker parameters from the neutral shared configuration module.',
  'admin/extension-installer -> storage': 'the installer resolves package blobs, current packages and operation leases through the public storage stores.',
  'admin/health-monitoring -> admin/extension-installer': 'the health monitor reads the public plugin runtime state.',
  'admin/health-monitoring -> infra/worker-health': 'the health monitor reads the worker health summary through the public worker-health helper.',
  'admin/health-monitoring -> plugins': 'the health monitor reads the public plugin task health projection.',
  'admin/notifications -> audit': 'the admin notification routes record audit events through the audit outlet.',
  'admin/notifications -> auth': 'the admin notification routes resolve recipients through the public email-verification service.',
  'admin/notifications -> notifications': 'the admin notification routes write the resend copy through the public notification service that owns the `notifications` table.',
  'admin/order-management -> admin/extension-installer': 'the admin order module reads the public plugin runtime state.',
  'admin/order-management -> audit': 'the admin order module records audit events through the audit outlet.',
  'admin/order-management -> cache': 'the admin order module invalidates cached catalog and order entries.',
  'admin/order-management -> infra/events/emit': 'the admin order module publishes its events through the public outbox.',
  'admin/order-management -> inventory': 'the admin order module reads stock through the public inventory service.',
  'admin/order-management -> order': 'the admin order module drives the order state machine through the order module\'s public service.',
  'admin/order-management -> payment': 'the admin order module uses the payment module\'s public service and reconciliation entry points.',
  'admin/order-management -> settings': 'the admin order module reads system settings through the public settings service.',
  'admin/order-management -> shared': 'the admin order module takes the neutral row-lock helper from the shared layer.',
  'admin/plugin-management -> admin/extension-installer': 'plugin management calls the installer\'s public upload, manifest, migration and runtime API.',
  'admin/plugin-management -> cache': 'plugin management invalidates cached plugin entries.',
  'admin/plugin-management -> extensions/registry': 'plugin management reads the read-only provider registry.',
  'admin/plugin-management -> extensions/shared': 'plugin management validates instance configuration and reports installer errors through the neutral extension helpers.',
  'admin/plugin-management -> logger': 'plugin management logs through the unified logger.',
  'admin/plugin-management -> plugin-pages': 'plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service.',
  'admin/plugin-management -> plugin-storage': 'plugin management purges the private files of an uninstalled installation through the public plugin-storage service.',
  'admin/plugin-management -> plugins': 'plugin management uses the public durable-task API.',
  'admin/plugin-management -> settings': 'plugin management bumps the plugin registry version through the public settings module that owns the `system_settings` row.',
  'admin/plugin-management -> storage': 'plugin management resolves packages and operation leases through the public storage stores.',
  'admin/product-management -> cache': 'the admin product module invalidates the product cache.',
  'admin/product-management -> infra/events/emit': 'the admin product module publishes its events through the public outbox.',
  'admin/product-management -> infra/events/snapshots': 'the admin product module builds its event payload through the public outbox snapshot helpers.',
  'admin/product-management -> inventory': 'the admin product module sets variant stock through the public inventory service.',
  'admin/product-management -> order': 'the admin product module asks the order module whether a product is referenced by an order item.',
  'admin/product-management -> settings': 'the admin product module reads system settings through the public settings service.',
  'admin/product-management -> upload': 'the admin product routes publish product media through the public upload service.',
  'admin/staff-management -> audit': 'the staff module records staff-audit rows through the single audit write outlet.',
  'admin/staff-management -> auth': 'the staff module uses the public account-recovery and email-verification services.',
  'admin/staff-management -> plugin-pages': 'the staff module revokes the plugin-page sessions of a removed staff member through the public plugin-page session service.',
  'admin/storefront-code -> audit': 'the storefront-code module records audit events through the single audit write outlet.',
  'admin/system-settings -> settings': 'the old admin path is a pure re-export shim of the relocated settings module.',
  'admin/user-management -> audit': 'the admin user module records audit events through the audit outlet.',
  'admin/user-management -> auth': 'the admin user module issues password-reset links through the public auth account-recovery service.',
  'admin/user-management -> cache': 'the admin user module invalidates cached user entries.',
  'admin/user-management -> infra/events/emit': 'the admin user module publishes its events through the public outbox.',
  'admin/user-management -> infra/events/snapshots': 'the admin user module builds its event payload through the public outbox snapshot helpers.',
  'admin/user-management -> plugin-pages': 'the admin user module revokes the plugin-page sessions of a removed account through the public plugin-page session service.',
  'admin/user-management -> settings': 'the admin user module reads system settings through the public settings service.',
  'auth -> audit': 'the auth module records staff-audit rows through the single audit write outlet.',
  'auth -> cache': 'the auth module caches token and settings entries.',
  'auth -> infra/events/emit': 'the auth module publishes its events through the public outbox.',
  'auth -> infra/events/snapshots': 'the auth module builds its event payload through the public outbox snapshot helpers.',
  'auth -> logger': 'the auth module logs through the shared logger.',
  'auth -> notifications': 'the auth module sends verification and recovery notifications through the public notification service.',
  'auth -> plugin-pages': 'the auth middleware enforces the public plugin-page origin policy.',
  'auth -> settings': 'the auth module persists the API-token list through the public settings module that owns the `system_settings` row.',
  'cart -> auth': 'the cart routes authenticate through the public auth middleware.',
  'cart -> product': 'the cart service reads the sellable catalog through the product module\'s public projection.',
  'checkout -> admin/extension-installer': 'the checkout service calls plugin contracts through the public plugin runtime.',
  'checkout -> auth': 'the checkout routes authenticate through the public auth middleware.',
  'checkout -> cart': 'the checkout service consumes the cart through the public cart service.',
  'checkout -> extensions/registry': 'the checkout service resolves payment providers through the read-only registry.',
  'checkout -> extensions/runtime': 'the checkout service names the contract error and records the plugin failure through the neutral runtime helpers instead of the admin layer.',
  'checkout -> infra/shared-protection': 'the checkout routes apply the shared protection through the public protection helpers.',
  'checkout -> settings': 'the checkout service reads system settings through the public settings service.',
  'checkout -> shared': 'the checkout service uses the neutral money helper.',
  'extensions/runtime -> extensions/shared': 'the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers.',
  'extensions/shared -> storage': 'the neutral extension helpers resolve package roots through the public plugin package store.',
  'infra/core-process -> infra/core-process-identity': 'the process registry reads its own identity and lock constants from the neighbouring identity helper.',
  'infra/core-process -> infra/recovery-test-control': 'the process registry observes the recovery limit through the public recovery helper.',
  'infra/core-process -> storage': 'the process registry flushes the completed plugin markers through the public storage store.',
  'infra/events/core-subscribers -> notifications': 'the core subscriber of the outbox writes the notification through the public notification service.',
  'infra/events/delivery -> admin/extension-installer': 'the event delivery hands the installation event to the plugin runtime; this is the open callContract debt of the coordination ledger (section 5o, item 3) and is tracked in KNOWN_VIOLATIONS.',
  'infra/events/delivery -> extensions/runtime': 'the event delivery redacts the plugin failure through the neutral runtime helpers.',
  'infra/events/delivery -> infra/events/core-subscribers': 'the event delivery asks the core subscribers for the core handler of an event.',
  'infra/events/delivery -> infra/events/emit': 'the event delivery shares the outbox transaction type with the emit helper.',
  'infra/events/delivery -> infra/worker-shutdown': 'the event delivery observes the worker shutdown through the public shutdown helper.',
  'infra/events/emit -> infra/events/core-subscribers': 'the outbox hands the core events to the core subscribers.',
  'infra/events/snapshots -> infra/events/emit': 'the snapshot helpers reuse the outbox transaction type.',
  'infra/index -> infra/events/emit': 'the infra barrel re-exports the public outbox.',
  'infra/prisma-slow-query-extension -> logger': 'the slow-query extension logs through the unified logger.',
  'infra/shared-protection -> shared': 'the shared protection takes the platform-wide circuit breaker parameters from the neutral shared configuration module.',
  'infra/worker-health -> cache': 'the worker health summary reads the shared Redis cache client.',
  'infra/worker-health -> logger': 'the worker health summary logs through the unified logger.',
  'install -> auth': 'the installer creates the bootstrap administrator through the public auth identity service.',
  'install -> settings': 'the installer writes the installation row through the public settings module that owns the `system_settings` row.',
  'inventory -> cache': 'the inventory service bumps the product cache version.',
  'inventory -> infra/events/emit': 'the inventory module publishes its events through the public outbox.',
  'inventory -> infra/events/snapshots': 'the inventory module builds its event payload through the public outbox snapshot helpers.',
  'jobs/payment-reconciliation -> logger': 'the reconciliation job logs through the unified logger.',
  'jobs/payment-reconciliation -> payment': 'the reconciliation job drives the payment module through its public reconciliation entry points.',
  'jobs/plugin-file-cleanup -> plugin-storage': 'the cleanup job runs the private file cleanup through the public plugin-storage service.',
  'notifications -> admin/extension-installer': 'the notification delivery calls plugins through the public plugin runtime.',
  'notifications -> auth': 'the notification service reads the recipient locale through the auth module\'s public identity projection instead of the `users` table.',
  'notifications -> extensions/registry': 'the notification delivery resolves the notification provider through the read-only registry.',
  'notifications -> extensions/runtime': 'the notification delivery takes the plugin timeout from the neutral runtime gateway protection helpers.',
  'notifications -> infra/core-process-identity': 'the notification delivery identifies its core process through the public process-identity helper.',
  'notifications -> infra/worker-shutdown': 'the notification delivery observes the worker shutdown through the public shutdown helper.',
  'notifications -> order': 'the notification service reads the order through the order module\'s public projection.',
  'order -> admin/extension-installer': 'the order service calls plugin contracts through the public plugin runtime.',
  'order -> auth': 'the order routes authenticate through the public auth middleware and read the account through the auth module\'s public identity projection.',
  'order -> cart': 'the order service consumes purchased cart lines through the public cart service (`CartService.consumePurchasedItems`).',
  'order -> checkout': 'the order service re-quotes the purchased lines through the public checkout service.',
  'order -> extensions/registry': 'the order service resolves payment providers through the read-only registry.',
  'order -> extensions/runtime': 'the order service names the contract error through the neutral runtime helpers instead of the admin layer.',
  'order -> infra/events/emit': 'the order service publishes its events through the public outbox.',
  'order -> infra/shared-protection': 'the order routes apply the shared protection through the public protection helpers.',
  'order -> inventory': 'the order service checks and reserves stock through the public inventory service.',
  'order -> logger': 'the order service logs through the unified logger.',
  'order -> payment': 'the order service drives the payment module through its public service.',
  'order -> plugin-pages': 'the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  'order -> product': 'the order service reads the sellable catalog through the product module\'s public projection.',
  'order -> settings': 'the order service reads system settings through the public settings service.',
  'order -> shared': 'the order module uses the neutral money, pricing and row-lock helpers.',
  'payment -> admin/extension-installer': 'the payment module calls plugin contracts through the public plugin runtime.',
  'payment -> audit': 'the payment module records audit events through the audit outlet.',
  'payment -> auth': 'the payment routes authenticate through the public auth middleware.',
  'payment -> cache': 'the payment routes invalidate cached entries.',
  'payment -> extensions/registry': 'the payment module resolves providers through the read-only registry.',
  'payment -> extensions/runtime': 'the payment module takes the plugin timeout from the neutral runtime gateway protection helpers instead of the admin layer.',
  'payment -> infra/core-process-identity': 'the payment reconciliation identifies its core process through the public process-identity helper.',
  'payment -> infra/events/emit': 'the payment module publishes its events through the public outbox.',
  'payment -> infra/shared-protection': 'the payment routes apply the shared protection through the public protection helpers.',
  'payment -> logger': 'the payment routes log through the unified logger.',
  'payment -> notifications': 'the payment module emits notifications through the public notification service.',
  'payment -> order': 'the payment module reports payment outcomes through the order module\'s public service.',
  'payment -> settings': 'the payment routes read system settings through the public settings service.',
  'payment -> shared': 'the payment module uses the neutral money and row-lock helpers.',
  'plugin-pages -> admin/extension-installer': 'the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  'plugin-pages -> cart': 'the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  'plugin-pages -> extensions/registry': 'the plugin-page asset routes read the plugin instance through the read-only registry\'s public installation projection instead of querying the plugin domain\'s tables directly.',
  'plugin-pages -> infra/shared-protection': 'the plugin-page routes apply the shared protection through the public protection helpers.',
  'plugin-pages -> plugins': 'the plugin-page session records its task principal through the public durable-task API.',
  'plugin-pages -> product': 'the plugin-page routes read the sellable catalog through the public product projection.',
  'plugin-pages -> storage': 'the plugin-page asset routes read package blobs through the public storage stores.',
  'plugin-storage -> admin/audit-events': 'the plugin-storage service records its audit rows through the public admin audit writer.',
  'plugin-storage -> admin/extension-installer': 'the plugin-storage service admits a file through the public storage admission service of the installer.',
  'plugin-storage -> infra/shared-protection': 'the plugin-storage routes apply the shared protection through the public protection helpers.',
  'plugin-storage -> plugin-pages': 'the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service.',
  'plugin-storage -> plugins': 'the plugin-storage service claims its durable-task operation through the public durable-task API.',
  'plugin-storage -> storage': 'the plugin-storage service keeps the file blobs through the public uploaded-object store.',
  'plugins -> admin/extension-installer': 'the task worker invokes plugin tasks through the public plugin runtime.',
  'plugins -> extensions/runtime': 'the durable-task worker records the plugin failures through the neutral runtime helpers instead of the admin layer.',
  'plugins -> audit': 'the task module records audit events through the audit outlet.',
  'plugins -> infra/core-process': 'the task worker registers its core process through the public process registry.',
  'product -> cache': 'the product module reads and invalidates cached catalog entries.',
  'product -> inventory': 'the product projection reads stock through the public inventory service.',
  'product -> settings': 'the product module reads system settings through the public settings service.',
  'settings -> audit': 'the settings module records audit events through the audit outlet.',
  'settings -> cache': 'the settings module invalidates cached settings entries.',
  'storage -> admin/extension-installer': 'the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  'storage -> extensions/shared': 'the storage module uses the neutral extension types and helpers.',
  'storage -> infra/core-process': 'the plugin package store registers its core process through the public process registry.',
  'storage -> infra/recovery-test-control': 'the storage store applies the recovery limit through the public recovery helper.',
  'store -> settings': 'the storefront routes read system settings through the public settings service.',
  'upload -> storage': 'the upload service publishes media through the public uploaded-media set store.',
};

/**
 * Section 1b — known module dependency cycles.
 *
 * A cycle is a directed ring in the module dependency graph: a set of modules
 * that import each other in a circle. Every edge of such a ring can be an
 * approved edge on its own while the ring as a whole is still a violation, so
 * the ring itself has to be registered here.
 *
 * `modules` is the module sequence of the cycle, rotated so that the
 * lexicographically smallest module comes first and the first module is not
 * repeated at the end (`order -> payment` is the `order`/`payment` ring).
 * `reason` says in one sentence why the mutual dependency is accepted.
 *
 * A cycle that exists in the tree but is not registered here fails the audit.
 * A registered cycle that no longer exists in the tree fails the audit too, so
 * the list cannot go stale.
 */
type KnownCycle = {
  modules: string[];
  reason: string;
};

const KNOWN_CYCLES: KnownCycle[] = [
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','payment'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','payment','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','plugins'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> plugins -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','plugins','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> plugins -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','plugins','infra/core-process','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> plugins -> infra/core-process -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','payment'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','payment','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','plugins'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> plugins -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','plugins','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> plugins -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','plugins','infra/core-process','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> plugins -> infra/core-process -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','plugin-pages','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> plugin-pages -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','checkout'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> checkout -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','checkout','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> checkout -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','payment'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> payment -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','payment','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> payment -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','plugin-pages'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> plugin-pages -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','plugin-pages','plugins'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> plugin-pages -> plugins -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','plugin-pages','plugins','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> plugin-pages -> plugins -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','plugin-pages','plugins','infra/core-process','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> plugin-pages -> plugins -> infra/core-process -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','notifications','order','plugin-pages','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> notifications -> order -> plugin-pages -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','payment'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','payment','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','payment'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','cart','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','payment','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> cart -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','plugins'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> plugins -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','plugins','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> plugins -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','plugins','infra/core-process','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> plugins -> infra/core-process -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','payment'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/emit','infra/events/core-subscribers','notifications','order','payment','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','checkout','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> checkout -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','payment'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','product','inventory','infra/events/snapshots','infra/events/emit','infra/events/core-subscribers','notifications','order','payment','extensions/runtime','extensions/shared','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> product -> inventory -> infra/events/snapshots -> infra/events/emit -> infra/events/core-subscribers -> notifications -> order -> payment -> extensions/runtime -> extensions/shared -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  {
    modules: ['admin/extension-installer','admin/plugin-management','auth','plugin-pages','storage'],
    reason: 'G1 repair-bootstrap admission ring (admin/extension-installer -> admin/plugin-management -> auth -> plugin-pages -> storage -> admin/extension-installer): plugin management re-admits the verified request through the public AuthService inside the task transaction; the existing public dependency path returns to plugin management.',
  },
  // The commerce ring: the order service drives the payment module, and the
  // payment module reports payment outcomes back into the order module.
  {
    modules: ['order', 'payment'],
    reason: 'the order service drives the payment module through its public service, and the payment module reports payment outcomes back through the public `OrderService` methods (`applyPaymentSucceeded`, `applyPaymentFailed`, `recordPaymentAttempt`, `getOrderRecipient`); the two modules share no internal helper file.',
  },
  {
    modules: ['notifications', 'order', 'payment'],
    reason: 'the notification service reads the order through the order module\'s public projection and the payment module emits notifications through the public notification service.',
  },
  {
    modules: ['auth', 'notifications', 'order'],
    reason: 'the auth module sends verification and recovery notifications through the public notification service, and the notification service reads the order through the order module\'s public projection, whose routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'notifications', 'order', 'cart'],
    reason: 'the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service consumes purchased cart lines through the public cart service, whose routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'notifications', 'order', 'checkout'],
    reason: 'the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service re-quotes the purchased lines through the public checkout service, whose routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'notifications', 'order', 'checkout', 'cart'],
    reason: 'the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service reaches the checkout and cart modules, whose routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'notifications', 'order', 'payment'],
    reason: 'the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service drives the payment module through its public service, whose routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'notifications'],
    reason: 'the auth module sends verification and recovery notifications through the public notification service, and the notification service reads the recipient locale through the auth module\'s public identity projection.',
  },
  {
    modules: ['admin/extension-installer', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer takes the neutral runtime helpers, those helpers decrypt the stored plugin configuration through the neutral extension helpers, and the extension helpers resolve package roots through the public storage stores, which expose the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module sends verification and recovery notifications through the public notification service, the notification delivery takes the plugin timeout from the neutral runtime helpers, those helpers decrypt the stored configuration through the neutral extension helpers, and the extension helpers resolve package roots through the public storage stores.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection and takes the plugin timeout from the neutral runtime helpers, those helpers decrypt the stored configuration through the neutral extension helpers, and the extension helpers resolve package roots through the public storage stores.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the notification delivery takes the plugin timeout from the neutral runtime helpers, those helpers decrypt the stored configuration through the neutral extension helpers, and the extension helpers resolve package roots through the public storage stores.',
  },
  {
    modules: ['admin/extension-installer', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer uses the public durable-task API, the task worker records the plugin failures through the neutral runtime helpers, those helpers decrypt the stored configuration through the neutral extension helpers, and the extension helpers resolve package roots through the public storage stores, which expose the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer and plugin management reach each other through their public services, both use the public durable-task API, the task worker records the plugin failures through the neutral runtime helpers, those helpers decrypt the stored configuration through the neutral extension helpers, and the extension helpers resolve package roots through the public storage stores.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, the payment module takes the plugin timeout from the neutral runtime helpers, those helpers decrypt the stored configuration through the neutral extension helpers, and the extension helpers resolve package roots through the public storage stores.',
  },
  // The extension ring: the installer, plugin management, the storage stores,
  // the durable-task engine and the plugin-page routes all call each other
  // through public exports only.
  {
    modules: ['admin/extension-installer', 'admin/plugin-management'],
    reason: 'the installer calls the plugin-management module\'s public service, config crypto and lifecycle hooks, and plugin management calls the installer\'s public upload, manifest, migration and runtime API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'storage'],
    reason: 'the installer and plugin management reach each other through their public services, and both resolve packages and operation leases through the public storage stores, which expose the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugins'],
    reason: 'the installer and plugin management reach each other through their public services, and both use the public durable-task API, whose worker invokes plugin tasks through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'extensions/shared', 'storage'],
    reason: 'the installer and plugin management reach each other through their public services, plugin management validates configuration through the neutral extension helpers, and those helpers resolve package roots through the public storage stores.',
  },
  {
    modules: ['admin/extension-installer', 'extensions/shared', 'storage'],
    reason: 'the installer re-exports the neutral extension helpers, and those helpers resolve package roots through the public storage stores, which expose the installer\'s public recovery test control.',
  },
  {
    modules: ['extensions/shared', 'storage'],
    reason: 'the neutral extension helpers resolve package roots through the public plugin package store, and the storage module uses the neutral extension types and helpers.',
  },
  {
    modules: ['admin/extension-installer', 'storage'],
    reason: 'the installer resolves package blobs through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugins'],
    reason: 'the installer uses the public durable-task API, and the task worker invokes plugin tasks through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages'],
    reason: 'the plugin runtime enforces the public plugin-page origin policy, and the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'storage'],
    reason: 'the plugin runtime enforces the public plugin-page origin policy, the plugin-page asset routes use the installer\'s public migration gate and signing policy, and they read package blobs through the public storage stores.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications'],
    reason: 'the installer routes authenticate through the public auth middleware, and the auth module sends verification and recovery notifications through the public notification service, which calls plugins through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages'],
    reason: 'the installer routes authenticate through the public auth middleware, and the auth middleware enforces the public plugin-page origin policy that the plugin runtime applies.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, and the plugin-page asset routes read package blobs through the public storage stores.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module sends verification and recovery notifications through the public notification service, and the notification service reads the order through the order module\'s public projection, which calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, and the checkout service records plugin failures and calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'payment'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module sends verification and recovery notifications through the public notification service, the notification service reads the order through the order module\'s public projection, and the payment module calls plugin contracts through the public plugin runtime.',
  },
  // The rings of the extended scan (WP-F8). The outbox ring: a Core module
  // publishes its events through the neutral outbox, the outbox hands the core
  // events to the core subscribers, and the core subscriber writes the
  // notification through the public notification service, which reads back the
  // Core state it notifies about. The process-registry ring: the installer, the
  // plugin management and the task worker register their core process through
  // the neutral process registry, and the registry touches the plugin package
  // store, which reaches back into the installer.
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the installer calls the plugin-management module\'s public service, plugin management uses the public durable-task API, the task worker registers its core process through the public process registry, the process registry flushes the completed plugin markers through the public storage store, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, and the notification delivery calls plugins through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification delivery takes the plugin timeout from the neutral runtime gateway protection helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, and the checkout service calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout service names the contract error through the neutral runtime helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service names the contract error through the neutral runtime helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, and the payment module calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, the payment module takes the plugin timeout from the neutral runtime gateway protection helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, and the notification delivery calls plugins through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification delivery takes the plugin timeout from the neutral runtime gateway protection helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, and the checkout service calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout service names the contract error through the neutral runtime helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service names the contract error through the neutral runtime helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, and the payment module calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer routes authenticate through the public auth middleware, the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, the payment module takes the plugin timeout from the neutral runtime gateway protection helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/core-process', 'storage'],
    reason: 'the installer registers its core process through the public process registry, the process registry flushes the completed plugin markers through the public storage store, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, and the notification delivery calls plugins through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'auth', 'plugin-pages'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the recipient locale through the auth module\'s public identity projection, the auth middleware enforces the public plugin-page origin policy, and the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'auth', 'plugin-pages', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the recipient locale through the auth module\'s public identity projection, the auth middleware enforces the public plugin-page origin policy, the plugin-page asset routes read package blobs through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification delivery takes the plugin timeout from the neutral runtime gateway protection helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'auth', 'plugin-pages'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, and the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'auth', 'plugin-pages', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, the plugin-page asset routes read package blobs through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart', 'auth', 'plugin-pages'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service consumes purchased cart lines through the public cart service, the cart routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, and the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart', 'auth', 'plugin-pages', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service consumes purchased cart lines through the public cart service, the cart routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, the plugin-page asset routes read package blobs through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, and the checkout service calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'auth', 'plugin-pages'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, and the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'auth', 'plugin-pages', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, the plugin-page asset routes read package blobs through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart', 'auth', 'plugin-pages'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout service consumes the cart through the public cart service, the cart routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, and the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart', 'auth', 'plugin-pages', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout service consumes the cart through the public cart service, the cart routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, the plugin-page asset routes read package blobs through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout service names the contract error through the neutral runtime helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service names the contract error through the neutral runtime helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, and the payment module calls plugin contracts through the public plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'auth', 'plugin-pages'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, the payment routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, and the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'auth', 'plugin-pages', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, the payment routes authenticate through the public auth middleware, the auth middleware enforces the public plugin-page origin policy, the plugin-page asset routes read package blobs through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the installer publishes its plugin events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, the payment module takes the plugin timeout from the neutral runtime gateway protection helpers, the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers, the neutral extension helpers resolve package roots through the public storage stores, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the installer uses the public durable-task API, the task worker registers its core process through the public process registry, the process registry flushes the completed plugin markers through the public storage store, and the storage module validates theme packages and exposes the installer\'s public recovery test control.',
  },
  {
    modules: ['auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, and the notification service reads the recipient locale through the auth module\'s public identity projection.',
  },
  {
    modules: ['auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, and the order routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart'],
    reason: 'the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service consumes purchased cart lines through the public cart service, and the cart routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, and the checkout routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart'],
    reason: 'the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout service consumes the cart through the public cart service, and the cart routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the auth module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, and the payment routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, and the notification service reads the recipient locale through the auth module\'s public identity projection.',
  },
  {
    modules: ['auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, and the order routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart'],
    reason: 'the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service consumes purchased cart lines through the public cart service, and the cart routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, and the checkout routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart'],
    reason: 'the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, the checkout service consumes the cart through the public cart service, and the cart routes authenticate through the public auth middleware.',
  },
  {
    modules: ['auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the auth module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, and the payment routes authenticate through the public auth middleware.',
  },
  {
    modules: ['cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the cart service reads the sellable catalog through the product module\'s public projection, the product projection reads stock through the public inventory service, the inventory module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service consumes purchased cart lines through the public cart service.',
  },
  {
    modules: ['cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the cart service reads the sellable catalog through the product module\'s public projection, the product projection reads stock through the public inventory service, the inventory module publishes its events through the public outbox, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, and the checkout service consumes the cart through the public cart service.',
  },
  {
    modules: ['cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the cart service reads the sellable catalog through the product module\'s public projection, the product projection reads stock through the public inventory service, the inventory module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, and the order service consumes purchased cart lines through the public cart service.',
  },
  {
    modules: ['cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the cart service reads the sellable catalog through the product module\'s public projection, the product projection reads stock through the public inventory service, the inventory module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, the outbox hands the core events to the core subscribers, the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service re-quotes the purchased lines through the public checkout service, and the checkout service consumes the cart through the public cart service.',
  },
  {
    modules: ['infra/core-process', 'storage'],
    reason: 'the process registry flushes the completed plugin markers through the public storage store, and the plugin package store registers its core process through the public process registry.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'infra/events/emit'],
    reason: 'the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service publishes its events through the public outbox, and the outbox hands the core events to the core subscribers.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'inventory', 'infra/events/emit'],
    reason: 'the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service checks and reserves stock through the public inventory service, the inventory module publishes its events through the public outbox, and the outbox hands the core events to the core subscribers.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'inventory', 'infra/events/snapshots', 'infra/events/emit'],
    reason: 'the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service checks and reserves stock through the public inventory service, the inventory module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, and the outbox hands the core events to the core subscribers.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'payment', 'infra/events/emit'],
    reason: 'the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service drives the payment module through its public service, the payment module publishes its events through the public outbox, and the outbox hands the core events to the core subscribers.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'product', 'inventory', 'infra/events/emit'],
    reason: 'the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service reads the sellable catalog through the product module\'s public projection, the product projection reads stock through the public inventory service, the inventory module publishes its events through the public outbox, and the outbox hands the core events to the core subscribers.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit'],
    reason: 'the core subscriber of the outbox writes the notification through the public notification service, the notification service reads the order through the order module\'s public projection, the order service reads the sellable catalog through the product module\'s public projection, the product projection reads stock through the public inventory service, the inventory module builds its event payload through the public outbox snapshot helpers, the snapshot helpers reuse the outbox transaction type, and the outbox hands the core events to the core subscribers.',
  },

  // The rings of the plugin-page and the private plugin-file surface (WP-F9).
  // The plugin pages and the private files are called back by the account, the
  // order, the admin and the job modules, and they read the cart, the catalog,
  // the durable-task API, the shared protection and the storage stores back, so
  // every combination of those edges closes a ring of approved edges. Each
  // ring below names the edges that close it.
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> cart): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> plugins): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> plugins): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> plugins): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages, plugin-pages -> product): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'storage'],
    reason: 'the plugin-page ring (admin/plugin-management -> plugin-pages): plugin management revokes the plugin-page sessions of a disabled or uninstalled installation through the public plugin-page session service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage'],
    reason: 'the plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> admin/extension-installer): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage service admits a file through the public storage admission service of the installer.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> plugins): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> plugins): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> plugins): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugin-pages): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugins'],
    reason: 'the plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugins): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage service claims its durable-task operation through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugins): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage service claims its durable-task operation through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> plugins): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage service claims its durable-task operation through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'storage'],
    reason: 'the plugin-file ring (admin/plugin-management -> plugin-storage, plugin-storage -> storage): plugin management purges the private files of an uninstalled installation through the public plugin-storage service and the plugin-storage service keeps the file blobs through the public uploaded-object store.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'auth', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'auth', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'auth', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'auth', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart', 'auth', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart', 'auth', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'auth', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'auth', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart', 'auth', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart', 'auth', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'auth', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'auth', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> plugins): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'storage'],
    reason: 'the plugin-page ring (order -> plugin-pages): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> plugins): the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage'],
    reason: 'the plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> admin/extension-installer): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage service admits a file through the public storage admission service of the installer.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> cart): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'plugins'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> plugins): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> plugins): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> plugins): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page session records its task principal through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages, plugin-pages -> product): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'storage'],
    reason: 'the plugin-page and plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugin-pages): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage routes take the storage and download authority of the current plugin-page session through the public plugin-page service.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugins'],
    reason: 'the plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugins): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage service claims its durable-task operation through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'the plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugins): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage service claims its durable-task operation through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugins', 'infra/core-process', 'storage'],
    reason: 'the plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> plugins): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage service claims its durable-task operation through the public durable-task API.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'storage'],
    reason: 'the plugin-file ring (admin/extension-installer -> plugin-storage, plugin-storage -> storage): the contract runtime hands the private plugin files to a plugin through the public plugin-storage service and the plugin-storage service keeps the file blobs through the public uploaded-object store.',
  },
  {
    modules: ['auth', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'cart'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> cart): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'cart'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> cart): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'notifications', 'order', 'plugin-pages', 'cart'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> cart): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> cart): the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'cart'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'checkout', 'cart'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['auth', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'payment'],
    reason: 'the plugin-page ring (plugin-pages -> product): the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['cart', 'product', 'inventory', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> cart): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['cart', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit', 'infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> cart): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page routes add a product to the cart of the signed-in principal through the public cart service.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'product', 'inventory', 'infra/events/emit'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> product): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
  {
    modules: ['infra/events/core-subscribers', 'notifications', 'order', 'plugin-pages', 'product', 'inventory', 'infra/events/snapshots', 'infra/events/emit'],
    reason: 'the plugin-page ring (order -> plugin-pages, plugin-pages -> product): the order service binds the purchase origin and reads the purchase return target through the public plugin-page service and the plugin-page routes read the sellable catalog through the public product projection.',
  },
];

/**
 * Section 2 — table ownership.
 *
 * Exactly one owner may write a table. The key is the physical table name
 * (`@@map`), the value is the owning module or the owning domain. `infra` marks
 * a table that is owned by the neutral infra layer (the outbox and the
 * core-process registry); it is a domain, so the modules of that layer may
 * share the tables.
 *
 * A domain is a group of modules that deliberately share a table set. A write
 * is allowed when the writing module is the owner, or when the owner is a
 * domain that contains the writing module.
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
  plugin_installs: 'extensions',
  plugin_installations: 'extensions',
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
  plugin_task_execution_slots: 'extensions',
  plugin_task_scheduler: 'plugins',
  plugin_task_fairness: 'plugins',
  // plugin pages and the private plugin files
  plugin_page_sessions: 'plugin-pages',
  plugin_purchase_origins: 'plugin-pages',
  plugin_files: 'plugin-storage',
  plugin_storage_quotas: 'plugin-storage',
  plugin_file_cleanup: 'plugin-storage',
  // written outside apps/api/src/core
  event_records: 'infra',
  event_deliveries: 'infra',
  plugin_event_subscriptions: 'infra',
  core_processes: 'infra',
};

/**
 * Section 2b — domain ownership.
 *
 * A domain is a group of core modules that deliberately share one table set.
 * The commerce modules are not split that way: each of their tables has
 * exactly one owner module. The extension domain is, because the installer,
 * the registry/lifecycle module and the durable-task engine all work on the
 * same installation rows.
 *
 * A table whose owner is a domain may be written by every member of that
 * domain. Every other ownership rule of the audit is unchanged: a table
 * without an owner, an unknown module and a stale known violation are still
 * failures.
 */
const DOMAIN_MEMBERS: Record<string, string[]> = {
  // The extension domain spans four modules on purpose: the installer owns
  // installation and packaging, plugin management owns the registry and the
  // lifecycle, the task engine owns the durable task rows, and the neutral
  // runtime module records the plugin failures on the installation rows.
  extensions: ['admin/extension-installer', 'admin/plugin-management', 'plugins', 'extensions/runtime'],
  // The infra domain spans the modules of the neutral infrastructure layer that
  // share the outbox tables and the core-process registry: the process registry
  // owns `core_processes`, the outbox modules own the event records, the event
  // deliveries and the plugin event subscriptions.
  infra: ['infra/core-process', 'infra/events/cleanup', 'infra/events/delivery', 'infra/events/emit'],
};

/**
 * The tables each domain owns. This is the independent declaration of the
 * domain's table set: a table may only be assigned to a domain that declares
 * it here, and a declared table must have that domain as its owner. The safety
 * assertion below enforces both directions.
 */
const DOMAIN_TABLES: Record<string, string[]> = {
  extensions: ['plugin_installations', 'plugin_installs', 'plugin_task_execution_slots'],
  infra: ['core_processes', 'event_deliveries', 'event_records', 'plugin_event_subscriptions'],
};

/**
 * The commerce modules. A domain may never contain one of them: the commerce
 * domain owns its tables through a single module.
 */
const COMMERCE_MODULES = [
  'order',
  'payment',
  'cart',
  'checkout',
  'inventory',
  'product',
  'account',
  'auth',
  'notifications',
  'settings',
  'audit',
  'store',
  'upload',
  'cache',
  'secrets',
  'logger',
  'install',
];

/**
 * Section 3 — the still-open violations.
 *
 * Each entry is one tracked exception. `file` is relative to `src/core` for a
 * Core file and to `src` for a file of the infra or job layer; `module` pins a
 * module edge (`from -> to`); `table` pins a physical table; `specifier` pins
 * one import specifier. `owner` names the batch or decision that owns the
 * follow-up. An entry that no longer matches a real violation fails the audit.
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
    file: 'admin/extension-installer/plugin-migration-executor.ts',
    table: 'admin_audit_events',
    reason: 'the migration executor writes the `admin_audit_events` row with raw SQL inside its own manual transaction instead of going through the `core/audit` write outlet.',
    owner: 'B-BOUND-D follow-up: extend the audit outlet so the migration executor can use it instead of raw SQL.',
  },
  {
    file: 'inventory/service.ts',
    table: 'product_variants',
    reason: 'the inventory module writes the `product_variants` stock level; B-BOUND-A moved the stock write into `InventoryService.applyDesiredStock` on purpose, so the table still has a second writer.',
    owner: 'B-BOUND-A decision (accepted): the stock field of `product_variants` is owned by the inventory module; the guard cannot express field-level ownership.',
  },
  {
    file: 'admin/audit-events/service.ts',
    table: 'admin_audit_events',
    reason: 'the admin audit-events module writes the `admin_audit_events` row itself instead of going through the single audit write outlet of the `audit` module; the private plugin storage records its rows through that second outlet.',
    owner: 'WP-F9 finding (open): the coordinator decides whether the admin audit-events module keeps its own write outlet or the plugin storage records its rows through the `audit` module.',
  },
  {
    file: 'infra/events/delivery.ts',
    table: 'plugin_installations',
    reason: 'the event delivery writes the `plugin_installations` row with raw SQL when a delivery fails permanently; the table is owned by the extensions domain, so the neutral infra layer writes a table of another domain.',
    owner: 'WP-F8 finding (open): the coordinator decides whether the failure bookkeeping moves into the extensions domain or the delivery stops writing the installation row.',
  },
  {
    file: 'infra/events/delivery.ts',
    module: 'infra/events/delivery -> admin/extension-installer',
    specifier: '@/core/admin/extension-installer/plugin-runtime',
    reason: 'the neutral event delivery calls `deliverInstallationEvent` of the admin plugin runtime; the infra layer must not reach into the admin layer.',
    owner: 'callContract batch follow-up (open): the coordination ledger, section 5o, item 3; the edge is listed in LEGAL_EDGES because the audit requires every existing import to be listed, but the dependency itself is still owed.',
  },
];

// ── analysis ────────────────────────────────────────────────────────────────

const coreFiles = apiSourceFiles(CORE_ROOT);
const infraFiles = apiSourceFiles(INFRA_ROOT);
const jobsFiles = apiSourceFiles(JOBS_ROOT);
/** Every scanned file of the Core tree, the infra layer and the job layer. */
const scannedFiles = [...coreFiles, ...infraFiles, ...jobsFiles];
const config = ts.readConfigFile(path.resolve('tsconfig.json'), ts.sys.readFile);
const compilerOptions = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
const program = ts.createProgram(scannedFiles, compilerOptions);
const checker = program.getTypeChecker();

/**
 * The display path of a file.
 *
 * A Core file is shown relative to `src/core` (the anchors of KNOWN_VIOLATIONS
 * keep that form); a file of the infra or job layer is shown relative to `src`.
 */
const relative = (file: string) => {
  const rel = path.relative(SRC_ROOT, file).replaceAll('\\', '/');
  return rel.startsWith('core/') ? rel.slice('core/'.length) : rel;
};

/**
 * The module of a file.
 *
 * A Core module is a directory below `src/core` (`core/order/service.ts` →
 * `order`, `core/admin/order-management/service.ts` →
 * `admin/order-management`): a Core directory is one module with private
 * helper files.
 *
 * The infra and job layers are file-scoped: every file below `src/infra` and
 * `src/jobs` is an independent cross-cutting concern (the process registry, the
 * worker health summary, the outbox, the reconciliation job) without a
 * cohesive internal helper set. Their module name is therefore the path below
 * `src` without its extension: `infra/core-process`, `infra/events/emit`,
 * `jobs/payment-reconciliation`.
 */
function moduleOf(file: string): string {
  const rel = path.relative(SRC_ROOT, file).replaceAll('\\', '/');
  if (rel.startsWith('core/')) {
    const dir = path.posix.dirname(rel.slice('core/'.length));
    return dir === '.' ? 'core' : dir;
  }
  return rel.replace(/\.[cm]?tsx?$/, '');
}

/** Resolve an import specifier to the scanned file it points at. */
function resolveScannedFile(specifier: string, importer: string): string | null {
  let base: string | null = null;
  if (specifier.startsWith('@/core/')) base = path.join(CORE_ROOT, specifier.slice('@/core/'.length));
  else if (specifier.startsWith('@/infra/')) base = path.join(INFRA_ROOT, specifier.slice('@/infra/'.length));
  else if (specifier.startsWith('@/jobs/')) base = path.join(JOBS_ROOT, specifier.slice('@/jobs/'.length));
  else if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(importer), specifier);
    if (SCAN_ROOTS.some(root => resolved === root || resolved.startsWith(root + path.sep))) base = resolved;
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
  for (const file of scannedFiles) {
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
        const target = resolveScannedFile(specifier, file);
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
  for (const file of scannedFiles) {
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
    // Raw SQL writes against a core table. The schema qualifier is optional and
    // may be written in any of its forms (`public`, `"public"`), and the table
    // is the last identifier of the qualified name. A path that is qualified
    // with another schema (a plugin namespace, for example) does not write a
    // Core table and is skipped.
    const text = source.getFullText();
    const sql = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?((?:"[^"]+"|[A-Za-z_$][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_$][\w$]*))*)/gi;
    let match: RegExpExecArray | null;
    while ((match = sql.exec(text))) {
      const identifiers = match[1].match(/"[^"]+"|[A-Za-z_$][\w$]*/g) ?? [];
      if (identifiers.length === 0) continue;
      const table = (identifiers[identifiers.length - 1] ?? '').replace(/^"|"$/g, '');
      if (!tables.has(table)) continue;
      const schema = identifiers.length > 1 ? (identifiers[identifiers.length - 2] ?? '').replace(/^"|"$/g, '') : undefined;
      if (schema !== undefined && schema !== 'public') continue;
      const { line } = source.getLineAndCharacterOfPosition(match.index);
      const call = schema === undefined ? `raw SQL against ${table}` : `raw SQL against ${schema}.${table}`;
      writes.push({ file: relative(file), module, table, line: line + 1, call });
    }
  }
  return writes;
}

const importSites = collectImports();
const crossModuleImports = importSites.filter(site => site.from !== site.to);
const edges = [...new Set(crossModuleImports.map(site => `${site.from} -> ${site.to}`))].sort();
const writes = collectWrites();

/** Rotate a cycle so that its lexicographically smallest module comes first. */
function canonicalCycle(modules: string[]): string[] {
  if (modules.length === 0) return modules;
  let smallest = 0;
  for (let index = 1; index < modules.length; index += 1) {
    if (modules[index] < modules[smallest]) smallest = index;
  }
  return [...modules.slice(smallest), ...modules.slice(0, smallest)];
}

/**
 * Every directed cycle of the module dependency graph.
 *
 * The nodes are the modules of the scanned trees (`src/core`, `src/infra` and
 * `src/jobs`), the edges are the approved cross-module imports. The search
 * starts at every module and only walks to modules that sort after the start
 * module, so each cycle is found exactly once, rotated so that its smallest
 * module comes first.
 */
function findModuleCycles(): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const [from, to] = edge.split(' -> ');
    const targets = adjacency.get(from) ?? [];
    targets.push(to);
    adjacency.set(from, targets);
  }
  const cycles: string[][] = [];
  for (const start of [...adjacency.keys()].sort()) {
    const path = [start];
    const onPath = new Set<string>([start]);
    const walk = (from: string) => {
      for (const next of adjacency.get(from) ?? []) {
        if (next === start) {
          cycles.push(canonicalCycle([...path]));
          continue;
        }
        if (next < start || onPath.has(next)) continue;
        onPath.add(next);
        path.push(next);
        walk(next);
        path.pop();
        onPath.delete(next);
      }
    };
    walk(start);
  }
  return cycles;
}

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
    expect(edges).toEqual(Object.keys(LEGAL_EDGES).sort());
  });

  it('rejects every module dependency cycle that is not registered', () => {
    const known = new Map(KNOWN_CYCLES.map(entry => [canonicalCycle(entry.modules).join(' -> '), entry]));
    const cycles = findModuleCycles();
    const unregistered: string[] = [];
    for (const cycle of cycles) {
      const key = cycle.join(' -> ');
      if (known.has(key)) continue;
      const traversed = cycle.map((module, index) => `${module} -> ${cycle[(index + 1) % cycle.length]}`);
      unregistered.push(`${key} (${traversed.join(', ')})`);
    }
    expect(unregistered, `Unregistered module dependency cycles:\n${unregistered.join('\n')}`).toEqual([]);

    const found = new Set(cycles.map(cycle => cycle.join(' -> ')));
    const stale = [...known.keys()].filter(key => !found.has(key));
    expect(stale, `Known cycles that no longer exist in the tree:\n${stale.join('\n')}`).toEqual([]);
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
      // A domain owner is satisfied by every module of that domain.
      const domainMembers = DOMAIN_MEMBERS[owner];
      if (domainMembers && domainMembers.includes(write.module)) continue;
      const known = KNOWN_VIOLATIONS.find(entry => matchesKnown(entry, write.file, undefined, write.table));
      if (known) continue;
      violations.push(`${write.file}:${write.line} writes "${write.table}" (${write.call}) but the table is owned by "${owner}"`);
    }
    expect(violations, `Cross-domain table writes:\n${violations.join('\n')}\n\nKnown violations still open:\n${knownList}`).toEqual([]);
  });

  it('keeps the domain model safe and free of loopholes', () => {
    const problems: string[] = [];
    const treeModules = new Set(scannedFiles.map(file => moduleOf(file)));

    // 1. Every domain has members and every member exists in the tree.
    for (const [domain, members] of Object.entries(DOMAIN_MEMBERS)) {
      if (members.length === 0) problems.push(`the domain "${domain}" has no members`);
      for (const member of members) {
        if (!treeModules.has(member)) {
          problems.push(`the domain "${domain}" lists "${member}" as a member, but "${member}" is not a module of the scanned tree`);
        }
      }
    }

    // 2. A domain may never contain a commerce module.
    for (const [domain, members] of Object.entries(DOMAIN_MEMBERS)) {
      for (const member of members) {
        if (COMMERCE_MODULES.includes(member)) {
          problems.push(`the domain "${domain}" contains the commerce module "${member}"`);
        }
      }
    }

    // 3. A domain may only own the tables it declares, and every declared
    //    table must be owned by that domain.
    for (const [table, owner] of Object.entries(TABLE_OWNERS)) {
      if (!DOMAIN_MEMBERS[owner]) continue;
      const declared = DOMAIN_TABLES[owner] ?? [];
      if (!declared.includes(table)) {
        problems.push(`the table "${table}" is assigned to the domain "${owner}", but "${table}" is not one of the tables of that domain`);
      }
    }
    for (const [domain, tables] of Object.entries(DOMAIN_TABLES)) {
      for (const table of tables) {
        const owner = TABLE_OWNERS[table];
        if (owner !== domain) {
          problems.push(`the table "${table}" is declared as a table of the domain "${domain}", but its owner is "${owner ?? 'none'}"`);
        }
      }
    }

    expect(problems, `Domain model problems:\n${problems.join('\n')}`).toEqual([]);
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

  it('scans the whole core, infra and job tree', () => {
    const summary = `files=${scannedFiles.length} edges=${edges.length} writes=${writes.length} known=${KNOWN_VIOLATIONS.length}`;
    expect(scannedFiles, summary).toEqual([...apiSourceFiles(CORE_ROOT), ...apiSourceFiles(INFRA_ROOT), ...apiSourceFiles(JOBS_ROOT)]);
  });
});
