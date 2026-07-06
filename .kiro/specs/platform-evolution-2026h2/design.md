# Design Document — Platform Evolution 2026 H2

> 需求见 [requirements.md](./requirements.md)。本文档给出各需求域的技术设计与关键决策，任务拆解见 [tasks.md](./tasks.md)。

## Overview

九个需求域按三条主线组织：

- **生态合规线（R1 → R2）**：先定法律边界，再收敛技术边界。这是 Marketplace 第三方生态的前置条件。
- **工程健康线（R3 → R4 → R5 → R6）**：schema 治理 → 异步统一 → 可观测性 → 主题契约，自底向上消除维护性风险。
- **差异化线（R7 → R8 → R9）**：数字商品发行版、MCP server、托管漏斗，均为增量、可独立交付。

## R1: 许可证与插件生态合规边界

### 决策

采用 **"GPL 核心 + 接口例外声明 + 宽松许可 SDK"** 组合，而非整体换许可证（重新授权需要全部贡献者同意，成本过高）：

1. `LICENSE-EXCEPTIONS.md`：声明通过以下接口与核心交互的独立作品不构成衍生作品：
   - 插件网关 HTTP 协议（`/api/extensions/plugin/{slug}/api/*`）；
   - Webhook 订阅协议；
   - Theme Pack 声明式格式（`theme.json` + tokens/templates）。
2. SDK 重新授权：`packages/plugin-sdk`、`packages/theme-sdk`、`packages/theme-api-sdk`、`packages/core-api-sdk` 改为 MIT（这些包由团队独立编写，无外部贡献者障碍；逐包核对 git log 确认）。
3. `internal-fastify` 插件明确为 GPL 衍生作品 → 只有官方（版权同源）可以闭源分发，第三方进程内插件必须开源为 GPL 或走 external-http。

### 风险

- 例外条款措辞需法务复核，任务中设置显式检查点（checkpoint task），未复核前不合入 `LICENSE-EXCEPTIONS.md`。
- 已发布的历史版本无法追溯变更，声明只对新版本生效——文档需注明生效版本号。

## R2: 插件运行时安全收敛

### 架构

```
                        ┌─ internal-fastify（官方白名单，同进程）
Admin/Shop ─> 插件网关 ─┤    · 安装时验签（Ed25519，公钥内置）
 /api/extensions/       │    · 白名单来源：built-in | official-signed
 plugin/{slug}/api/*    └─ external-http（所有第三方，进程外）
                             · undici pool，每插件独立
                             · 超时 10s / 熔断 / 限流 / 响应上限 5MB
```

### 关键设计

- **信任级别落库**：`PluginInstall` 增加 `trustLevel`（`builtin | official | third-party`）派生字段——从签名校验结果推导，不新增迁移则复用现有 metadata JSON 字段。
- **熔断器**：网关层实现每插件 circuit breaker（滚动窗口失败率 > 50% 且样本 ≥ 10 时断路 30s，半开试探）。状态存内存（单实例）+ Redis（多实例共享，可选）。
- **不破坏现有行为**：现有已安装的 internal-fastify 插件在升级后进入 grace 模式（启动时 warn 日志 + Admin 提示），下一个 minor 版本才强制执行白名单。
- 事件循环保护：external-http 调用全部走 undici 且带 AbortSignal；禁止网关层同步 JSON.parse 超大响应（先检查 content-length）。

## R3: 数据模型治理

### 决策

- 启用 Prisma `prismaSchemaFolder`（需要 Prisma ≥ 5.15，先确认当前版本），目录结构：

```
apps/api/prisma/schema/
├── commerce.prisma      # Store, Product, Variant, Category, Cart, Order, Discount...
├── inventory.prisma     # Warehouse, WarehouseInventory, StockAlert, Transfer...
├── payment.prisma       # Payment, Refund, PaymentLedger, RefundLedger
├── extension.prisma     # PluginInstall*, InstalledTheme, Webhook*, PluginThemeExtension
├── platform-links.prisma# External*Link, OutboxEvent, PushSubscription
├── system.prisma        # User, SystemSettings, ErrorLog, SeoRedirect
├── _dormant.prisma      # 冻结模型（审计后确定）
└── _base.prisma         # datasource + generator
```

- **零 drift 保证**：拆分是纯文件重组。验收命令：`prisma migrate diff --from-migrations ./migrations --to-schema-datamodel ./schema` 输出为空。
- 冻结模型处理：不删表（避免破坏已部署实例），schema 保留 + 头部注释 `// DORMANT since 2026-07: no code references, do not use`；ESLint 规则（或 grep CI 检查）禁止新代码 import 对应 Prisma 类型。

## R4: 统一异步任务层

### 架构

```
业务代码 ──(同一事务写入)──> OutboxEvent 表
                                  │
                    OutboxPoller（间隔轮询 + LISTEN/NOTIFY 可选优化）
                                  │
                             BullMQ queues
                    ┌─────────┼──────────┬────────────┐
              webhook-delivery  email  fulfillment  stock-alert
                    │
              失败 5 次 → DLQ → WebhookDeadLetter（webhook 类）/ DeadJob 记录
```

### 关键设计

- 新增模块 `apps/api/src/infra/jobs/`（复用现有 `src/jobs` 目录，先盘点现有内容再决定合并方向）。
- **幂等**：job id = outbox event id；处理器开头检查处理标记（OutboxEvent.status 字段，确认现有模型字段，缺则走 metadata）。
- **部署模式**：`WORKER_MODE=embedded|standalone|off`。embedded（默认）：API 进程内启动 worker；standalone：`node dist/worker.js` 独立进程；off：仅入队不消费（配合外部 worker）。
- **降级**：Redis 不可用 → poller 直接内联执行处理器（牺牲重试语义，保可用性），结构化 warn。
- 指标：`jobs_queue_depth`、`jobs_failed_total`、`jobs_duration_seconds`（接 R5）。

## R5: 生产可观测性

### 决策

- OTel Node SDK + auto-instrumentation（http、fastify、prisma、ioredis），入口在 API 启动最前（`--require` 或 server.ts 首行 import）。
- 采样：默认 parent-based + 10% ratio，环境变量可调；错误请求强制采样（tail sampling 留给 Collector）。
- 指标导出：OTLP 优先；同时保留 `/metrics` Prometheus endpoint（自托管用户最低成本接入）。
- 交付物形态：`deploy/observability/` 目录 = docker compose profile + Grafana dashboard JSON + alert rules YAML。
- 慢查询：Prisma client extension 计时（比 $on('query') 更可控），阈值 `SLOW_QUERY_MS` 默认 500。

## R6: 主题 SDK 版本契约

### 关键设计

- **API surface 契约测试**：用 `api-extractor` 或简化方案（tsc 生成 .d.ts rollup + snapshot 对比）锁定 `theme-sdk`/`theme-api-sdk` 导出面；surface 变化必须显式更新 snapshot + changeset。
- **theme.json 兼容声明**：新增字段 `engines: { "jiffoo-theme-sdk": "^2.0.0" }`；主题激活流程（theme-management routes）加 semver 校验，不满足则 409 + 结构化错误。已存在主题无该字段时视为 `*`（兼容），仅 warn。
- **CI 兼容性矩阵**：turbo task `theme-matrix` = 对 `packages/shop-themes/*` 逐个执行 `build` + SSR 冒烟（用 React `renderToString` 渲染 HomePage 组件，seed 数据 mock），任一失败即整体失败。放在核心 PR 的 required checks。

## R7: 数字商品垂直发行版

- `create-jiffoo-app` 增加 template registry（JSON 清单：模板 → 主题包名 + seed 数据集 + .env 预设），`digital-goods`、`esim` 为首批。
- 履约路径盘点现有实现（product-types-system spec 已交付虚拟商品/履约逻辑），本阶段以**文档化 + 模板化 + 补齐断点**为主，不重写。
- 官方主题引用走已发布 artifact（npm 包或签名 ZIP），源码不进本仓——与 official-extensions 双仓口径一致。

## R8: MCP Server

### 设计

- 新包 `packages/mcp-server`，依赖 `@modelcontextprotocol/sdk` + `packages/core-api-sdk`（复用已有 API client，避免重复实现鉴权/类型）。
- 鉴权模型：
  - 只读工具：可匿名（走公开 storefront API）；
  - 写工具（cart/checkout）：需要 `JIFFOO_API_TOKEN`（Admin 生成的 scoped token；确认现有 auth 是否已有 API token 机制，没有则先补最小 scoped-token 能力——这是本需求域最大的前置工作，任务中单列）。
- checkout 返回 hosted payment URL（Stripe checkout session），支付永远在浏览器完成——agent 不接触卡号，规避 PCI 与代付风险。
- 传输：stdio（本地 agent）+ streamable HTTP（远程部署，带 token）。

## R9: 托管漏斗挂载点

- 复用 `bootstrap-status` / 运行时状态下发机制（与 Footer attribution 同一模式）：后端下发 `platformOffers` 状态块（可为空），Admin 渲染；`JIFFOO_DISABLE_PLATFORM_OFFERS=true` 时后端恒下发空。
- CF Pages 部署后引导页：`apps/shop` 检测无 API 配置时渲染 setup 引导（连接自有 API / 了解托管选项），静态页即可。

## 横切约束

- 所有开源范围新代码英文（含注释、错误信息、日志）。
- 每个需求域交付都包含：实现 + 测试 + 文档 + CHANGELOG 条目。
- 数据库相关任务执行前后必须跑 drift 检查；检测到 drift 立即停止（全局规则）。
