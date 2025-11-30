# 插件系统技术架构设计

> 本文档与《内部插件系统开发指南》配套，给出 Jiffoo 整体插件生态（内部 + 外部）的技术架构设计，用于指导后端 / 前端 / 基础设施团队在同一抽象下演进插件系统。

---

## 1. 设计目标与范围

### 1.1 设计目标

- **统一入口**  
  所有插件 API（无论内部还是外部）对前端暴露统一入口：
  - `/{basePrefix}/api/plugins/<plugin-slug>/api/*`
  - 其中 `basePrefix` 由部署环境决定（例如 `''`、`/mall` 等），对插件层透明。

- **遵循 Fastify 官方实践**  
  内部插件严格采用 Fastify 官方推荐模式（`FastifyPluginAsync` + `fastify.register`），并通过基础设施插件提供统一的租户上下文、商业化、插件注册表与安装生命周期。

- **多语言外部插件支持**  
  插件实现可为：
  - 内部 TypeScript + Fastify 插件；
  - 外部 HTTP 服务（任意语言 / 框架），通过平台网关集成。

- **平台统一控制**  
  所有插件调用必须先经过平台（统一网关），在平台侧完成：
  - 多租户隔离；
  - 安装 / 启用状态检查；
  - 订阅 / 许可证 / 用量计费检查；
  - 审计与限流。

- **开发者友好**  
  同时面向两类开发者提供清晰规范：
  - 内部开发者：统一的 Fastify 插件开发体验；
  - 外部开发者：基于 HTTP 协议 + OAuth 安装的一套简单、稳定的约定，并提供 SDK / 模板工程。

### 1.2 文档范围

- 定义“插件生态”整体分层与组件；
- 给出现有内部插件体系的架构位置；
- 引入“统一插件网关层”，统一内部 / 外部插件路由与商业化逻辑；
- 映射到现有代码结构（`apps/backend`、`apps/admin`、`apps/super-admin` 等）；
- 与《内部插件系统开发指南》和《外部插件开发指南》的关系。

---

## 2. 概念模型与角色

### 2.1 核心实体

下列概念与实体由 Prisma 模型承载（字段以 `schema.prisma` 为准，本节仅为抽象）：

- **Plugin**
  - 插件元数据与商业信息；
  - 主要字段（概念级）：
    - `id`, `slug`, `name`, `category`, `tags`, `status`, `version`, `iconUrl`, `screenshots`；
    - `runtimeType`：`'internal-fastify' | 'external-http'`；
    - `entryModule?`：内部插件实现文件路径（例如 `apps/backend/src/plugins/stripe.ts`）；
    - `externalBaseUrl?`：外部插件服务基础 URL；
    - `oauthConfig?`：安装所需 OAuth 配置（`installUrl`, `tokenUrl`, `scopes`, `redirectUri` 等，封装为 JSON）；
    - `integrationSecrets?`：平台与插件之间的共享密钥 / 公钥信息（JSON）。

- **PluginInstallation**
  - 租户对插件的安装实例；
  - 关键字段：
    - `tenantId`, `pluginId`, `status`, `enabled`, `installedAt`, `trialStartDate`, `trialEndDate`；
    - `configData`：租户级配置（JSON）；
    - 对外部插件，可能包含 `externalInstallationId`, `accessToken` 等。

- **SubscriptionPlan / Subscription**
  - 插件的订阅计划与具体订阅实例；
  - 由 `commercial-support` 插件统一处理；
  - 与插件类型（内部 / 外部）无关。

- **PluginUsage**
  - 插件调用 / 用量计费记录；
  - 典型维度：`tenantId`, `pluginSlug`, `metricName`, `period`；
  - 由平台网关或插件内部调用计费接口写入。

### 2.2 插件分类

统一插件架构下，仍延续内部指南中的分类：

- **基础设施插件（Infrastructure Plugins）**
  - 位于 `apps/backend/src/plugins`：
    - `tenant-context.ts`：提供多租户上下文（`request.tenant`、`tenantId` 等）；
    - `commercial-support.ts`：订阅 / 许可证 / 用量计费等商业化能力；
    - `plugin-registry.ts`：插件注册表（查询、详情、分类、搜索）；
    - `plugin-installer.ts`：安装 / 卸载 / 启用 / 禁用 / 订阅绑定；
    - `plugin-gateway.ts`：**统一插件网关层（新引入）**。
  - 仅由核心团队维护，不对外开放扩展。

- **业务插件（Business Plugins）**
  - 内部插件：TS + Fastify 实现，部署在平台进程内；
  - 外部插件：任意语言实现，通过 HTTP 与平台交互；
  - 提供支付、邮件、登录、分销、营销等功能。

- **UI 主题插件（Theme Plugins）**
  - 控制商城前端 UI 布局与组件；
  - 安装后更新 `Tenant.theme`，通过 `MallContextProvider` + `ThemeProvider` + `ThemedLayout` 生效；
  - 可为内部（本地主题包）或外部（远程主题服务）的形式；外部主题在 V2 阶段扩展协议。

### 2.3 平台角色

- **Super Admin**
  - 管理全局插件列表、商业计划和默认配置；
  - 调用 `/api/super-admin/plugins/...`。

- **Admin（租户管理员）**
  - 在租户后台中管理插件：安装、启用、配置、订阅、用量；
  - 调用 `/api/admin/plugins/...`。

- **Mall（终端用户）**
  - 使用插件提供的能力（支付、登录、UI、营销等）；
  - 调用 `/api/plugins/<slug>/api/*`。

---

## 3. 后端整体架构

### 3.1 Fastify 应用分层

后端整体结构（概念）：

```text
Fastify Application (apps/backend/src/server.ts)
├── Core Infrastructure
│   ├── Logger / Monitor
│   ├── Database (Prisma)
│   ├── Redis Cache
│   ├── Swagger / OpenAPI
│   └── Shared Middlewares (CORS, cookie, multipart, static files)
├── Infrastructure Plugins
│   ├── tenant-context
│   ├── commercial-support
│   ├── plugin-registry
│   ├── plugin-installer
│   └── plugin-gateway       ← 统一插件网关层（新）
├── Business Plugins
│   ├── internal-fastify plugins (Stripe / Resend / Google OAuth / Affiliate / ...)
│   └── external-http plugins (通过 HTTP 代理接入)
└── Core Business Routes
    ├── Auth / Users / Products / Orders / ...
    ├── Admin APIs (含插件管理)
    └── Super Admin APIs (含插件管理)
```

其中插件相关模块工作流程如下：

1. `tenant-context`：在请求进入早期注入租户上下文；
2. `commercial-support`：提供订阅 / 许可证 / 用量相关装饰器与工具函数；
3. `plugin-gateway`：拦截 `/api/plugins/:slug/api/*` 路由，统一处理；
4. `plugin-registry` / `plugin-installer`：提供插件市场与安装生命周期的 API；
5. 业务插件（内部 / 外部）只关心自身业务逻辑与下游集成。

### 3.2 插件注册和路由前缀约定

- 所有业务插件的 HTTP API 对外统一前缀：
  - `/api/plugins/<plugin-slug>/api/*`
- 对于内部 Fastify 插件：
  - 在 `server.ts` 中通过动态 `import` 注册：
    - 例如：
      - `stripe`: `prefix: '/api/plugins/stripe/api'`
      - `resend`: `prefix: '/api/plugins/resend/api'`
      - `google`: `prefix: '/api/plugins/google/api'`
      - `affiliate`: `prefix: '/api/plugins/affiliate/api'`
  - 插件内部路由仅使用相对路径（`/health`, `/create-checkout-session` 等），不重复 `/api/plugins/...` 前缀。

- 对于外部插件：
  - 在平台外以独立服务形式运行，内部可使用任意路由结构；
  - 平台通过 `plugin-gateway` 将 `/api/plugins/<slug>/api/*` 转发到外部插件的 `externalBaseUrl`；
  - 转发时去除 `/api/plugins/<slug>/api` 前缀，仅转发业务路径与请求数据。

---

## 4. 统一插件网关层设计

> 统一插件网关是内部 / 外部插件生态之间的“桥梁”，对前端暴露统一的 API 前缀，对后端隐藏实现细节。

### 4.1 职责

- 接管所有 `/api/plugins/:slug/api/*` 路由；
- 解析租户上下文（通过 `tenant-context`）；
- 查询 `Plugin` 与 `PluginInstallation`，并执行：
  - 插件状态检查（`status = ACTIVE`）；
  - 安装状态检查（当前租户是否已安装且 `enabled = true`）；
- 调用 `commercial-support` 的能力：
  - `checkPluginLicense(tenantId, pluginSlug, feature?)`；
  - `checkSubscriptionAccess(tenantId, pluginSlug, feature?)`；
  - `checkUsageLimit(...)` 与 `recordPluginUsage(...)`；
- 根据 `runtimeType` 决定请求转发路径：
  - `internal-fastify`：转发到本地 Fastify 插件；
  - `external-http`：代理到外部插件 HTTP 服务；
- 统一错误码与响应结构。

### 4.2 请求处理流程（时序）

1. 前端调用：`/api/plugins/<slug>/api/<path>`；
2. Fastify 匹配 `plugin-gateway` 路由；
3. `tenant-context` 提供 `tenant`，`plugin-gateway` 解析 `slug` 与 `<path>`；
4. 查询数据库中的 `Plugin` / `PluginInstallation`；
5. 执行商业化检查（订阅、许可证、用量）；
6. `runtimeType` 分支：
   - 内部插件：
     - 直接调用已经通过 `fastify.register` 注册的子路由；
     - 或使用 `fastify.inject` 发起内部请求。
   - 外部插件：
     - 构建 HTTP 请求：
       - URL: `externalBaseUrl + '/' + <path>`；
       - Headers: `X-Tenant-ID`, `X-Plugin-Slug`, `X-Installation-ID`, `X-Platform-*`, `Authorization?`；
       - 签名：`X-Platform-Signature`；
     - 发送请求，获取响应；
7. 更新用量记录（成功 / 失败的处理策略视业务而定）；
8. 封装 / 透传响应返回给前端。

### 4.3 内部 vs 外部插件路由映射

- 内部插件：
  - 本质是 Fastify 插件；
  - 网关层可通过 Fastify 路由树直接调用；
  - 不需要额外的签名 / HTTP 跳转。

- 外部插件：
  - 本质是远程 HTTP 服务；
  - 网关层负责：
    - 请求签名；
    - 超时 / 重试策略；
    - 日志与错误转换。

这一分层确保内部插件可以保持极致性能和简洁实现，而外部插件则获得最大灵活性。

---

## 5. 前端集成视图

### 5.1 Super Admin 面

- 管理全局插件仓库与商业化信息：
  - 列表 / 搜索 / 分类（使用 `plugin-registry`）；
  - 编辑 `SubscriptionPlan` / 默认状态 / 上架 / 下架；
- 对内部 / 外部插件一视同仁，仅在部分字段展示时显示“运行类型 / 外部服务状态”等信息。

### 5.2 Admin 面

- 后台插件管理：
  - 市场列表：`/admin/plugins/marketplace`；
  - 已安装：`/admin/plugins/installed`；
  - 安装 / 配置 / 卸载：`/admin/plugins/:slug/install|config`；
- 对于外部插件：
  - 安装按钮会引导 OAuth 安装流程；
  - 配置页面通过调用插件 manifest 中声明的配置项渲染表单。

### 5.3 Mall 面

- 面向终端用户的插件能力：
  - 支付 / 登录 / 邮件 / 营销等；
  - 统一通过 `/api/plugins/<slug>/api/*` 访问；
- 对 UI 主题类插件：
  - 通过统一的主题系统接口获取 `Tenant.theme`；
  - 内部或外部主题均通过同一套前端组件抽象加载。

---

## 6. 安装 / 卸载 / 用量计费统一模型

### 6.1 安装流程（概念）

- 内部插件：
  - 一般由平台内置，不需要 OAuth 安装；
  - 当某租户选择启用时，创建 / 更新 `PluginInstallation` 记录；
  - 由 `plugin-installer` 负责安装 / 启用逻辑。

- 外部插件：
  - 安装时统一遵循 OAuth 模式：
    1. Admin 在后台选择插件 → 平台生成 `state` → 重定向到外部插件 `installUrl`；
    2. 外部插件处理授权与账号绑定 → 重定向回平台 `redirectUri`；
    3. 平台通过插件的 `tokenUrl` 换取 `accessToken` 等安装上下文；
    4. 平台创建 `PluginInstallation` 记录，并调用插件 `/install`；
    5. 返回 Admin 安装成功状态。

### 6.2 卸载流程（概念）

1. Admin 在后台发起卸载；
2. 平台调用外部插件 `/uninstall`，附带 `tenantId`, `installationId`, 签名；
3. 更新 `PluginInstallation` 状态为卸载 / 禁用；
4. 取消订阅（如适用）、清理 or 标记用量记录。

### 6.3 用量计费

- 计量入口：
  - 网关在每次插件 API 调用前 / 后调用 `recordPluginUsage`；
  - 插件内部也可以通过调用平台计费 API 主动上报用量（如异步任务）。
- 计量粒度：
  - `(tenantId, pluginSlug, metricName, period)`；
  - 常见指标：`api_calls`, `transactions`, `emails_sent`, `login_attempts` 等。

---

## 7. 与内部开发指南 / 外部开发指南的关系

- 《内部插件系统开发指南》：
  - 面向内部开发者；
  - 定义如何编写 Fastify 插件、如何与商业化 / 多租户 / 前端集成。

- 《外部插件开发指南》：
  - 面向外部开发者；
  - 基于本文档的架构抽象，给出：
    - 必须实现的 HTTP 端点；
    - 签名 / 安全约定；
    - OAuth 安装流程；
    - 示例请求 / 响应结构。

- 本文档（技术架构设计）：
  - 面向内部架构 / 平台团队；
  - 为内部 / 外部两个开发指南提供统一的技术和概念基础；
  - 为后续演进提供约束与扩展空间（如 serverless 插件、外部主题插件等）。

---