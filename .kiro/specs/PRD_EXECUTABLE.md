# Jiffoo Mall 可执行 PRD（Execution PRD）

> 配套战略概览：[`.kiro/specs/PRD.md`](./PRD.md)  
> 本文档回答：**这一阶段到底做什么、做到什么算完成、怎么验收**。面向研发/测试/运维/产品协同。

---

## 0. 文档信息

- **状态**：✅ Active（执行中）
- **适用阶段**：Alpha v0.1.0（2025 Q1）
- **适用范围**：开源核心（单商户单店部署 / Single Store）能力闭环；不包含任何平台化运营能力（`apps/super-admin`、`apps/developer-portal`、`apps/platform-api` 等）
- **交付形态**：
  - 开源版：`apps/api`（Core API，端口 3001）+ `apps/shop` + `apps/admin`（不包含任何平台运营闭源应用）
  - 闭源版：上述 + `apps/platform-api`（Platform API，端口 3011）+ `apps/super-admin` + `apps/developer-portal`
- **验收方式**：功能验收（手工验收清单/走查）+ 生产可用基线（Release Gate）

### Alpha 里程碑计划

| 里程碑 | 日期 | 交付物 | 责任人 |
|--------|------|----------|--------|
| M1: 核心功能闭环 | 2025-01-31 | 完整购物流程可跑通 | 后端+前端 |
| M2: 后台管理闭环 | 2025-02-15 | 商品/订单管理可用 | 前端 |
| M3: 质量基线达标 | 2025-02-28 | 手工验收+安全+可观测性 | 全员 |
| M4: Alpha 发布 | 2025-03-15 | Release Gate 全部通过 | PM |

---

## 1. 产品边界（先对齐，避免脑补）

### 1.1 本 PRD 的产品边界（Alpha）

- **单商户单店部署（Single Store）**：一套系统服务一个商户/一个店铺；开源核心按“独立站”默认路径设计。
- **开源范围单租户语义（Hard Requirement）**：开源侧默认以单租户独立站运行；文档中可用 `tenant` 术语表达“该独立站本身”（等价于 store/site），但系统不提供 tenant 切换流程；开源核心数据模型不包含 `tenantId` 字段/外键，也不包含 `tenants` 表。
- **严禁引入“多租户”工程表征（Hard Requirement）**：开源范围内禁止出现任何以租户为维度的工程设计与接口形态，包括但不限于：
  - 任何业务表字段/外键/索引中的 `tenantId`、`tenants`（或同义概念）
  - 任何鉴权载荷中的 `tenantId` claim（JWT/Session/Token payload）
  - 任何请求头/参数中的 `X-Tenant-Id`（或同义 Header/Query/Path 形态）
- **不做平台化运营闭环**：不交付 `super-admin`、开发者审核、分账提现、平台数据分析等（属于闭源/后续阶段）。
- **不引入平台商业化/订阅/许可证闭环（Hard Requirement）**：开源 Core API 不交付任何“许可证管理/订阅管理/分销”等平台商业化运营接口与后台能力；相关能力仅存在于闭源 Platform API（或闭源前端）。Core 只允许保留“可被校验/可被限制”的挂载点，不得在 Core 内实现平台商业逻辑。
- **国际化（i18n）基础能力（Alpha 必须交付）**：Web 应用统一使用 `/{locale}/` 路由前缀；Alpha 默认支持 `en` + `zh-Hant`（英语 + 繁体中文；不做 i18n 全量工作流与后台）。
- **主题系统（Alpha 必须交付到生产可用）**：保留离线 ZIP 安装主题与从磁盘加载的能力；并交付“主题切换闭环”：
  - 切换后立即生效（无需重启服务；对用户可感知）
  - 可回滚到上一个主题（具备明确回滚入口与状态）
  - 主题配置持久化（重启/升级后不丢失）
  - **同时支持两种主题类型（同一套安装/启用/回滚体验）**：
    - **Theme Pack（L3.5 / 无可执行代码）**：ZIP 仅包含 `theme.json` + tokens/templates/assets 等静态资源，由内置 `theme-runtime` 渲染
    - **Theme App（L4 / 可执行 storefront）**：ZIP 包含可直接运行的构建产物（例如 Next.js standalone build），平台安装后启动独立主题进程并通过 `shop/admin` 网关切流量（允许覆盖核心路由与新增页面，SSR 由主题负责）
- **插件/主题“运行时”可保留**：为 Beta/GA 铺路，但 Alpha 不做“市场交易闭环”（上架/购买/审核/分账）；后续闭源市场默认采用 `Marketplace Control Plane + Artifact Registry + Entitlement Service + Admin Installer + Event-Activated Runtime`，其中官方与第三方默认走 `package-managed`，并支持后台断点续传下载安装；`service-managed` 仅作为少数重型扩展的高级路径。
- **官方扩展双仓开发口径（执行约束）**：`jiffoo-extensions-official` 是官方主题/插件源码的唯一可写仓库；`jiffoo-mall-core` 负责运行时、Marketplace 控制平面集成、Artifact Registry/Installer 与 fallback 默认主题。团队应使用“组合工作区 + 单一写入源”模式联调，禁止把“先在主仓库改完再手动同步到 official 仓库”当作默认流程。
- **官方归属默认规则（执行约束）**：凡是通过主仓库对话流程推进、且未被明确声明为 core-owned fallback/runtime-only 的新主题/插件，默认按官方扩展处理，并将 canonical source 收敛到 `jiffoo-extensions-official`。
- **多端复用口径（Post-Alpha 执行约束）**：`jiffoo-mall-desktop-private` 采用 Electron + Web-heavy adapter；`jiffoo-mall-mobile-private` 采用 React Native / Expo native-first adapter。Web / Desktop / Mobile 共享 SDK、schema、theme tokens、plugin capability contract 与 solution package manifest，但不以“同一份 Web 页面实现跑三端”为目标。
- **主题/插件跨端主路径（Post-Alpha 执行约束）**：`Theme Pack` 是 Web / Desktop / Mobile 的统一主路径。Desktop 可以支持更接近 Web 的可执行主题/插件扩展；Mobile 默认只支持声明式主题/插件（tokens、assets、templates、config schema、capability metadata），不将任意下载执行代码作为默认能力。
- **组合工作区约束（执行约束）**：本地开发默认使用同级目录组合工作区，例如 `/Users/jordan/Projects/jiffoo-mall-core`、`/Users/jordan/Projects/jiffoo-extensions-official`、`/Users/jordan/Projects/jiffoo-mall-desktop`、`/Users/jordan/Projects/jiffoo-mall-mobile`。
- **未来闭源市场域模型（非 Alpha 验收项）**：闭源后续阶段应明确拆分：
  - `app_marketplace`：主题、插件、扩展服务，平台代收，结算给 `developer`
  - `goods_marketplace`：实体商品、数字商品、组合包，平台代收，结算给 `vendor`
  - `merchant_store`：商户自营商品，走商户自己的支付账号，不进入平台代收分润
- **未来平台账号绑定（非 Alpha 验收项）**：开源实例可独立运行；只有访问 Marketplace、Billing、Settlement、官方服务时，才需要把 `Local Instance + Local Tenant` 绑定到 `Jiffoo Platform Account`。推荐体验是在 Admin 内打开 **Jiffoo 托管登录/注册弹窗（Hosted Auth Popup + PKCE）**，并在无稳定回调地址时自动回退到 `Device Flow / User Code Flow`
- **未来开源核心一键升级（非 Alpha 验收项）**：长期目标是在 Admin 中统一提供 `检查更新 / 立即升级 / 自动恢复状态` 体验，并由本地 `Jiffoo Updater` 根据部署方式执行：
  - `package-managed` 单机/脚本安装：目录原子切换
  - `docker-compose`：镜像/tag 升级与容器重建
  - `k8s/helm/operator`：发布版本滚动升级与自动恢复上一个健康 release
  - 开源核心更新不依赖平台账号绑定；平台绑定只影响 Marketplace / Billing / Settlement 等平台能力
- **业务插件网关（Alpha 口径，必须对齐现有代码路径）**：
  - 统一网关：`/api/extensions/plugin/{slug}/api/*`（历史路径 `/api/plugins/{slug}/api/*` 已废弃，返回 404）
  - 支持多实例：`installationId` 为"插件实例唯一标识"，默认实例 `instanceKey=default`
  - 实例选择：`?installation=default` 或 `?installationId=...`（未提供则默认 `default`）
  - `slug` 格式必须校验：`^[a-z][a-z0-9-]{0,30}[a-z0-9]$`（2-32 字符）
  - `instanceKey` 格式必须校验：`^[a-z0-9-]{1,32}$`
  - **运行时安全声明**：internal-fastify 插件在 Core API 同进程运行；自托管用户应只安装来自可信来源的插件
- **默认主题（Fallback）**：系统必须内置 `builtin-default` 主题作为 fallback，不可删除；系统启动时如果没有激活任何主题，自动激活默认主题
- **双 API 架构（闭源版）**：闭源版运行 Core API（端口 3001）+ Platform API（端口 3011）双服务。详见 [dual-api-architecture](./dual-api-architecture/requirements.md)。
- **数据库强隔离（推荐实践）**：使用同一 Postgres database 的不同 schema（不共享表结构/不跨 schema 外键）；Platform 仅通过 Core API（公开/内部接口）对接核心能力与数据。
- **开源版独立可运行**：Core API (`apps/api`) 必须能在没有 Platform API 的情况下独立运行，不依赖任何闭源代码。
- **Admin 初始凭证安全口径（Alpha 必须对齐）**：
  - 登录页是否展示初始化管理员凭证，必须由后端 `bootstrap-status` 显式控制
  - `bootstrap` 模式下允许展示一次初始化管理员凭证
  - 初始化管理员改密成功后，系统必须关闭凭证展示并移除“需要改密”状态
  - `demo` 模式可持续展示示例凭证，但不得与正常安装环境混淆

### 1.2 多端执行约束（非 Alpha Release Gate，但必须对齐）

- Web / Desktop / Mobile 的复用对象应是：
  - SDK
  - schema
  - theme metadata / tokens
  - plugin capability contract
  - solution package manifest
- 所有端应优先读取统一的 `RuntimeSnapshot` 读模型，而不是各自发明一套主题/插件状态：
  - `store`
  - `solution`
  - `theme`
  - `plugins`
  - `branding`
  - `surfaces`
- `desktop` 应优先复用 `shop-web` / `desktop-web` 这类 Web-heavy surface，再通过 Electron shell 暴露桌面能力。
- `mobile` 应优先实现 `shop-native` / `mobile-native` surface，不应把 Web DOM 主题页面直接当作移动端主实现。
- `Theme Pack` 应作为三端统一主路径；Desktop 可额外支持 executable theme/plugin surface，Mobile 默认走 declarative path。
- `Theme Pack` 最小交付物应至少包含：`theme.json`、tokens、templates/blocks、assets、settings schema（可选）与 adapter 声明（可选）。
- `Plugin Capability` 最小交付物应至少包含：`slug`、`name`、`version`、`capabilities`、`configSchema`、`surface support` 声明。
- 主题与插件的跨端复用目标应是“共享 contract + 可选 surface adapter”，而不是要求所有 surface 共用同一个页面树。
- 主对话上下文可以保留在 `jiffoo-mall-core`，但实现必须落到 canonical repo：
  - 官方主题/插件：`jiffoo-extensions-official`
  - 桌面宿主/桌面 adapter：`jiffoo-mall-desktop-private`
  - 移动宿主/native adapter：`jiffoo-mall-mobile-private`
- `Admin` 应被视为统一扩展控制面：
  - 安装主题
  - 安装插件
  - 切换 active theme
  - 启用/停用插件
  - 下发 solution package
  - 下发 feature/capability flags
- 关联 Spec：
  - [`.kiro/specs/multi-surface-solution-architecture/requirements.md`](./multi-surface-solution-architecture/requirements.md)
  - [`.kiro/specs/multi-surface-solution-architecture/design.md`](./multi-surface-solution-architecture/design.md)

### 1.3 Alpha In Scope / Out of Scope

**In Scope（必须做）**
- 用户可完成：浏览商品 → 加入购物车 → 结账 → 支付 → 生成订单 → 查看订单
- 商户可完成：商品管理、订单处理（发货/取消/退款的最小闭环，至少“全额退款”）、基础店铺配置
- i18n 基础：`/{locale}/` 路由前缀；默认支持 `en` + `zh-Hant`（英语 + 繁体中文）
- 主题系统：离线安装 + 主题切换（立即生效/可回滚/配置持久化）
- 结构化数据模型（Alpha 必须落库）：分类、收货地址、发货/履约、退款记录
- 系统具备：安全基线、可观测性、备份恢复、手工验收清单、可部署发布流程

**Out of Scope（明确不做，避免范围膨胀）**
- 插件/主题市场（上架/购买/审核/分账/提现）
- 任何“在线市场”联通与安装闭环（例如对 `jiffoo.com` 的 `/api/marketplace/*` 浏览/下载/安装）：**不作为 Alpha 验收项**；Alpha 仅验收“离线 ZIP 安装 + 本地加载 + 主题切换闭环”
- `Jiffoo` 官方扩展首发（官方主题/官方插件的上架、定价、授权、Admin 一键安装/启用）**单独由** [`.kiro/specs/official-extensions-go-live/requirements.md`](./official-extensions-go-live/requirements.md) **跟踪，不改变本 Alpha 范围定义**
- 闭源后续第三方扩展市场也应沿用同一模型：Merchant Admin 只面对“浏览/购买/安装/启用”流程，不直接处理 ZIP、镜像、部署细节；下载、断点续传、验签与安装由后台安装器负责
- `app_marketplace / goods_marketplace / merchant_store` 的交易域拆分、平台账号绑定、开发者/卖家分润、平台代收结算
- 开源核心的真实“一键升级执行器”（包括单机、Docker Compose、Kubernetes 的环境 adapter）不作为 Alpha Release Gate；Alpha 允许保留更新检查/版本展示与升级 API 骨架，但不以生产可用升级器作为阻塞验收项
- 多商户/多店（multi-store）/平台代理/白标/分销网络
- 国际化（i18n 全量：多语种规模化、翻译工作流/后台、内容全量翻译覆盖等）、移动端 App、桌面端
- 企业级能力：多仓、多币种、税务/发票、复杂促销引擎、对接 ERP/OMS/WMS

---

## 2. Alpha 的“闭环”定义（验收口径）

> **未来市场化扩展的对齐说明（非 Alpha 验收项）**：后续官方/第三方扩展市场应统一收敛到五层模型：
> `Marketplace Control Plane`、`Artifact Registry`、`Entitlement Service`、`Admin Installer`、`Event-Activated Runtime`。
> Alpha 只需保证开源 Core 不阻断该模型未来接入。
>
> 同时，长期闭源平台还应具备以下但不作为 Alpha 阻塞项：
> - 交易域拆分：`app_marketplace`、`goods_marketplace`、`merchant_store`
> - 结算对象拆分：`developer`、`vendor`、`merchant`
> - 平台账号绑定：`Platform Account -> Instance Registration -> Tenant Binding`
> - 绑定交互：默认 `Hosted Auth Popup + PKCE`，兜底 `Device Flow / User Code Flow`
> - 开源核心自更新：统一 Admin 升级中心 + 本地 `Jiffoo Updater` + 环境感知执行器（single-host / docker-compose / k8s）
> - 开源核心版本规范：严格 semver，默认 `stable` 通道，支持 `prerelease` opt-in；`major` 升级必须显式确认
> - Merchant Admin 市场 IA：商户侧直接暴露 `Themes / Plugins`，插件形成插件中心，不继续以泛化 `Extensions` 作为主导航
> - 默认 storefront 主题：必须允许 `storefront`、`landing-commerce`、`product-site` 三种 archetype，避免把首页固定成商品网格；Jiffoo 官方站与其他 SaaS 站点可基于同一主题基础模板配置出安装/部署/文档优先的 landing 体验

### 2.1 交易闭环（Shopper）

1. 可浏览商品与分类，进入商品详情
2. 可将商品加入购物车并修改数量
3. 可进入结账页填写收货信息并提交订单
4. 可完成至少一种真实支付路径（建议：Stripe），支付成功后订单状态正确
5. 可在用户中心查看订单列表与订单详情

### 2.2 商户运营闭环（Merchant Admin）

1. 可创建/编辑/上下架商品（含库存/价格/图片的最小集合）
2. 可查看订单并进行最小订单处理：确认付款、发货（填写物流信息）、取消/退款（至少支持“全额退款”的最小闭环）

### 2.3 工程运维闭环（Ops）

1. 部署后具备健康检查与关键告警（服务不可用、错误率、延迟、备份失败）
2. 具备可恢复的备份策略（RPO/RTO 有明确目标并可演练）
3. 具备基础安全防护（限流、安全头、Webhook 验签等）

---

## 3. Alpha 需求清单（可执行/可验收）

> 说明：以下为 Alpha 的“总装配”需求，详细实现与更细粒度验收标准以对应 Spec 为准。

### ALPHA-P0-F01：核心电商功能可用（Shop + API）

- **验收**：
  - 完整购物流程可走通：浏览 → 购物车 → 结账 → 支付成功 → 订单确认
  - 订单与支付状态在刷新/重复回调/网络抖动下保持一致（具备幂等/防重复）
- **关联 Spec**：
  - [`.kiro/specs/core-functionality-completion/requirements.md`](./core-functionality-completion/requirements.md)

### ALPHA-P0-F02：单店核心边界清晰（独立站默认路径）

- **验收**：
  - 默认路径下不要求任何“多店/多商户”上下文即可完成全流程
  - 开源核心的代码与数据模型不包含“多店/多商户”维度（不引入额外的店铺隔离字段/头部/切换流程）
  - 如未来需要多店能力，必须以独立扩展（后续阶段）提供，不得污染开源核心的默认路径
- **关联 Spec**：
  - [`.kiro/specs/single-store-core-architecture/requirements.md`](./single-store-core-architecture/requirements.md)

### ALPHA-P0-F03：后台商品管理可用（Admin）

- **验收**：
  - 可创建/编辑/删除/上下架商品（含分类、价格、库存的最小集合）
  - 商城端展示与后台变更一致（缓存/搜索延迟有明确策略）
- **关联 Spec**：
  - [`.kiro/specs/core-functionality-completion/requirements.md`](./core-functionality-completion/requirements.md)

### ALPHA-P0-F04：后台订单处理可用（Admin）

- **验收责任人**：QA + 产品
- **验收**：
  - 可查看订单列表/详情，完成最小处理：发货、取消、退款（至少全额退款）
  - 关键状态流转有明确规则且可测试（PAID → FULFILLED / REFUNDED 等）
- **关联 Spec**：
  - [`.kiro/specs/core-functionality-completion/requirements.md`](./core-functionality-completion/requirements.md)

### ALPHA-P0-F05：i18n + 主题系统可用于生产（独立站默认体验）

- **验收**：
- Web 应用统一使用 `/{locale}/` 路由前缀；Alpha 默认支持 `en` + `zh-Hant`（英语 + 繁体中文）
  - 主题可切换且**切换后立即生效**（用户侧可感知，且不要求重启服务）
  - 主题可**回滚到上一个主题**（有明确回滚入口与状态）
  - 主题配置**可持久化**（重启/升级后不丢失）
  - 首页推荐、联动推荐、购物车推荐等商品卡片必须始终携带真实商品 ID；点击后不得出现 `/products/undefined` 或其他无效详情路由
  - `Commercial package` 授权码激活成功后，如 package 声明了默认主题，系统必须自动完成默认主题的恢复/安装与激活，不允许把 `Install` / `Activate` 这一步再甩给商户手动完成
  - 若测试/生产环境缺失 `commercial package` 存储表或平台侧迁移未完成，相关接口必须返回明确的存储不可用错误，并阻断 release gate；不允许以模糊 `500` 继续推进上线
  - **离线主题安装口径（Alpha 必须真实可用）**：
    - 用户从社区下载主题 ZIP，在 `apps/admin` 的“离线安装主题”入口上传即可安装；安装成功后能在“已安装主题列表”中看到，并可一键启用/回滚。
    - **Theme Pack（L3.5 / 配置与资源包）**：只允许包含配置文件与静态资源（例如 `theme.json`、图片、CSS 变量/Token、templates 等），**不得包含可执行的 JS/TS（包括 React/Next 可执行代码）**。
    - **Theme App（L4 / 可执行 storefront）**：允许包含可执行产物，但必须是**可直接运行的构建产物**（例如 Next.js standalone build），安装后平台应：
      - 启动独立主题进程并完成 health check（失败不允许切换；应自动回滚/保持原主题）
      - 通过 `shop/admin` 网关/路由层把用户请求转发到当前激活的主题进程，实现“安装即用/切换即生效”
      - 保证 SSR 可用（主题负责路由与渲染），并保留可回滚路径（至少回滚到上一个主题）
    - 默认主题必须支持 `storefront / landing-commerce / product-site` 三种首页定位，而不是把首页固定成商品陈列页。
    - 当站点采用 `product-site` archetype 时，首页应优先呈现安装、部署、文档、演示与产品能力简介，商品与交易路径保留为次级入口。
    - 主题切换的“立即生效”指：不重启 `apps/api`，用户刷新页面即可看到新主题效果（Theme Pack 通过 runtime 重新加载资源；Theme App 通过网关切流量）。
    - 商业包授权码激活后的主题/品牌切换必须在新的 storefront 请求中立即生效；`shop` 端不得把 `store context` 以小时级 SSR 缓存冻结在旧主题上。
    - 安全约束：Theme Pack 必须做白名单文件类型与大小限制；Theme App 属于可执行代码扩展，需以“独立进程 + 可观测 + 失败回退”为最低安全底线。
  - 明确不交付“主题市场交易闭环”（上架/购买/审核/分账/提现）
- **扩展模块统一错误格式**：所有扩展相关 API 的错误响应必须使用统一格式 `{ code, message, details? }`，详见 [EXTENSIONS_IMPLEMENTATION.md](./theme-pack/EXTENSIONS_IMPLEMENTATION.md)
- **关联 Spec**：
  - [`.kiro/specs/unified-theme-architecture/requirements.md`](./unified-theme-architecture/requirements.md)
  - [`.kiro/specs/i18n-plugin/requirements.md`](./i18n-plugin/requirements.md)
  - [`.kiro/specs/theme-pack/EXTENSIONS_BLUEPRINT.md`](./theme-pack/EXTENSIONS_BLUEPRINT.md)
  - [`.kiro/specs/theme-pack/EXTENSIONS_IMPLEMENTATION.md`](./theme-pack/EXTENSIONS_IMPLEMENTATION.md)

### ALPHA-P0-F06：结构化数据模型落库（可审计、可演进）

- **验收**：
  - 商品分类为结构化数据模型（非字符串临时字段承载）
  - 收货地址为结构化数据模型（可校验、可扩展；订单引用地址时保持一致性与可追溯）
  - 发货/履约信息为结构化数据模型（支持“手动录入物流公司+单号+状态”的最小闭环）
  - 退款必须有独立退款记录（数据库可审计）；至少支持“全额退款”，并具备幂等键/外部退款单号以支持重试与重复回调
- **关联 Spec**：
  - [`.kiro/specs/core-functionality-completion/requirements.md`](./core-functionality-completion/requirements.md)

### ALPHA-P0-Q01：前端稳定性基线（不崩、不刷屏、可恢复）

- **验收**：
  - API 异常时页面不允许疯狂刷新；必须提供可见错误态 + 手动重试
  - 图片加载失败不出现破碎图；必须优雅降级
  - 全站有错误边界（Error Boundary）兜底
- **关联 Spec**：
  - [`.kiro/specs/frontend-stability/requirements.md`](./frontend-stability/requirements.md)
  - [`.kiro/steering/no-browser-dialogs.md`](../steering/no-browser-dialogs.md)

### ALPHA-P0-Q03：安全基线（可上线的最低门槛）

- **验收**：
  - API 限流、CORS、安全响应头默认开启
  - 外部回调（如 Stripe webhook）具备签名验证
  - 输入校验具备最小覆盖（防止明显注入/超大 payload）
- **关联 Spec**：
  - [`.kiro/specs/security-hardening/requirements.md`](./security-hardening/requirements.md)

### ALPHA-P0-Q04：可观测性基线（出事能定位）

- **验收**：
  - API/前端错误可追踪（含用户上下文、traceId）
  - 关键链路具备分布式追踪与结构化日志
  - 关键告警可在 1 分钟内送达（渠道可配置）
  - 健康检查具备 liveness/readiness 与依赖探测
- **关联 Spec**：
  - [`.kiro/specs/production-observability/requirements.md`](./production-observability/requirements.md)

### ALPHA-P0-Q05：备份与灾难恢复基线（能恢复）

- **验收**：
  - 数据库与文件存储有自动备份与保留策略，备份文件加密并校验完整性
  - 明确 RPO/RTO，并至少完成一次演练（可在预生产环境）
- **关联 Spec**：
  - [`.kiro/specs/backup-disaster-recovery/requirements.md`](./backup-disaster-recovery/requirements.md)

### ALPHA-P1-Q06：性能基线（有指标、有回归检测）

- **验收**：
  - 建立性能基线（RPS、P95/P99 延迟、LCP/CLS 等）并能检测 20% 回归
  - 至少覆盖核心接口与核心页面的性能测试/烟测
- **关联 Spec**：
  - [`.kiro/specs/performance-testing/requirements.md`](./performance-testing/requirements.md)

### ALPHA-P1-Q07：CI/CD 规则清晰（避免团队误解）

- **验收**：
  - main/tag 的部署触发规则清晰，通知包含访问链接
  - 构建/部署耗时与重试策略满足约束
  - 关键 child pipeline 的运行镜像可切换到内网镜像源，避免因 Docker Hub / 外网镜像拉取抖动导致测试环境部署失败
  - 至少 `admin / api / super-admin / platform-api` 的 test 与 gitops 链路不应依赖不可控的公共基础镜像拉取
  - post-deploy E2E 必须默认对已部署测试环境做浏览器验证，不应因为本地 `DATABASE_URL_TEST` 缺失而在验收前提前失败
- **关联 Spec**：
  - [`.kiro/specs/cicd-workflow/requirements.md`](./cicd-workflow/requirements.md)
  - [`.kiro/specs/official-extensions-go-live/requirements.md`](./official-extensions-go-live/requirements.md)

### ALPHA-P1-Q08：开源准备（阶段性对外可用）

- **验收**：
  - 开源/闭源目录边界可通过同步脚本与排除规则稳定执行
  - 文档与许可证准备到位（README/贡献指南/敏感信息清理）
  - **验收口径澄清（避免历史遗留阻断）**：
    - 本条仅对“将被同步到开源仓库的交付物”负责；不得因为闭源仓库内历史遗留文件/废弃文档而阻断开源验收
    - 文档验收仅包含：`README.md`、`CONTRIBUTING.md`、`LICENSE`（以及开源同步脚本明确要求的最小必要文档）
    - 其他 Markdown/历史文档（例如各类 `TESTING.md`、过期设计稿、临时说明）不作为 Alpha Release Gate 的阻断项；可另行进入清理 Backlog
    - 官方 Marketplace 主题与插件不属于开源同步交付物；开源仓库只保留 Core、Admin、Shop、SDK、运行时挂载点与下载/安装逻辑，不同步官方主题源码树、官方插件包内容或任何已安装扩展目录内容
- **关联 Spec**：
  - [`.kiro/specs/open-source-preparation/requirements.md`](./open-source-preparation/requirements.md)

### ALPHA-P1-Q09：双 API 架构基础（代码隔离）

- **验收**：
  - Core API (`apps/api`) 可独立运行，不依赖任何 `apps/platform-api/` 代码
  - ESLint 规则配置完成，`apps/api` 目录禁止 import `platform-api` 路径
  - CI 流程包含"开源同步后 build"步骤，引用缺失时立即报错
  - 两个服务各自拥有独立的 Prisma Schema（Core 只包含核心电商模型）
  - Core 与 Platform 使用同一 Postgres database 的不同 schema（不共享表/不跨 schema 外键）；Platform 对 Core 的依赖以**事件投影**为主（读/报表/聚合），API 用于受控命令（写操作）
- **关联 Spec**：
  - [`.kiro/specs/dual-api-architecture/requirements.md`](./dual-api-architecture/requirements.md)

### ALPHA-P1-Q10：开源核心单租户数据模型（无 tenantId）

- **验收**：
  - 开源核心（Core API）的 Prisma Schema 与迁移不包含 `tenantId` 字段/外键，也不包含 `tenants` 表。
  - 开源侧不提供 tenant 切换相关接口与流程（仅存在一个 tenant=该独立站本身）。
  - 开源范围内不允许出现 `X-Tenant-Id`（或同义）Header、`tenantId`（或同义）JWT claim、URL path/query 中的租户参数。
  - 开源同步脚本与 CI gate 能阻断任何 `tenantId`/`tenants` 回流到开源范围（发现即失败）。
  - **验收口径澄清（避免历史遗留阻断）**：
    - 本条用于 Gate 的“回流阻断”检查范围与 `ALPHA-P1-Q11` 的“纳入检查”范围一致；不对 `docs/**` 与 `tests/**` 的历史内容做阻断扫描
  - **迁移基线策略（工程口径）**：在 Core DB schema 评审完成前，不生成“初始化迁移”；评审通过后，生成一次性 baseline migration 作为发布基线，并纳入 CI gate（后续迁移必须保持开源边界与无租户约束）。
- **关联 Spec**：
  - [`.kiro/specs/open-source-preparation/requirements.md`](./open-source-preparation/requirements.md)

### ALPHA-P1-Q11：开源范围代码英文规范（禁止中文字符）

- **验收**：
  - **检查范围澄清（Alpha Gate 只卡“会交付的代码”）**：
    - 本条款的“开源范围”以开源同步脚本产出的开源仓库为准；本条只检查会随开源交付的“可执行/可编译代码与配置代码”，而不是对闭源仓库内所有历史文件做全量扫描。
    - **纳入检查（必须满足）**：
      - `apps/api/src/**`
      - `apps/admin/app/**`、`apps/admin/components/**`、`apps/admin/lib/**`
      - `apps/shop/app/**`、`apps/shop/components/**`、`apps/shop/lib/**`
      - `packages/*/src/**`
      - `scripts/**` 与 `.github/workflows/**` 中会被开源仓库保留并参与 CI/发布流程的脚本与配置
    - **不纳入本条的阻断检查（但仍建议逐步清理）**：
      - `docs/**` 与其他非交付必需的 Markdown/历史文档（例如 `TESTING.md`、过期说明）
      - `tests/**`（Alpha 阶段测试不是必交付，不因测试文件不合规阻断 Alpha Release Gate）
      - 生成产物与缓存目录（如 `dist/**`、`.next/**`、`node_modules/**`、`*.tsbuildinfo`）
  - 在上述“纳入检查”的范围内：**任何位置不得出现中文字符**（包括但不限于：注释/Docstring/JSDoc、字符串字面量、JSX 文本、日志文案、错误信息、占位文案、i18n 的 fallback 文案）。
    - 例：`getText('common.errors.componentUnavailable', 'Help Page Not Found')` ✅（fallback 为英文）
    - 例：`getText('common.errors.componentUnavailable', '帮助页面未找到')` ❌（fallback 含中文）
  - i18n 的要求：
    - UI 文案必须通过 i18n key 获取；代码中的 fallback 只能是英文（或空字符串/占位符），不得包含中文。
    - **允许中文存在于 i18n 资源文件**（如 `packages/i18n/**`、`packages/shared/src/i18n/**`、`packages/**/messages/**` 等字典/翻译资源），但这些资源文件之外的代码仍不得出现中文字符。
  - 在上述“纳入检查”的范围内：注释/Docstring/JSDoc **不得出现任何“开源/闭源/opensource/open-source/closed-source/GPL/专有/私有仓库”等概念或暗示**；注释只描述业务与技术实现，不描述授权/仓库边界。
  - PR Review 规则明确：任何新增中文字符（在纳入检查范围内）视为阻断项（blocker）。
- **关联 Spec**：
  - [`.kiro/specs/open-source-preparation/requirements.md`](./open-source-preparation/requirements.md)

---

## 4. Alpha 发布准入（Release Gate）

> 这是 Alpha “能上线”的硬门槛，建议作为发布 Checklist 使用。

### 4.1 功能 Gate

- 满足 `ALPHA-P0-F01`～`ALPHA-P0-F06`
- 关键手工验收：交易闭环 + 后台商品/订单核心操作均可稳定通过

### 4.2 质量/运维 Gate

- 前端稳定性达标（`ALPHA-P0-Q01`）
- 安全基线达标（`ALPHA-P0-Q03`）
- 可观测性达标（`ALPHA-P0-Q04`）
- 备份/恢复达标（`ALPHA-P0-Q05`）

### 4.3 架构 Gate

- Core API 独立可运行（`ALPHA-P1-Q09`）
- ESLint 代码边界检查通过
- CI 开源版 build 通过

### 4.4 明确不做 Gate

- 不引入平台运营闭环依赖（super-admin/分账/审核/提现）
- 不为未来阶段提前实现“市场交易/商业化”细节（避免早期复杂化）
- Core API 不引入任何闭源代码依赖

---

## 5. 待确认问题（已决策）

| 编号 | 问题 | 决策 | 理由 |
|------|------|------|------|
| Q1 | 支付范围（Alpha） | **Alpha 先支持 Stripe**，支付宝/微信放 Beta | Stripe 测试环境成熟，国内支付需备案 |
| Q2 | 退款范围（Alpha） | **Alpha 只做全额退款** | 部分退款复杂度高，放 Beta |
| Q3 | 发货/物流（Alpha） | **只做手动录入**（物流公司+单号+状态） | 不对接承运商、不做运费模板 |
| Q4 | 权限模型（Alpha） | **Alpha 单一店主账号** | 最小 RBAC 放 Beta（店主/员工）|
| Q5 | 税务/发票 | **Alpha 不做** | 极大拉长周期，放 GA |
| Q6 | 双 API 架构 | **Alpha 建立基础隔离** | 先做代码隔离约束，Platform API 完整功能放 Beta |

---

*最后更新: 2026-03-24*
