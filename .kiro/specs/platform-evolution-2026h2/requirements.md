# Requirements Document — Platform Evolution 2026 H2

> **文档定位**：本 spec 承接 2026-07 项目评估结论（商业模式 + 技术架构升级空间），定义 GA 后（v1.0.3+）平台演进阶段的需求。
> 配套设计文档：[design.md](./design.md)；任务清单：[tasks.md](./tasks.md)；执行 PRD：[`.kiro/specs/PRD_EXECUTABLE_2026H2.md`](../PRD_EXECUTABLE_2026H2.md)。

## Introduction

Jiffoo 已完成 Alpha → GA 的工程化闭环（v1.0.3-opensource），当前阶段的核心矛盾是：

1. **商业模式层**：GPL-2.0 核心 + Marketplace 抽成模式存在许可证传染性冲突，第三方闭源付费插件缺乏法律安全的运行边界；
2. **技术架构层**：插件运行时（internal-fastify 同进程执行）的安全模型与商业生态目标不匹配；数据模型存在"超前建设"负担；异步任务与可观测性尚未生产化；
3. **差异化层**：数字/虚拟商品垂直能力（eSIM、数字资产）与 AI/Agentic Commerce 是竞品（Medusa/Saleor/Vendure）空白区，需要显性化为产品卖点。

本 spec 定义九个需求域（R1–R9），按 P0/P1/P2 分级，覆盖 2026 H2。

**边界约束（继承自 PRD_EXECUTABLE.md，Hard Requirement）**：

- 开源核心保持单租户语义：不引入 `tenantId`/`tenants` 表/`X-Tenant-Id` 等多租户工程表征；
- 开源核心不实现平台商业化逻辑（许可证管理/订阅/分销），只保留可被校验的挂载点；
- 开源范围代码（`src/**`）保持英文，不含中文字符；
- 官方主题/插件 canonical source 在 `jiffoo-extensions-official`，本仓只承载 runtime、fallback 主题与安装器。

---

## Requirements

### Requirement 1 (P0): 许可证与插件生态合规边界

**User Story:** As a third-party plugin developer, I want a legally safe boundary for building closed-source paid plugins, so that I can invest in the Jiffoo marketplace without GPL contamination risk.

#### Acceptance Criteria

1. 项目 SHALL 发布正式的许可证边界声明文档（License Boundary Statement），明确以下三层的许可证语义：
   - 开源核心（GPL-2.0-or-later）；
   - 通过 `external-http` 网关通信的外部插件（明确声明为独立作品，不受 GPL 传染）；
   - 通过 `internal-fastify` 同进程运行的插件（明确声明为 GPL 衍生作品）。
2. 项目 SHALL 在 `LICENSE` 旁新增 `LICENSE-EXCEPTIONS.md`（或等价文件），包含对插件/主题接口的例外条款或链接豁免声明（plugin exception / linking exception），并经过法务复核后合入。
3. `plugin-sdk` 与 `theme-sdk` 包 SHALL 采用宽松许可证（MIT 或 Apache-2.0）独立发布，使第三方开发者引用 SDK 不触发 GPL 义务。
4. `EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md` SHALL 增加"许可证与商业分发"章节，给出闭源付费插件的合规开发路径（external-http + SDK）。
5. 第三方付费插件 SHALL NOT 以 `internal-fastify` 运行时形态上架 Marketplace（该约束由闭源侧 Marketplace Control Plane 执行，本仓在插件元数据校验层保留 `runtimeType` 检查挂载点）。
6. `javascript-obfuscator` 混淆分发路径 SHALL 被标记为 deprecated，商业能力保护迁移至平台侧服务端校验（Entitlement Service，闭源范围）。

### Requirement 2 (P0): 插件运行时安全收敛

**User Story:** As a self-hosted operator, I want third-party plugins isolated from the Core API process, so that a faulty or malicious plugin cannot crash or compromise my store.

#### Acceptance Criteria

1. 插件运行时 SHALL 收敛为两级信任模型：
   - `internal-fastify`：仅允许官方白名单插件（内置于发行版或来自 `jiffoo-extensions-official` 签名包）；
   - `external-http`：所有第三方插件的唯一运行时形态。
2. 插件安装器 SHALL 在安装 `internal-fastify` 插件时校验签名与白名单，非白名单来源 SHALL 拒绝安装并给出明确错误（含文档链接）。
3. 统一插件网关（`/api/extensions/plugin/{slug}/api/*`）SHALL 对 external-http 插件调用实施：
   - 每插件独立超时（默认 10s，可配置）；
   - 熔断（连续失败自动断路，半开恢复）；
   - 每插件限流；
   - 响应大小上限。
4. 网关 SHALL 在插件调用失败时返回结构化错误（插件 slug、错误类别、trace id），且 SHALL NOT 使 Core API 进程崩溃或阻塞事件循环。
5. 插件调用 SHALL 产生结构化审计日志（slug、installationId、路由、耗时、状态码），接入统一日志系统。
6. `PLUGIN_SYSTEM_ARCHITECTURE.md` 与 `agent_plugin.md` SHALL 更新为两级信任模型的最终口径。

### Requirement 3 (P1): 数据模型治理与 Schema 拆分

**User Story:** As a core maintainer, I want the Prisma schema split by domain with speculative models audited, so that migrations stay safe and the schema stays maintainable.

#### Acceptance Criteria

1. 项目 SHALL 完成一次全量模型使用审计，输出审计报告：每个 Prisma 模型标记为 `active`（有路由/服务引用）/ `dormant`（仅迁移存在，无代码引用）/ `deprecated`。
2. `schema.prisma`（当前 1579 行、50+ 模型）SHALL 拆分为按域组织的多文件结构（Prisma `prismaSchemaFolder`），域划分至少包含：`commerce`（商品/订单/购物车）、`inventory`、`payment`、`extension`（插件/主题/webhook）、`platform-links`（外部系统链接）、`system`。
3. 标记为 `dormant` 的模型（候选：`InventoryForecast`、`ForecastAccuracy`、`ProductAffinity`、`RecommendationConfig` 等，以审计结果为准）SHALL 被冻结：迁移中保留表结构，schema 文件中集中到 `_dormant.prisma` 并注释来源与冻结日期，禁止新代码引用。
4. 拆分与冻结 SHALL NOT 产生任何数据库迁移 diff（`prisma migrate diff` 为空），即纯 schema 文件重组，零 drift。
5. CI SHALL 增加 drift 检查步骤：`prisma migrate diff --from-migrations --to-schema-datamodel` 非空时构建失败（与全局规则"检测到 database drift 立即停止"对齐）。

### Requirement 4 (P1): 统一异步任务层（Outbox Worker + 队列）

**User Story:** As a core maintainer, I want a single queue-backed worker layer consuming the outbox, so that webhooks, emails, and fulfillment jobs are reliable, retryable, and observable in one place.

#### Acceptance Criteria

1. 系统 SHALL 提供统一的异步任务层（基于 BullMQ + Redis），消费 `OutboxEvent` 表并分发到任务处理器。
2. 现有散落的异步路径 SHALL 收编到该层，至少包含：webhook 投递（对齐 `WebhookDeliveryLog`/`WebhookDeadLetter`）、事务性邮件、库存预警扫描、订单履约后置任务。
3. 任务层 SHALL 支持：指数退避重试（默认 5 次）、死信队列（与 `WebhookDeadLetter` 语义统一）、幂等消费（以 outbox event id 为幂等键）。
4. 任务层 SHALL 暴露运维可见性：队列深度、失败率、处理延迟指标，接入 R5 可观测性体系。
5. Redis 不可用时，系统 SHALL 降级为内联同步执行或延迟写入（可配置），SHALL NOT 丢失 outbox 事件（事件先落库）。
6. Worker SHALL 可独立进程运行（`pnpm --filter api worker`），也 SHALL 支持与 API 同进程的嵌入模式（小型部署默认）。

### Requirement 5 (P0): 生产可观测性落地（OTel + 告警基线）

**User Story:** As an operator running Jiffoo in production, I want traces, metrics, and alerts out of the box, so that I can locate incidents before customers report them.

#### Acceptance Criteria

1. Core API SHALL 集成 OpenTelemetry SDK：HTTP 请求 trace（含 Prisma 查询 span）、核心业务指标（订单创建、支付成功/失败、插件网关调用），通过 OTLP exporter 导出，endpoint 可配置。
2. `@shared/observability` SHALL 成为唯一埋点入口，前端结构化日志与后端 trace SHALL 通过 trace id 关联。
3. 项目 SHALL 提供默认告警规则集（以代码/配置文件形式交付，Prometheus 或 Grafana 格式）：API 5xx 率、p95 延迟、支付失败率、队列积压、数据库连接池饱和。
4. `docker-compose.prod.yml` SHALL 提供可选的 observability profile（OTel Collector + Grafana + Prometheus/Tempo），一条命令启动。
5. 慢查询 SHALL 可定位：Prisma 查询超过阈值（默认 500ms）记录结构化警告日志（含模型、操作、耗时）。
6. 文档 SHALL 包含"生产运维手册"页：如何接入自有 APM（Datadog/Grafana Cloud）、告警阈值调整、常见故障定位路径。

### Requirement 6 (P1): 主题 SDK 版本契约与兼容性矩阵

**User Story:** As a theme developer maintaining one of 10+ themes, I want a versioned, contract-tested theme SDK, so that core upgrades don't silently break my theme.

#### Acceptance Criteria

1. `theme-sdk` 与 `theme-api-sdk` SHALL 定义显式的公共 API 表面（导出清单 + 类型契约），并采用严格 semver：破坏性变更必须 major。
2. 主题包元数据（`theme.json`）SHALL 声明兼容的 SDK 版本范围（`engines.jiffooTheme` 或等价字段），主题安装/激活时 SHALL 校验兼容性，不兼容时给出明确错误而非运行时崩溃。
3. CI SHALL 增加主题兼容性矩阵任务：对 `packages/shop-themes/*` 全部主题执行构建 + 冒烟渲染（首页 SSR 可渲染、无类型错误），核心 PR 破坏任一主题时构建失败。
4. SDK 公共 API SHALL 有契约测试（API surface snapshot test）：导出面变化未伴随版本升级时测试失败。
5. `RuntimeSnapshot` 读模型（multi-surface spec 定义）SHALL 是主题获取 store/theme/branding 状态的唯一入口，主题 SHALL NOT 直接调用未纳入契约的内部 API。

### Requirement 7 (P2): 数字商品垂直发行版（Digital Commerce Distribution)

**User Story:** As a merchant selling digital goods (eSIM, licenses, digital assets), I want a purpose-built Jiffoo distribution, so that I can launch a digital-goods store without assembling pieces myself.

#### Acceptance Criteria

1. 开源核心 SHALL 将虚拟商品履约能力显性化：数字商品交付（下载链接/兑换码/API 履约）作为一等商品类型路径，文档化端到端流程（下单 → 支付 → 自动履约 → 交付凭证）。
2. `create-jiffoo-app` SHALL 支持垂直模板选项（`--template digital-goods` / `--template esim`），生成预配置的数字商品站点（主题 + 示例商品 + 履约配置）。
3. 垂直模板引用的官方主题（`esim-mall`、`digital-vault`）SHALL 遵循 canonical source 约束：模板只引用发布产物，源码归属 `jiffoo-extensions-official`。
4. 营销层面 SHALL 在 README 与 docs 站点新增 "Digital Commerce" 定位页：与 Medusa/Saleor 的差异化对比（虚拟商品履约、eSIM 场景）。
5. B2B 模块（`src/core/b2b`）与数字商品能力的组合场景（批量采购兑换码）SHALL 至少完成需求盘点，产出后续 spec 提案（不要求本阶段实现）。

### Requirement 8 (P2): Agentic Commerce — MCP Server

**User Story:** As an AI agent (or a developer building agent integrations), I want an official MCP server for Jiffoo stores, so that agents can browse products and place orders programmatically and safely.

#### Acceptance Criteria

1. 项目 SHALL 新增开源包 `packages/mcp-server`（`@jiffoo/mcp-server`，宽松许可证），实现 MCP 协议 server，对接 Core API 公开接口。
2. 第一阶段工具集 SHALL 包含（只读优先）：`search_products`、`get_product`、`get_categories`、`get_cart`、`add_to_cart`、`create_checkout`（返回支付链接，不代持支付凭证）。
3. 写操作 SHALL 基于显式 API token 鉴权（商户在 Admin 生成、可撤销、可限权），MCP server SHALL NOT 存储用户支付信息。
4. MCP server SHALL 支持 stdio 与 streamable HTTP 两种传输，可独立部署（`npx @jiffoo/mcp-server --api-url ...`）。
5. 文档 SHALL 提供 agent 接入指南（Claude Desktop / Claude Code 配置示例），并在 README 特性列表新增 Agentic Commerce 条目。
6. 每个 MCP 工具 SHALL 有集成测试（对 seed 数据的端到端调用）。

### Requirement 9 (P2): 托管 SaaS 获客漏斗挂载点（开源侧）

**User Story:** As the platform business, I want the open-source deployment funnel to surface managed-hosting upgrade paths, so that self-hosted users can discover paid offerings without the core containing commercial logic.

#### Acceptance Criteria

1. 开源核心 SHALL 保持"挂载点不实现商业逻辑"边界：Admin 内的托管升级入口仅展示由后端运行时状态下发的链接/状态（与 `Powered by Jiffoo` Footer 同一机制），商业闭环全部在闭源 Platform API。
2. Cloudflare 一键部署路径 SHALL 完成体验闭环：部署后的引导页（连接自有 API、或注册托管后端）可用且文档化。
3. Admin 仪表盘 SHALL 支持展示"实例健康 + 版本更新提示"卡片（数据来自开源 upgrade 模块），作为托管服务价值对比的自然入口。
4. 上述入口 SHALL 可通过配置完全关闭（自托管用户无强制商业曝光），符合开源社区预期。

---

## 需求依赖关系

```
R1 (许可证边界) ──┬──> R2 (运行时收敛)     [法律边界决定技术边界]
                  └──> R7/R8 SDK 许可证选择
R2 (运行时收敛) ─────> Marketplace 第三方生态（闭源侧后续 spec）
R3 (schema 治理) ────> R4 (outbox worker 依赖 OutboxEvent 模型稳定)
R5 (可观测性) <────── R2/R4 的指标接入
R6 (主题契约) <────── R7 (垂直模板依赖主题稳定性)
```

## 明确不做（Out of Scope）

- 多租户/多店架构（违反开源核心 Hard Requirement）
- Marketplace 交易闭环（上架/购买/分账，闭源侧单独跟踪）
- AI 建站/AI 生成主题（依赖闭源平台能力，后续 spec）
- 移动端/桌面端相关工作（由 multi-surface spec 及私有仓跟踪）
- Wasm/isolate 插件运行时（本阶段仅做技术评估备忘，不实现）
