# Requirements — Repo Hardening 2026 H2（平台演进收尾加固）

> 背景：Platform Evolution 2026 H2（R1–R9）工程实质完成（tasks 165/165），但收尾状态存在四类风险：
> ① 大量未提交 WIP 悬在工作树上；② PR 级 CI 门禁缺失（specs 承诺的自动把关未落到 GitHub Actions）；
> ③ 测试债簿记与实际配置不一致（KNOWN-FAILURES.md vs vitest.config.ts）+ discount-e2e 未销号；
> ④ 分支泛滥（79 个本地分支）与仓库门面陈旧（2024-12 的评估报告仍在根目录）。
> 本 spec 目标：把"工程实质完成"变成"可审计、可持续的完成"。

## 硬约束（继承 Platform Evolution 2026 H2）

- **数据库零 drift 纪律**：任何任务执行前后如涉及数据库，运行 `pnpm --filter api db:check-drift`，检测到 drift 立即停止。
- **开源范围代码英文**：新增代码（含 CI workflow、脚本、日志、错误信息）不含中文字符。
- **不引入新迁移**：本 spec 全部任务不应产生任何 Prisma 迁移。
- **破坏性操作先留证据**：删除分支前必须先打归档 tag 或确认已合并；不允许直接 `git branch -D` 未验证的分支。

## R1 — WIP 落地（P0）

当前分支 `codex/runtime-single-source-truth-wip` 上有 49 个已修改文件（+1188/-247）+ 3 个未跟踪路径，混合了五类不相关改动。

- **R1.1** 工作树改动必须按逻辑域拆分为独立提交，每个提交可独立回归、可独立 revert。
- **R1.2** 每个提交合入前，其对应的测试子集必须绿（提交信息中注明验证命令与结果）。
- **R1.3** 全部提交完成后，分支通过 PR 合回 `main`，合并前全量回归（API 测试 + Shop/Admin E2E + theme-matrix + surface:check + drift check）全绿。
- **R1.4** 合并后工作树干净：`git status --porcelain` 输出为空。

## R2 — PR 级 CI 门禁（P0）

`.github/workflows` 目前只有 3 个构建/发布 workflow，无任何 `pull_request` 触发的质量门禁；且 `oss-agile-build-push.yml` 的 push 触发分支是过时的恢复分支 `codex/local-recovery-20260411`。

- **R2.1** 存在一个 `pull_request`（目标 `main`）触发的质量门禁 workflow，至少包含：install + type-check + lint + API 单测（含 Postgres/Redis service container）+ drift check + theme-matrix + theme SDK surface 契约检查。
- **R2.2** 门禁总时长可控（目标 < 15 分钟），允许按 job 并行拆分。
- **R2.3** `main` 分支开启 branch protection，必需检查项 = R2.1 的全部 job。
- **R2.4** `oss-agile-build-push.yml` 的触发条件被修正或显式确认（不允许指向已废弃分支而无注释说明）。
- **R2.5** 覆盖率阈值沿用 vitest.config.ts 中 `CI=true` 分支的既有配置（lines 60 / branches 50 / functions 60 / statements 60），不另立标准。

## R3 — 测试债清零与簿记对账（P1）

- **R3.1** `KNOWN-FAILURES.md` 与 `apps/api/vitest.config.ts` 的实际状态对账：文档声称"15 files excluded"，但当前 exclude 列表只有 node_modules/dist/e2e 三项。以实际跑测结果为准修正文档。
- **R3.2** `tests/routes/discount-e2e.test.ts` 的数据库状态泄漏被修复，全量套件下稳定通过（连续 3 次全量运行不翻车）。
- **R3.3** Platform Evolution tasks.md 中挂在 Task 10.2 的门禁条件（"excluded files 全部 resolved"）可以正式勾选或更新描述。
- **R3.4** KNOWN-FAILURES.md 收敛为"零已知失败"的终态文档或归档。

## R4 — 分支与仓库门面治理（P1/P2）

- **R4.1** 本地/远程 `codex/*` 分支清理：已合并的删除；未合并但已废弃的打 `archive/<branch-name>` tag 后删除；仍有价值的登记保留原因。目标：活跃分支 ≤ 10。
- **R4.2** 根目录 `PROJECT_EVALUATION_REPORT.md`（2024-12 数据）更新为当前状态或移入 `docs-internal/` 归档，避免误导新贡献者。
- **R4.3**（P2）根 `package.json` 收敛：`test:*`/`verify:*` 长尾脚本下沉到统一入口；核实根 `dependencies` 中 `stripe`、`fastify-plugin` 是否必要（stripe 实际用在 `apps/api`）；`pnpm.overrides` 钉版本的原因写注释或 ADR。

## Out of Scope（明确不做）

- 不动 Platform Evolution R1–R9 的任何业务实现。
- 不重构测试框架、不调整覆盖率阈值。
- 不处理闭源仓（jiffoo-extensions-official 等）的分支或 CI。
- 不引入新的部署目标或发布渠道。

## Release Gate（本 spec 完成判定）

1. `git status --porcelain` 为空，`codex/runtime-single-source-truth-wip` 已合入 `main` 并删除。
2. 对 `main` 发起任意 PR 会自动运行 R2.1 全部检查，且 branch protection 生效。
3. `cd apps/api && npx vitest run tests/` 全量 0 failed（含 discount-e2e），连续 3 次。
4. 本地 + 远程活跃分支 ≤ 10，归档 tag 清单落盘本 spec 目录 `branch-audit.md`。
5. 根目录无过时评估报告；README/CONTRIBUTING 中对 CI 门禁的描述与实际 workflow 一致。
