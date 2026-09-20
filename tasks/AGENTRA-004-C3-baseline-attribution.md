# AGENTRA-004-C3 Test Baseline Attribution

## Charter Gate

章程文件存在：`docs/agentra-001-core-v1-product-charter.md`。其第 7 节标题为
`## 7. Outside the V1 Worktree`，见 `docs/agentra-001-core-v1-product-charter.md:398`；
本文将其视为任务所称的“§7”。未读取或替代任何 `tasks/` 中的章程文件。

## 1. Environment Truth

已完整读取 `.github/workflows/pr-quality-gates.yml:1-170`。

| Applicable block | Evidence | Value / finding |
|---|---|---|
| Workflow env | `.github/workflows/pr-quality-gates.yml:20-21` | `NODE_VERSION='20'`。 |
| api-tests job | `.github/workflows/pr-quality-gates.yml:48-50` | Ubuntu runner，20 分钟时限。 |
| PostgreSQL service env | `.github/workflows/pr-quality-gates.yml:51-64` | `POSTGRES_USER=postgres`、`POSTGRES_PASSWORD=postgres`、`POSTGRES_DB=jiffoo_test`。 |
| Redis service | `.github/workflows/pr-quality-gates.yml:65-73` | 无 service-level env block。 |
| api-tests job env | `.github/workflows/pr-quality-gates.yml:74-81` | `CI=true`、`NODE_ENV=test`、`DATABASE_URL`、`DATABASE_URL_TEST`、`REDIS_URL`、`JWT_SECRET=ci-test-secret`、`STORE_DEFAULT_ID=test-store`。 |
| api-tests step env | `.github/workflows/pr-quality-gates.yml:82-115` | 无 step-level `env` block。 |
| `secrets.` references | `rg -n -i -F 'secrets.' .github/workflows/pr-quality-gates.yml` | 无输出；该工作流没有 `secrets.` 引用。 |

### SERVICE_JWT_SECRET

搜索方法：`rg -n -i -F 'SERVICE_JWT_SECRET' .github apps/api packages apps/admin apps/shop --glob '!node_modules/**' --glob '!dist/**' --glob '!*.map'`；并对 workflow、`.env.example`、Vitest config/setup、test helpers/tests 执行同一固定字符串搜索。`apps/api/tests/.env.test` 不存在（`Test-Path` 返回 `False`）；`Get-ChildItem -Force apps/api -Filter '.env*'` 仅列出 `.env.example`。

- workflow、`.env.example`、Vitest config、Vitest setup 和 helpers 中均未设置该值；上述定向搜索在这些路径无命中。
- `apps/api/src/config/env.ts:71-72` 仅将 `SERVICE_JWT_ISSUER` 默认化，将 `SERVICE_JWT_SECRET` 定义为 optional。
- `apps/api/src/core/auth/service-auth.ts:10-18` 在验证时要求该值；缺失时抛出 `SERVICE_JWT_SECRET is not configured`。
- `apps/api/tests/core/service-auth.test.ts:7` 使用 `process.env.SERVICE_JWT_SECRET!` 作为 `jwt.sign` 的 key。

结论：CI `api-tests` 没有提供 `SERVICE_JWT_SECRET`。

### AUTH_REQUIRE_EMAIL_VERIFICATION

搜索方法：`rg -n -i -F 'AUTH_REQUIRE_EMAIL_VERIFICATION' .github apps/api packages apps/admin apps/shop --glob '!node_modules/**' --glob '!dist/**' --glob '!*.map'`，以及对 workflow、`.env.example`、Vitest config/setup、helpers/tests 的定向固定字符串搜索。

- `apps/api/.env.example:27-30` 设置 `AUTH_REQUIRE_EMAIL_VERIFICATION=true`。
- `apps/api/src/config/env.ts:63` 默认值为 `'true'`；`apps/api/src/core/auth/service.ts:102-103` 直接读取 process env。
- `apps/api/tests/routes/auth.test.ts:76-77` 和 `:123-127` 在单个测试内设置并恢复 `'false'`。
- `apps/api/tests/core/auth-service.test.ts:117-131` 保存/恢复值，`:320` 与 `:384` 设置 `'false'`。
- workflow、Vitest config、Vitest setup、helpers 和不存在的 `.env.test` 均未提供全局测试值；上述定向搜索在这些位置无命中。

## 2. Re-run With Migration

工作流的精确 migrate 命令是 `pnpm --filter api exec prisma migrate deploy`，见 `.github/workflows/pr-quality-gates.yml:96-99`。

按工作流 package-build 顺序执行：

```text
pnpm --filter shared build                         PASS
pnpm --filter @jiffoo/ui build                    PASS
pnpm --filter @jiffoo/core-api-sdk build          PASS
pnpm --filter @jiffoo/theme-api-sdk build         PASS
pnpm --filter api export:openapi                  PASS
pnpm --filter api exec prisma migrate deploy      PASS
pnpm --filter api test                            FAIL (exit 1)
```

构建顺序来自 `.github/workflows/pr-quality-gates.yml:90-97`；OpenAPI 与测试命令来自 `:111-115`。导出命令输出：`OpenAPI spec successfully exported and validated`。迁移命令输出：`12 migrations found in prisma/migrations` 与 `No pending migrations to apply.`，因此本次未发现 migration drift。

测试仅使用 `.github/workflows/pr-quality-gates.yml:74-81` 的七个 job variables：

```text
CI=true
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jiffoo_test?schema=public
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/jiffoo_test?schema=public
REDIS_URL=redis://localhost:6379/15
JWT_SECRET=ci-test-secret
STORE_DEFAULT_ID=test-store
```

未提供 `AUTH_REQUIRE_EMAIL_VERIFICATION`、`SERVICE_JWT_SECRET` 或其他变量。最终 Vitest 原文：

```text
Test Files  11 failed | 84 passed (95)
Tests  25 failed | 1458 passed | 2 skipped (1485)
```

完整失败列表见第 4 节；每项只归入一个 bucket。

## 3. Baseline Reconciliation

`apps/api/tests/KNOWN-FAILURES.md:3-5` 记录 2026-07-13 基线为 91 files，
`1494 passed / 0 failed / 2 skipped (1496)`。`KNOWN-FAILURES.md:6-7` 将详细历史指向
该文件的 Git history 和 `.kiro/specs/.../wip-split-log.md`。本任务禁止 Git operation，且当前
工作树没有该历史清单，因此“1496 产生时 openapi.json 是否存在”为
`UNVERIFIABLE_STATIC`。要确定它，需要允许读取该提交的 Git history 或提供该次运行的完整日志。

`KNOWN-FAILURES.md:20-21` 只说明缺少 `apps/api/openapi.json` 会静默跳过“350+”契约
用例；它没有陈述 1496 运行时该文件的存在状态。当前生成的 spec 报告 421 operations（本次测试
stdout），而 `tests/contract/openapi-contract.test.ts` 当前收集 353 tests。

当前树中用 `rg --files apps/api/tests -g '*.test.ts' -g '*.spec.ts'` 发现 101 个候选；按
`apps/api/vitest.config.ts:14-28` 排除 5 个 `tests/e2e/**` Playwright 文件和
`tests/performance/benchmarks.test.ts`，余 95 个，与运行结果一致。该搜索不证明 2026-07 的
91-file 集合。

1496 - 1485 = 11。然而基线没有每文件/每测试名称清单，且 Git history 禁止读取，故无法识别
这 11 个历史 cases 或文件；此项为 `UNVERIFIABLE_STATIC`，不作估计。下面是本次运行的每文件
收集数（来自 `pnpm --filter api test` verbose file summaries），用于后续可比较历史日志：

```text
auth 33; email-verification 14; multi-store-dashboard.e2e 8; openapi-contract 353;
admin-staff 7; account 15; store 6; plugin-fs-installer 1; service-auth 1;
remoteradar-catalog 1; tianquan-catalog 2; tianquan-payment-catalog 1;
admin-health 6; discount-e2e 14; extensions 24; admin-users 30; orders 23;
cart 21; cart-batch 13; cache-behavior 32; admin-products 36; admin-orders 32;
seo 47; admin-inventory 13; integration/versioning 34; admin-dashboard 4;
payments 13; products 22; admin-settings 7; admin-plugins 33; forecasting-service 30;
plugin-runtime 5; admin-themes 16; upgrade 24; plugin-gateway-baseline 9;
themes-public 4; integration/plugin-compatibility 29; system 9;
forecasting-algorithms 16; security-headers 25; in-memory-rate-limiter 12;
job-infrastructure 15; rate-limit-middleware 16; recommendation-routes 1;
payment-routes 9; theme-installer-upgrade 1; theme-app-runtime-security 18;
digital-fulfillment 15; admin-catalog-import 4; bokmoo-app-facade 24;
external-order-service-polling 7; deprecation 27; telemetry 8; upgrade-executors 9;
resumable-downloader 1; theme-management-service 4; plugin-lifecycle-hooks 1;
webhook-delivery-worker 2; admin-catalog-import-service 2; plugin-module-loader 2;
external-order-polling-worker 3; official-package-recovery 1; official-catalog 2;
extension-installer-security 5; api-standards 5 (2 skipped); product-service 8;
email-verification-code 5; api-version 44; theme-extensions-service 1; auth-service 23;
gateway-metrics 6; order-service 13; gateway-protection 29; store-context 3;
versioning 19; trust-level-enforcement 2; theme-app-contract 3;
api-token-middleware 9; theme-app-runtime-policy 4; plugin-order-routes 2;
contract-v1-runtime 4; signature-verification 12; version-utils 28;
trust-level-install-integration 1; plugin-config-secrets 2; account-service 2;
plugin-config-readiness 3; external-order-utils 3; market-update-checker 1;
plugin-loader 40; recommendation-service 1; plugin-manifest-contract 4;
stripe-service-config 2; native-payment-confirmation 2; auth-middleware 2.
```

上面的简写名称直接对应 Vitest 输出中的 `tests/...` 路径；当前完整路径集是上述固定 glob 命令返回的 95-file 集合。

## 4. Failure Classification

| Bucket | Failures | Evidence |
|---|---|---|
| `MISSING_ENV_VAR` | `tests/core/service-auth.test.ts` — `accepts only HS256 tokens signed with the service secret and issuer` | Test uses undefined `SERVICE_JWT_SECRET` as JWT signing key at `tests/core/service-auth.test.ts:7`; CI env omits it at workflow `:74-81`; source requires it at `src/core/auth/service-auth.ts:10-18`. |
| `REAL_VIOLATION` | `auth.test.ts` register; all three `email-verification.test.ts` resend/workflow cases; `account.test.ts` update email; `admin-staff.test.ts` resend invite | Shared email-delivery cause is traced in §5. Charter requires console email without an extension at `docs/agentra-001-core-v1-product-charter.md:39`; transactional email instead throws when no SMTP plugin subscription exists at `src/services/transactional-email.service.ts:28-32`. |
| `UNKNOWN` | `multi-store-dashboard.e2e.test.ts` Step 3 and Step 4 | Assertions are `expected +0 to be 3` at `:442` and `expected +0 to be 1` at `:471`. Multi-store is outside V1 (`charter:409`), but static evidence here does not establish the runtime cause of zero statistics. |
| `REAL_VIOLATION` | 10 public-operation cases in `contract/openapi-contract.test.ts`: `/api/v1/account`, `/api/account`, `/api/cards`, `/api/cards/{cardId}`, `/api/orders/{orderId}/install-session`, `/api/profiles`, `/api/payment-methods`, `/api/notifications`, `/api/support/tickets`, `/api/support/cards/search` | Parameterized public contract asserts status is not 401 at `tests/contract/openapi-contract.test.ts:115-142`; each returns 401 in this run. |
| `REAL_VIOLATION` | `contract/openapi-contract.test.ts` `GET /api/store/context should return valid schema`; `routes/store.test.ts` `should match OpenAPI schema on success` | Both report `expected false to be true`; contract validation is at `openapi-contract.test.ts:221-233`, route assertion at `tests/routes/store.test.ts:45-47`. |
| `REAL_VIOLATION` | Four catalog assertions: Tianquan theme, SMTP plugin, Tianquan payment catalog, RemoteRadar catalog | Each imports `getOfficialCatalogEntry` at the respective test lines `2/3` and fails because that export does not exist; §6 traces the chain. |

没有失败归类为 `MISSING_MIGRATION`：迁移后运行报告无 pending migrations，且迁移前 C2 运行已有相同的 1485 总数。Step 2 没有 `ENV_WINDOWS` 失败；此前仅在 C2 出现的 plugin filesystem `EPERM rename` 在迁移后未复现，故不属于这 25 个失败。

## 5. One Email Root Cause

这六个失败共享同一代码路径：强制 transactional email delivery 要求已安装、启用且内部订阅的 SMTP plugin。

1. Auth registration determines verification is required at `src/core/auth/service.ts:207-217`, calls `EmailVerificationService.sendVerificationEmail` at `:219-226`, and auth route maps the thrown error to HTTP 400 at `src/core/auth/routes.ts:83-92`.
2. Resend route calls the same service at `src/core/auth/routes.ts:296`; an unsuccessful result maps to HTTP 400 at `:298-305`. `EmailVerificationService.resendVerificationEmail` delegates at `src/services/email-verification.service.ts:197-217`.
3. Account email update calls the same sender at `src/core/account/service.ts:118-125`; account route's default error mapping is HTTP 500 at `src/core/account/routes.ts:187-199`.
4. Staff invite calls `sendStaffInvitationEmail` at `src/core/admin/staff-management/service.ts:668-676`; failed delivery creates `INVITE_SEND_FAILED` status 502. The route delegates to that service at `src/core/admin/staff-management/routes.ts:120-140`.
5. Both sender methods call `TransactionalEmailService.send`: verification at `src/services/email-verification.service.ts:82-99`, staff invitation at `:244-261`. That service throws `SMTP email plugin is not installed, enabled, and subscribed to email.send` whenever no internal `email.send` subscription exists (`src/services/transactional-email.service.ts:28-32`).

静态路径证明了同一 delivery prerequisite 和每个断言状态的映射。特定运行时 subscription 集合是否为空未作为 Vitest response body 输出；没有保留的 response logging 或测试期间数据库查询时，该运行时事实为 `UNVERIFIABLE_STATIC`。

## 6. Catalog Export Chain

`getOfficialCatalogEntry` does not exist in current source. Fixed-string, case-insensitive search
`rg -n -i 'getOfficialCatalogEntry' apps/api packages --glob '*.ts' --glob '*.tsx' --glob '*.d.ts' --glob '!dist/**'` returns only the three failing tests; no source export is found.

测试 specifier 为 `@/core/admin/market/official-catalog`，位于
`tests/core/tianquan-catalog.test.ts:2`, `tests/core/tianquan-payment-catalog.test.ts:2`, and
`tests/core/remoteradar-catalog.test.ts:3`. Vitest maps `@` to `apps/api/src` at
`apps/api/vitest.config.ts:95-105`; TypeScript maps `@/*` to `./src/*` at
`apps/api/tsconfig.json:31-44`. Therefore the specifier resolves to
`apps/api/src/core/admin/market/official-catalog.ts`.

该模块导出 `OfficialCatalogItem`（`official-catalog.ts:10-31`）和
`getOfficialCatalog` (`:47-84`), but not `getOfficialCatalogEntry`. The production market route
imports and calls `getOfficialCatalog` at `src/core/admin/market/routes.ts:10,22-31`; its focused
test also imports `getOfficialCatalog` at `tests/core/official-catalog.test.ts:12-37`.

Search method for declaration shadowing: `rg --files packages -g '*.d.ts'`, plus
`rg --files apps/api/src -g 'official-catalog.d.ts' -g 'official-catalog.*'`. It finds no
`official-catalog.d.ts`; the only matching runtime module is `official-catalog.ts`. Checked-in
`packages/shared/src/i18n/messages/zh-Hans/merchant.d.ts:382` declares `roleTenantAdmin`; it is
in a different package/path and cannot resolve the `@/core/admin/market/official-catalog` import.
没有 `.d.ts` 遮蔽该 runtime module。

## 7. Payment Contract Coverage

生成的 `apps/api/openapi.json` 包含 20 个 payment-named operations：

```text
POST /api/v1/admin/orders/{id}/record-manual-payment
GET /api/v1/payments/available-methods
POST /api/v1/payments/create-session
GET /api/v1/payments/verify/{sessionId}
POST /api/v1/payments/webhook/{provider}
GET|POST /api/payment-methods
POST /api/payment-methods/{paymentMethodId}/default
DELETE /api/payment-methods/{paymentMethodId}
POST /api/payments/apple-pay/confirm
POST /api/payments/google-pay/confirm
POST /api/admin/orders/{id}/record-manual-payment
GET /api/payments/available-methods
POST /api/payments/create-session
GET /api/payments/verify/{sessionId}
POST /api/payments/webhook/{provider}
POST /api/payments/create-intent
POST /api/payments/webhook
POST /api/payments/stripe/create-intent
POST /api/payments/stripe/webhook
```

该枚举由解析 `apps/api/openapi.json` 并筛选包含
`payment`; examples appear at `openapi.json:26962`, `:51845`, `:71071`, `:71335`. Six are
security-marked and create six parameterized 401 cases through
`getAuthenticatedOperations()` / `it.each` (`tests/contract/openapi-contract.test.ts:50-112`);
five are public GET operations and create five public-access cases through `it.each`
(`:115-142`). Thus **11 payment-related parameterized contract cases** are present. The absence
of payment failures means those 11 parameterized cases passed in this run; it does not establish
coverage of the other nine payment operations, because the contract test only parameterizes
authenticated operations and public GET operations.

## Not Done

本任务未编辑 source、config、generated artifact、`KNOWN-FAILURES.md` 或 implementation code。
this task. No Git command was run; this is why the 1496 provenance and 11-case historical delta
remain `UNVERIFIABLE_STATIC`. The C2 Windows-only plugin filesystem failure was not attributed to
this post-migration run because it did not recur.
