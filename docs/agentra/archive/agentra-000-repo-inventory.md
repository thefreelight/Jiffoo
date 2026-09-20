# AGENTRA-000-B Repository Surface Inventory

本报告是 Part 1 的只读盘点，写入后才进行 Part 2 的未跟踪文件分类。文件内容证据均按当前树行号列出；目录/时间/跟踪状态来自本次 `Get-ChildItem`、`git ls-files` 与 `git status --short` 输出。

## 1.1 REPOSITORY ROOT

根目录直接条目（`name | type | immediate child count | tracking`；文件的 child count 为 `-`）：

```text
.buildkite | dir | 1 | tracked
.changeset | dir | 4 | tracked
.cursorignore | file | - | tracked
.dockerignore | file | - | tracked
.env.example | file | - | tracked
.env.production.example | file | - | modified
.git | file | - | Git metadata
.github | dir | 2 | tracked
.gitignore | file | - | tracked
.gitlab | dir | 4 | tracked
.gitlab-ci.yml | file | - | tracked
.husky | dir | 2 | tracked
.kiro | dir | 1 | tracked
.npmrc | file | - | tracked
.opensourceexclude | file | - | tracked
.release | dir | 8 | tracked
内部插件系统开发指南.md | file | - | tracked
agent_plugin.md | file | - | tracked
AGENTS.md | file | - | tracked
API_DESCRIPTION.md | file | - | tracked
apps | dir | 4 | mixed
artifacts | dir | 4 | tracked
CHANGELOG.md | file | - | tracked
config | dir | 3 | tracked
CONTRIBUTING.md | file | - | tracked
deploy | dir | 7 | tracked
deploy.sh | file | - | tracked
docker-compose.prod.yml | file | - | modified
docker-compose.yml | file | - | tracked
docs | dir | 25 | mixed
docs-internal | dir | 1 | tracked
e2e | dir | 8 | tracked
eslint.config.mjs | file | - | tracked
examples | dir | 1 | tracked
extensions | dir | 3 | tracked
EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md | file | - | tracked
install.sh | file | - | modified
LICENSE | file | - | tracked
LICENSE-EXCEPTIONS.md | file | - | tracked
nginx | dir | 1 | tracked
node_modules | dir | 1111 | neither tracked nor untracked
package.json | file | - | modified
packages | dir | 8 | mixed
performance | dir | 6 | tracked
playwright.config.ts | file | - | tracked
PLUGIN_SYSTEM_ARCHITECTURE.md | file | - | tracked
plugins | dir | 1 | tracked
pnpm-lock.yaml | file | - | tracked
pnpm-workspace.yaml | file | - | tracked
README.md | file | - | tracked
rules.md | file | - | tracked
scripts | dir | 36 | tracked
spec-kit-workspace | dir | 3 | tracked
status-jiffoo.sh | file | - | tracked
stop-jiffoo.sh | file | - | tracked
tasks | dir | 3 | untracked
tests | dir | 2 | tracked
tsconfig.json | file | - | tracked
turbo.json | file | - | tracked
```

目录分类由 `git ls-files` 与 `git ls-files --others --exclude-standard` 按根目录前缀统计；`apps` 为 1055 tracked / 6 untracked，`docs` 为 35 / 7，`packages` 为 940 / 1，`tasks` 为 0 / 3。状态为 modified/deleted 的文件不是本报告中“tracked/untracked directory”分类的一部分。

## 1.2 WORKSPACE TOPOLOGY

Workspace 定义逐字为：

```text
packages:
  - 'apps/cloudflare-native-core-api'
  - 'apps/api'
  - 'apps/admin'
  - 'apps/shop'
  - 'packages/*'
  - 'packages/shop-themes/*'
```

见 [pnpm-workspace.yaml:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/pnpm-workspace.yaml:1)–[7](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/pnpm-workspace.yaml:7)。根 `package.json` 的 `workspaces` 重复声明其中除 Cloudflare app 之外的路径，见 [package.json:11](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/package.json:11)–[16](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/package.json:16)；pnpm 文件是含 Cloudflare app 的完整定义。

解析到的包（`directory | package name | build script | category`）：

```text
apps/admin | admin | yes | app
apps/api | api | yes | app
apps/cloudflare-native-core-api | @jiffoo/cloudflare-native-core-api | no | app
apps/shop | shop | yes | app
packages/core-api-sdk | @jiffoo/core-api-sdk | yes | package
packages/create-jiffoo-app | create-jiffoo-app | yes | package
packages/mcp-server | @jiffoo/mcp-server | yes | package
packages/plugin-sdk | @jiffoo/plugin-sdk | yes | package
packages/shared | shared | yes | package
packages/theme-api-sdk | @jiffoo/theme-api-sdk | yes | package
packages/ui | @jiffoo/ui | yes | package
packages/shop-themes/ai-gateway | @shop-themes/ai-gateway | no | theme
packages/shop-themes/app-landingpage | @shop-themes/app-landingpage | yes | theme
packages/shop-themes/bokmoo | @shop-themes/bokmoo | no | theme
packages/shop-themes/default | @shop-themes/default | no | theme
packages/shop-themes/digital-vault | @shop-themes/digital-vault | no | theme
packages/shop-themes/esim-mall | @shop-themes/esim-mall | yes | theme
packages/shop-themes/fire | @shop-themes/fire | no | theme
packages/shop-themes/imagic-studio | @shop-themes/imagic-studio | no | theme
packages/shop-themes/modelsfind | @shop-themes/modelsfind | no | theme
packages/shop-themes/navtoai | @shop-themes/navtoai | no | theme
packages/shop-themes/quiet-curator | @jiffoo/official-theme-quiet-curator | no | theme
packages/shop-themes/serene | @shop-themes/serene | no | theme
packages/shop-themes/stellar-midnight | @shop-themes/stellar-midnight | no | theme
packages/shop-themes/yevbi | @shop-themes/yevbi | yes | theme
```

每个 name 与 build-script 判定来自各目录的 `package.json` 的 `name` 与 `scripts.build` 字段；例如 API 的 name/build 见 [apps/api/package.json:2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/package.json:2) 与 [apps/api/package.json:14](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/package.json:14)，plugin SDK 的 name/build 见 [packages/plugin-sdk/package.json:2](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/packages/plugin-sdk/package.json:2) 与 [packages/plugin-sdk/package.json:7](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/packages/plugin-sdk/package.json:7)。没有由 workspace glob 解析出的 `plugins/` package；`plugins/` 是根目录存在的 tracked directory，而非该 workspace 定义的一部分。

## 1.3 DOCUMENTATION SURFACE

`docs/` 和根目录的全部 Markdown 文件（`path | lines | first heading verbatim | last modified`）：

```text
docs/admin-rbac-design.md | 454 | # Admin RBAC Design for OSS | 2026-09-20 15:25:56 +08:00
docs/adr/ADR-0001-self-hosted-updater-version-commit-last.md | 30 | # ADR-0001: Self-Hosted Updater Commits Version Last | 2026-09-20 15:25:48 +08:00
docs/adr/ADR-0002-official-storefront-runtime-single-source.md | 63 | # ADR-0002: Official Storefront Runtime Must Resolve From One Source Of Truth | 2026-09-20 15:25:48 +08:00
docs/agentic-commerce.md | 241 | # Agentic Commerce — MCP Server Guide | 2026-09-20 15:25:48 +08:00
docs/agentra-000-ground-facts.md | 116 | # AGENTRA-000 Shared Ground-Truth Baseline | 2026-09-20 22:03:46 +08:00
docs/agentra-001-core-v1-product-charter.md | 416 | # AGENTRA-001: Jiffoo Core V1 Product Charter | 2026-09-20 18:52:13 +08:00
docs/AGENTRA-002-recon-a.md | 209 | # AGENTRA-002 Pass 0A -- Stack & Delivery Recon | 2026-09-20 18:58:44 +08:00
docs/AGENTRA-002-recon-b.md | 222 | # AGENTRA-002 Pass 0B -- Plugin Subsystem Recon | 2026-09-20 18:58:44 +08:00
docs/AGENTRA-002-recon-c.md | 237 | # AGENTRA-002 Pass 0C -- Theme Subsystem Recon | 2026-09-20 18:58:44 +08:00
docs/AGENTRA-003-conformance.md | 537 | # AGENTRA-003: Charter Conformance Diff | 2026-09-20 18:58:44 +08:00
docs/AGENTRA-004-recon.md | 168 | # AGENTRA-004: Payment Path Recon | 2026-09-20 18:58:44 +08:00
docs/API_CORE_ENDPOINTS.md | 176 | # API Core Endpoint Overview | 2026-09-20 15:25:48 +08:00
docs/cloudflare-pages-dual-deploy.md | 357 | # Jiffoo 双部署兼容方案：Cloudflare Pages + 自托管服务器 | 2026-09-20 15:25:48 +08:00
docs/cloudflare-pages.md | 102 | # Deploy to Cloudflare | 2026-09-20 15:25:48 +08:00
docs/digital-commerce.md | 125 | # Digital Commerce — Virtual Goods Fulfillment in Jiffoo | 2026-09-20 15:25:48 +08:00
docs/jiffoo-positioning-statement.md | 115 | # Jiffoo Positioning Statement | 2026-09-20 15:25:48 +08:00
docs/operations/admin-staff-rbac-release-checklist.md | 89 | # Admin Staff RBAC Release Checklist | 2026-09-20 15:25:56 +08:00
docs/operations/admin-staff-rbac-release-runbook.md | 113 | # Admin Staff RBAC Release Runbook | 2026-09-20 15:25:48 +08:00
docs/operations/backup-and-recovery.md | 389 | # Jiffoo Mall - 备份与恢复系统 | 2026-09-20 15:25:48 +08:00
docs/operations/bokmoo-app-api-production-runbook.md | 241 | # BOKMOO App API Production Runbook | 2026-09-20 15:25:48 +08:00
docs/operations/disaster-recovery-drill.md | 314 | # 数据库恢复演练记录 | 2026-09-20 15:25:48 +08:00
docs/operations/official-storefront-runtime-source-of-truth-prd-executable.md | 57 | # Official Storefront Runtime Source-of-Truth PRD Executable | 2026-09-20 15:25:48 +08:00
docs/operations/official-storefront-runtime-source-of-truth-prd.md | 72 | # Official Storefront Runtime Source-of-Truth PRD | 2026-09-20 15:25:48 +08:00
docs/operations/official-storefront-runtime-source-of-truth-spec.md | 113 | # Official Storefront Runtime Source-of-Truth Spec | 2026-09-20 15:25:48 +08:00
docs/operations/oss-release-publication-checklist.md | 44 | # OSS Release Publication Checklist | 2026-09-20 15:25:48 +08:00
docs/operations/oss-release-publication-repair-runbook.md | 137 | # OSS Release Publication Repair Runbook | 2026-09-20 15:25:48 +08:00
docs/operations/production-observability.md | 130 | # Production Observability | 2026-09-20 15:25:48 +08:00
docs/operations/self-hosted-updater-prd-executable.md | 42 | # Self-Hosted Updater PRD Executable | 2026-09-20 15:25:48 +08:00
docs/operations/self-hosted-updater-prd.md | 53 | # Self-Hosted Updater PRD | 2026-09-20 15:25:48 +08:00
docs/operations/self-hosted-updater-runbook.md | 39 | # Self-Hosted Core Update Runbook | 2026-09-20 15:25:48 +08:00
docs/operations/self-hosted-updater-spec.md | 53 | # Self-Hosted Updater Spec | 2026-09-20 15:25:48 +08:00
docs/theme-client-compatibility-matrix.md | 68 | # Theme Client Compatibility Matrix | 2026-09-20 15:25:48 +08:00
docs/theme-client-first-wave-rollout.md | 178 | # Theme Client First-Wave Rollout | 2026-09-20 15:25:48 +08:00
docs/theme-client-official-theme-support.md | 108 | # Official Theme Support Inventory | 2026-09-20 15:25:48 +08:00
docs/theme-client-platform-contract.md | 434 | # Cross-Platform Theme Client Contract | 2026-09-20 15:25:48 +08:00
内部插件系统开发指南.md | 547 | # 内部插件系统开发指南 | 2026-09-20 15:25:49 +08:00
agent_plugin.md | 345 | # Agent 插件业务需求与业务逻辑说明 | 2026-09-20 15:25:48 +08:00
AGENTS.md | 4 | # Global Rules | 2026-09-20 15:25:48 +08:00
API_DESCRIPTION.md | 311 | # Jiffoo Mall Backend API Reference | 2026-09-20 15:25:48 +08:00
CHANGELOG.md | 44 | # Changelog | 2026-09-20 15:25:48 +08:00
CONTRIBUTING.md | 278 | # Contributing to Jiffoo Mall | 2026-09-20 15:25:48 +08:00
EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md | 517 | # 外部插件开发指南 | 2026-09-20 15:25:48 +08:00
LICENSE-EXCEPTIONS.md | 88 | # License Exceptions & Boundary Statement | 2026-09-20 15:25:48 +08:00
PLUGIN_SYSTEM_ARCHITECTURE.md | 424 | # 插件系统技术架构设计 | 2026-09-20 15:25:48 +08:00
README.md | 211 | # Jiffoo - Open Source E-Commerce Platform | 2026-09-20 15:25:48 +08:00
rules.md | 40 | # Jiffoo OSS Repository Rules | 2026-09-20 15:25:49 +08:00
```

上述每个 first heading 都位于对应文件 `:1`；line count 与 last-modified 为文件系统元数据。标题显示为 Charter、Design、ADR、Spec、PRD 或 `...Decision...` 的文件是应特别标识的 charter/specification/design/decision surfaces：`docs/agentra-001-core-v1-product-charter.md`、`docs/admin-rbac-design.md`、两个 `docs/adr/ADR-*.md`、`docs/operations/*-spec.md`、`docs/operations/*-prd*.md`、根 `PLUGIN_SYSTEM_ARCHITECTURE.md` 和根 `LICENSE-EXCEPTIONS.md`。

README 有 Documentation 索引，而非完整 docs/ 目录 TOC；其链接列表位于 [README.md:186](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/README.md:186)–[202](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/README.md:202)。搜索为 case-insensitive `rg -n -i 'agentra-|docs/|documentation|table of contents|^#.*index|^##.*index' README.md docs .github .kiro`，未找到一个列出本节全部 Markdown 文件的完整索引。

## 1.4 STALE / COMPETING DOCUMENT SURFACES

- `.kiro/` EXISTS，目录下有 24 个文件（`Get-ChildItem -Recurse -File .kiro`）；其直接文档入口包括 [.kiro/specs/PRD.md:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.kiro/specs/PRD.md:1) 与 [.kiro/specs/PRD_EXECUTABLE.md:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.kiro/specs/PRD_EXECUTABLE.md:1)。
- 名为 `specs`、`adr`、`rfc`、`decisions` 或 `design` 的目录：`.kiro/specs` EXISTS、`docs/adr` EXISTS、`docs/design` EXISTS；未发现名为 `rfc` 或 `decisions` 的目录。搜索为 case-sensitive PowerShell recursive directory-name regex `^(specs|adr|rfc|decisions|design)$`，路径为整个 worktree，排除 `.git`、`node_modules`。
- `apps/api/tests/KNOWN-FAILURES.md` EXISTS，30 行，首标题为 `# API Test Baseline / Known Failures`：[apps/api/tests/KNOWN-FAILURES.md:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/tests/KNOWN-FAILURES.md:1)。
- docs/ 之外，匹配名称 regex `(?i)(charter|conformance|recon)` 的文件为 `apps/api/src/core/payment/reconciliation.ts`（324 行）及 `apps/api/src/jobs/payment-reconciliation.ts`（83 行）；它们是源码 filename substring matches，不是 Markdown 文档。[reconciliation.ts:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/core/payment/reconciliation.ts:1)、[payment-reconciliation.ts:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/src/jobs/payment-reconciliation.ts:1)。搜索路径为全 worktree，case-insensitive，排除 `.git`、`node_modules`。

## 1.5 WHAT AN AGENT SEES BY DEFAULT

唯一命中的 agent-instruction file 是 `AGENTS.md`，4 行，首标题 `# Global Rules`：[AGENTS.md:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/AGENTS.md:1)。其完整内容为：

```text
# Global Rules

- Stop immediately if any database drift is detected.
- 每次回复前先叫我宝贝。
```

搜索为全 worktree 的 PowerShell recursive exact-name scan，名字为 `AGENTS.md`、`CLAUDE.md`、`.cursorrules`、`copilot-instructions.md`，排除 `.git` 与 `node_modules`；未发现其他同类文件。根 `.codex/` 不存在（根目录盘点），故无 repo-local Codex instructions。

会使目录列举隐藏项目文件的 `.gitignore` 规则包括 dependencies [`.gitignore:2`](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:2)–[4](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:4)、build outputs [`.gitignore:13`](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:13)–[19](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:19)、env files [`.gitignore:29`](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:29)–[39](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:39)、logs/runtime data [`.gitignore:52`](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:52)–[68](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:68)、extension runtime [`.gitignore:70`](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:70)–[92](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:92)、test/IDE/OS products [`.gitignore:94`](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:94)–[126](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:126)，以及 `apps/api/openapi.json` [`.gitignore:150`](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/.gitignore:150)。API-local ignore 还隐藏 `node_modules`、`dist`、`.env`、`.env.test`、`coverage`、logs 和 `data/`：[apps/api/.gitignore:1](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/.gitignore:1)–[8](C:/Personal%20Develop/jiffoo/worktrees/jiffoo-core-extension-boundary/apps/api/.gitignore:8)。

## 2.1 UNTRACKED CLASSIFICATION (before staging)

本表来自本次 `git ls-files --others --exclude-standard` 的完整输出：

```text
apps/api/prisma/migrations/20260920000000_plugin_registry_version/migration.sql | DELIVERABLE | Prisma migration
apps/api/src/core/admin/extension-installer/plugin-registry-version.ts | DELIVERABLE | source module
apps/api/src/core/payment/manual-payment.ts | DELIVERABLE | payment source module
apps/api/src/core/storage/plugin-package-store.ts | DELIVERABLE | source module
apps/api/src/core/storage/uploaded-file-store.ts | DELIVERABLE | source module
apps/shop/app/[locale]/payment/manual/page.tsx | DELIVERABLE | Shop page source
docs/AGENTRA-002-recon-a.md | DELIVERABLE | recon report
docs/AGENTRA-002-recon-b.md | DELIVERABLE | recon report
docs/AGENTRA-002-recon-c.md | DELIVERABLE | recon report
docs/AGENTRA-003-conformance.md | DELIVERABLE | conformance report
docs/AGENTRA-004-recon.md | DELIVERABLE | payment recon report
docs/agentra-000-ground-facts.md | DELIVERABLE | shared ground-truth report
docs/agentra-000-repo-inventory.md | DELIVERABLE | this inventory report
docs/agentra-001-core-v1-product-charter.md | DELIVERABLE | V1 product charter
packages/plugin-sdk/src/__tests__/init-scaffold.test.ts | DELIVERABLE | SDK test source
tasks/AGENTRA-004-C3-baseline-attribution.md | DELIVERABLE | task report
tasks/AGENTRA-004-R0-ground-truth.md | DELIVERABLE | task report
tasks/AGENTRA-004-test-diagnosis.md | DELIVERABLE | task report
```

ARTIFACT entries：none。分类方法：migration/source/test/document/task-report 均为项目交付物；本次精确未跟踪列表中没有 `dist/`、`.next/`、coverage、cache、log、OpenAPI output、editor 或 OS-noise 路径。
