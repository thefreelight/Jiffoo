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
  'account -> plugin-pages': 'the account module revokes the live plugin-page sessions of a deleted principal through the public plugin-page service.',
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
  'admin/extension-installer -> plugin-pages': 'the plugin runtime enforces the public plugin-page origin policy.',
  'admin/extension-installer -> plugin-storage': 'the contract runtime hands a plugin its storage API through the public plugin-storage service.',
  'admin/extension-installer -> plugins': 'the installer uses the public durable-task API (`assertTaskClaim`, `withTaskScope`, task policy).',
  'admin/extension-installer -> settings': 'the installer bumps the plugin registry version through the public settings module that owns the `system_settings` row.',
  'admin/extension-installer -> shared': 'the installer re-exports the platform-wide circuit breaker parameters from the neutral shared configuration module.',
  'admin/extension-installer -> storage': 'the installer resolves package blobs, current packages and operation leases through the public storage stores.',
  'admin/health-monitoring -> admin/extension-installer': 'the health monitor reads the public plugin runtime state.',
  'admin/health-monitoring -> plugins': 'the health monitor reads the public plugin task health projection.',
  'admin/notifications -> audit': 'the admin notification routes record audit events through the audit outlet.',
  'admin/notifications -> auth': 'the admin notification routes resolve recipients through the public email-verification service.',
  'admin/notifications -> notifications': 'the admin notification routes write the resend copy through the public notification service that owns the `notifications` table.',
  'admin/order-management -> admin/extension-installer': 'the admin order module reads the public plugin runtime state.',
  'admin/order-management -> audit': 'the admin order module records audit events through the audit outlet.',
  'admin/order-management -> cache': 'the admin order module invalidates cached catalog and order entries.',
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
  'admin/plugin-management -> plugin-pages': 'plugin management revokes the live plugin-page sessions of an installation or a plugin through the public plugin-page service.',
  'admin/plugin-management -> plugin-storage': 'plugin management purges the private files of an uninstalled installation through the public plugin-storage service.',
  'admin/plugin-management -> plugins': 'plugin management uses the public durable-task API.',
  'admin/plugin-management -> settings': 'plugin management bumps the plugin registry version through the public settings module that owns the `system_settings` row.',
  'admin/plugin-management -> storage': 'plugin management resolves packages and operation leases through the public storage stores.',
  'admin/product-management -> cache': 'the admin product module invalidates the product cache.',
  'admin/product-management -> inventory': 'the admin product module sets variant stock through the public inventory service.',
  'admin/product-management -> order': 'the admin product module asks the order module whether a product is referenced by an order item.',
  'admin/product-management -> settings': 'the admin product module reads system settings through the public settings service.',
  'admin/product-management -> upload': 'the admin product routes publish product media through the public upload service.',
  'admin/staff-management -> audit': 'the staff module records staff-audit rows through the single audit write outlet.',
  'admin/staff-management -> auth': 'the staff module uses the public account-recovery and email-verification services.',
  'admin/staff-management -> plugin-pages': 'the staff module revokes the live plugin-page sessions of a disabled or deleted staff principal through the public plugin-page service.',
  'admin/storefront-code -> audit': 'the storefront-code module records audit events through the single audit write outlet.',
  'admin/system-settings -> settings': 'the old admin path is a pure re-export shim of the relocated settings module.',
  'admin/user-management -> audit': 'the admin user module records audit events through the audit outlet.',
  'admin/user-management -> auth': 'the admin user module issues password-reset links through the public auth account-recovery service.',
  'admin/user-management -> cache': 'the admin user module invalidates cached user entries.',
  'admin/user-management -> plugin-pages': 'the admin user module revokes the live plugin-page sessions of a disabled or deleted user through the public plugin-page service.',
  'admin/user-management -> settings': 'the admin user module reads system settings through the public settings service.',
  'auth -> audit': 'the auth module records staff-audit rows through the single audit write outlet.',
  'auth -> cache': 'the auth module caches token and settings entries.',
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
  'checkout -> settings': 'the checkout service reads system settings through the public settings service.',
  'checkout -> shared': 'the checkout service uses the neutral money helper.',
  'extensions/runtime -> extensions/shared': 'the neutral runtime helpers decrypt the stored plugin configuration through the neutral extension helpers.',
  'extensions/shared -> storage': 'the neutral extension helpers resolve package roots through the public plugin package store.',
  'install -> auth': 'the installer creates the bootstrap administrator through the public auth identity service.',
  'install -> settings': 'the installer writes the installation row through the public settings module that owns the `system_settings` row.',
  'inventory -> cache': 'the inventory service bumps the product cache version.',
  'notifications -> admin/extension-installer': 'the notification delivery calls plugins through the public plugin runtime.',
  'notifications -> auth': 'the notification service reads the recipient locale through the auth module\'s public identity projection instead of the `users` table.',
  'notifications -> extensions/registry': 'the notification delivery resolves the notification provider through the read-only registry.',
  'notifications -> extensions/runtime': 'the notification delivery takes the plugin timeout from the neutral runtime gateway protection helpers.',
  'notifications -> order': 'the notification service reads the order through the order module\'s public projection.',
  'order -> admin/extension-installer': 'the order service calls plugin contracts through the public plugin runtime.',
  'order -> auth': 'the order routes authenticate through the public auth middleware and read the account through the auth module\'s public identity projection.',
  'order -> cart': 'the order service consumes purchased cart lines through the public cart service (`CartService.consumePurchasedItems`).',
  'order -> checkout': 'the order service re-quotes the purchased lines through the public checkout service.',
  'order -> extensions/registry': 'the order service resolves payment providers through the read-only registry.',
  'order -> extensions/runtime': 'the order service names the contract error through the neutral runtime helpers instead of the admin layer.',
  'order -> inventory': 'the order service checks and reserves stock through the public inventory service.',
  'order -> logger': 'the order service logs through the unified logger.',
  'order -> payment': 'the order service drives the payment module through its public service.',
  'order -> plugin-pages': 'the order module binds the plugin purchase origin of an order through the public plugin-page service.',
  'order -> product': 'the order service reads the sellable catalog through the product module\'s public projection.',
  'order -> settings': 'the order service reads system settings through the public settings service.',
  'order -> shared': 'the order module uses the neutral money, pricing and row-lock helpers.',
  'payment -> admin/extension-installer': 'the payment module calls plugin contracts through the public plugin runtime.',
  'payment -> audit': 'the payment module records audit events through the audit outlet.',
  'payment -> auth': 'the payment routes authenticate through the public auth middleware.',
  'payment -> cache': 'the payment routes invalidate cached entries.',
  'payment -> extensions/registry': 'the payment module resolves providers through the read-only registry.',
  'payment -> extensions/runtime': 'the payment module takes the plugin timeout from the neutral runtime gateway protection helpers instead of the admin layer.',
  'payment -> logger': 'the payment routes log through the unified logger.',
  'payment -> notifications': 'the payment module emits notifications through the public notification service.',
  'payment -> order': 'the payment module reports payment outcomes through the order module\'s public service.',
  'payment -> settings': 'the payment routes read system settings through the public settings service.',
  'payment -> shared': 'the payment module uses the neutral money and row-lock helpers.',
  'plugin-pages -> admin/extension-installer': 'the plugin-page asset routes use the installer\'s public migration gate and signing policy.',
  'plugin-pages -> cart': 'the plugin-page routes add a storefront variant to the cart through the public cart service.',
  'plugin-pages -> extensions/registry': 'the plugin-page asset routes read the plugin instance through the read-only registry\'s public installation projection instead of querying the plugin domain\'s tables directly.',
  'plugin-pages -> plugins': 'the plugin-page session module records the plugin task principal in the transaction through the public durable-task API.',
  'plugin-pages -> product': 'the plugin-page routes read the sellable catalog through the public product read service.',
  'plugin-pages -> storage': 'the plugin-page asset routes read package blobs through the public storage stores.',
  'plugin-storage -> admin/audit-events': 'the plugin-storage service records the audit events of a file operation through the admin audit-event writer.',
  'plugin-storage -> admin/extension-installer': 'the plugin-storage service admits a file operation through the installer\'s public storage admission service.',
  'plugin-storage -> plugin-pages': 'the plugin-storage routes issue the attachment grants of a live plugin-page shell through the public plugin-page service.',
  'plugin-storage -> plugins': 'the plugin-storage service validates the plugin task principal and claims the scheduler slot through the public durable-task API.',
  'plugin-storage -> storage': 'the plugin-storage service keeps the private file bytes in the public uploaded-object store.',
  'plugins -> admin/extension-installer': 'the task worker invokes plugin tasks through the public plugin runtime.',
  'plugins -> extensions/runtime': 'the durable-task worker records the plugin failures through the neutral runtime helpers instead of the admin layer.',
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
  // The plugin-page and plugin-storage rings: the mainline plugin-page and
  // per-plugin file-storage modules join the extension ring. Every edge of
  // these rings is an approved public export of the module it points at, and
  // no module of a ring reaches into the internal helper file of the next.
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; and the plugin-page routes use the installer migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; and the notification delivery calls plugins through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification delivery takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; and the order service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; and the checkout service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; the checkout service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; and the payment module calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; the payment module takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page session module records the plugin task principal in the transaction; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page session module records the plugin task principal in the transaction; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-pages', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management revokes the live plugin-page sessions of an installation; the plugin-page asset routes read package blobs through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; and the plugin-storage service admits a file operation through the installer.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; and the plugin-page routes use the installer migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; and the notification delivery calls plugins through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification delivery takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; and the order service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; and the checkout service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; the checkout service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; and the payment module calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; the payment module takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page session module records the plugin task principal in the transaction; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page session module records the plugin task principal in the transaction; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugin-pages', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page asset routes read package blobs through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage service claims the durable-task slot of a file operation; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage service claims the durable-task slot of a file operation; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'admin/plugin-management', 'plugin-storage', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer calls the plugin-management service; plugin management purges the private files of an uninstalled installation; the plugin-storage service keeps the private file bytes in the object store; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages'],
    reason: 'every step of this ring is an approved public-export call: the installer routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service binds the plugin purchase origin of an order; and the plugin-page routes use the installer migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the installer routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service binds the plugin purchase origin of an order; the plugin-page session module records the plugin task principal in the transaction; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service binds the plugin purchase origin of an order; the plugin-page session module records the plugin task principal in the transaction; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'notifications', 'order', 'plugin-pages', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service binds the plugin purchase origin of an order; the plugin-page asset routes read package blobs through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the installer routes authenticate through the auth middleware; the auth middleware enforces the plugin-page origin policy; the plugin-page session module records the plugin task principal in the transaction; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'auth', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the installer routes authenticate through the auth middleware; the auth middleware enforces the plugin-page origin policy; the plugin-page session module records the plugin task principal in the transaction; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; and the notification delivery calls plugins through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification delivery takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; and the order service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; and the checkout service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; the checkout service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; and the payment module calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; the payment module takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page session module records the plugin task principal in the transaction; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the plugin runtime enforces the plugin-page origin policy; the plugin-page session module records the plugin task principal in the transaction; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; and the plugin-storage service admits a file operation through the installer.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; and the plugin-page routes use the installer migration gate and signing policy.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; and the notification delivery calls plugins through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification delivery takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; and the order service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; and the checkout service calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'checkout', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service re-quotes the purchased lines through the checkout service; the checkout service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service names the contract error through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; and the payment module calls plugin contracts through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'cart', 'auth', 'notifications', 'order', 'payment', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page routes add a storefront variant to the cart; the cart routes authenticate through the auth middleware; the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service drives the payment module through its public service; the payment module takes the plugin timeout from the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page session module records the plugin task principal in the transaction; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page session module records the plugin task principal in the transaction; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugin-pages', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage routes issue the attachment grants of a live plugin-page shell; the plugin-page asset routes read package blobs through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugins'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage service claims the durable-task slot of a file operation; and the task worker invokes plugin tasks through the plugin runtime.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'plugins', 'extensions/runtime', 'extensions/shared', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage service claims the durable-task slot of a file operation; the durable-task worker records the plugin failures through the neutral runtime helpers; the runtime helpers decrypt the stored plugin configuration; the extension helpers resolve package roots through the storage stores; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['admin/extension-installer', 'plugin-storage', 'storage'],
    reason: 'every step of this ring is an approved public-export call: the contract runtime hands the storage API to a plugin; the plugin-storage service keeps the private file bytes in the object store; and the storage module exposes the installer recovery test control.',
  },
  {
    modules: ['auth', 'notifications', 'order', 'plugin-pages', 'cart'],
    reason: 'every step of this ring is an approved public-export call: the auth module sends verification and recovery notifications; the notification service reads the order through the order projection; the order service binds the plugin purchase origin of an order; the plugin-page routes add a storefront variant to the cart; and the cart routes authenticate through the auth middleware.',
  },
  {
    modules: ['auth', 'plugin-pages', 'cart'],
    reason: 'every step of this ring is an approved public-export call: the auth middleware enforces the plugin-page origin policy; the plugin-page routes add a storefront variant to the cart; and the cart routes authenticate through the auth middleware.',
  },
];

/**
 * Section 2 — table ownership.
 *
 * Exactly one owner may write a table. The key is the physical table name
 * (`@@map`), the value is the owning module or the owning domain. `infra` marks
 * a table that is owned outside `apps/api/src/core` (the outbox and the
 * core-process registry).
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
  // plugin pages and per-plugin file storage
  plugin_page_sessions: 'plugin-pages',
  plugin_purchase_origins: 'plugin-pages',
  plugin_files: 'plugin-storage',
  plugin_file_cleanup: 'plugin-storage',
  plugin_storage_quotas: 'plugin-storage',
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
};

/**
 * The tables each domain owns. This is the independent declaration of the
 * domain's table set: a table may only be assigned to a domain that declares
 * it here, and a declared table must have that domain as its owner. The safety
 * assertion below enforces both directions.
 */
const DOMAIN_TABLES: Record<string, string[]> = {
  extensions: ['plugin_installations', 'plugin_installs', 'plugin_task_execution_slots'],
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
 * Each entry is one tracked exception. `file` is relative to `src/core`;
 * `module` pins a module edge (`from -> to`); `table` pins a physical table;
 * `specifier` pins one import specifier. `owner` names the batch or decision
 * that owns the follow-up. An entry that no longer matches a real violation
 * fails the audit.
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
    file: 'admin/audit-events/service.ts',
    table: 'admin_audit_events',
    reason: 'the admin audit-events module writes the `admin_audit_events` row through its own transactional writer instead of going through the `core/audit` write outlet, so the audit table has a second writer.',
    owner: 'G-1 follow-up: route the admin audit-events writer through the `core/audit` outlet so that `admin_audit_events` keeps a single writer.',
  },
  {
    file: 'inventory/service.ts',
    table: 'product_variants',
    reason: 'the inventory module writes the `product_variants` stock level; B-BOUND-A moved the stock write into `InventoryService.applyDesiredStock` on purpose, so the table still has a second writer.',
    owner: 'B-BOUND-A decision (accepted): the stock field of `product_variants` is owned by the inventory module; the guard cannot express field-level ownership.',
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
 * The nodes are the modules of `src/core`, the edges are the approved
 * cross-module imports. The search starts at every module and only walks to
 * modules that sort after the start module, so each cycle is found exactly
 * once, rotated so that its smallest module comes first.
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
    const treeModules = new Set(coreFiles.map(file => moduleOf(file)));

    // 1. Every domain has members and every member exists in the tree.
    for (const [domain, members] of Object.entries(DOMAIN_MEMBERS)) {
      if (members.length === 0) problems.push(`the domain "${domain}" has no members`);
      for (const member of members) {
        if (!treeModules.has(member)) {
          problems.push(`the domain "${domain}" lists "${member}" as a member, but "${member}" is not a module of the core tree`);
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

  it('scans the whole core tree', () => {
    const summary = `files=${coreFiles.length} edges=${edges.length} writes=${writes.length} known=${KNOWN_VIOLATIONS.length}`;
    expect(coreFiles, summary).toEqual(apiSourceFiles(CORE_ROOT));
  });
});
