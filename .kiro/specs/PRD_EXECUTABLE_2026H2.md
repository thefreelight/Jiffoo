# Jiffoo 可执行 PRD — 平台演进阶段（2026 H2）

> 配套战略概览：[`.kiro/specs/PRD.md`](./PRD.md)
> 前一阶段执行 PRD：[`.kiro/specs/PRD_EXECUTABLE.md`](./PRD_EXECUTABLE.md)（Alpha，已交付）
> 详细需求/设计/任务：[`.kiro/specs/platform-evolution-2026h2/`](./platform-evolution-2026h2/requirements.md)
> 本文档回答：**这一阶段到底做什么、做到什么算完成、怎么验收**。

---

## 0. 文档信息

- **状态**：✅ 工程实质完成，发布门禁已达标（10.2 全量回归 E2E 全绿；2026-07-13 更新：discount-e2e 遗留已随 repo-hardening §3.2 清零——根因为跨套件默认仓争抢 + Redis 缓存，API 全量 1494 passed / 0 failed）
- **适用阶段**：Platform Evolution v1.1.x ~ v1.3.x（2026 H2）
- **适用范围**：开源核心（`apps/api` + `apps/shop` + `apps/admin` + 开源 `packages/*`）；闭源联动项（Marketplace 上架约束、Entitlement Service）只定义挂载点与口径，不在本 PRD 验收
- **阶段主题**：生态合规边界 → 工程健康 → 差异化能力（数字商品 + Agentic Commerce）
- **验收方式**：每需求域 Release Gate 条目 + 全量回归（API 测试 + E2E + theme-matrix + drift 检查）

### 里程碑计划

| 里程碑 | 日期 | 交付物 | 阻塞判定 |
|--------|------|--------|----------|
| M1: 生态边界闭环 | 2026-08-31 | 许可证边界声明合入 + SDK MIT 化 + 插件运行时两级信任模型上线 | 法务复核未过 → M1 顺延，不降级合入 |
| M2: 工程健康闭环 | 2026-10-31 | Schema 拆分零 drift + 统一任务层收编完成 + OTel/告警基线可用 | drift 非空 → 立即停止 |
| M3: 契约与差异化 | 2026-12-05 | 主题矩阵 CI 上线 + 垂直模板发布 + MCP server v0.1 发布 | — |
| M4: 阶段发布 | 2026-12-20 | 版本发布 + 文档 + 路线图回写 | 全量回归任一红 → 不发布 |

---

## 1. 阶段边界（先对齐，避免脑补）

继承 Alpha PRD 全部 Hard Requirement，重申与本阶段直接相关的：

- **开源核心单租户语义不变**：本阶段所有工作不引入 `tenantId`/多租户表征；多租户/多店诉求一律记入闭源侧 backlog。
- **开源核心不实现平台商业逻辑**：R9 托管漏斗只做"运行时状态下发 + 展示"挂载点；Entitlement、订阅、结算全部在闭源 Platform API。
- **官方扩展双仓口径不变**：`esim-mall`、`digital-vault` 等官方主题源码在 `jiffoo-extensions-official`；本仓垂直模板只引用发布产物（7.2.2）。
- **开源范围代码英文**：新增代码（含日志、错误信息）不含中文字符。
- **数据库零 drift 纪律**：schema 拆分（R3）承诺零迁移 diff；任何任务检测到 drift 立即停止。

### In Scope

- R1 许可证边界 + SDK MIT 化（P0）
- R2 插件运行时两级信任模型：官方白名单 internal + 第三方 external-http，网关超时/熔断/限流（P0）
- R5 OTel + Prometheus + 默认告警规则 + observability compose profile（P0）
- R3 Prisma schema 按域拆分 + dormant 模型冻结 + CI drift 门禁（P1）
- R4 BullMQ 统一任务层消费 OutboxEvent，收编 webhook/邮件/库存预警/履约（P1）
- R6 主题 SDK surface 契约 + theme.json engines 校验 + CI 主题矩阵（P1）
- R7 数字商品垂直发行版（模板 + 文档 + 履约断点补齐）（P2）
- R8 `@jiffoo/mcp-server` v0.1（P2）
- R9 托管漏斗挂载点（platformOffers + CF 引导页）（P2）

### Out of Scope（明确不做）

- Marketplace 交易闭环（上架/购买/审核/分账）——闭源侧 official-extensions-go-live 及后续 spec 跟踪
- 多租户/多店、白标、分销网络
- AI 建站 / AI 生成主题（后续 spec）
- Wasm/isolate 插件运行时（只留技术评估备忘）
- 一键升级执行器（维持 Alpha 口径：只展示版本状态）
- 移动端/桌面端（multi-surface spec + 私有仓跟踪）

---

## 2. 阶段"闭环"定义（验收口径）

### 2.1 生态闭环（第三方开发者视角）

一个外部开发者能在不咨询法务的情况下，读 `LICENSE-EXCEPTIONS.md` + `EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md` 后回答"我能不能做闭源付费插件、怎么做"（答案：能，external-http + MIT SDK），并且技术上无法把第三方插件装进 Core API 进程。

### 2.2 工程健康闭环（维护者/运维视角）

- 任何核心 PR：drift 门禁 + 主题矩阵 + surface 契约测试自动把关；
- 生产实例：一条 compose 命令获得 trace/指标/告警；出事时能沿 trace id 从前端错误定位到慢查询；
- 所有异步副作用（webhook/邮件/履约）走同一条可观测、可重试、有死信的队列。

### 2.3 差异化闭环（市场视角）

- `pnpm create jiffoo-app --template esim` 五分钟得到可跑的 eSIM 商店；
- Claude Desktop 配置 `@jiffoo/mcp-server` 后能搜索商品并创建 checkout 链接；
- README/docs 讲清 Digital Commerce + Agentic Commerce 两个差异化卖点。

---

## 3. 需求清单（可执行/可验收）

> 完整验收条款见 [platform-evolution-2026h2/requirements.md](./platform-evolution-2026h2/requirements.md)，此处为执行摘要与验收命令。

### EVO-P0-R01：许可证与插件生态合规边界

- **做什么**：LICENSE-EXCEPTIONS.md（法务复核后合入）；4 个 SDK 包 MIT 化；开发者文档合规路径章节；混淆分发 deprecate + ADR。
- **验收**：文件存在且 README 链接；`packages/{plugin-sdk,theme-sdk,theme-api-sdk,core-api-sdk}/package.json` license=MIT + LICENSE 文件；changeset 发布记录。
- **风险闸门**：法务复核是显式检查点（任务 1.2.2），未过不合入。

### EVO-P0-R02：插件运行时安全收敛

- **做什么**：Ed25519 验签 + internal-fastify 白名单（存量 grace 模式）；网关超时/响应上限/熔断/限流；结构化审计日志。
- **验收**：集成测试覆盖——第三方 internal 包拒装、官方签名包可装、慢插件超时、熔断状态机、错误结构断言；`PLUGIN_SYSTEM_ARCHITECTURE.md` 更新。
- **不破坏**：存量已安装插件本版本只 warn 不禁用。

### EVO-P0-R05：生产可观测性

- **做什么**：OTel SDK（trace + 业务指标，未配 endpoint 零开销）；`/metrics`；默认告警规则集；`deploy/observability/` compose profile + Grafana dashboards；慢查询 warn；运维手册。
- **验收**：compose 启动后打流量 dashboard 有数；告警规则可触发演练记录；trace 含 fastify + prisma span。

### EVO-P1-R03：数据模型治理

- **做什么**：模型使用审计报告 → schema 按域拆分（prismaSchemaFolder）→ dormant 冻结 → CI drift 门禁。
- **验收（硬性）**：`prisma migrate diff --from-migrations --to-schema-datamodel` 为空；全量测试绿；`model-audit.md` 落盘。

### EVO-P1-R04：统一异步任务层

- **做什么**：BullMQ + OutboxPoller（SKIP LOCKED）；webhook/邮件/stock-alert/履约四类处理器收编；指数退避 + DLQ + 幂等；Redis 宕机降级内联；三种 WORKER_MODE。
- **验收**：每处理器迁移单独 PR + 对应 E2E 绿；Redis 宕机模拟测试通过；队列指标可见。

### EVO-P1-R06：主题 SDK 版本契约

- **做什么**：surface snapshot 契约测试；theme.json `engines` 校验（缺失=兼容+warn）；CI theme-matrix（10 主题 build + SSR 冒烟）。
- **验收**：故意改 SDK 导出面无 changeset → CI 红；不兼容主题激活 → 409；theme-matrix 进 required checks。

### EVO-P2-R07：数字商品垂直发行版

- **做什么**：虚拟商品履约端到端审计 + 断点补齐 + E2E；create-jiffoo-app `--template digital-goods|esim`；Digital Commerce 定位文档；B2B×数字商品提案（只盘点）。
- **验收**：模板生成 → dev 启动 → 首页 200 的 smoke test；数字商品购买-履约 E2E 绿。

### EVO-P2-R08：MCP Server v0.1

- **做什么**：scoped API token（前置，先审计现有 auth）；`@jiffoo/mcp-server`（stdio + HTTP）；6 工具（search/get/categories/cart×2/checkout）；agent 接入文档。
- **验收**：MCP client SDK 对 seed 数据逐工具集成测试绿；checkout 返回 hosted payment URL 且不触碰支付凭证；Claude Desktop 配置示例实测可用。

### EVO-P2-R09：托管漏斗挂载点

- **做什么**：platformOffers 运行时状态（默认空、可禁用）；Admin offers 卡片；shop 无 API 配置引导页；CF 部署流程走查修复。
- **验收**：`JIFFOO_DISABLE_PLATFORM_OFFERS=true` 时零商业曝光（测试断言）；CF 按钮全流程走查记录。

---

## 4. 阶段发布准入（Release Gate）

### 4.1 生态 Gate

- [x] LICENSE-EXCEPTIONS.md 经复核合入，README 引用
- [x] 4 个 SDK 包 license=MIT 且已发布
- [x] 第三方 internal-fastify 插件安装被拒（测试证明）
- [x] 网关超时/熔断/限流默认值生效（测试证明）

### 4.2 工程 Gate

- [x] drift 检查 CI 步骤存在且为空
- [x] schema 拆分后全量测试 + E2E 绿
- [x] webhook/邮件/履约全部走统一队列（旧路径删除或 feature-flag off）
- [x] observability profile 一键启动验证记录
- [x] theme-matrix 在 required checks 且 10 主题全绿

### 4.3 差异化 Gate

- [x] 两个垂直模板 smoke test 进 CI
- [x] `@jiffoo/mcp-server` npm 发布 + 文档
- [x] README 含 Digital Commerce 与 Agentic Commerce 条目

### 4.4 明确不做 Gate（防范围膨胀）

- [x] 无 tenantId/多租户表征进入开源核心（grep 断言）
- [x] 无平台商业逻辑进入开源核心（platformOffers 仅展示状态）
- [x] 开源新增代码无中文字符（现有 lint 规则覆盖）

---

## 5. 风险与决策记录

| 风险 | 等级 | 缓解 |
|------|------|------|
| 法务复核延期阻塞 M1 | 高 | 1.2.2 设为显式检查点；R2 技术工作不依赖复核结果可并行 |
| schema 拆分引发 drift | 高 | 纯文件重组 + 拆分前后 diff 断言 + 单独 PR 便于回滚 |
| 任务层收编破坏现有异步行为 | 中 | 每处理器单独 PR/单独回归；embedded 默认模式保持单进程部署不变 |
| 存量第三方 internal 插件用户被 breaking | 中 | grace 模式一个 minor 周期 + Admin 提示 + 迁移文档 |
| MCP token 前置工作量超预期 | 中 | 8.1.1 先审计再决策；若需完整 token 系统则 MCP 降级到只读工具发布 v0.1 |
| 官方主题 engines 字段跨仓联动延期 | 低 | 缺失视为兼容（6.2.2），不阻塞本仓发布 |

## 6. 待确认问题

1. SDK MIT 化的包范围是否包含 `packages/ui`、`packages/i18n`？（当前决策：不含，主题/插件开发不强依赖；如社区反馈需要再扩）
2. `installer` 与 `create-jiffoo-app` 是否合并？（本阶段不动，记 backlog）
3. MCP server 是否同步提供 OpenAI-compatible tools 清单？（本阶段不做，观察 MCP 生态渗透率）
