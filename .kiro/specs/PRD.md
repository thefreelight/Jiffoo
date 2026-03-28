# Jiffoo 产品战略概览 (Product Strategy Overview)

> **文档定位说明**：本文档是 Jiffoo 产品的**战略概览文档**，而非可执行的 PRD。它定义了产品愿景、开源/闭源边界、商业模式和仓库结构。具体功能的详细需求请参考各模块的 Spec 文档。

> **开源与闭源关系**：**闭源版（jiffoo-mall-core）是开源版（jiffoo）的超集**。闭源版包含开源版的全部运行时代码，并在此基础上增加平台管理功能（super-admin、developer-portal 等）。官方主题/插件源码由独立私有仓库 `jiffoo-extensions-official` 承载；桌面端与移动端的私有开发主仓分别是 `jiffoo-mall-desktop-private` 与 `jiffoo-mall-mobile-private`，公开的 `jiffoo-mall-desktop` / `jiffoo-mall-mobile` 作为后续 OSS sync 输出。它们共享同一套运行时契约、扩展模型与 solution package 交付模型，而不是继续依赖“所有代码都在一个仓库里”的假设。

> **可执行 PRD（Alpha）**：见 [`.kiro/specs/PRD_EXECUTABLE.md`](./PRD_EXECUTABLE.md)（定义 Alpha 范围、验收口径与 Release Gate）。
>
> **官方扩展首发（闭源专项）**：见 [`.kiro/specs/official-extensions-go-live/requirements.md`](./official-extensions-go-live/requirements.md)（定义 `esim-mall`、`yevbi`、`digital-vault`、`stripe`、`i18n`、`odoo` 的首发范围，以及 `Marketplace Control Plane + Artifact Registry + Entitlement Service + Admin Installer + Event-Activated Runtime` 的闭环）。
>
> **官方扩展源码仓库**：`jiffoo-extensions-official`（私有 GitLab 仓库）是官方主题/插件源码的权威仓库；`jiffoo-mall-core` 负责运行时、Marketplace 控制平面集成、默认 fallback 主题以及签名包构建/安装能力。若主仓库中仍保留过渡期兼容副本，它们也不应再被当作官方扩展的 source of truth。

---

## 📋 目录

1. [产品概述](#产品概述)
2. [仓库结构](#仓库结构)
3. [商业模式](#商业模式)
4. [开源版 vs 闭源版](#开源版-vs-闭源版)
5. [功能模块索引](#功能模块索引)
6. [开发路线图](#开发路线图)
7. [许可证说明](#许可证说明)

---

## 🎯 产品概述

### 两个产品

| 产品 | 仓库名 | 类型 | 说明 |
|------|--------|------|------|
| **Jiffoo** | `jiffoo` | 🟢 开源 | 完整的开源电商解决方案，GPLv2+ 许可 |
| **Jiffoo Mall Core** | `jiffoo-mall-core` | 🔴 闭源 | 包含平台管理和商业服务的完整版本 |

### 产品愿景

**Jiffoo** 是一个**开源电商解决方案**，致力于为开发者和企业提供：

- 🆓 **开源核心**：核心电商功能完全开源（GPLv2+），可商用
- 🔌 **可扩展架构**：插件系统 + 主题系统，支持社区和商业扩展
- 🛒 **完整电商能力**：商品、订单、购物车、支付、用户管理
- 🌐 **Jiffoo 市场**：通过 jiffoo.com 购买插件、主题，以及未来的平台商品与服务

### 目标用户

| 用户类型 | 需求 | 推荐方案 |
|----------|------|----------|
| 个人开发者 | 学习电商开发、构建个人项目 | Jiffoo 开源版 |
| 中小企业 | 快速搭建自有电商平台 | Jiffoo 开源版 + 插件/主题 |
| 插件/主题开发者 | 开发并销售扩展 | 在 jiffoo.com 上架作品 |
| 分销商 | 销售 Jiffoo 官方产品赚取分成 | 上架官方产品到自己的商城 |

### 竞品分析

| 特性 | Jiffoo | Shopify | WooCommerce | Medusa |
|------|--------|---------|-------------|--------|
| **开源** | ✅ GPLv2+ | ❌ 闭源 | ✅ GPL | ✅ MIT |
| **技术栈** | Node.js + React | Ruby + Liquid | PHP + WordPress | Node.js + React |
| **自托管** | ✅ 免费 | ❌ 仅 SaaS | ✅ 免费 | ✅ 免费 |
| **插件生态** | 🚧 建设中 | ✅ 成熟 | ✅ 成熟 | 🚧 建设中 |
| **TypeScript** | ✅ 全栈 | ❌ | ❌ | ✅ 后端 |
| **前后端分离** | ✅ | ❌ | ❌ | ✅ |
| **学习曲线** | 中等 | 低 | 低 | 中等 |
| **定制灵活性** | 高 | 中（受限于 Liquid） | 高（但代码混乱） | 高 |
| **中国本地化** | ✅ 优先 | ⚠️ 部分 | ⚠️ 插件 | ❌ 较弱 |

**Jiffoo 的差异化优势**：
- 🇨🇳 **中国优先**：原生支持支付宝/微信支付、中文文档、国内部署优化
- 🔌 **现代插件架构**：基于 React 组件的插件系统，比 WordPress/WooCommerce 更现代
- 🎨 **主题与扩展交付模型**：开源 Core 保留 `Theme Pack` 与高级 `Theme App` 自托管能力；闭源市场默认采用 `package-managed / service-managed` 两种交付模式，其中首发以 **签名包下载 + 后台安装 + 事件激活插件** 为主
- 💰 **开发者友好**：70% 分成（高于 Shopify 的 80/20）

### 扩展市场参考模型

Jiffoo 的长期扩展分发模型，不直接照搬某一个产品，而是组合成熟生态中的优势：

- **Atlassian / JetBrains**：市场控制平面、版本、授权、订阅
- **Grafana**：签名制品与信任链
- **WordPress**：后台浏览、安装、更新体验
- **VS Code**：轻量激活、按事件执行的扩展运行时

统一抽象为五层：

1. `Marketplace Control Plane`：管理 listing、版本、定价、发布状态、installability、entitlement
2. `Artifact Registry`：管理 signed package、artifact metadata 与下载地址
3. `Entitlement Service`：校验免费、买断、订阅访问权
4. `Admin Installer`：后台一键安装，隐藏 ZIP/包处理细节
5. `Event-Activated Runtime`：主题即时切换，插件按事件激活，不默认走独立微服务

### 市场域与结算边界（长期模型）

Jiffoo 的长期市场平台，不应把所有可售卖对象都塞进 `Extensions`。推荐的总结构是：

- `Marketplace`
  - `App Marketplace`
    - `Themes`
    - `Plugins`
    - `App Services`
  - `Goods Marketplace`
    - `Physical Goods`
    - `Digital Goods`
    - `Bundles`
  - `Merchant Store`
    - 商户自营商品目录

其中：

- `Extensions` 仅指 **Themes + Plugins**
- `Goods Marketplace` 面向实体商品、数字商品与组合包
- `Merchant Store` 是商户自己的店铺商品域，不等于平台市场

### 支付与分润角色边界（长期模型）

长期平台必须明确区分“收款方”和“分润对象”：

| 域 | 供给方 | 收款方 | 分润/结算对象 | 典型对象 |
|----|--------|--------|---------------|----------|
| `app_marketplace` | `developer` / `platform` | `platform` | `developer` | Theme / Plugin / App Service |
| `goods_marketplace` | `vendor` / `platform` | `platform` | `vendor` | 实体商品 / 数字商品 / Bundle |
| `merchant_store` | `merchant` | `merchant` | `merchant` | 商户自营商品 |

关键口径：

- `Apps` 不是“卖家生态”，而是“开发者生态”
- `Goods` 才是“卖家/供应商生态”
- `Merchant Store` 走商户自己的支付体系，不进入平台代收分润闭环

### 平台账号绑定模型（长期模型）

开源版部署后，系统应当允许“先本地独立运行，再按需接入平台能力”：

- **未绑定状态**：可继续使用本地商品、订单、支付、主题/插件离线安装等能力
- **绑定后状态**：才能访问官方 Marketplace、订阅/结算、平台分润、官方服务

推荐采用“两段式绑定”：

1. **实例绑定（Instance Binding）**
   - 把一套开源部署实例注册到 Jiffoo 平台
   - 获得 `instance_id` 与 `instance_token`
2. **店铺绑定（Tenant Binding）**
   - 把本地某个店铺/租户绑定到平台侧商户身份
   - 后续 Marketplace 购买、授权与分润都以该绑定关系为准

推荐的产品体验不是让商户离开后台去官网手工注册，而是：

- 在 Merchant Admin 内点击 `Connect Jiffoo Platform`
- 打开 **Jiffoo 托管的登录/注册弹窗**
- 通过 **Hosted Auth Popup + PKCE** 完成登录或注册
- 成功后自动回到当前安装/购买动作并继续

同时，为了兼容自部署环境无稳定公网回调地址、弹窗受限、或纯内网部署的现实，系统必须保留 **Device Flow / User Code Flow** 作为兜底路径。

本地 Admin 不应直接代理或持久化 Jiffoo 平台账号密码；账号认证表单应由平台托管。

### Admin 初始凭证与首登改密（安全口径）

开源版 Admin 可以在**首次安装 bootstrap 阶段**展示初始化管理员凭证，但这不应成为永久行为。

产品规则：

- `demo mode` 与 `bootstrap mode` 必须区分：
  - `demo mode`：公开演示环境可持续展示示例凭证
  - `bootstrap mode`：仅首次安装阶段展示初始化管理员凭证
- 登录页是否展示示例凭证，必须由后端显式状态控制，而不是由前端硬编码长期展示
- 初始化管理员在使用默认密码登录后，应被引导尽快修改密码
- 一旦初始化管理员完成改密，登录页必须停止展示示例凭证
- 主题、插件、商业包等功能不得依赖“默认密码始终公开可见”这种前提

### Merchant Admin 市场 IA（当前阶段）

当前商户后台的市场入口应遵循以下规则：

- 商户界面直接暴露 `Themes` 与 `Plugins`
- 不要求商户先进入一个泛化的 `Extensions` 页面再切 tab
- 已连接的平台状态应收敛为紧凑状态条，而不是占据首屏的大卡片
- `Plugins` 应表现为一个“插件中心”：
  - 已安装插件形成二级导航/列表
  - 点击插件可直接进入设置或管理工作区
  - 官方插件市场保留在同一页面中作为第二视图
- 官方主题/插件卡片需要具备：
  - 图标或品牌头像
  - 官方认证标记
  - 更自然的商户文案，如 `Install`、`Enable`、`Configure`、`Manage`
- 不应在商户界面暴露开发者口吻按钮，例如 `Open Admin UI`

### 默认 storefront 主题站点 archetype（长期模型）

默认 storefront 主题不应被固定成“首页只能是商品网格”的模型。

内置默认主题至少应支持以下三种 archetype：

- `storefront`
  - 以商品发现和交易为首页主轴
- `landing-commerce`
  - 先讲品牌/产品价值，再把用户导向商品与结账链路
- `product-site`
  - 首页优先承载产品介绍、安装、部署、文档、演示与 CTA，电商路径作为次级入口保留

Jiffoo 官方站点应优先使用 `product-site` 或 `landing-commerce` archetype，而不是被迫伪装成普通商店首页。

同一套默认主题基础模板还应可复用于其他 SaaS / product website，使其既能承担 landing page 角色，也能在需要时承接商品、演示包、模板包或相关电商路径。

### 开源核心版本号与更新通道（长期模型）

Jiffoo 开源核心版本应统一采用严格 semver：

- 稳定版：`MAJOR.MINOR.PATCH`
- 预发布版：`MAJOR.MINOR.PATCH-alpha.N`
- Beta：`MAJOR.MINOR.PATCH-beta.N`
- RC：`MAJOR.MINOR.PATCH-rc.N`

更新通道规则：

- `stable`：默认通道，面向绝大多数自托管用户
- `prerelease`：显式 opt-in 后可见，包含 alpha/beta/rc

升级策略：

- `patch` / `minor`：通过兼容性与环境检查时，可走一键升级主路径
- `major`：必须提示迁移风险并要求操作员明确确认

公开 update manifest 至少应包含：

- `latestStableVersion`
- `latestPrereleaseVersion`
- `channel`
- `upgradeType`
- `releaseDate`
- `changelogUrl`
- `minimumAutoUpgradableVersion`
- `requiresManualIntervention`
- checksum / signature 元数据

---

## 🏗 仓库结构

### 🟢 开源仓库：`jiffoo`

```
jiffoo/                               # 开源仓库（GPLv2+）
├── apps/
│   ├── api/                          # Core API（端口 3001）
│   │   └── src/
│   │       ├── core/                 # 所有业务模块（包含路由+服务）
│   │       │   ├── account/          # 账户模块
│   │       │   ├── admin/            # 管理模块
│   │       │   │   ├── extension-installer/  # 扩展安装器
│   │       │   │   ├── order-management/     # 订单管理
│   │       │   │   ├── plugin-management/    # 插件管理
│   │       │   │   ├── product-management/   # 商品管理
│   │       │   │   ├── system-settings/      # 系统设置
│   │       │   │   ├── theme-management/     # 主题管理
│   │       │   │   └── user-management/      # 用户管理
│   │       │   ├── auth/             # 认证模块
│   │       │   ├── cache/            # 缓存模块
│   │       │   ├── cart/             # 购物车模块
│   │       │   ├── install/          # 安装向导
│   │       │   ├── logger/           # 日志模块
│   │       │   ├── mall/             # 商城公共路由
│   │       │   ├── order/            # 订单模块（含 hooks）
│   │       │   ├── payment/          # 支付模块
│   │       │   ├── plugins/          # 插件公共路由
│   │       │   ├── product/          # 商品模块
│   │       │   ├── upgrade/          # 升级模块
│   │       │   ├── upload/           # 文件上传
│   │       │   └── user/             # 用户模块
│   │       ├── infra/                # 基础设施（无业务逻辑、无路由）
│   │       │   ├── backup/           # 备份监控
│   │       │   ├── outbox/           # 事件发布（Transactional Outbox）
│   │       │   └── queue/            # 队列服务
│   │       ├── plugins/              # Fastify 插件（限流、安全头等）
│   │       ├── config/               # 配置
│   │       ├── utils/                # 工具函数
│   │       └── types/                # 全局类型
│   ├── admin/                        # 商户管理后台（端口 3002）
│   └── shop/                         # 商城前端（端口 3003）
├── extensions/                       # 运行时扩展目录（不进 git；仅保留 .gitkeep）
│   ├── plugins/                      # 已安装插件（离线 ZIP 安装/本地开发）
│   └── themes/                       # 已安装主题（离线 ZIP 安装/本地开发）
├── packages/
│   ├── core-api-sdk/                 # Core API SDK（开源）
│   ├── create-jiffoo-app/            # 官方脚手架（开源）
│   ├── plugin-sdk/                   # 插件开发 SDK（开源）
│   ├── shared/                       # 共享类型/DTO/工具/API Client（开源）
│   ├── theme-api-sdk/                # 主题侧 Core API SDK（开源）
│   ├── ui/                           # Web UI 组件库（开源）
│   ├── i18n/                         # 国际化资源（开源；仅包含开源应用所需部分）
│   ├── installer/                    # 安装器/一键部署相关（开源）
│   └── mobile-ui/                    # 移动端 UI（可选；不属于“独立站”核心交付）
├── docs/                             # 开源文档（Markdown）
├── tests/                            # 测试集合（统一入口）
│   ├── e2e/                          # （可选）Playwright E2E（当前不作为 Alpha 必交付）
│   │   ├── core/                     # 开源可运行的端到端用例（shop/admin/api）
│   │       └── playwright.config.ts  # 开源 E2E 配置（位于 core/ 内）
│   └── performance/                  # 性能测试（k6/基线/回归检测）
├── .env.example                      # 开源仓库自带示例配置（无敏感值）
├── .gitignore
├── LICENSE                           # GPLv2+
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
└── turbo.json
```

### 🟠 官方扩展私有仓库：`jiffoo-extensions-official`

```
jiffoo-extensions-official/           # 官方扩展私有源码仓库
├── extensions/
│   └── plugins/                      # 官方插件源码（如 stripe / i18n / odoo）
├── packages/
│   └── shop-themes/                  # 官方 storefront 主题源码（如 esim-mall / yevbi / digital-vault）
├── .tools/                           # 扩展构建辅助资产
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

该仓库的职责：

- 维护官方主题与官方插件的**源码权威版本**
- 承担官方扩展的日常开发、评审与版本演进
- 为 `jiffoo-mall-core` 的 Artifact Registry / package-managed 交付提供源码输入

该仓库**不**承担：

- `api / shop / admin / platform-api / super-admin / developer-portal` 等运行时宿主
- 开源默认 fallback 主题 `packages/shop-themes/default`
- Marketplace 控制平面或自托管运行时逻辑

#### 推荐开发工作流（官方扩展）

为了避免官方主题/插件在两个私有仓库里“双写”导致漂移，推荐采用：

- **一个开发视图，两个仓库，单一写入源**
- `jiffoo-extensions-official`：官方主题/插件源码唯一可写仓库
- `jiffoo-mall-core`：运行时宿主、Marketplace 控制平面集成、Artifact Registry/Installer、默认 fallback 主题

具体执行规则：

- 本地开发时，两个私有仓库应并排放在同一个**组合工作区（composite workspace）**中，以获得接近 monorepo 的联调体验
- 官方主题/插件的日常 authoring、评审、版本演进只允许发生在 `jiffoo-extensions-official`
- `jiffoo-mall-core` 只能消费官方扩展源码（通过版本锁定、workspace link、submodule、CI 拉取或构建输入），不应继续作为官方扩展的手工编辑入口
- **不推荐**“先在 `jiffoo-mall-core` 里改，再手动同步到 `jiffoo-extensions-official`”的流程；这种双写模式最容易造成 CI、部署、源码与文档状态不一致
- 若迁移期仍保留兼容副本，这些副本应被视为只读镜像或构建输入，而不是新的 source of truth

#### 运行时扩展（离线 ZIP）口径（开源 Alpha）

为确保开源版在不引入“在线市场交易闭环”的前提下，仍具备可用的扩展能力，Alpha 阶段对 `extensions/` 的定义如下（闭源版可在此基础上扩展平台化能力，但开源口径不变）：

- `extensions/` 为**运行时目录**（不进 git；部署时挂载 volume；仓库仅保留 `.gitkeep`）。
- **Theme（主题）**：
  - **同时支持两种主题类型（同一套安装/启用/回滚体验）**：
    - **Theme Pack（L3.5 / 安全资源包）**：面向可运营与可商用的长期主路径（对齐 Shopify/BigCommerce 的 theme pack 思路）。
      - 适用于 **两个前端目标**：`shop` 与 `admin`（同一套安装/启用/回滚体验；仅 target 不同）。
      - ZIP **仅包含配置文件与静态资源**（如 `theme.json`、图片、字体、CSS 变量/Token、布局/区块 JSON 等）。
      - **不得包含可执行的 JS/TS**（包括 React/Next 可执行代码）；主题渲染由内置 `theme-runtime` 完成，避免引入前端运行任意脚本的安全风险。
      - **重要原则**：Theme Pack 只能影响“外观与布局”（样式、间距、排版、区块组合/顺序、静态资源），不得引入任何业务逻辑与后端能力。
    - **Theme App（L4 / 可执行 storefront）**：面向“最高自由度自定义”的高级模式，允许主题覆盖核心路由并新增页面（如 blog/landing 等）。
      - ZIP **必须包含可直接运行的构建产物**（例如 Next.js `output: 'standalone'` 的 server bundle + static/public），平台安装后可启动独立 Node 进程作为该主题的 storefront server。
      - 启用 Theme App 后，由 `shop/admin` 侧网关/路由层将用户请求转发到当前激活的主题 server，实现“安装即用/切换即生效”（无需重启 Core API、无需重新构建主前端）。
      - Theme App 的业务数据对接通过 Core API（以及 shared 包内的类型/Client/SDK）完成；可选支持“bundle ZIP”（主题 ZIP 内携带所需业务插件 ZIP）以实现“上传一个包即全可用”。
      - **风险提示**：Theme App 属于可执行代码扩展，适合自托管与高自由度场景；闭源商业化默认不以 Theme App 作为市场首发主路径，而以 `package-managed` 主题交付为主，仅在受控/白名单场景开放 Theme App。
  - 用户在 `apps/admin` 上传主题 ZIP 后，应可在“已安装主题”中看到并一键启用/回滚；启用后用户刷新目标前端（`apps/shop` 或 `apps/admin`）即可感知生效（无需重启服务、无需重新构建前端）。
  - **开源 Alpha 明确口径**：
    - 开源 Alpha 只支持单店（Single Store / Single-Tenant）。
    - 回滚语义固定为“回滚到上一个主题”（不承诺“任意历史版本回滚”）。
    - 版本字段（`theme.json.version` 或 Theme App manifest 的 `version`）使用严格 semver，用于升级判定与运行时缓存失效（具体规范以相关 Spec 为准）。
  - **对前端工程的要求（不等于“全部重写”）**：
    - Theme Pack：两个前端都需要清晰的 `theme-runtime` 集成层，负责读取“当前激活主题”的配置、加载主题静态资源（CSS/图片/JSON），并把配置注入到 UI。
    - Theme Pack：两个前端都需要一个“可主题化的 UI 合约”（可理解为 Block/Slot Registry）：由内置 React 组件实现，但对 Theme Pack 暴露的是稳定的 ID + JSON settings（Theme Pack 只能选择/排列/配置，不能写逻辑）。
    - 默认主题不应只交付“商店橱窗”一种首页风格；内置主题应至少支持 `storefront / landing-commerce / product-site` 三种站点 archetype，使同一套基础模板既可服务普通商家，也可服务 SaaS/产品官网。
    - Theme App：`shop` 与 `admin` 都需要一个“主题路由层/网关”，用于把请求转发到当前激活的主题 server，并提供失败回退与回滚路径。
- **Plugin（插件）**：
  - Alpha 阶段仅要求“离线 ZIP 安装 + 启用/禁用 + 配置生效 + 安装后立刻可用”的最小闭环；不交付“在线市场交易闭环”（上架/购买/审核/分账/提现）。
  - **开源实现口径（当前仓库代码为准）**：开源 Core 同时支持两种插件运行模式（`manifest.json.runtimeType`）：
    - `internal-fastify`：插件 ZIP 内包含可执行 JS（Fastify plugin），平台在运行期为该插件创建**独立 Fastify 实例**并通过网关转发请求（避免往主 Fastify 实例热注册导致的限制）；安装并启用后即可立刻访问插件 API（无需重启）。
    - `external-http`：插件声明 `externalBaseUrl`，平台通过网关转发请求到外部服务；安装并启用后即可立刻访问插件 API（无需重启）。
  - **闭源市场默认交付模型**：优先采用 `package-managed` 插件，并以 **事件激活（Event-Activated Runtime）** 作为默认运行模型；`service-managed` 仅保留给少数真正需要独立伸缩或隔离的重型扩展。
  - **统一访问前缀（网关）**：`/api/extensions/plugin/{slug}/api/*`
  - **权限声明与受控能力 API（产品口径，v1 最小）**：
    - 插件在 `manifest.json.permissions` 声明所需权限；安装/启用时形成该实例最终授权集合（开源可默认授予，闭源必须显式授权）。
    - 第三方插件不得直连 Core 主库、不得获得 Core 内部服务地址；与核心数据交互只能通过平台提供的受控能力接口（Core API/Platform API），并使用实例级身份鉴权（可撤销）。
    - 插件自有数据应使用独立数据库/schema/账号，仅授权其自身表结构（闭源平台化强约束；开源自托管强烈推荐）。
  - **多实例（高度自由化）**：同一插件允许多个安装实例（`installationId` 为“插件实例唯一标识”，默认实例 `instanceKey=default`）。
  - **实例选择（v1）**：通过网关 query 选择实例：`?installation=default` 或 `?installationId=...`（未提供则默认 `default`）。
  - **启用/禁用语义（开源 Alpha）**：
    - 禁用：立刻不可访问（网关软拦截，返回 404），无需卸载文件。
    - 卸载：开源 Alpha 采用“伪卸载”——从管理界面列表隐藏并禁用，立刻不可访问；文件可保留在磁盘（不承诺物理删除）。物理删除属于可选的 `purge`（运维/高级操作），不作为 v1 默认语义。
  - **升级语义（开源 Alpha）**：必须支持热升级（无需重启 Core API）。切换必须遵循“先 warm 新 runtime、成功后再切换”；若新版本加载/初始化失败，必须回退到升级前的旧版本并保持可用。
  - **Header 防伪造（v1 最小）**：网关不得信任来自客户端的 `x-plugin-*`、`x-installation-*`、`x-user-*`、`x-platform-*`、`x-caller` 等上下文 Header，必须剥离并由平台侧覆盖注入。
  - **管理 API 入口（v1）**：插件安装/列表/实例管理等管理能力统一在 `/api/extensions/*` 下提供（不维护 `/api/admin/plugins/*` 作为对外契约）。
  - 开源 Core 不允许引入平台化商业逻辑（许可证/订阅/分销/结算等）；这类能力属于闭源平台模块。

#### 官方主题/插件与仓库边界

- 开源仓库 `jiffoo` 不包含官方 Marketplace 主题与插件的源码树或安装包内容。
- `jiffoo-extensions-official` 是官方主题（例如 `esim-mall`、`yevbi`、`digital-vault`）与官方插件（例如 `stripe`、`i18n`、`odoo`）的**源码权威仓库**。
- `jiffoo-mall-core` 负责：
  - 官方 Marketplace 浏览/连接入口
  - 后台下载、断点续传、验签、安装能力
  - 运行时挂载点与激活逻辑
  - 默认 fallback 主题 `packages/shop-themes/default`
- 若 `jiffoo-mall-core` 中仍保留官方主题/插件源码副本，那些目录仅视为**过渡期兼容副本**；官方扩展的日常 authoring/change review 以 `jiffoo-extensions-official` 为准。
- 部署开源版后，商户需要在 Admin 中连接 Jiffoo Platform，才能下载安装官方主题和插件。

#### Core API 目录职责说明

| 目录 | 职责 | 特点 |
|------|------|------|
| `core/` | 业务模块 | 有路由、有业务逻辑、直接服务用户 |
| `infra/` | 基础设施 | 无路由、无业务逻辑、被业务模块调用 |

**infra/ 包含的"基础设施服务"**：
- **Outbox**：事件发布机制（Transactional Outbox 模式，含 `outbox.service.ts` 写入 + `outbox-worker.service.ts` 分发）
- **Queue**：队列抽象
- **Backup**：备份监控

这些是跨业务模块的通用能力，不属于任何特定业务。

> **说明**：闭源平台运营能力（如 `apps/platform-api`、`apps/super-admin`、`apps/developer-portal`、`apps/docs`）不会进入开源仓库，且必须被开源同步脚本排除。
>
> **同步策略（模式A）**：开源仓库是独立仓库，拥有自己的 git 历史；私有仓库通过“历史过滤同步”（如 `git filter-repo`）将开源范围代码与历史推送到开源仓库，确保开源侧可长期独立演进与承接 PR。

#### 开源核心定位与硬约束（独立站 / 单租户）

开源仓库定位为**标准单店独立站（Single Store / Single-Tenant）**：一套系统服务一个商户/一个店铺（或一个品牌站点）。为避免历史遗留造成架构歧义，开源仓库遵守以下硬约束：

- **单租户语义**：开源侧的 `tenant` 表示“该独立站本身”（等价于 store/site），系统运行时只存在一个 tenant，不提供 tenant 切换流程。
- **核心数据模型无 `tenantId`**：开源核心（Core API）数据模型不包含 `tenantId` 字段/外键，也不包含 `tenants` 表；站点/tenant 身份为隐式单例。
- **禁止“多租户”工程表征**：开源范围内禁止出现 `X-Tenant-Id`（或同义）Header、`tenantId`（或同义）JWT claim、URL path/query 中的租户参数；禁止任何以租户为维度的数据隔离设计。
- **目录与服务边界清晰**：平台运营能力（Platform API / Super Admin / Developer Portal 等）不进入开源仓库，且必须被开源同步脚本严格排除。
- **代码注释语言规范（开源范围）**：开源范围内的代码注释/Docstring/JSDoc 统一使用英文；中文注释视为缺陷，需要在开源发布前清理完毕（用户界面文案与 i18n 资源不受此限制）。同时，注释不得出现任何“开源/闭源/opensource/open-source/closed-source/GPL/专有/私有仓库”等概念或暗示，避免强化仓库边界联想。

### 🔴 闭源仓库：`jiffoo-mall-core`

```
jiffoo-mall-core/                     # 闭源仓库（专有许可）
├── .kiro/                            # 内部 Specs/流程（不进入开源）
├── .github/                          # GitHub 配置（若使用）
├── .gitlab/                          # GitLab 配置（若使用）
├── .buildkite/                       # CI（若使用）
├── apps/
│   ├── api/                          # Core API（端口 3001）- 开源核心
│   ├── admin/                        # 商户管理后台（端口 3002）
│   ├── shop/                         # 商城前端（端口 3003）
│   ├── platform-api/                 # Platform API（端口 3011）🔒 - 平台运营后端（原 commercial 能力内聚于此）
│   ├── super-admin/                  # 超级管理后台（端口 3012）🔒（复用 shared/ui 等开源核心）
│   ├── developer-portal/             # 开发者门户（端口 3013）🔒
│   └── docs/                         # 文档站点（端口 3014）🔒（Next.js）
├── extensions/                       # 运行时扩展目录（不进 git；仅保留 .gitkeep）
│   ├── plugins/                      # 已安装插件（离线 ZIP 安装/本地开发）
│   └── themes/                       # 已安装主题（离线 ZIP 安装/本地开发）
├── packages/
│   ├── core-api-sdk/                 # Core API SDK（供前端/工具/插件调用）
│   ├── create-jiffoo-app/            # 官方脚手架
│   ├── i18n/                         # 国际化能力（如仍需要）
│   ├── installer/                    # 安装器（如仍需要）
│   ├── mobile-ui/                    # 移动端 UI（如仍需要）
│   ├── plugin-sdk/                   # 插件 SDK（对外）
│   ├── shared/                       # 共享类型/DTO/工具
│   ├── shop-themes/                  # fallback 默认主题 + 过渡期兼容副本（官方扩展源码权威仓库不是这里）
│   ├── theme-api-sdk/                # 主题侧 Core API SDK（对外）
│   └── ui/                           # Web UI 组件库
├── deploy/                           # 部署工件（Helm/K8s/监控/面板）
├── docs/                             # 仓库级 Markdown 文档中心（不等于 apps/docs）
├── ops/                              # CI 模板与运维脚本
├── scripts/                          # 仓库脚本（开源同步方案为 pending）
├── tests/                            # 测试集合（闭源全量）
│   ├── e2e/
│   │   ├── core/                     # 开源子集用例（将被同步到开源仓库）
│   │   ├── private/                  # 闭源专用用例（super-admin/platform-api/developer-portal/docs）
│   │   │   └── playwright.config.ts  # 开源子集配置（与开源仓库一致）
│   │   │
│   │   └── private/
│   │       └── playwright.config.ts  # 闭源 E2E 配置（不同步到开源）
│   └── performance/                   # 性能测试（闭源可扩展）
├── .env.example                      # 闭源仓库自带示例配置（无敏感值）
├── .env.production                   # 闭源生产环境示例（敏感值需另行管理）
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── docker-compose.prod.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
└── turbo.json
```

`jiffoo-mall-core` 的仓库职责是“平台宿主 + 自托管运行时 + Marketplace 集成”，而不是官方扩展源码的长期 authoring 仓库。官方主题/插件的权威开发边界应收敛到 `jiffoo-extensions-official`；主仓库内如仍存在兼容副本，只应作为过渡期构建/运行时镜像，不应继续承担手工双写开发。

推荐的团队默认原则：

- 保留接近 monorepo 的联调体验
- 保持**单一写入源**
- 运行时仓库消费官方扩展时优先走**版本锁定 / 明确引用**
- 不采用“先在 `jiffoo-mall-core` 改，再手动同步到 `jiffoo-extensions-official`”的日常流程

### 🔀 双 API 服务架构

> **设计原则**：闭源版运行两个独立的 API 服务，确保开源/闭源代码物理隔离，防止代码互引。

#### 架构核心约束

| 约束 | 说明 |
|------|------|
| **单向依赖** | Platform API → Core API（闭源可依赖开源，开源绝不依赖闭源） |
| **独立 Schema** | 两个服务各自拥有独立的 Prisma Schema，避免数据模型强耦合 |
| **单库多 Schema（强隔离）** | 使用同一 Postgres 实例与同一 database，通过不同 schema 隔离（不共享表/不跨 schema 外键）；Platform 获取核心数据以**事件投影**为主（查询走 platform 投影表），写入型操作通过 Core API 的受控命令接口完成 |
| **独立进程** | 两个服务独立启动/停止/部署，开源版只运行 Core API |
| **硬约束检查** | ESLint + CI 双重保障，防止意外的跨边界引用 |

```
┌─────────────────────────────────────────────────────────────────┐
│                    双 API 服务架构                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Nginx / 网关                          │   │
│  │  /api/*     → Core API:3001                             │   │
│  │  /platform/* → Platform API:3011                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│           ┌─────────────┴─────────────┐                        │
│           ▼                           ▼                        │
│  ┌─────────────────┐        ┌─────────────────┐                │
│  │   Core API      │        │  Platform API   │                │
│  │   (apps/api)    │◄────HTTP Commands───────│(apps/platform-api)│
│  │   端口: 3001    │     (Service JWT)       │   端口: 3011    │
│  │   🟢 开源       │────Events/Projection────►   🔒 闭源      │
│  ├─────────────────┤     (Bull Queue)        ├─────────────────┤
│  │ • 商品管理      │        │ • 开发者管理    │                │
│  │ • 订单管理      │        │ • 提交审核      │                │
│  │ • 购物车        │        │ • 扩展注册中心  │                │
│  │ • 用户/认证     │        │ • 平台安全      │                │
│  │ • 支付集成      │        │ • 收入分成      │                │
│  │ • 插件管理      │        │ • 许可证管理    │                │
│  │ • 文件上传      │        │ • 市场服务      │                │
│  │ • 缓存服务      │        │ • 分销系统      │                │
│  │ • 安装/升级     │        │ • 平台分析      │                │
│  └────────┬────────┘        └────────┬────────┘                │
│           │                          │                         │
│           │ 独立 Prisma Schema       │ 独立 Prisma Schema      │
│           ▼                          ▼                         │
│  ┌─────────────────┐        ┌─────────────────┐                │
│  │   Postgres       │        │   Postgres       │                │
│  │ (single database)│        │ (single database)│                │
│  └─────────────────┘        └─────────────────┘                │
│           ▲                          ▲                          │
│           │                          │                          │
│   Core 仅访问 public schema    Platform 仅访问 platform schema   │
└─────────────────────────────────────────────────────────────────┘
```

#### 服务对比

| 特性 | Core API | Platform API |
|------|----------|--------------|
| 目录 | `apps/api` | `apps/platform-api` |
| 端口 | 3001 | 3011 |
| 开源状态 | 🟢 开源 | 🔒 闭源 |
| Prisma Schema | `apps/api/prisma/schema.prisma` | `apps/platform-api/prisma/schema.prisma` |
| 数据库存储 | 同一 Postgres database 的 `public` schema | 同一 Postgres database 的 `platform` schema |
| 依赖方向 | 被调用方（不依赖任何闭源代码） | 调用方（单向依赖 Core） |
| 平台交互方式 | 不提供平台专用“后门”路由 | 读：消费 Core 投影事件并查询 platform 投影表；写：通过 HTTP 调用 Core 受控命令接口（Service JWT） |
| 迁移顺序 | 独立执行（互不依赖） | 独立执行（互不依赖） |

#### 数据库隔离策略

> **核心原则**：Core 只包含开源模型，Platform 只包含闭源模型；两者使用同一 Postgres database 的不同 schema，不共享表结构，也不做跨 schema 外键。

```
┌─────────────────────────────────────────────────────────────────┐
│                    数据库模型隔离                                │
│                                                                 │
│  Public Schema (apps/api/prisma/schema.prisma)                 │
│  ├── User          # 用户（核心）                               │
│  ├── Product       # 商品                                       │
│  ├── Order         # 订单                                       │
│  ├── Cart          # 购物车                                     │
│  ├── Payment       # 支付记录                                   │
│  ├── PluginInstall # 插件安装元数据（安装阶段不执行；运行时可能执行）│
│  └── ThemeInstall  # 主题安装元数据（不执行主题代码）            │
│                                                                 │
│  Platform Schema (apps/platform-api/prisma/schema.prisma)      │
│  ├── platform_Developer     # 开发者账号（引用 coreUserId）      │
│  ├── platform_Submission    # 提交审核                          │
│  ├── platform_License       # 许可证                            │
│  ├── platform_Revenue       # 收入分成                          │
│  ├── platform_Distribution  # 分销记录                          │
│  └── platform_Analytics     # 平台分析数据                      │
│                                                                 │
│  关联方式：                                                      │
│  platform_Developer.coreUserId → Core User.id（应用层引用）      │
└─────────────────────────────────────────────────────────────────┘
```

**数据访问规则**：
- Platform 的查询/报表/聚合：以**事件投影**为主（Core → 队列/事件 → Platform 写入投影表，平台读投影表）
- Platform 的写入型操作（改变核心业务状态）：通过 HTTP 调用 Core 的受控命令接口（Service JWT），避免绕过 Core 业务规则
- Core API **绝不**访问 Platform schema（建议使用独立的 DB role/权限隔离进一步兜底）

#### 代码隔离约束（硬约束）

```
┌─────────────────────────────────────────────────────────────────┐
│                    代码隔离硬约束                                │
│                                                                 │
│  1. ESLint 规则（开发时拦截）                                    │
│     ├── apps/api/** 禁止 import apps/platform-api/**           │
│     └── packages/shared/** 禁止 import 任何 apps/** 代码        │
│                                                                 │
│  2. TypeScript paths 限制                                       │
│     └── Core 的 tsconfig.json 不配置 platform-api 的 paths     │
│                                                                 │
│  3. CI 验证（合并时拦截）                                        │
│     ├── 采用“模式A：历史过滤同步”（git filter-repo 等），生成开源版代码并推送到开源仓库 │
│     ├── 对开源版代码执行 build + test                           │
│     ├── 如果有引用缺失（闭源代码被引用），立即报错               │
│     └── 阻止合并，直到修复违规引用                               │
│                                                                 │
│  4. Pre-commit Hook（本地提交前检查）                            │
│     └── 快速检查是否有明显的跨边界 import                        │
└─────────────────────────────────────────────────────────────────┘
```

#### 部署模式

| 部署模式 | Core API | Platform API | 适用场景 |
|----------|:--------:|:------------:|----------|
| **开源版** | ✅ 运行 | ❌ 不部署 | 自托管用户、开源社区 |
| **闭源版** | ✅ 运行 | ✅ 运行 | Jiffoo 官方平台运营 |

**开源版独立运行**：
```bash
# 开源版只需启动 Core API
pnpm --filter api dev    # 启动 Core API (端口 3001)
```

**闭源版双服务运行**：
```text
闭源版部署时通过 Ingress/Nginx 暴露单域名多 path（示例路由）：
- /api/*         → Core API:3001
- /platform/*    → Platform API:3011
- /admin/*       → Admin:3002
- /shop/*        → Shop:3003
- /super-admin/* → Super-Admin:3012
- /developer/*   → Developer Portal:3013
- /docs/*        → Docs:3014
```

### 📱 独立仓库（客户端应用）

| 仓库 | 说明 | 技术栈 | 开源状态 |
|------|------|--------|:--------:|
| `jiffoo-mall-mobile-private` | 移动端商城 App / Companion Surface（私有开发主仓） | React Native + Expo | 🔴 私有 |
| `jiffoo-mall-desktop-private` | 桌面端应用（私有开发主仓） | Electron + Vite | 🔴 私有 |
| `jiffoo-mall-mobile` | 移动端开源同步仓库 | React Native + Expo | 🟢 开源 |
| `jiffoo-mall-desktop` | 桌面端开源同步仓库 | Electron + Vite | 🟢 开源 |

> 移动端和桌面端因不适合继续塞在同一个运行时 Monorepo 中，已移至独立仓库。
> 日常开发以私有开发主仓为准，公开仓库只作为后续开源同步输出。
> 推荐本地开发布局固定为同级组合工作区，例如：
> `/Users/jordan/Projects/jiffoo-mall-core`
> `/Users/jordan/Projects/jiffoo-extensions-official`
> `/Users/jordan/Projects/jiffoo-mall-desktop`
> `/Users/jordan/Projects/jiffoo-mall-mobile`
> 它们共享 API/SDK、主题/插件契约与 solution package 元数据，但**不再假定复用同一份 Web 页面实现**。

```
┌─────────────────────────────────────────────────────────────────┐
│                    客户端应用架构                                │
│                                                                 │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │ jiffoo-mall-mobile│     │jiffoo-mall-desktop│                 │
│  │  (React Native)  │     │    (Electron)    │                  │
│  └────────┬─────────┘     └────────┬─────────┘                  │
│           │                        │                            │
│           └──────────┬─────────────┘                            │
│                      │ 共享 SDK / Schema / Theme Tokens         │
│                      │ Plugin Capability / Solution Package     │
│                      ▼                                          │
│           ┌──────────────────┐                                  │
│           │ jiffoo / core    │                                  │
│           │ runtime contracts│                                  │
│           └──────────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 🌐 Web / Desktop / Mobile 复用模型

Jiffoo 的多端复用目标不是“同一份页面代码跑三端”，而是：

- **共享 contract**
- **分开 renderer**
- **宿主各自负责体验**

| 层 | Web | Desktop | Mobile | 复用策略 |
|----|-----|---------|--------|----------|
| Shared Contract Layer | `shop/admin` 共享 DTO/SDK/schema | 共享 DTO/SDK/schema | 共享 DTO/SDK/schema | 强复用 |
| Theme Layer | `Theme Pack` + optional `shop-web` / `admin-web` adapter | `Theme Pack` + optional `desktop-web` adapter | `Theme Pack` + optional `shop-native` / `mobile-native` adapter | 主路径复用 tokens/schema/assets，不强求同页源码 |
| Plugin Layer | capability + `admin-web` surface | capability + `desktop-web` surface，可选更强可执行能力 | capability + companion/lite native surface，默认声明式 | 复用 capability contract，表面可分化 |
| Host Layer | `jiffoo` / `jiffoo-mall-core` | `jiffoo-mall-desktop-private` | `jiffoo-mall-mobile-private` | 不复用宿主 |

明确口径：

- **Web**：继续承载 `shop-web`、`admin-web` 等完整浏览器 surface
- **Desktop**：优先采用 Electron + `desktop-web` / `shop-web` 的 Web-heavy 模型，同时保留桌面能力桥接；可支持更接近 Web 的主题/插件安装体验
- **Mobile**：优先采用 React Native / Expo 的 native-first 模型，不直接执行 Web DOM 主题页面；默认走声明式主题/插件路径

### 🧭 Admin 作为统一扩展控制面

Jiffoo 不应让 Web、Desktop、Mobile 各自维护独立的主题/插件配置系统。

统一规则是：

- `Admin` 是统一扩展控制面
- 客户端不自己当配置源
- 三端共享同一套产品形态结果

`Admin` 负责：

- 安装主题
- 安装插件
- 切换 `active theme`
- 启用/停用插件
- 下发 `solution package`
- 下发 feature / capability flags

### 🪞 Runtime Snapshot

后端应向所有端暴露统一的产品形态快照，而不是让每个客户端自己拼状态：

```ts
type RuntimeSnapshot = {
  store: StoreContext
  solution: SolutionPackage
  theme: ActiveTheme
  plugins: EnabledPlugin[]
  branding: BrandingProfile
  surfaces: {
    web: SurfaceProfile
    desktop: SurfaceProfile
    mobile: SurfaceProfile
  }
}
```

这意味着三端的一致性来源于：

- 统一的 `RuntimeSnapshot`
- 统一的 `Theme Pack`
- 统一的 `Plugin Capability` 语义
- 各端自己的 renderer / host

### 🤖 Solution Package 模型

为适应 AI 时代下快速生成新应用、快速上线新行业方案的目标，Jiffoo 需要一个比“主题 + 插件 + 手工拼装页面”更高一层的组合单元：

- `solution package`

一个 solution package 至少组合：

- `brand profile`
- `theme selection`
- `plugin bundle`
- `surface profiles`
- `environment preset`
- `support / operations metadata`

它的作用不是替代主题或插件，而是把“一个可上线的方案”从零散 repo 与页面，提升成可版本化、可复用、可被 AI 生成的组合模型。

详细约束与设计见：

- [`.kiro/specs/multi-surface-solution-architecture/requirements.md`](./multi-surface-solution-architecture/requirements.md)
- [`.kiro/specs/multi-surface-solution-architecture/design.md`](./multi-surface-solution-architecture/design.md)

---

## 💰 商业模式

### 三大盈利方式

```
┌─────────────────────────────────────────────────────────────────┐
│  💰 盈利方式一：插件销售                                          │
│  ├── 第三方开发者在 jiffoo.com 上架插件                          │
│  ├── 开源商城用户购买插件                                        │
│  ├── 定价模式：免费试用 → 订阅制 / 一次性买断                     │
│  └── Jiffoo 平台抽成                                             │
├─────────────────────────────────────────────────────────────────┤
│  🎨 盈利方式二：主题销售                                          │
│  ├── 第三方开发者在 jiffoo.com 上架主题                          │
│  ├── 开源商城用户购买主题                                        │
│  ├── 定价模式：免费试用 → 订阅制 / 一次性买断                     │
│  └── Jiffoo 平台抽成                                             │
├─────────────────────────────────────────────────────────────────┤
│  🛍 盈利方式三：平台商品市场（未来）                              │
│  ├── 官方或第三方卖家在平台商品市场上架实体/数字商品              │
│  ├── 平台统一收款并按规则向 vendor 分润                          │
│  ├── 商户可把平台商品导入/分销到自己的店铺                        │
│  └── 商户自营商品仍走商户自己的支付体系                          │
├─────────────────────────────────────────────────────────────────┤
│  ☁️ 盈利方式四：托管 SaaS 服务（未来）                            │
│  ├── 类似 WordPress 托管服务（如 WordPress.com）                 │
│  ├── 用户在线开通 Jiffoo Shop，无需自己部署                      │
│  ├── 用户仍可查看和修改源码（与 Shopify 不同）                   │
│  ├── 按月/年收取托管费用                                         │
│  └── 提供自动备份、SSL、CDN 等增值服务                           │
└─────────────────────────────────────────────────────────────────┘
```

### 🧭 市场控制平面与后台安装

> **目标模型**：用户部署开源/自托管版本后，可以在 Admin 后台直接浏览官方或第三方扩展，完成购买、订阅、安装、启用与更新；底层由平台控制平面、制品仓库、授权服务和后台安装器协同完成。

```
┌─────────────────────────────────────────────────────────────────┐
│                Marketplace Control Plane                        │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ Listing/版本 │   │ Pricing/授权 │   │ Publish/审核状态 │    │
│  └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘    │
│         └──────────────────┴────────────────────┘              │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Artifact Registry                                        │   │
│  │ - signed package                                         │   │
│  │ - package metadata / checksum / signature                │   │
│  │ - future service deployment descriptor                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Admin Installer                                         │   │
│  │ - entitlement 校验                                      │   │
│  │ - compatibility 校验                                    │   │
│  │ - 后台下载/断点续传/验签/安装                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**统一交付模式**：

| 模式 | 说明 | 当前定位 |
|------|------|----------|
| `package-managed` | 扩展以签名包形式分发，Admin Installer 后台下载、断点续传、验签和安装 | 当前官方/第三方主路径 |
| `service-managed` | 扩展带独立服务描述或镜像引用 | 后续高级路径，不作为当前默认 |

**长期交易域模型**：

| 交易域 | 说明 | 是否属于 `Extensions` |
|--------|------|----------------------|
| `app_marketplace` | 主题、插件、扩展服务 | 是 |
| `goods_marketplace` | 实体商品、数字商品、组合包 | 否 |
| `merchant_store` | 商户自营商品 | 否 |

**统一运行模型**：

| 对象 | 推荐运行方式 | 说明 |
|------|--------------|------|
| 主题 | 即时切换 | 切换 `active_theme`，不引入“启动主题”概念 |
| 插件 | 事件激活 | 安装后注册能力，按支付、Admin 页面、hook、webhook、job 等事件触发 |
| 重型扩展 | 服务化运行 | 仅给少数确实需要独立伸缩/隔离的扩展 |

**与成熟生态对标**：

| 参考对象 | 可借鉴部分 |
|----------|------------|
| WordPress | 浏览、安装、更新体验 |
| VS Code | 轻量激活、主题切换、按事件执行 |
| Atlassian / JetBrains | 授权、订阅、版本、付费控制平面 |
| Grafana | 签名制品、信任链、管理员控制 |

### 账户、收款与结算归属

> **商业闭环的基本原则**：不是所有可售卖对象都归同一个“seller”模型。开发者、卖家、商户必须区分。

| 交易域 | 供给方角色 | 平台是否代收 | 结算对象 | 备注 |
|--------|------------|--------------|----------|------|
| `app_marketplace` | `developer` / `platform` | 是 | `developer` | 主题/插件分润给开发者，不给卖家 |
| `goods_marketplace` | `vendor` / `platform` | 是 | `vendor` | 实体/数字商品分润给卖家/供应商 |
| `merchant_store` | `merchant` | 否 | `merchant` | 走商户自己的支付账号 |

推荐长期字段：

- `listing_domain`
- `listing_kind`
- `provider_type`
- `provider_id`
- `payment_mode`
- `settlement_target_type`
- `settlement_target_id`
- `installation_required`
- `activation_required`
- `inventory_required`
- `fulfillment_required`

### 平台账号接入与 Marketplace 使用前提

> **产品口径**：不是“安装开源版就强制注册 Jiffoo 官网账号”，而是“想使用 Jiffoo 平台能力时，必须绑定平台账号”。

建议行为：

1. 用户部署开源版后，可先完成本地初始化并独立运行
2. 当用户进入 `Marketplace / Billing / Settlement / 官方服务` 时，提示连接 `Jiffoo Platform Account`
3. 默认体验是在 Admin 内打开 Jiffoo 托管登录/注册弹窗，完成 `instance binding`
4. 如弹窗模式不可用，则自动回退到 `Device Flow / User Code Flow`
5. 完成实例绑定后，系统获得访问平台 Marketplace 的机器凭证
6. 完成店铺绑定后，Marketplace 购买、安装授权、结算身份全部可追踪

因此，长期商业模型应同时存在三层身份：

- `Platform Account`
- `Local Instance`
- `Local Tenant / Store`

且三者关系由平台侧的 `instance_registration`、`tenant_binding`、`entitlement`、`settlement_account` 等模型承载。

### 商业包激活与 Managed Mode

> **核心结论**：所有主题与插件始终是公共资产；客户购买的是“Commercial Package”，不是私有源码；开源版默认先以普通 `Jiffoo` 体验运行，只有输入 Super Admin 下发的授权码后，实例才进入 Managed Mode 并把 package 中已包含的公共资产投影为该客户的专属交付视图。

- **Public Assets + Package Projection**：Super Admin 在平台控制平面创建 `Commercial Package`，从公共 Marketplace 资产中勾选要包含的主题与插件，并填写 `display_brand_name`、`display_solution_name`、默认主题、支持信息与 activation code。资产本体不变，变化的是该客户实例的 entitlement 投影。
- **Managed Mode UX**：激活后，Merchant Admin / Shop 不再把 `Marketplace` 当主入口，而是切换到 `Your Package` 视图，只显示 package 内授权的主题、插件与方案文案；公开价格、购买 CTA、默认的 `Jiffoo Marketplace` 入口和品牌推广语全部隐藏。界面标题、登录口号、支持文案等统一使用 Super Admin 下发的品牌名与方案名。
- **Activation Default Theme Autopilot**：若 `Commercial Package` 配置了默认 storefront 主题，Merchant Admin 输入授权码后应自动完成该主题的官方包恢复/安装与激活，不要求商户再进入 `Themes` 页面手动执行 `Install` / `Activate`。
- **Storefront Propagation**：输入授权码、安装官方主题、切换当前主题后，下一次新的 storefront 请求必须立即读到最新 `store context` 与激活主题；不允许因为 SSR/应用层小时级缓存而继续渲染旧主题或旧品牌。
- **Included Assets Lifecycle**：package 内资产在商户侧显示为 `Included`、`Installed`、`Enabled`、`Active` 等状态。商户仍可卸载已包含的主题/插件，但卸载后应回到 `Included`，仍不显示价格，并允许后续重新安装；不存在“卸载后必须再次购买”的路径。
- **Low-Visibility License Surface**：日常操作界面不强调“已激活商业授权”，但必须保留低可见度的 `License / About / Support` 入口，展示 activation code、package 名称、license 状态、到期时间、支持方与透明的 `Jiffoo` 平台归属，便于审计、售后与法务核验。
- **Suspend + Revert to OSS**：如授权延期或欠费，实例应先进入 `Suspend` 状态：冻结 package 内的增量能力（例如新增安装、额外授权、升级、市场浏览），但不自动砸站或强制回退到开源版；核心购物、订单、库存与当前已运行站点继续可用。只有 Super Admin 显式执行 `Revert to OSS`，实例才退出 Managed Mode，恢复开源默认主题、显示 `Marketplace` 与 `Jiffoo` 默认品牌视图。
- **Super Admin Commercial Control Plane**：Super Admin 必须能查看客户、授权码、绑定实例、包含资产、当前安装/激活状态，并支持新增/移除 package 内的公共主题与插件、暂停/恢复授权，以及执行显式回退。
- **No private extensions**：我们不再维护“私有插件”“私有主题”概念；所有扩展资产在 Marketplace 上公开，客户差异只通过 package、license 和 entitlement 决定。

### 交付链路稳定性约束（CI / GitOps）

> **工程口径**：Managed Marketplace 的浏览、授权码激活、安装与投影能力，不只取决于代码本身，也取决于测试/发布流水线能否稳定拉起对应服务。因此 CI 运行镜像必须优先使用内网稳定镜像源，而不能把 Docker Hub 可用性当作默认前提。

- **Child pipeline 镜像策略**：`admin`、`super-admin`、`api`、`platform-api`、`shop`、`docs`、`developer-portal` 的 test / build / gitops job 应允许显式覆盖 image，优先使用内网 Harbor 镜像。
- **失败分类原则**：若 `admin` 构建因 TypeScript/Next.js 编译失败，则归类为代码问题；若 `gitops` / `test` job 在 prepare environment 阶段因 `ubuntu`、`helm` 或其他公共镜像拉取失败，则归类为 CI 基础设施问题，不应混淆。
- **验收口径**：当我们声明“测试环境验证通过”时，必须同时满足页面级核心流程可访问，以及对应 child pipeline 成功完成部署，不接受“代码能跑、本次部署没成功”的模糊状态。

### 开源核心自更新模型（Self-Hosted Core Updates）

> **目标体验**：无论用户通过单机脚本、Docker Compose 还是 Kubernetes/Helm 部署开源版，Admin 后台都应提供统一的 `检查更新 / 立即升级 / 自动恢复状态` 体验。

这项能力应参考 **WordPress 的后台更新体验**，但不照搬“Web 进程直接覆盖自己文件”的实现方式。Jiffoo 更适合采用：

- 统一的 `Admin Upgrade Center`
- 公开的 `Core Update Manifest`（不依赖平台账号绑定）
- 本地 `Jiffoo Updater` 执行器
- 按部署方式切换的升级 adapter

统一原则：

1. **体验统一，执行分层**：用户始终在 Admin 中完成检查更新、查看 changelog、开始升级、查看进度和自动恢复状态。
2. **开源核心更新不依赖平台绑定**：Marketplace/官方服务需要平台账号绑定；开源核心版本更新不需要。
3. **官方支持的安装方式提供一键升级**：
   - `package-managed` 单机/脚本/面板安装：下载 release 包、备份、原子切换目录、健康检查、失败自动恢复
   - `docker-compose`：拉取新镜像、更新 release/tag、执行迁移、重建容器、失败自动恢复旧 tag
   - `k8s/helm/operator`：更新期望版本、滚动升级、健康检查、失败自动恢复上一个健康 release
4. **统一安全基线**：升级前必须做版本兼容性检查、扩展兼容性检查、签名/校验和校验、备份与恢复点创建。
5. **统一状态回传**：所有执行器都向 Admin 返回同一套状态模型：`checking / preparing / downloading / backing_up / applying / migrating / verifying / completed / failed / recovered`。
6. **野生部署不承诺一键升级**：如果用户偏离官方支持的安装方式，Admin 至少应给出清晰的手工升级提示，但不承诺自动成功。

### 插件/主题定价模式

| 定价模式 | 说明 | 适用场景 |
|----------|------|----------|
| 🆓 免费版 | 基础功能免费使用 | 吸引用户试用 |
| 📅 订阅制 | 按月/年付费，持续获得更新 | 持续迭代的插件 |
| 💎 买断制 | 一次性付费，永久使用 | 功能稳定的插件 |

### 收入分成模型

```
┌─────────────────────────────────────────────────────────────────┐
│                     插件/主题销售                                │
│  ┌─────────────┐    购买    ┌─────────────┐                     │
│  │ 开源商城用户 │ ────────→ │ jiffoo.com  │                     │
│  └─────────────┘            └──────┬──────┘                     │
│                                    │                            │
│                              ┌─────▼─────┐                      │
│                              │  收入分成  │                      │
│                              └─────┬─────┘                      │
│                         ┌──────────┴──────────┐                 │
│                         ▼                     ▼                 │
│                   ┌──────────┐          ┌──────────┐            │
│                   │ 开发者   │          │ Jiffoo   │            │
│                   │ (70%)    │          │ (30%)    │            │
│                   └──────────┘          └──────────┘            │
├─────────────────────────────────────────────────────────────────┤
│                   平台商品市场（未来）                            │
│  ┌─────────────┐    购买    ┌─────────────┐                     │
│  │  最终消费者  │ ────────→ │ 平台市场订单 │                     │
│  └─────────────┘            └──────┬──────┘                     │
│                                    │                            │
│                              ┌─────▼─────┐                      │
│                              │  收入分成  │                      │
│                              └─────┬─────┘                      │
│                         ┌──────────┴──────────┐                 │
│                         ▼                     ▼                 │
│                   ┌──────────┐          ┌──────────┐            │
│                   │ Vendor   │          │ Jiffoo   │            │
│                   │ (分润)   │          │ (平台抽成)│            │
│                   └──────────┘          └──────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 🔐 商业机制约束 (Business Mechanism Constraints)

> 以下机制确保平台的商业运营规范、安全、可持续。

#### 1. 许可证/订阅验证

| 机制 | 说明 |
|------|------|
| **许可证验证** | 付费插件/主题安装时验证购买凭证，定期心跳检查有效性 |
| **订阅状态检查** | 订阅制产品每次启动时验证订阅状态，过期后降级为免费版或禁用 |
| **离线宽限期** | 网络不可用时允许 7 天宽限期，超期后提示用户联网验证 |
| **多站点授权** | 单许可证默认支持 1 个站点，多站点需购买额外授权 |

#### 2. 退款与收入回滚

| 场景 | 处理方式 |
|------|----------|
| **用户申请退款** | 14 天内无条件退款，超期需提供合理理由 |
| **退款后收入回滚** | 已结算的开发者分成从下期收入中扣除 |
| **争议处理** | 平台介入调解，必要时冻结相关资金 |
| **恶意退款** | 多次恶意退款的用户将被限制购买权限 |

#### 3. 插件/主题安全策略

> **默认商业化执行模型**：官方与第三方扩展默认采用 `package-managed + Event-Activated Runtime`。也就是商家在 Admin 浏览市场后，由后台安装器下载并安装签名包；安装后注册能力，按事件执行，不把“每个插件都是独立微服务”作为默认前提。
>
> **高级执行模型**：仅当扩展确实需要独立伸缩、独立依赖或更强隔离时，才进入 `service-managed` 路径，由平台统一治理。
>
> **开源 Alpha 现状说明（与上文“运行时扩展”保持一致）**：开源版为了提供 WordPress 式“上传 ZIP 即可用”的体验，允许 `internal-fastify` 同进程运行插件代码，并提供网关转发能力；开源版不承诺与平台化同等的安全治理能力。
>
> **信任模型补充（开源 vs 闭源默认口径）**：
> - **开源自托管（Trusted / Self-host）**：可允许 `internal-fastify` 同进程执行，但用户应只安装可信来源插件。
> - **闭源平台化（Untrusted / Platform）**：第三方扩展默认视为不可信代码，必须通过签名制品、权限声明、受控 API 和后台安装器接入；是否进入 `service-managed` 取决于扩展级别的运行时需求，而不是默认假设。

| 策略 | 说明 |
|------|------|
| **代码审核** | 所有提交必须通过自动化安全扫描 + 人工审核 |
| **沙箱运行** | 默认通过签名制品 + 受控安装 + 事件激活运行时隔离风险；少数 `service-managed` 扩展再使用独立服务/容器治理 |
| **权限声明** | 插件必须声明所需权限，用户安装时明确授权 |
| **数据隔离** | 第三方插件不得直连 Core 主库；插件自有数据应使用独立数据库/schema/账号，仅授权其自身表结构 |
| **漏洞响应** | 发现安全漏洞后 24 小时内下架，修复后重新审核 |
| **恶意代码** | 发现恶意代码立即永久封禁开发者账号 |

#### 4. 审核标准与时效

| 阶段 | 时效 | 标准 |
|------|------|------|
| **自动化审核** | < 30 分钟 | 代码规范、安全扫描、依赖检查、兼容性测试 |
| **人工审核** | 1-3 工作日 | 功能验证、UI/UX 检查、文档完整性 |
| **加急审核** | < 24 小时 | 付费服务，优先处理 |
| **申诉处理** | 3-5 工作日 | 开发者对审核结果有异议时 |

#### 5. 争议解决机制

```
┌─────────────────────────────────────────────────────────────────┐
│                    争议解决流程                                  │
│                                                                 │
│  1. 用户/开发者提交争议申请                                      │
│     └── 通过开发者门户或用户中心提交                             │
│                                                                 │
│  2. 平台初步调查（3 工作日内）                                   │
│     └── 收集双方证据，了解情况                                   │
│                                                                 │
│  3. 调解协商                                                    │
│     └── 平台提出解决方案，双方协商                               │
│                                                                 │
│  4. 最终裁决                                                    │
│     └── 协商不成时，平台做出最终裁决                             │
│                                                                 │
│  5. 执行与申诉                                                  │
│     └── 执行裁决结果，不服可向上级申诉                           │
└─────────────────────────────────────────────────────────────────┘
```

#### 6. 版本回滚策略

| 场景 | 回滚方式 |
|------|----------|
| **用户主动回滚（开源 Alpha）** | 主题：仅支持回滚到上一个主题 slug（不支持任意版本回滚） |
| **平台强制回滚（闭源/平台化能力）** | 平台化能力未来可做“全量回滚到安全版本/安全主题”，开源 Alpha 不承诺 |
| **版本保留（开源 Alpha）** | v1 采用覆盖式升级：不保留历史版本安装包；如未来需要版本回滚再引入归档/清理策略 |
| **数据兼容** | 主题回滚不涉及 DB 迁移（主题不含可执行逻辑）；插件的版本回滚与迁移策略另行定义 |

---

## 🆚 开源版 vs 闭源版

### 应用对比

| 应用 | 说明 | 端口 | Jiffoo (开源) | Jiffoo Mall Core (闭源) |
|------|------|:----:|:-------------:|:-----------------------:|
| `apps/api` | Core API 服务（电商核心） | 3001 | ✅ | ✅ |
| `apps/admin` | 商户管理后台 | 3002 | ✅ | ✅ |
| `apps/shop` | 商城前端 | 3003 | ✅ | ✅ |
| `apps/platform-api` | Platform API 服务（平台管理） | 3011 | ❌ | ✅ |
| `apps/super-admin` | 超级管理后台（继承 admin） | 3012 | ❌ | ✅ |
| `apps/developer-portal` | 开发者门户 | 3013 | ❌ | ✅ |
| `apps/docs` | 开发者文档站 | 3014 | ❌ | ✅ |

> **注意**：闭源版始终运行双 API 服务（Core API + Platform API），不提供单进程合并模式；且 `apps/super-admin` 为闭源能力，不会被同步到开源仓库。

### 🔄 Super-Admin 继承架构

> **设计原则**：`super-admin` 完美继承 `admin` 的所有能力，避免重复造轮子。

```
┌─────────────────────────────────────────────────────────────────┐
│                    管理后台架构设计                               │
│                                                                 │
│  packages/shared + packages/ui  # 共享的管理后台核心              │
│  ├── shared/src/               # DTO、hooks、业务共享逻辑         │
│  ├── ui/src/components/admin/  # 通用后台 UI 组件                │
│  ├── ui/src/tokens/            # 设计令牌                        │
│  └── ui/src/utils/             # UI 工具函数                     │
│                                                                 │
│  ┌─────────────────┐          ┌─────────────────────────────┐   │
│  │   apps/admin    │          │      apps/super-admin       │   │
│  │  (商户管理后台)  │          │     (超级管理后台)           │   │
│  ├─────────────────┤          ├─────────────────────────────┤   │
│  │ ✅ 商品管理      │          │ ✅ 继承 admin 全部功能       │   │
│  │ ✅ 订单管理      │  ──────→ │ ✅ 插件系统支持              │   │
│  │ ✅ 用户管理      │  继承    │ ✅ 主题系统支持              │   │
│  │ ✅ 插件系统      │          │ ➕ 平台用户管理              │   │
│  │ ✅ 主题系统      │          │ ➕ 开发者审核                │   │
│  └─────────────────┘          │ ➕ 收入分成管理              │   │
│                               │ ➕ 平台数据分析              │   │
│                               └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**继承关系说明**：

| 能力 | admin | super-admin | 说明 |
|------|:-----:|:-----------:|------|
| 商品管理 | ✅ | ✅ 继承 | 完全复用 admin 的商品管理模块 |
| 订单管理 | ✅ | ✅ 继承 | 完全复用 admin 的订单管理模块 |
| 用户管理 | ✅ | ✅ 继承 | 完全复用 admin 的用户管理模块 |
| 插件安装/管理 | ✅ | ✅ 继承 | 同一套插件运行时，无需重复开发 |
| 主题切换/管理 | ✅ | ✅ 继承 | 同一套主题运行时，无需重复开发 |
| 平台用户管理 | ❌ | ✅ 独有 | 管理所有商户账号 |
| 开发者审核 | ❌ | ✅ 独有 | 审核插件/主题提交 |
| 收入分成管理 | ❌ | ✅ 独有 | 管理开发者收入和提现 |
| 平台数据分析 | ❌ | ✅ 独有 | 全平台数据统计和分析 |

**架构优势**：
- 🔄 **代码复用**：插件/主题系统只需开发维护一次
- 🎯 **一致性**：平台运营人员和商户使用相同的扩展体验
- 🛠 **维护成本低**：修复 bug 或更新功能只需改一处
- 🔌 **插件生态统一**：开发者不需要为不同后台适配

### 功能对比

| 功能分类 | 功能项 | Jiffoo (开源) | Jiffoo Mall Core (闭源) |
|----------|--------|:-------------:|:-----------------------:|
| **核心电商** | 商品管理（CRUD、分类、属性、库存） | ✅ | ✅ |
| | 订单管理（创建、支付、发货、退款） | ✅ | ✅ |
| | 购物车（添加、修改、结算） | ✅ | ✅ |
| | 用户系统（注册、登录、个人中心） | ✅ | ✅ |
| | 基础支付集成 | ✅ | ✅ |
| | 商品搜索、筛选 | ✅ | ✅ |
| **扩展系统** | 插件安装/卸载 | ✅ | ✅ |
| | 主题切换 | ✅ | ✅ |
| | Plugin SDK | ✅ | ✅ |
| | Theme SDK | ✅ | ✅ |
| **市场功能** | 浏览 jiffoo.com 插件市场 | ✅ | ✅ |
| | 浏览 jiffoo.com 主题市场 | ✅ | ✅ |
| | 购买并安装插件/主题 | ✅ | ✅ |
| | 上架官方产品分销 | ✅ | ✅ |
| **平台管理** | 超级管理后台 | ❌ | ✅ |
| | 开发者门户（提交插件/主题） | ❌ | ✅ |
| | 插件/主题审核系统 | ❌ | ✅ |
| | 收入分成管理 | ❌ | ✅ |
| | 平台数据分析 | ❌ | ✅ |

### 开发者工作流

```
┌─────────────────────────────────────────────────────────────────┐
│                    插件/主题开发者工作流                          │
│                                                                 │
│  1. 使用 Plugin SDK / Theme SDK 开发                            │
│     └── 在本地 Jiffoo 开源版上开发和测试                         │
│                                                                 │
│  2. 提交到 jiffoo.com                                           │
│     └── 访问 jiffoo.com/developer-portal 提交作品               │
│                                                                 │
│  3. 审核通过后上架                                               │
│     └── 在 jiffoo.com 市场展示和销售                            │
│                                                                 │
│  4. 获得收入分成                                                 │
│     └── 通过开发者门户查看收入和提现                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 功能模块索引

### 🛒 核心电商

| 模块 | 说明 | 开源/闭源 | Spec 目录 | 状态 |
|------|------|:---------:|-----------|------|
| core-functionality-completion | 核心电商功能完善 | 🟢 开源 | [📁](./core-functionality-completion/) | 进行中 |
| single-store-core-architecture | 单店核心架构（独立站默认路径） | 🟢 开源 | [📁](./single-store-core-architecture/) | 进行中 |
| product-types-system | 商品类型系统 | 🟢 开源 | [📁](./product-types-system/) | 进行中 |
| frontend-stability | 前端稳定性 | 🟢 开源 | [📁](./frontend-stability/) | 进行中 |
| app-rename-refactor | 应用重命名重构 | 🟢 开源 | [📁](./app-rename-refactor/) | 进行中 |

### 🔌 扩展系统

| 模块 | 说明 | 开源/闭源 | Spec 目录 | 状态 |
|------|------|:---------:|-----------|------|
| plugin-marketplace | 插件市场（客户端） | 🟢 开源 | [📁](./plugin-marketplace/) | 进行中 |
| theme-marketplace | 主题市场（客户端） | 🟢 开源 | [📁](./theme-marketplace/) | 进行中 |
| extension-management-ui | 扩展管理界面 | 🟢 开源 | [📁](./extension-management-ui/) | 进行中 |
| cms-plugin | CMS 插件 | 🟢 开源 | [📁](./cms-plugin/) | 进行中 |
| i18n-plugin | 国际化插件 | 🟢 开源 | [📁](./i18n-plugin/) | 进行中 |
| commercial-plugins | 商业插件系统 | 🔴 闭源 | [📁](./commercial-plugins/) | 进行中 |

### 🏢 平台管理（闭源）

| 模块 | 说明 | Spec 目录 | 状态 |
|------|------|-----------|------|
| jiffoo-platform-super-admin | 超级管理后台 | [📁](./jiffoo-platform-super-admin/) | 进行中 |
| developer-ecosystem | 开发者生态（门户、审核） | [📁](./developer-ecosystem/) | 进行中 |
| developer-experience | 开发者体验 | [📁](./developer-experience/) | 进行中 |

### 📱 客户端应用（独立开源仓库）

| 模块 | 说明 | 仓库 | Spec 目录 | 状态 |
|------|------|------|-----------|------|
| react-native-shop-app | 移动端商城 App（私有开发主仓） | `jiffoo-mall-mobile-private` 🔴 | [📁](./react-native-shop-app/) | 进行中 |
| electron-desktop-apps | 桌面端应用（私有开发主仓） | `jiffoo-mall-desktop-private` 🔴 | [📁](./electron-desktop-apps/) | 进行中 |
| multi-surface-solution-architecture | Web/Desktop/Mobile 共享契约与 solution package 架构 | 跨仓 | [📁](./multi-surface-solution-architecture/) | 进行中 |

> 客户端应用日常开发在私有主仓进行，公开仓库作为后续 OSS sync 输出；联调时要求与 `jiffoo-mall-core` 处于同级目录。

### 🔧 基础设施

| 模块 | 说明 | 开源/闭源 | Spec 目录 | 状态 |
|------|------|:---------:|-----------|------|
| dual-api-architecture | 双 API 服务架构 | 🔴 闭源 | [📁](./dual-api-architecture/) | 进行中 |
| comprehensive-testing-system | 综合测试系统 | 🟢 开源 | [📁](./comprehensive-testing-system/) | 暂缓 |
| e2e-test-hardening | E2E 测试加固 | 🟢 开源 | [📁](./e2e-test-hardening/) | 暂缓 |
| performance-testing | 性能测试 | 🟢 开源 | [📁](./performance-testing/) | 进行中 |
| security-hardening | 安全加固 | 🟢 开源 | [📁](./security-hardening/) | 进行中 |
| production-observability | 生产可观测性 | 🟢 开源 | [📁](./production-observability/) | 进行中 |
| unified-logging-system | 统一日志系统 | 🟢 开源 | [📁](./unified-logging-system/) | 进行中 |
| backup-disaster-recovery | 备份与灾难恢复 | 🟢 开源 | [📁](./backup-disaster-recovery/) | 进行中 |
| cicd-workflow | CI/CD 工作流 | 🟢 开源 | [📁](./cicd-workflow/) | 进行中 |

### 🎨 设计与文档

| 模块 | 说明 | 开源/闭源 | Spec 目录 | 状态 |
|------|------|:---------:|-----------|------|
| jiffoo-design-system | 设计系统 | 🟢 开源 | [📁](./jiffoo-design-system/) | 进行中 |
| jiffoo-blue-minimal-redesign | 蓝色极简重设计 | 🟢 开源 | [📁](./jiffoo-blue-minimal-redesign/) | 进行中 |
| unified-theme-architecture | 统一主题架构 | 🟢 开源 | [📁](./unified-theme-architecture/) | 进行中 |
| documentation-management | 文档管理 | 🔴 闭源 | [📁](./documentation-management/) | 进行中 |

### 📦 其他

| 模块 | 说明 | 开源/闭源 | Spec 目录 | 状态 |
|------|------|:---------:|-----------|------|
| open-source-preparation | 开源准备 | 🟢 开源 | [📁](./open-source-preparation/) | 进行中 |
| project-evaluation | 项目评估 | 🟢 开源 | [📁](./project-evaluation/) | 进行中 |
| one-click-installer | 一键安装器 | 🟢 开源 | [📁](./one-click-installer/) | 进行中 |
| dual-repo-deployment | 双仓库部署 | 🔴 闭源 | [📁](./dual-repo-deployment/) | 进行中 |

---

## 🗓 开发路线图

### 第一阶段：基础稳固（Alpha v0.1.0）- 2025 Q1

**版本号**：`v0.1.0-alpha.x`  
**目标**：可用于生产的单店独立站（Single Store）电商系统

**最小可交付闭环 (Minimum Viable Closure)**：
- ✅ 用户可以完成完整购物流程：浏览商品 → 加入购物车 → 下单 → 支付 → 收货
- ✅ 商户可以在 admin 后台管理商品、订单、用户
- ✅ 系统可以稳定运行 7 天无重大故障

**交付物**：
- ✅ 核心电商功能完善（shop, api, admin）
- ✅ 单店架构稳定（独立站默认路径）
- ✅ 前端稳定性优化
- ✅ 结构化数据模型（Alpha 必须落库）：分类、收货地址、发货/履约、退款记录
- ✅ 基础国际化（i18n）：`/{locale}/` 路由前缀；默认支持 `en` + `zh-Hant`（英语 + 繁体中文）
- ✅ 主题系统：支持离线安装与“生产可用”的主题切换（切换立即生效、可回滚到上一个主题、主题配置持久化）
- ✅ 开源准备工作

#### Alpha 验收口径澄清（只卡必须交付的代码）

为避免闭源仓库内历史遗留文件（测试用例、临时文档、过期说明）成为阻断项，Alpha 的 Release Gate 以 `.kiro/specs/PRD_EXECUTABLE.md` 为准，并遵循以下口径：

- **必须通过 Gate 的范围**：`apps/api`、`apps/admin`、`apps/shop`、以及 PRD 列出的开源 `packages/*`（对应源码目录 `src/**`）与参与开源交付的必要脚本/CI 配置。
- **允许保留但不参与 Alpha Gate 的范围**：`tests/**`、`docs/**` 及其他历史文档；这类内容可后续纳入清理 Backlog，不影响 Alpha 发布。

**Non-goals（本阶段不做）**：
- ❌ 插件/主题市场交易闭环（上架/购买/审核/分账/提现）
- ❌ i18n 全量能力（多语种规模化、翻译工作流/后台、内容全量翻译覆盖等）
- ❌ 移动端 App
- ❌ 高并发优化（>1000 QPS）

> 说明：Jiffoo 官方维护扩展的首发上线（官方主题/官方插件的上架、定价、授权、Admin 一键安装/启用）不属于本 Alpha 开源范围，单独由 [`.kiro/specs/official-extensions-go-live/requirements.md`](./official-extensions-go-live/requirements.md) 跟踪。

### 第二阶段：扩展生态（Beta v0.5.0）- 2025 Q2

**版本号**：`v0.5.0-beta.x`  
**目标**：完整的插件/主题生态系统

**最小可交付闭环 (Minimum Viable Closure)**：
- ✅ 开发者可以使用 SDK 开发插件/主题，并提交到 jiffoo.com
- ✅ 用户可以在 admin 后台浏览、购买、安装插件/主题
- ✅ 至少 5 个官方示例插件和 3 个官方主题上线

**交付物**：
- 🔄 jiffoo.com 插件市场上线
- 🔄 jiffoo.com 主题市场上线
- 🔄 Plugin SDK / Theme SDK 完善
- 🔄 开发者门户上线（闭源）
- 🔄 插件/主题审核系统

**Non-goals（本阶段不做）**：
- ❌ 付费系统（本阶段仅免费插件/主题）
- ❌ 收入分成结算
- ❌ 官方产品分销
- ❌ 托管 SaaS 服务

### 第三阶段：商业化（GA v1.0.0）- 2025 Q3

**版本号**：`v1.0.0`  
**目标**：完整的商业化运营

**最小可交付闭环 (Minimum Viable Closure)**：
- ✅ 开发者可以上架付费插件/主题，并收到分成收入
- ✅ 用户可以购买付费插件/主题，支付流程完整
- ✅ 分销商可以上架官方产品并获得佣金
- ✅ 月活跃开发者 > 50，月交易额 > $10,000

**交付物**：
- 💰 插件/主题付费系统上线
- 💰 官方产品市场上线
- 💰 分销系统上线
- 💰 收入分成系统

**Non-goals（本阶段不做）**：
- ❌ 托管 SaaS 服务
- ❌ 企业级定制功能
- ❌ 白标解决方案

### 第四阶段：规模化（Post-GA v1.x / v2.0）- 2025 Q4

**版本号**：`v1.1.0` ~ `v2.0.0`  
**目标**：扩大用户规模和生态

**最小可交付闭环 (Minimum Viable Closure)**：
- ✅ 移动端 App 上架 App Store 和 Google Play
- ✅ 桌面端应用支持 Windows/macOS/Linux
- ✅ 支持至少 6 种语言
- ✅ 月活跃商户 > 1,000

**交付物**：
- 📱 移动端 App 发布（iOS/Android）
- 🖥 桌面端应用发布
- 🌍 国际化完善（6+ 语言）
- 🏢 企业级功能

**Non-goals（本阶段不做）**：
- ❌ 托管 SaaS 服务（移至 2026 Q1）
- ❌ 多店/多商户架构

---

## 📜 许可证说明

### 开源部分：GPLv2+

- **仓库**：`jiffoo`
- **许可证**：GNU General Public License v2.0 or later
- **权限**：可商用、可修改、可分发
- **要求**：衍生作品需保持 GPL 许可，分发时需提供源代码
- **参考**：与 WordPress 相同的许可模式

### 闭源部分：专有许可

- **仓库**：`jiffoo-mall-core`
- **包含**：`apps/platform-api`、`apps/super-admin`、`apps/developer-portal`、`apps/docs`（以及其他平台运营相关闭源能力）
- **说明**：平台运营相关功能，不对外开放源代码；**不以源码/二进制形式对外分发，仅用于官方托管/运营**

### 插件/主题许可

- **开源核心代码**：GPLv2+，包含在开源仓库中
- **官方主题/插件**：不随开源仓库分发，通过 jiffoo.com / 官方 Marketplace 以签名包形式下载
- **第三方商业插件/主题**：开发者自定义许可，通过 jiffoo.com 销售

---

## 📚 相关文档

- [可执行 PRD（Alpha）](./PRD_EXECUTABLE.md)
- [闭源最终工程形态蓝图（Draft）](./PRD_FINAL_BLUEPRINT.md)
- [详细产品路线图需求](./product-roadmap-prd/requirements.md)
- [开源准备工作](./open-source-preparation/requirements.md)
- [功能模块路线图](../../docs/FEATURE_ROADMAP.md)
- [技术架构文档](../../docs/ARCHITECTURE.md)
- [贡献指南](../../CONTRIBUTING.md)

---

## 🔗 相关链接

- **官网**：https://jiffoo.com
- **开源仓库**：https://github.com/jiffoo/jiffoo
- **开发者门户**：https://jiffoo.com/developer-portal
- **插件市场**：https://jiffoo.com/plugins
- **主题市场**：https://jiffoo.com/themes

---

*最后更新: 2026-01-28*
