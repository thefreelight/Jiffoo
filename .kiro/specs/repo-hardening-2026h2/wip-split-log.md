# WIP Split Log — Task 1 (repo-hardening-2026h2)

> Records the verification evidence for each commit of the WIP split (task group 1).
> Branch: `codex/runtime-single-source-truth-wip`. Safety snapshot: `stash@{0}` (`pre-split-snapshot`).

## 1.1 Baseline (2026-07-10, before any commit)

- **Drift check (1.1.3)**: ✅ zero drift — ran `check-drift.sh` against throwaway DB `jiffoo_drift_check` (NOT the dev DB: the script uses `$DATABASE_URL` as Prisma shadow DB, which gets reset).
- **Full API suite (1.1.2)**: `cd apps/api && npx vitest run tests/`
  - Test Files: **5 failed | 82 passed (87)**
  - Tests: **4 failed | 1136 passed | 2 skipped (1142)** — duration 202s
  - The 4 failed tests are all `tests/routes/discount-e2e.test.ts` (known pending item → task 3.2).
  - File-level failures (no test-level failures, pre-existing, → task 3.1 reconciliation):
    - `tests/performance/benchmarks.test.ts` — "No test suite found in file"
    - `tests/plugins/sendgrid-provider.test.ts` — imports missing module `src/plugins/email-providers/sendgrid-provider`
    - `tests/contract/openapi-contract.test.ts` — suite-level hook errors (2 suites)
    - `tests/routes/official-launch-plugins.test.ts` — suite-level hook error
  - **Finding for task 3.1**: `vitest.config.ts` exclude list contains only node_modules/dist/e2e — the "15 excluded files" from KNOWN-FAILURES.md are NOT excluded anymore; total discovered tests = 1142, not the documented 925. The doc is stale.
- **Commit-order correction vs. original plan**: theme contract types + theme packs must land BEFORE shop runtime, because `apps/shop/lib/themes/registry.ts` imports `@shop-themes/app-landingpage/src/runtime`, and theme packs use the new `app-download` archetype from `packages/shared/src/types/theme.ts`. Revised order: ① themes+contract → ② shop runtime → ③ API test debt → ④ admin → ⑤ meta.
- **New guard**: added `.gitignore` rules `packages/shop-themes/*/public/downloads/` + `*.apk` — the new `app-landingpage` package contained a 12MB APK (`public/downloads/EasyEUICC-v1.6.2.apk`) that must not enter git history; binaries belong in release storage.

## 1.3 Commit ①′ — themes (`1c25a62c`, 131 files)

- Scope: theme contract types (`app-download` archetype + app distribution fields), SDK surface snapshot, new `@shop-themes/app-landingpage` package, theme content updates (default/imagic-studio/serene/modelsfind), `.gitignore`, root `package.json` (next 16.0.7 override), `pnpm-lock.yaml`.
- Verified: `pnpm theme-matrix:validate` 73/73; `pnpm theme-matrix:type-check` 2/2; `pnpm surface:check` snapshot matches; app-landingpage discovered by matrix (6/6 manifest checks); no APK/.next staged.
- Note: theme-matrix type-check only covers `@shop-themes/default` + SDK build — the other theme packages are not type-checked by the matrix (potential gap for task 2.1.5 / theme-gate).

## 1.2 Commit ②′ — shop runtime (`3c97d5ca`, 8 files)

- Scope: server store context dedupe (React cache), focus-reload throttling (ThemePackProvider + StoreContextProvider), app-landingpage embedded renderer registration, next.config.js/Dockerfile.
- Verified: shop theme tests 23/24; `pnpm --filter shop type-check` 0 errors.
- **Pre-existing failure** (fails identically without WIP changes, verified via temp stash): `tests/themes/store-context-provider.test.tsx` › "falls back to the server theme slug when no embedded renderer contract is present" — expects `builtin-default`, gets `unknown-market-theme`. Either the fallback semantics changed intentionally (branch is "runtime single source of truth") and the test is stale, or the fallback regressed earlier. Needs an owner decision → tracked as follow-up in task 3.1 notes.
- **Finding**: root script `test:shop-runtime-truth` references 4 test files that do not exist (`theme-pack-loader`, `theme-provider-remote-runtime`, `storefront-runtime-source-of-truth`, `esim-mall-runtime-registry`) — script is aspirational/stale; only 2 of 6 files exist. Fold into task 5.2 script cleanup.

## 1.4 Commit ③ — API test debt (`54e41f48`, 21 files)

- Verified: full suite 1136 passed | 4 failed | 2 skipped (1142); all 4 failures = discount-e2e (task 3.2). Drift check before/after: zero drift.
- File-level errors (pre-existing/environmental, task 3.1): benchmarks (empty suite), sendgrid-provider (imports deleted module), official-launch-plugins (`spawn zip ENOENT`), openapi-contract (2 empty suites when OpenAPI spec absent).

## 1.5 Commit ④ — admin (`3f74d622` + `79f73ea9`)

- `3f74d622`: WIP admin changes as-is (managedPackageApi.provision, useProvisionManagedPackage hook, admin E2E proxy env + click-flow assertions).
- `79f73ea9`: fixes for pre-existing admin type-check failures found during verification:
  1. `lib/store.ts` login: `extendedUserData` read `userData` before its declaration — real TDZ runtime bug on every login, not just a type error.
  2. `lib/api.ts` `OfficialCatalogItem`: missing `solutionOffer`/`solutionPackage` fields already consumed by 4 extension components (types imported from shared).
  3. `InstanceHealthCard`: `resolveApiErrorMessage(err)` missing required `t` arg.
- After fixes: `pnpm --filter admin type-check` 0 errors (also cleared stale local `.next` that referenced deleted staff pages — gitignored artifact).
- Admin E2E full run deferred to 1.7.2 pre-merge regression.

## 1.7 合回主线 — merge `origin/main` (`85dbc7ce`) + 回归修复 (`d7b014a6`, 后续)

### 1.7.1 策略评估（rebase → merge）

- `git merge origin/main` 首次尝试产生 **199 个冲突文件**，远超 10 文件阈值 → 停下评估。
- 评估结论：main 自 3 月被私有仓 squash 覆盖（`6be327aa`），7 月 4 日 CF Pages 调试期间 `d4149440`（提交信息 "remove open-next.config.ts"）误将本地机器全部工作暂存提交（685 文件 +125k 行），内含真实业务工作（staff RBAC + 3 个迁移、bokmoo API、native 支付确认、i18n/stripe 插件全量实现）与垃圾（`.vercel` 产物、13MB APK、`pw_token*.js`、npm tgz、提交进 git 的 node_modules 符号链接）。
- 经 owner 确认采用「全部保留，完整合并」。冲突解决原则：双方都改的平台代码取 WIP（更新、测试背书）；main 独有业务工作全部保留并补齐集成；垃圾从树中移除（main 历史仍可找回）。
- rebase 放弃原因：分支含 merge commit（origin/dev），rebase 线性化会改写 tasks.md 引用的 5 个逻辑提交哈希。

### 合并集成工作（见 merge commit `85dbc7ce` 提交信息明细）

- Schema：AdminMembership / AdminStaffAuditLog / User.phone 移植进拆分 schema（`system.prisma`），与 main 带来的 3 个迁移零 drift——**这同时修复了 main 自身的 schema drift**（main 的 schema.prisma 从未包含这些迁移对应的模型）。
- Dump 引用但从未提交的支撑件全部补实现：`requirePermission` 中间件、`AuthenticatedUser` admin 字段、`sendStaffInvitationEmail`、`StripeService.confirmNativePayment`、admin staffApi + 9 个 react-query hooks、shop `verifyEmail`、`UserProfile` admin 身份字段、主题 Login/Register `onAppleOAuthClick`。
- Edge runtime 策略：仓库源码保持 Node 兼容（自托管部署需要 fs 主题加载），`export const runtime = 'edge'` 改为 CF Pages 构建脚本注入（与脚本中既有的 `rm proxy.ts` 同模式）。**CF Pages 部署需在合并后实际部署验证一次**。
- 孤儿处置（实现两边都不存在，仅移除测试/页面，可从 main 历史找回）：social-auth 测试 ×3、bokmoo-auth-compat 测试（手机号注册兼容层无实现）、shop accept-invite / oauth-callback 页面、B2B 全套（api/admin/shop，WIP schema 无 B2B 模型，属刻意移除，见 b2b-digital-goods-proposal.md）。

### 1.7.2 全量回归

| 门禁 | 结果 |
|---|---|
| `pnpm theme-matrix:validate` | 73/73 ✅ |
| `pnpm theme-matrix:type-check` | 2/2 ✅ |
| `pnpm surface:check` | 快照一致 ✅（onAppleOAuthClick 为有意的表面新增，快照已随 `1622...` 刷新） |
| `pnpm --filter shop type-check` | 0 错误 ✅ |
| `pnpm --filter admin type-check` | 0 错误 ✅ |
| shop vitest | **47/47 ✅**（含修复合并前遗留失败 "falls back to the server theme slug"：已加载 manifest 无渲染契约时不再透传不可渲染 slug） |
| admin vitest | 27/27 ✅ |
| api vitest 全量 | 1168+ passed；剩余失败均为已备案存量：openapi-contract 空套件 ×2、benchmarks 空套件、sendgrid 缺模块、official-launch-plugins 缺 zip（任务 3.1）；discount-e2e / orders / forecasting / payments 为状态泄漏抖动——单文件跑全绿，全量跑随执行顺序偶发（任务 3.2 范畴扩大：不止 discount-e2e 一处泄漏源） |
| `pnpm --filter api db:check-drift` | 零 drift ✅（一次性库 jiffoo_drift_check） |
| `pnpm test:e2e:shop` | 6/6 ✅（修复两处共享测试环境问题后：① vitest 助手遗留的 TEST 仓抢占默认仓且无 e2e 库存——global-setup 现在先降级非 E2E 仓；② Redis db15 持久缓存 `warehouse:default`——global-setup 现在清 `warehouse:*` 键） |
| `pnpm test:e2e:admin` | 26 passed / 1 skipped ✅（修复：中间件默认店 id `store-default` 在测试库不存在导致 STORE_REQUIRED——两个 playwright 配置注入 `STORE_DEFAULT_ID=e2e-default-store`） |

- 发现并修复（回归揭示的真实 bug）：`resolveServerApiOrigin` / `getActiveThemeInfo` 曾优先请求来源而非内网 `API_SERVICE_URL`（SSR 回绕公网域名）；主题 loader 版本化请求会静默回退 legacy 路径；`deliverInternalWebhook` 是仅记日志的 stub。
- API 全量 tsc 存量类型债（≈20 错误：BullMQ/OTel/prisma-$extends 依赖类型不匹配）在合并前即存在，归任务 2.1.2/3.1。
