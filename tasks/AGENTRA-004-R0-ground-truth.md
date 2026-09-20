# AGENTRA-004-R0 Charter & task-file ground truth

Inspection timestamp: 2026-09-20 (Asia/Shanghai). This report is based solely on read-only filesystem and Git inspection. No implementation directories were read.

## Step 1 — Which tree am I in

- Current worktree absolute path: `C:\Personal Develop\jiffoo\worktrees\jiffoo-core-extension-boundary` (Git worktree output; no source path:line applies).
- Current branch: `codex/core-extension-boundary` (Git branch output; no source path:line applies).
- HEAD: `f3c8284e` — `refactor(core): finalize in-process plugin runtime` (Git log output; no source path:line applies).
- This working tree is dirty (Git status output; no source path:line applies). Dirty paths follow; `M` means modified, `D` deleted, `??` untracked, and `MM` has both index and working-tree changes.

```text
M  .env.production.example
M  apps/admin/app/[locale]/auth/login/page.tsx
M  apps/admin/app/[locale]/dashboard/page.tsx
M  apps/admin/app/[locale]/layout.tsx
M  apps/admin/app/[locale]/orders/page.tsx
D  apps/admin/app/[locale]/package/page.tsx
M  apps/admin/app/[locale]/plugins/page.tsx
M  apps/admin/app/[locale]/products/page.tsx
M  apps/admin/app/[locale]/settings/page.tsx
M  apps/admin/app/[locale]/themes/page.tsx
M  apps/admin/app/health/route.ts
M  apps/admin/app/layout.tsx
M  apps/admin/components/auth/login-modal.tsx
D  apps/admin/components/dashboard/PlatformOffersCards.tsx
M  apps/admin/components/extensions/InstalledPluginsRail.tsx
M  apps/admin/components/extensions/OfficialPluginsCatalog.tsx
M  apps/admin/components/extensions/OfficialThemesCatalog.tsx
D  apps/admin/components/extensions/PlatformConnectionCard.tsx
M  apps/admin/components/extensions/PluginsManager.tsx
M  apps/admin/components/extensions/ThemesManager.tsx
M  apps/admin/components/layout/admin-layout.tsx
M  apps/admin/components/layout/blue-minimal-header.tsx
M  apps/admin/components/layout/blue-minimal-layout.tsx
M  apps/admin/components/layout/blue-minimal-sidebar.tsx
M  apps/admin/components/layout/header.tsx
M  apps/admin/components/layout/sidebar.tsx
D  apps/admin/components/settings/ManagedLicensePanel.tsx
M  apps/admin/hooks/use-localized-navigation.ts
M  apps/admin/lib/admin-access.ts
M  apps/admin/lib/api.ts
M  apps/admin/lib/hooks/use-api.ts
D  apps/admin/lib/managed-mode.tsx
M  apps/admin/tests/lib/admin-access.test.ts
M  apps/api/.env.example
M  apps/api/prisma/schema/system.prisma
M  apps/api/prisma/seed.ts
M  apps/api/src/config/env.ts
M  apps/api/src/core/admin/extension-installer/bundle-installer.ts
M  apps/api/src/core/admin/extension-installer/index.ts
M  apps/api/src/core/admin/extension-installer/plugin-fs-installer.ts
M  apps/api/src/core/admin/extension-installer/plugin-runtime.ts
M  apps/api/src/core/admin/extension-installer/types.ts
M  apps/api/src/core/admin/extension-installer/utils.ts
D  apps/api/src/core/admin/managed-package/routes.ts
D  apps/api/src/core/admin/managed-package/service.ts
M  apps/api/src/core/admin/market/install-handoff.ts
D  apps/api/src/core/admin/market/market-client.ts
M  apps/api/src/core/admin/market/official-catalog.ts
M  apps/api/src/core/admin/market/official-package-recovery.ts
M  apps/api/src/core/admin/market/routes.ts
M  apps/api/src/core/admin/market/update-checker.ts
M  apps/api/src/core/admin/order-management/routes.ts
M  apps/api/src/core/admin/order-management/schemas.ts
M  apps/api/src/core/admin/order-management/service.ts
D  apps/api/src/core/admin/platform-connection/routes.ts
D  apps/api/src/core/admin/platform-connection/service.ts
D  apps/api/src/core/admin/platform-connection/url.ts
D  apps/api/src/core/admin/platform-offers/routes.ts
D  apps/api/src/core/admin/platform-offers/service.ts
M  apps/api/src/core/admin/plugin-management/lifecycle-hooks.ts
M  apps/api/src/core/admin/plugin-management/service.ts
M  apps/api/src/core/admin/product-management/service.ts
M  apps/api/src/core/auth/admin-access.ts
M  apps/api/src/core/auth/admin-permission-guard.ts
M  apps/api/src/core/auth/routes.ts
M  apps/api/src/core/error-tracking/types.ts
M  apps/api/src/core/mall/routes.ts
M  apps/api/src/core/payment/reconciliation.ts
M  apps/api/src/core/payment/routes.ts
M  apps/api/src/core/product/service.ts
M  apps/api/src/core/store/routes.ts
M  apps/api/src/core/upload/service.ts
M  apps/api/src/core/user/service.ts
M  apps/api/src/middleware/store-context.ts
M  apps/api/src/routes/index.ts
M  apps/api/src/routes/v1/index.ts
M  apps/api/src/server.ts
M  apps/api/src/types/fastify.d.ts
M  apps/api/src/utils/route-error-mapper.ts
M  apps/api/src/utils/signature.ts
M  apps/api/tests/core/market-update-checker.test.ts
M  apps/api/tests/core/official-catalog.test.ts
M  apps/api/tests/core/official-package-recovery.test.ts
M  apps/api/tests/core/payment-routes.test.ts
D  apps/api/tests/core/platform-connection-url.test.ts
D  apps/api/tests/core/platform-offers.test.ts
M  apps/api/tests/core/plugin-fs-installer.test.ts
M  apps/api/tests/core/plugin-gateway-baseline.test.ts
M  apps/api/tests/core/plugin-lifecycle-hooks.test.ts
M  apps/api/tests/core/plugin-runtime.test.ts
M  apps/api/tests/helpers/auth.ts
M  apps/api/tests/middleware/store-context.test.ts
D  apps/api/tests/routes/admin-market-install.test.ts
M  apps/api/tests/routes/admin-orders.test.ts
M  apps/api/tests/routes/extensions.test.ts
D  apps/api/tests/routes/market-install-binding.test.ts
D  apps/api/tests/routes/official-launch-plugins.test.ts
M  apps/api/vitest.config.ts
M  apps/shop/public/install.sh
D  deploy/dashboard.html
D  deploy/helm/values-dev.yaml
D  deploy/helm/values-prod.yaml
D  deploy/helm/values.yaml
M  docker-compose.prod.yml
M  docs/admin-rbac-design.md
M  docs/operations/admin-staff-rbac-release-checklist.md
M  install.sh
M  package.json
M  packages/mcp-server/src/index.ts
M  packages/plugin-sdk/README.md
M  packages/plugin-sdk/package.json
M  packages/plugin-sdk/src/cli/commands/init.ts
M  packages/plugin-sdk/src/index.ts
M  packages/plugin-sdk/src/types.ts
M  packages/shared/index.ts
D  packages/shared/src/extensions/commercial-package.ts
M  packages/shared/src/extensions/official-catalog.ts
D  packages/shared/src/extensions/platform-connection.ts
M  packages/shared/src/i18n/README.md
M  packages/shared/src/i18n/messages/en/merchant.ts
MM packages/shared/src/i18n/messages/index.ts
M  packages/shared/src/i18n/messages/zh-Hant/merchant.d.ts
M  packages/shared/src/i18n/messages/zh-Hant/merchant.ts
M  packages/shared/src/i18n/types.ts
M  packages/shared/src/index.ts
M  packages/shared/src/security/admin-rbac.ts
D  plugins/core/managers/installer.ts
D  plugins/core/services/license.ts
M  scripts/release-oss-patch.mjs
D  scripts/seed-remote.sh
M  scripts/verify-admin-quality-gate.mjs
?? apps/api/prisma/migrations/20260920000000_plugin_registry_version/
?? apps/api/src/core/admin/extension-installer/plugin-registry-version.ts
?? apps/api/src/core/payment/manual-payment.ts
?? apps/api/src/core/storage/
?? apps/shop/app/[locale]/payment/manual/
?? docs/AGENTRA-002-recon-a.md
?? docs/AGENTRA-002-recon-b.md
?? docs/AGENTRA-002-recon-c.md
?? docs/AGENTRA-003-conformance.md
?? docs/AGENTRA-004-recon.md
?? docs/agentra-001-core-v1-product-charter.md
?? packages/plugin-sdk/src/__tests__/init-scaffold.test.ts
?? tasks/
```

Other Git worktree: `C:/Personal Develop/jiffoo/Jiffoo`, branch `main`, HEAD `717bdf3718f62d82c2a137a5aa552eba30f286d4` (Git worktree output; no source path:line applies).

## Step 2 — Charter structure, verbatim

The charter has 416 lines: [docs/agentra-001-core-v1-product-charter.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docs/agentra-001-core-v1-product-charter.md:1).

```text
line 1: # AGENTRA-001: Jiffoo Core V1 Product Charter
line 6: ## 1. Product Promise
line 32: ## 2. Merchant Journeys
line 34: ### Initial Store Operation
line 42: ### Add a Capability
line 63: ### Update Core
line 73: ## 3. Core V1 Capabilities
line 75: ### Commerce Kernel
line 83: ### Extension Center and Execution
line 126: ### Failure Containment
line 139: ### State and Storage Boundaries
line 162: ### Plugin Database and Migrations
line 190: ### Event Layer
line 201: ### Extension SDK
line 209: ### Storefront Tracking and Custom Code
line 237: ### Themes
line 258: ### Core Updates
line 283: ### Extension Lifecycle
line 291: ## 4. Non-Negotiable Rules
line 320: ## 5. V1 Acceptance Scenarios
line 372: ## 6. Deferred Decisions
line 398: ## 7. Outside the V1 Worktree
```

The scope-exclusion heading is `## 7. Outside the V1 Worktree`, covering lines 398–416: [docs/agentra-001-core-v1-product-charter.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docs/agentra-001-core-v1-product-charter.md:398). Its introductory exclusion statement is at lines 400–401, and its seven exclusion bullets are at lines 403–416: [docs/agentra-001-core-v1-product-charter.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docs/agentra-001-core-v1-product-charter.md:400).

The file contains a numbered acceptance-scenario list of 16 items, numbered 1 through 16. The first item begins at line 325 and the final item begins at line 368; the list content ends at line 370, immediately before `## 6. Deferred Decisions` at line 372: [docs/agentra-001-core-v1-product-charter.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docs/agentra-001-core-v1-product-charter.md:325), [docs/agentra-001-core-v1-product-charter.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docs/agentra-001-core-v1-product-charter.md:372).

## Step 3 — Is this charter the finalized one

No other charter copy or variant was found. Search performed: `rg -l -i --glob '!node_modules/**' --glob '!**/.git/**' 'AGENTRA-001: Jiffoo Core V1 Product Charter' .` and `rg -l -i --glob '!node_modules/**' --glob '!**/.git/**' 'agentra-001-core-v1-product-charter|AGENTRA-001' .` from the worktree root; both case-insensitive searches returned only [docs/agentra-001-core-v1-product-charter.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docs/agentra-001-core-v1-product-charter.md:1). Therefore there is no second hit for which line count, first heading, modification time, or difference can be reported.

The sole hit has 416 lines, first heading `# AGENTRA-001: Jiffoo Core V1 Product Charter`, and last-modified time `2026-09-20 18:52:13 +08:00`: [docs/agentra-001-core-v1-product-charter.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/docs/agentra-001-core-v1-product-charter.md:1). The timestamp is filesystem metadata and therefore has no source path:line.

## Step 4 — `tasks/` inventory

`AGENTRA-004-R0-ground-truth.md` | 212 lines | 2026-09-20 21:48:50 +08:00 (observed immediately before this metadata correction) | `# AGENTRA-004-R0 Charter & task-file ground truth` ([tasks/AGENTRA-004-R0-ground-truth.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/tasks/AGENTRA-004-R0-ground-truth.md:1)).

`AGENTRA-004-test-diagnosis.md` | 286 lines | 2026-09-20 20:35:55 +08:00 | `# AGENTRA-004 Pass C - Test Baseline Diagnosis` ([tasks/AGENTRA-004-test-diagnosis.md](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/tasks/AGENTRA-004-test-diagnosis.md:1)).

## Inspection methods

- Git metadata: `git worktree list --porcelain`, `git branch --show-current`, `git log -1 --format='%h%x09%s'`, and `git status --short`, all run at the worktree root.
- Charter headings: PowerShell `Select-String` with case-sensitive pattern `^#{1,6}\s+` against `docs/agentra-001-core-v1-product-charter.md`.
- Scope coverage: PowerShell line-numbered read of lines 398–416 and case-insensitive `Select-String` for `outside|not in V1|excluded|exclusion|worktree|scope` against the charter.
- Acceptance scenarios: case-sensitive `Select-String` pattern `^\s*\d+[.)]\s+` against the charter.
- Task metadata: PowerShell `Get-ChildItem tasks -File`, line counts from `Get-Content`, file timestamps from `LastWriteTime`, and case-sensitive first-heading pattern `^#{1,6}\s+`.
