# AGENTRA-004 Pass C - Test Baseline Diagnosis

## Coverage

- A5: 327 个未计入用例的精确来源为 `UNDETERMINED`。当前缺少
  `apps/api/openapi.json`，而 `apps/api/tests/KNOWN-FAILURES.md:21` 仅陈述其
  会使“350+”契约用例静默跳过；该证据不能精确推出 327。
- C4: 16 个隔离运行均执行，但没有一个到达原先失败的断言。9 个路由/服务
  测试文件在全局数据库 setup 失败后使文件内测试跳过；7 个无数据库的文件在
  导入时因没有 `JWT_SECRET` 失败。要判定每个原始断言在“无额外变量”环境是否
  仍会失败，需有可认证的测试数据库和必需导入环境；本报告不作该推断。
- D3: 除 CI 工作流和 `db:mode:test` 脚本外，针对 `apps/api` 的文档化准备
  程序为 `UNDETERMINED`。搜索范围为 `README.md`、`apps/api/`、`docs/`、
  `.github/workflows/` 中名称含 readme/test/setup/environment/env 的文件，及
  `DATABASE_URL_TEST`、`export:openapi`、`vitest run tests`、`db:mode:test`。

## A. The Missing Cases

### A1. Full-suite runs and final counts

运行前已阅读 `apps/api/tests/KNOWN-FAILURES.md`。可比较的完整运行命令为：

```powershell
$env:DATABASE_URL_TEST='postgresql://postgres:postgres@localhost:5432/jiffoo_test?schema=public'
$env:DATABASE_URL=$env:DATABASE_URL_TEST
$env:JWT_SECRET='test-jwt-secret-for-api-suite'
$env:AUTH_REQUIRE_EMAIL_VERIFICATION='false'
pnpm --filter api test
```

该运行的完整 stdout 已捕获于
`C:\Users\11948\AppData\Local\Temp\tmpeygboi.tmp`。其开头为：

```text
> api@1.0.2 test C:\Personal Develop\jiffoo\worktrees\jiffoo-core-extension-boundary\apps\api
> vitest run

 RUN  v4.0.15 C:/Personal Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api
```

末尾原文为：

```text
 Test Files  11 failed | 84 passed (95)
      Tests  16 failed | 1151 passed | 2 skipped (1169)
   Start at  19:34:38
   Duration  111.20s (transform 3.57s, setup 3.29s, import 12.71s, tests 82.94s, environment 8ms)
```

本次也在不提供任何额外变量的情况下运行了：

```powershell
pnpm --filter api test
```

该运行在 `apps/api/tests/setup.ts:15` 的 fallback 数据库 URL 上得到
`PrismaClientInitializationError` / `P1000`，原文包括：

```text
Failed to connect to test database: PrismaClientInitializationError: Authentication failed against database server
```

因此该无变量运行不是上述 1169 结果的可比较计数来源。

### A2. Test-file collection

`apps/api/tests/KNOWN-FAILURES.md:4` 记录基线为 91 files。可比较完整运行实际报告
95 files（A1 末尾原文）。静态文件发现命令：

```powershell
rg --files apps/api/tests -g '*.test.ts' -g '*.test.tsx' -g '*.spec.ts' -g '*.spec.tsx'
```

得到 101 个候选；按 `apps/api/vitest.config.ts:14-28` 的 include/exclude，以下 6 个
在树中但不由该 Vitest 运行收集：

```text
apps/api/tests/performance/benchmarks.test.ts
apps/api/tests/e2e/shop/shop-api-integration.spec.ts
apps/api/tests/e2e/shop/shop-api-client-endpoints.spec.ts
apps/api/tests/e2e/admin/admin-ui-click-flows.spec.ts
apps/api/tests/e2e/admin/admin-api-integration.spec.ts
apps/api/tests/e2e/admin/admin-api-client-endpoints.spec.ts
```

101 - 6 = 95，与完整运行相符。`KNOWN-FAILURES.md:16` 明确说明 benchmark 是
非 Vitest 的 `node:test` 套件；`KNOWN-FAILURES.md:30` 说明 `tests/e2e/**` 是
Playwright 排除项。基线文档不列出那 91 个文件的清单，故 91 与 95 的四文件差异的
历史归属为 `UNDETERMINED`。

### A3. File-level collection/import errors

对 A1 的可比较运行，规则发现的 95 个文件全部进入了 Vitest 的最终文件统计；输出中
没有 `Failed Suites`，并且 11 个失败文件均有具名 `× tests/...` 断言失败记录。例如：

```text
× tests/routes/auth.test.ts > Auth Endpoints > POST /api/auth/register > should register a new user successfully
  → expected true to be false // Object.is equality
```

因此，针对该 95 文件、1151/16/2 的运行，文件级 collection/import error 为 0；主要
假设被排除：没有“文件无法加载导致其所有 case 不计数”的证据。

不同条件下，无额外变量的隔离运行确有 file-level 导入错误；例如：

```text
FAIL  tests/core/remoteradar-catalog.test.ts [ tests/core/remoteradar-catalog.test.ts ]
ZodError: [ ... path: [ "JWT_SECRET" ], message: "Required" ]
❯ src/config/env.ts:96:30
❯ src/config/database.ts:2:1
```

这是无变量环境的结果，不能用于解释 A1 可比较运行中的 327 差额。

### A4. First throwing import/statement

无变量的失败加载文件中，首个抛出的语句是
`apps/api/src/config/env.ts:96` 的 `envSchema.parse(process.env)`；错误为
`ZodError`，字段 `JWT_SECRET` 的值为 `undefined`。上面的隔离输出还给出导入者
`apps/api/src/config/database.ts:2:1`。`apps/api/src/config/env.ts:26` 将
`JWT_SECRET` 定义为必填字符串，`apps/api/src/config/env.ts:96` 执行 parse。

### A5. Arithmetic

基线总数为 1496（`KNOWN-FAILURES.md:4`）；A1 可比较运行报告 1169；差额为
1496 - 1169 = 327。该运行中：

| Component | Count explained |
|---|---:|
| Baseline-in-scope files not collected | 0 cases evidenced |
| Failed-to-load files in the comparable run | 0 cases |
| Exact explained total | 0 cases |
| Remaining | 327 cases, `UNDETERMINED` |

`apps/api/openapi.json` 当前不存在（`Test-Path 'apps/api/openapi.json'` 输出
`False`）。`apps/api/tests/helpers/openapi.ts:78-84` 在文件不存在时返回 `null`，
`apps/api/tests/helpers/openapi.ts:100-103` 因此返回空操作列表；
`apps/api/tests/contract/openapi-contract.test.ts:96-98` 以该列表生成参数化测试。
`KNOWN-FAILURES.md:21` 记录此状态会静默跳过“350+”契约用例。这是 327 差额的
文档化相关事实，但不是 327 的精确算术证明。

## B. AUTH_REQUIRE_EMAIL_VERIFICATION

### B1. Source reads

- `apps/api/src/config/env.ts:63`: Zod schema 读取该变量，默认 `'true'` 并将
  仅字符串 `'false'` 转换为 `false`。
- `apps/api/src/core/auth/service.ts:103`: `shouldRequireEmailVerification()`
  直接读取 `process.env.AUTH_REQUIRE_EMAIL_VERIFICATION`。

### B2. Test-related settings in the tree

- `apps/api/.env.example:30`: `AUTH_REQUIRE_EMAIL_VERIFICATION=true`。
- `apps/api/tests/routes/auth.test.ts:76-77`: 保存旧值并设为 `'false'`；
  `apps/api/tests/routes/auth.test.ts:123-127` 恢复旧值。
- `apps/api/tests/core/auth-service.test.ts:117` 保存初始值；
  `apps/api/tests/core/auth-service.test.ts:127-131` 恢复；
  `apps/api/tests/core/auth-service.test.ts:320` 和 `:384` 设为 `'false'`。

在 `apps/api/vitest.config.ts`、`apps/api/tests/setup.ts`、`apps/api/package.json`、
`.github/workflows/` 中未找到该变量的设置。`apps/api/tests/.env.test` 不存在；
`Get-ChildItem -Force apps/api -Filter '.env*'` 仅列出 `.env.example`。

### B3. Checked-in or external

就仓库树而言，测试的全局值未被 checked-in 测试配置设为 `false`。A1 命令中的
`AUTH_REQUIRE_EMAIL_VERIFICATION=false` 是命令运行时提供的外部环境变量；测试文件内
两处局部设置除外。

### B4. Behaviour-changing tests

- `apps/api/tests/routes/auth.test.ts:75-128`：`should allow register, login, and logout when email verification is disabled`。
- `apps/api/tests/core/auth-service.test.ts:319-361`：`should create a verified user and skip verification email when email verification is disabled`。
- `apps/api/tests/core/auth-service.test.ts:364-395`：guest conversion 测试在 `:384` 设置为 `'false'`。

## C. The 16 Failures

### C1. Failing tests

以下均为 A1 完整输出的原文（每项含断言/错误）：

- `tests/routes/auth.test.ts` — `should register a new user successfully` — `expected true to be false // Object.is equality`。
- `tests/routes/auth.test.ts` — `should return error for duplicate email` — `expected 400 to be 409 // Object.is equality`。
- `tests/routes/email-verification.test.ts` — `should resend verification email successfully` — `expected 400 to be 200 // Object.is equality`。
- `tests/routes/email-verification.test.ts` — `should generate a new token when resending` — `expected 400 to be 200 // Object.is equality`。
- `tests/routes/email-verification.test.ts` — `should complete full verification workflow` — `expected 400 to be 200 // Object.is equality`。
- `tests/routes/multi-store-dashboard.e2e.test.ts` — `Step 3: Verify consolidated stats show all stores` — `expected +0 to be 3 // Object.is equality`。
- `tests/routes/multi-store-dashboard.e2e.test.ts` — `Step 4: Verify individual store stats are correct` — `expected +0 to be 1 // Object.is equality`。
- `tests/routes/account.test.ts` — `should update email when currentPassword is valid` — `expected 500 to be 200 // Object.is equality`。
- `tests/routes/admin-staff.test.ts` — `should resend invitation and audit the action` — `expected 502 to be 200 // Object.is equality`。
- `tests/core/tianquan-catalog.test.ts` — `exposes the published Tianquan theme` — `(0 , __vite_ssr_import_1__.getOfficialCatalogEntry) is not a function`。
- `tests/core/tianquan-catalog.test.ts` — `exposes the published SMTP email plugin` — `(0 , __vite_ssr_import_1__.getOfficialCatalogEntry) is not a function`。
- `tests/core/auth-service.test.ts` — `should create user, send verification email, and return tokens` — `expected "vi.fn()" to be called with arguments: [ Array(1) ]`。
- `tests/core/auth-service.test.ts` — `does not issue an authenticated session when verification delivery fails` — `promise resolved "{ user: { …(7) }, …(5) }" instead of rejecting`。
- `tests/core/service-auth.test.ts` — `accepts only HS256 tokens signed with the service secret and issuer` — `secretOrPrivateKey must have a value`。
- `tests/core/tianquan-payment-catalog.test.ts` — `points YiPay and subscriptions at dependency-closed releases` — `(0 , __vite_ssr_import_1__.getOfficialCatalogEntry) is not a function`。
- `tests/core/remoteradar-catalog.test.ts` — `exposes the published free theme package to self-hosted instances` — `(0 , __vite_ssr_import_1__.getOfficialCatalogEntry) is not a function`。

### C2. Groups by module under test

| Group | Failing cases |
|---|---:|
| Auth HTTP endpoints | 2 |
| Email-verification HTTP endpoints | 3 |
| Multi-store dashboard HTTP endpoints | 2 |
| Account HTTP endpoints | 1 |
| Admin staff HTTP endpoints | 1 |
| Official catalog | 4 |
| Auth service | 2 |
| Service authentication | 1 |

### C3. Payment/order-management relation per group

| Group | Evidence and result |
|---|---|
| Auth HTTP, email-verification HTTP, multi-store dashboard HTTP, account HTTP, admin staff HTTP | Yes, application registration imports both modules. Each test imports `createTestApp` (for example `tests/routes/auth.test.ts:14`); `tests/helpers/create-test-app.ts:315` dynamically imports `src/routes` and `:362` calls `registerRoutes`. `src/routes/index.ts:16` imports payment routes, `:29` imports admin order routes, and `:85` registers admin order routes. This proves app construction imports both; none of the listed failed assertions names a payment or admin-order endpoint. |
| Official catalog | No direct payment or admin-order-management import/call in the three test files: `tests/core/tianquan-catalog.test.ts:2`, `tests/core/tianquan-payment-catalog.test.ts:2`, and `tests/core/remoteradar-catalog.test.ts:3` import only `@/core/admin/market/official-catalog`; their failures occur at that called export. |
| Auth service | No direct payment or admin-order-management import/call in the test; it tests `AuthService` and environment/mocks. Evidence: `tests/core/auth-service.test.ts:123` begins the `AuthService` suite, and its failed cases are recorded in C1. Transitive relation is `UNDETERMINED` from these direct imports alone. |
| Service authentication | No direct payment or admin-order-management import/call: `tests/core/service-auth.test.ts:3` imports only `@/core/auth/service-auth`; the assertion fails while calling `jwt.sign` at `:7`. |

### C4. Isolation with no extra variables

Each command used the form below from `apps/api`, with no environment-variable assignment:

```powershell
pnpm --filter api exec vitest run <file> -t '<test name>'
```

Results:

- Both `auth.test.ts` failures: exit 1; file result `33 skipped (33)`; setup error `PrismaClientInitializationError ... P1000`.
- All three `email-verification.test.ts` failures: exit 1; file result `14 skipped (14)`; same `P1000` setup error.
- Both `multi-store-dashboard.e2e.test.ts` failures: exit 1; file result `8 skipped (8)`; same `P1000` setup error.
- `account.test.ts` failure: exit 1; file result `15 skipped (15)`; same `P1000` setup error.
- `admin-staff.test.ts` failure: exit 1; file result `7 skipped (7)`; same `P1000` setup error.
- Both `auth-service.test.ts` failures: exit 1; file result `23 skipped (23)`; same `P1000` setup error.
- Both `tianquan-catalog.test.ts` failures, `service-auth.test.ts`, `tianquan-payment-catalog.test.ts`, and `remoteradar-catalog.test.ts`: exit 1; `Tests no tests`; import error `ZodError ... path: [ 'JWT_SECRET' ], message: 'Required'` at `src/config/env.ts:96`.

Thus none can be reported as still failing the original assertion in a clean/no-extra-variable environment; every isolated command failed before executing its selected test.

## D. Environment Reproducibility

### D1. Required setup

- Database: `apps/api/tests/helpers/db.ts:16-25` requires `DATABASE_URL_TEST` and
  verifies that the URL contains `test`; `:35-42` creates Prisma with it.
- Required config values: `apps/api/src/config/env.ts:14` requires `DATABASE_URL`;
  `:26` requires `JWT_SECRET`; `:96` parses them.
- Redis is optional in Vitest global setup: `apps/api/tests/setup.ts:45-46` returns
  when `REDIS_URL` is missing. When it exists, `:49-56` connects and deletes
  `warehouse:*` keys.
- Built workspace packages / plugin fixtures are CI prerequisites: `.github/workflows/pr-quality-gates.yml:90-97` builds four workspace packages and generates Prisma client; `:100-110` builds Stripe and i18n plugin fixtures.

### D2. Migrations, reset, and seed

`apps/api/tests/setup.ts:31-35` 仅调用 `setupTestDatabase()` 和缓存清理。
`apps/api/tests/helpers/db.ts:51-64` 将 setup 实现为 `$connect()`；其 `:59-60`
的迁移调用已被注释。全局 teardown 在 `apps/api/tests/setup.ts:63-67` 调用
`cleanupDatabase()`；该 helper 在 `apps/api/tests/helpers/db.ts:71-100` 删除列出的
表记录。`resetDatabase()` 存在于 `:171-190`，但全局 setup 未调用它。未发现全局
setup seed。

`apps/api/package.json:44` exposes `db:mode:test`; `apps/api/scripts/run-test-migrate.js:15-31`
validates a test URL and runs `prisma migrate deploy`. CI separately runs
`prisma migrate deploy` at `.github/workflows/pr-quality-gates.yml:96-99`.

### D3. 已文档化/脚本化的准备

脚本化的 CI 准备位于 `.github/workflows/pr-quality-gates.yml:74-115`：它定义
DB/Redis/JWT 变量（`:77-81`），安装依赖（`:89`），构建 packages（`:90-97`），
部署 migrations（`:98-99`），构建 plugins（`:100-110`），导出 OpenAPI（`:111-112`），
然后运行 Vitest（`:113-115`）。本地测试迁移脚本为 `apps/api/package.json:44` 和
`apps/api/scripts/run-test-migrate.js:15-31`。

### D4. Baseline conditions recorded by KNOWN-FAILURES

`apps/api/tests/KNOWN-FAILURES.md` 没有记录其 1496 基线的精确数据库 URL、JWT
值、Redis URL、已安装 package 状态或 migration 状态。它记录了以下条件：

```text
the spec-driven suites silently skipped when apps/api/openapi.json was absent.
Generate the spec before running (pnpm --filter api export:openapi; CI does this in the api-tests job) — 350+ contract tests actually run.
```

它还在 `KNOWN-FAILURES.md:20` 记录 Vitest 与 Playwright 共享 `jiffoo_test` 和
Redis database 15，且 setup 会清理 `warehouse:*` keys。
