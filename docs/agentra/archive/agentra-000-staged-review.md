# AGENTRA-000-B4 Staged Change Review

本报告只读取暂存区。统计、路径和 diff 证据来自 `git diff --cached`；当前行号来自暂存工作树文件。未执行编辑、暂存、取消暂存、提交、构建或测试。

## 1. Raw Inventory

`git diff --cached --stat` 的完整汇总行：`123 files changed, 1079 insertions(+), 11460 deletions(-)`。该命令的 123 条逐文件统计由以下 path list 和各 cluster 的净行数完整覆盖；原始输出中的最大单文件变更是 `packages/shared/src/extensions/official-catalog.ts`（4/1009）、`apps/api/tests/routes/admin-market-install.test.ts`（0/789）和 `apps/api/tests/routes/official-launch-plugins.test.ts`（0/619）。

## 2. Grouped Changes

### Official catalog and managed/platform control-plane removal

Paths (M/D): `apps/api/src/core/admin/market/official-catalog.ts` M, `apps/api/src/core/admin/market/routes.ts` M, `apps/api/src/core/admin/market/official-package-recovery.ts` M, `apps/api/src/core/admin/market/install-handoff.ts` M, `apps/api/src/core/admin/market/update-checker.ts` M, `apps/api/src/core/admin/market/market-client.ts` D, `apps/api/src/core/admin/managed-package/{routes.ts,service.ts}` D, `apps/api/src/core/admin/platform-connection/{routes.ts,service.ts,url.ts}` D, `apps/api/src/core/admin/platform-offers/{routes.ts,service.ts}` D, `packages/shared/src/extensions/{commercial-package.ts,platform-connection.ts}` D, `packages/shared/src/extensions/official-catalog.ts` M, `packages/shared/index.ts` M, `packages/shared/src/index.ts` M, `plugins/core/{managers/installer.ts,services/license.ts}` D. Net: 267 added / 4244 removed.

The diff removes the managed-package service routes and its activation, status, branding, and provisioning operations; the deleted route registrations are visible in `HEAD:apps/api/src/core/admin/managed-package/routes.ts` and deleted service exports in `HEAD:apps/api/src/core/admin/managed-package/service.ts`. It removes the API platform-connection service and platform-offers route/service; their prior route and export names are in `HEAD:apps/api/src/core/admin/platform-connection/routes.ts` and `HEAD:apps/api/src/core/admin/platform-offers/service.ts`. The shared official-catalog module is reduced by 1009 deleted lines, and API market catalog/routes are correspondingly reduced (staged diff for [official-catalog.ts](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/core/admin/market/official-catalog.ts:1) and [routes.ts](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/core/admin/market/routes.ts:1)).

Remaining-reference search: case-insensitive `rg -n 'getOfficialCatalogEntry|ManagedPackageService|ManagedPackageDefinition|PlatformConnectionService|PlatformOfferService|platform-connection|platform-offers|managed-package|PlatformOffersCards|PlatformConnectionCard|ManagedLicensePanel|managed-mode|market-client' apps packages docs config scripts tests`, excluding `node_modules`, `dist`, `.next`. It finds the four `getOfficialCatalogEntry` tests listed in §3 and Cloudflare-native platform files listed in §3. Internal completeness: NOT ESTABLISHED because surviving references exist.

### Admin extension/dashboard UI simplification

Paths (M/D): `apps/admin/app/[locale]/{auth/login,page?}` changes are separately in auth cluster; this cluster is `apps/admin/app/[locale]/{dashboard,plugins,themes,settings}.tsx` M, `apps/admin/components/extensions/{InstalledPluginsRail,OfficialPluginsCatalog,OfficialThemesCatalog,PluginsManager,ThemesManager}.tsx` M, `apps/admin/components/{dashboard/PlatformOffersCards.tsx,extensions/PlatformConnectionCard.tsx,settings/ManagedLicensePanel.tsx}` D, `apps/admin/lib/{api.ts,hooks/use-api.ts,managed-mode.tsx}` M/D, plus layout/sidebar files M. Net: 305 added / 1960 removed.

The diff removes managed package props, package filtering, platform binding and commercial pricing/release display from the catalog components; representative removals are in [OfficialPluginsCatalog.tsx:9](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/admin/components/extensions/OfficialPluginsCatalog.tsx:9) and [OfficialThemesCatalog.tsx:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/admin/components/extensions/OfficialThemesCatalog.tsx:1). It deletes standalone Platform Offers, Platform Connection, Managed License, and package page UI files; their former hook/API names appear in the deleted files noted above. PURPOSE_NOT_VISIBLE beyond the concrete removal and prop/API simplification.

Remaining-reference search is the same §2 search. It found no remaining app-admin import of the deleted UI component names; it did find a theme README mention of `managed-mode` at `packages/shop-themes/ai-gateway/README.md:33`. Internal completeness: NOT ESTABLISHED because the shared/API cluster has surviving references.

### Extension package storage, install lifecycle, and registry-version calls

Paths (M): `apps/api/prisma/schema/system.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/core/admin/extension-installer/{bundle-installer,index,plugin-fs-installer,plugin-runtime,types,utils}.ts`, `apps/api/src/core/admin/plugin-management/{lifecycle-hooks,service}.ts`, `apps/api/src/core/upload/service.ts`, `apps/api/src/server.ts`, `apps/api/src/routes/{index.ts,v1/index.ts}`, `apps/api/src/types/fastify.d.ts`, `apps/api/src/utils/signature.ts`, `apps/api/src/core/mall/routes.ts`, `apps/api/src/core/store/routes.ts`, `apps/api/src/middleware/store-context.ts`, and adjacent auth/product/user/error route edits. Net: 201 added / 350 removed.

The diff adds `pluginRegistryVersion Int @default(0)` to `SystemSettings` at [system.prisma:51](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/schema/system.prisma:51), and staged installer/plugin-management callers import and call `incrementPluginRegistryVersion` (for example [plugin-fs-installer.ts:34](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts:34), [plugin-management/service.ts:14](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/core/admin/plugin-management/service.ts:14)). The installer diff replaces direct package filesystem paths with `pluginPackageStore` access and adjusts lifecycle/runtime call sites. PURPOSE_NOT_VISIBLE for the collective relationship of all adjacent route/auth/product/user edits.

Remaining-reference search: `rg -n -i 'pluginRegistryVersion|PluginPackageStore|UploadedFileStore' apps/api/src apps/api/prisma`; it finds the staged callers and [migration.sql:2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/migrations/20260920000000_plugin_registry_version/migration.sql:2). Internal completeness: migration exists for the schema field; see §4.

### Delivery and deployment surface deletion

Paths (M/D): `.env.production.example` M, `docker-compose.prod.yml` M, `install.sh` M, `apps/shop/public/install.sh` M, `package.json` M, `deploy/dashboard.html` D, `deploy/helm/{values.yaml,values-dev.yaml,values-prod.yaml}` D, `scripts/{seed-remote.sh,release-oss-patch.mjs,verify-admin-quality-gate.mjs}` M/D. Net: 22 added / 1403 removed.

The diff removes `MARKET_API_URL` from production environment, Compose API environment, and install script; the concrete Compose removal is [docker-compose.prod.yml:82](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docker-compose.prod.yml:82) and the install default removal is [install.sh:174](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/install.sh:174). It deletes the HTML deployment dashboard and all three Helm values files, whose deleted contents include API/shop/tenant/admin and legacy service definitions. `package.json` replaces two deleted market-install test paths with `official-package-recovery.test.ts` in `test:admin-market-theme-upgrade` ([package.json:64](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/package.json:64)).

Remaining-reference search: case-insensitive `rg -n 'MARKET_API_URL|deploy/helm|values-dev.yaml|values-prod.yaml|deploy/dashboard.html|seed-remote.sh' .github docs deploy scripts package.json docker-compose*.yml`; no result for the deleted deployment paths or `MARKET_API_URL`. Internal completeness: no surviving reference found by that search.

### Auth/login, admin access, localization, and SDK text/types edits

Paths (M/D): `apps/admin/app/[locale]/auth/login/page.tsx`, `apps/admin/components/auth/login-modal.tsx`, `apps/admin/{app/[locale]/{layout,orders,products}.tsx,app/health/route.ts,app/layout.tsx,hooks/use-localized-navigation.ts,lib/admin-access.ts}`, `apps/api/src/{config/env.ts,core/auth/{admin-access,admin-permission-guard,routes}.ts}`, `packages/shared/src/{i18n/README.md,i18n/messages/{en/merchant.ts,index.ts,zh-Hant/merchant.{d.ts,ts}},i18n/types.ts,security/admin-rbac.ts}`, and `docs/admin-rbac-design.md`, `docs/operations/admin-staff-rbac-release-checklist.md`. Net: 80 added / 274 removed.

The visible diffs remove managed-license/platform text and related RBAC/documentation entries, and modify login UI/API hook interactions. Representative changed runtime configuration is [apps/api/src/config/env.ts:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/config/env.ts:1); representative localization removals are [merchant.ts:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/packages/shared/src/i18n/messages/en/merchant.ts:1). PURPOSE_NOT_VISIBLE for a single unifying purpose across authentication, localization, and docs.

Remaining-reference search: case-insensitive `rg -n 'managedLicense|platformConnection|platformOffer|marketplaceReady' apps/admin apps/api packages`; surviving matches are covered by §3's Cloudflare and test results. Internal completeness: NOT ESTABLISHED.

### Test-surface pruning and fixture changes

Paths (M/D): `apps/admin/tests/lib/admin-access.test.ts` M; `apps/api/tests/core/{market-update-checker,official-catalog,official-package-recovery,plugin-fs-installer,plugin-gateway-baseline,plugin-lifecycle-hooks,plugin-runtime}.test.ts` M; `apps/api/tests/{helpers/auth.ts,middleware/store-context.test.ts,routes/extensions.test.ts}` M; `apps/api/tests/core/{platform-connection-url,platform-offers}.test.ts` D; `apps/api/tests/routes/{admin-market-install,market-install-binding,official-launch-plugins}.test.ts` D; `apps/api/vitest.config.ts` M; `packages/plugin-sdk/src/cli/commands/init.ts`, `packages/plugin-sdk/src/{index.ts,types.ts}`, `packages/plugin-sdk/{README.md,package.json}` M. Net: 262 added / 2424 removed.

Deleted tests covered platform-connection URL normalization, platform-offers storage, admin market installation, market-install binding, and official plugin launch (their imports/describes are visible in `HEAD:<path>` outputs). Modified official catalog/recovery tests delete many assertions (numstat 18/422 and 37/165); `store-context.test.ts` adds 26 assertion/setup lines. The SDK type/init diffs remove exports/types and modify scaffold generation; PURPOSE_NOT_VISIBLE beyond those concrete diff operations.

Remaining-reference search: §3's exact `getOfficialCatalogEntry` search and `rg -n -i 'platform-connection|platform-offers|managed-package' apps/api/tests apps/admin/tests`; internal completeness is NOT ESTABLISHED because four tests remain against a removed catalog export.

### UNGROUPED

Paths (M): `apps/api/src/core/{payment/reconciliation.ts,payment/routes.ts}`, `apps/api/src/core/admin/order-management/{routes.ts,schemas.ts,service.ts}`, `apps/api/src/utils/route-error-mapper.ts`, `apps/api/tests/core/payment-routes.test.ts`, `apps/api/tests/routes/admin-orders.test.ts`. These are working-tree-only (second status column) rather than staged-index entries in the current status; they are excluded from the 123 staged-path review.

## 3. Dangling References

- `getOfficialCatalogEntry` was removed from staged `apps/api/src/core/admin/market/official-catalog.ts`; surviving test imports are [tianquan-payment-catalog.test.ts:2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/tests/core/tianquan-payment-catalog.test.ts:2), [tianquan-catalog.test.ts:2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/tests/core/tianquan-catalog.test.ts:2), and [remoteradar-catalog.test.ts:3](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/tests/core/remoteradar-catalog.test.ts:3). This is source-test content.
- Removed API platform-connection/offers modules have surviving source references in Cloudflare-native code: [platform-connection.ts:46](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/cloudflare-native-core-api/src/platform-connection.ts:46) and [platform-offers.ts:9](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/cloudflare-native-core-api/src/platform-offers.ts:9), plus tests at [platform-offers.test.ts:2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/cloudflare-native-core-api/src/platform-offers.test.ts:2). They are separate app source/tests, not imports of deleted API module paths.
- Removed managed-mode text has a surviving docs reference in `packages/shop-themes/ai-gateway/README.md:33` (documentation).

Search method: case-insensitive `rg -n` fixed alternation for deleted module/export/component names across `apps packages docs config scripts tests`, excluding `node_modules`, `dist`, `.next`; deleted export names were first extracted with `git show HEAD:<deleted-path>` and `Select-String` for `export`, Fastify registration, and service names.

## 4. Schema and Migration Changes

Exact staged schema hunk: `SystemSettings` adds `pluginRegistryVersion Int @default(0)` after `lastUpdatedAt` at [apps/api/prisma/schema/system.prisma:48](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/schema/system.prisma:48)–[51](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/schema/system.prisma:51). A staged/new migration corresponds: `apps/api/prisma/migrations/20260920000000_plugin_registry_version/migration.sql` adds the same non-null integer default at [migration.sql:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/migrations/20260920000000_plugin_registry_version/migration.sql:1)–[2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/migrations/20260920000000_plugin_registry_version/migration.sql:2). No other staged Prisma schema file appears in `git diff --cached --name-status`; therefore this staged schema change has a migration and no additional staged schema change lacks one. Search: `git diff --cached -- apps/api/prisma/schema/system.prisma`, `git diff --cached --name-status`, and case-insensitive `rg 'pluginRegistryVersion|SystemSetting' apps/api/prisma apps/api/src`.

## 5. Config and Deployment Changes

`.env.production.example` removes one line (the diff's managed-market URL entry); `docker-compose.prod.yml` and `install.sh` remove `MARKET_API_URL` as described in the delivery cluster. `apps/shop/public/install.sh` removes one line (diff statistic 0/1). All `deploy/**` changes are deletions: `dashboard.html` (349 lines), Helm `values-dev.yaml` (126), `values-prod.yaml` (180), `values.yaml` (200). `package.json` changes the one test script shown at [package.json:64](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/package.json:64). Concrete deleted Helm keys/services are available only in `HEAD:deploy/helm/*.yaml`, including `global`, `services`, `config`, ingress and monitoring sections; no corresponding current file lines exist.

## 6. Test Surface Changes

All staged test paths are enumerated in the Test-surface cluster. Deleted tests are `platform-connection-url.test.ts`, `platform-offers.test.ts`, `admin-market-install.test.ts`, `market-install-binding.test.ts`, `official-launch-plugins.test.ts`; their tested imports/routes are recorded from `git show HEAD:<path>` in §2. Modified tests remove assertions in `market-update-checker` (11/113), `official-catalog` (18/422), and `official-package-recovery` (37/165); `middleware/store-context.test.ts` adds assertions/setup (26/0); `routes/extensions.test.ts` adds 139 and removes 5 lines. `apps/api/vitest.config.ts` changes 3/1 lines. Exact assertion semantic classification beyond those diff operations is PURPOSE_NOT_VISIBLE without asserting intent.

## 7. History Context

Raw `git log --oneline -15`:

```text
5fe6b711 chore(agentra): track charter, recon reports, and batch-4a sources
f3c8284e refactor(core): finalize in-process plugin runtime
7b6a6f4e refactor(market): use canonical official artifact origin
299818a3 refactor(core): remove mirrored official plugin packaging
7522a4f6 Merge pull request #319 from thefreelight/feature/catalog-growth-plugins-001
6ff11370 feat(catalog): register 8 growth-suite plugins 0.0.1
10e482d2 Merge pull request #317 from thefreelight/feature/native-catalog-category-001
899f4cc7 fix(affiliate): answer CORS preflights on store routes
4a4ab0c7 perf(shop-auth): Suspense boundaries + forgot-password prefetch
009667c3 feat(auth): shop and admin forgot-password pages + admin login link
e6f2e5c3 feat(auth): password recovery via emailed reset code (core + shop + admin)
d743086f feat(marketplace): honor declared plugin category through native catalog and localize admin chips
78676fe7 chore(bokmoo-theme): rebuild 1.1.8 runtime bundle (0caca2c1…)
8a634687 fix(bokmoo-theme): auth pages used nonexistent Tailwind h-13/min-h-13
ecc63d0c fix(admin): hide Job Sources nav on cores without the jobs admin proxy
```

Representative path histories: `official-catalog.ts`: `7b6a6f4e`, `f3c8284e`, `299818a3`; `plugin-fs-installer.ts`: `f3c8284e`, `299818a3`, `54e41f48`; `OfficialPluginsCatalog.tsx`: `f159387f`, `15bb6ab0`; `docker-compose.prod.yml`: `293e4f81`, `b6149a37`, `4e832a0a` (raw command: `git log --oneline -3 -- <path>`).

## 8. Cluster Dependencies

- Official catalog/control-plane removal depends on Test-surface pruning because deleted tests and surviving `getOfficialCatalogEntry` imports concern [official-catalog.ts](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/core/admin/market/official-catalog.ts:1).
- Admin extension/dashboard UI simplification depends on Official catalog/control-plane removal because deleted UI files previously imported managed/platform hooks from the deleted API/shared surfaces (`HEAD:apps/admin/components/extensions/PlatformConnectionCard.tsx`).
- Extension storage/registry changes depend on the registry migration because [system.prisma:51](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/schema/system.prisma:51) is implemented by [migration.sql:2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/prisma/migrations/20260920000000_plugin_registry_version/migration.sql:2).
- Delivery/deployment removal has no surviving reference from the stated delivery search.
