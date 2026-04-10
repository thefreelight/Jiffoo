# 外部插件开发指南

> 本文档面向希望为 Jiffoo 平台开发插件的 **外部开发者**。  
> 插件可以使用任意语言 / 框架实现，只需遵守本文档定义的 HTTP 协议、OAuth 安装流程和安全约定。

---

## 1. 概览

### 1.1 外部插件是什么？

- 外部插件是运行在 Jiffoo 平台之外的独立服务（SaaS 应用）；
- 插件通过 HTTP 与平台交互：
  - 接收平台转发的插件 API 请求；
  - 接收安装 / 卸载 / 配置等生命周期事件；
  - 调用平台的用量计费 / 订阅 / 租户信息 API（通过 SDK 或直接 HTTP）。

### 1.2 你需要做什么？

作为外部插件开发者，你需要：

- 实现若干必须的 HTTP 端点（健康检查、manifest、安装 / 卸载等）；
- 支持平台发来的签名 Header 并完成验证；
- 实现基于 OAuth 的安装流程；
- 实现你自己的业务 API 路由；
- 可选：集成 Jiffoo 提供的 SDK，简化签名验证和平台 API 调用。

平台会负责：

- 统一入口：所有前端请求都会调用 `Jiffoo API`，再由平台转发到你的插件；
- 多租户隔离、订阅计费、用量统计、限流和审计；
- 插件市场、安装 / 配置 / 卸载的后台管理界面；
- 为你提供统一的开发文档、SDK、模板项目。

---

## 2. 外部插件的运行模型

### 2.1 请求流转示意

1. Mall / Admin 前端调用：
   - `POST /api/plugins/<your-plugin-slug>/api/<path>`；
2. Jiffoo 平台插件网关：
   - 校验当前租户是否已安装并启用你的插件；
   - 校验订阅 / 许可证 / 用量限制；
   - 将请求转发到你的服务 `externalBaseUrl`：
     - 去掉 `/api/plugins/<your-plugin-slug>/api` 前缀，只保留 `<path>`；
     - 加上签名和平台相关 Header；
3. 你的插件服务：
   - 验证平台签名；
   - 根据 `tenantId` / `installationId` 执行业务逻辑；
   - 返回 JSON 响应；
4. 平台将你的响应返回给前端。

### 2.2 多租户与安装实例

在 Jiffoo 平台中：

- 插件作为 `Plugin` 记录存在（由平台运营或你自己在平台上创建）；
- 每个租户安装你的插件时，会创建一条 `PluginInstallation` 记录；
- 你在插件侧应当：
  - 使用 `tenantId`（租户 ID）识别租户；
  - 使用 `installationId` 识别安装实例；
  - 将自己的一些状态（例如绑定的下游账号、配置等）与二者关联。

---

## 3. 必须实现的 HTTP 端点

> 所有路径示例均为你服务上的路径。平台会在调用时拼接你的 `externalBaseUrl`。

### 3.1 `GET /health`

- 用途：健康检查。
- 要求：
  - 当服务正常时返回 `200` + 简单 JSON；
  - 可以返回版本号 / 构建号等信息。
- 响应示例：

```json
{ "status": "ok", "version": "1.0.0" }
```

### 3.2 `GET /manifest`

- 用途：
  - 向平台描述你的插件能力；
  - 用于在插件市场、配置页面中展示信息。
- 建议包含信息：
  - 插件基本信息：
    - `name`, `slug`, `version`, `description`, `category`, `tags` 等；
  - 支持的业务 API 路由：
    - `path`, `method`, `summary`, `requiresAuth`, `metrics` 等；
  - 配置项 schema：
    - 租户级配置字段定义（可使用 JSON Schema）；
  - 权限（scopes）：
    - 插件需要访问的平台资源范围（视后续平台能力演进）。

> 平台会在安装或配置时调用 `/manifest`，并缓存结果。

### 3.3 `POST /install`

- 用途：
  - 在某个租户成功安装你的插件后，由平台调用此端点；
  - 用于初始化租户级资源 / 配置。
- 请求体示例：

```json
{
  "tenantId": "123",
  "installationId": "456",
  "environment": "production",
  "planId": "pro",
  "config": {
    "apiKey": "******",
    "region": "us-east-1"
  },
  "platform": {
    "baseUrl": "https://api.jiffoo.com",
    "pluginSlug": "your-plugin-slug"
  }
}
```

- 行为建议：
  - 在你的系统中为这个租户创建记录；
  - 保存必要的配置（建议加密存储）；
  - 若需要调用第三方服务（如 Stripe、邮件服务）进行初始化，也可以在此时进行。

### 3.4 `POST /uninstall`

- 用途：
  - 某个租户在平台后台卸载你的插件时，由平台调用；
  - 用于清理租户级资源。
- 请求体示例：

```json
{
  "tenantId": "123",
  "installationId": "456",
  "reason": "user_cancelled"
}
```

- 行为建议：
  - 标记租户为已卸载；
  - 清理缓存 / 临时资源；
  - 可根据你的业务决定是否保留历史数据。

### 3.5 业务 API 路由

- 由你自行设计，但需要注意：
  - 所有业务 API 路由最终将挂载在：
    - `/api/plugins/<plugin-slug>/api/<your-path>`；
  - 平台转发时会去掉前缀 `/api/plugins/<plugin-slug>/api`。

例子：

- 你的服务中实现：
  - `POST /api/create-checkout-session`
- 前端调用：
  - `POST /api/plugins/your-plugin-slug/api/create-checkout-session`
- 平台会将请求转发到你的服务，并附带租户 / 安装信息与签名。

---

## 4. 平台 Header 与签名规范

> 为了保证安全，所有平台 → 插件的请求都会带上统一 Header 和签名信息，插件必须验证签名。

### 4.1 标准 Header

平台向你的服务发送请求时，会附加以下 Header（命名可能根据最终实现微调，但语义不变）：

- `X-Platform-Id`：平台标识（例如 `jiffoo`）；
- `X-Platform-Env`：环境（`sandbox` / `staging` / `production` 等）；
- `X-Platform-Timestamp`：请求时间戳（ISO 字符串或 Unix 时间戳）；
- `X-Plugin-Slug`：你的插件 slug；
- `X-Tenant-ID`：当前租户 ID；
- `X-Installation-ID`：插件安装记录 ID；
- `X-Platform-Signature`：签名字符串。

根据业务需要，平台可能还会附加：

- `X-User-ID`：触发请求的用户 ID（若有）；
- `Authorization`：平台级授权 token（如需要双向调用）。

### 4.2 签名算法（建议方案）

推荐使用 HMAC-SHA256：

- 平台与你的插件之间约定一个 `sharedSecret`（在平台的 Plugin 配置中保存，并通过安全渠道告知你）；
- 签名原文（示例，可根据最终实现调整）：

```text
stringToSign = X-Platform-Timestamp + '\n' + HTTP_METHOD + '\n' + REQUEST_PATH + '\n' + body
signature = hex(HMAC_SHA256(sharedSecret, stringToSign))
```

- 平台将 `signature` 放入 `X-Platform-Signature`；
- 你在服务端：
  - 使用相同的 `sharedSecret`；
  - 计算签名并与 `X-Platform-Signature` 对比；
  - 检查 `X-Platform-Timestamp` 与当前时间差在允许范围内（例如 ±5 分钟）；
  - 否则返回 `401` 或 `403`。

平台后续也可能支持基于 JWT + 公私钥的签名方式，届时会在文档中追加说明。

---

## 5. OAuth 安装流程

> 本节介绍 Admin 在 Jiffoo 平台中安装你的插件时，平台与插件之间的 OAuth 流程。

### 5.1 高层流程

1. **Admin 在平台发起安装**
   - Admin 在 Jiffoo 管理后台选择你的插件 → 点击“安装”；
   - 平台生成一个 `state`（内部包含 `tenantId`, `pluginId`, `nonce` 等）；
   - 平台将浏览器重定向到你的授权 URL：

     ```text
     GET {oauthInstallUrl}?client_id={clientId}&state={state}&redirect_uri={platformRedirectUri}&scope={scopes}
     ```

2. **你在授权页面完成绑定 / 授权**
   - 展示登录 / 绑定页面；
   - 展示需要的权限（scopes）；
   - 用户确认后，将浏览器重定向回平台：

     ```text
     GET {platformRedirectUri}?code={authCode}&state={state}
     ```

3. **平台处理回调**
   - 校验 `state`；
   - 使用 `code` 调用你的 Token 端点：

     ```text
     POST {tokenUrl}
     Content-Type: application/x-www-form-urlencoded or application/json

     {
       "client_id": "...",
       "client_secret": "...",
       "code": "...",
       "redirect_uri": "..."
     }
     ```

   - 你的 Token 端点返回：

     ```json
     {
       "accessToken": "token-xxx",
       "refreshToken": "optional",
       "expiresIn": 3600,
       "externalInstallationId": "your-side-installation-id",
       "accountId": "your-side-account-id",
       "scopes": ["..."],
       "metadata": { "any": "thing" }
     }
     ```

   - 平台据此创建 `PluginInstallation` 记录；
   - 然后调用你的 `/install` 端点，将 `tenantId`, `installationId`, `planId`, `config` 等信息发送给你。

4. **安装完成**
   - 平台将 Admin 重定向到安装成功页面；
   - 从此以后，该租户就可以通过插件网关调用你的业务 API。

### 5.2 你需要实现的 OAuth 端点

- 授权页面入口：`oauthInstallUrl`
  - 负责展示授权 UI 并最终重定向回平台。
- Token 端点：`tokenUrl`
  - 负责将 `code` 换成 `accessToken` 等信息；
  - 平台只与此端点直接通信，不会在浏览器暴露 `client_secret`。

平台会在 Plugin 配置中记录这些 URL，并在安装流程中使用。

---

## 6. 错误与响应规范

### 6.1 HTTP 状态码建议

请尽量遵循与平台内部插件一致的约定：

- `200` 系列：调用成功（可以包含业务级错误码）；
- `400 Bad Request`：请求参数错误；
- `401 Unauthorized`：签名验证失败 / 凭证无效；
- `402 Payment Required`：租户在你的系统中需要付费（可选，用于补充平台侧计费逻辑）；
- `403 Forbidden`：无权访问（例如租户未在你系统中授权）；
- `404 Not Found`：路径不存在；
- `429 Too Many Requests`：你的插件内部限流；
- `5xx`：插件内部错误或下游错误。

### 6.2 响应结构建议

- 成功响应：

```json
{
  "success": true,
  "data": { "any": "payload" }
}
```

- 失败响应：

```json
{
  "success": false,
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human readable message",
    "details": { "optional": "extra info" }
  }
}
```

平台在转发你的响应时，可能会统一包装 / 透传这些字段，以便前端和运营界面更好地展示错误信息。

---

## 7. 开发体验建议与 SDK

> 平台会提供官方 SDK 和模板项目，帮助你快速上手。这里先定义 SDK 的核心能力，以便你评估集成成本。

### 7.1 SDK 核心功能（以 Node/TypeScript 为例）

- 签名与 Header 解析：
  - 验证 `X-Platform-Signature`；
  - 解析 `tenantId`, `installationId`, `pluginSlug`, `platformEnv` 等；
  - 在应用中作为 `PluginContext` 使用。

- 平台 API 封装：
  - 记录用量：`recordUsage(metricName, amount, metadata?)`；
  - 获取租户信息：`getTenantInfo()`；
  - 获取 / 更新当前安装配置：`getInstallationConfig()`, `updateInstallationConfig()`。

- 开发辅助：
  - 本地开发模式（例如绕过签名或使用固定密钥）；
  - 日志格式建议（方便在平台上关联）。

### 7.2 模板项目

平台会提供一个示例模板（例如 `create-jiffoo-plugin`）：

- 内置：
  - `GET /health`；
  - `GET /manifest`；
  - `POST /install`；
  - `POST /uninstall`；
  - 一两个示例业务 API（如 `/api/create-checkout-session`）；
- 已集成 SDK 的签名验证和平台 API 调用；
- 包含基础 README 和本地运行说明。

你可以基于该模板扩展自己的业务逻辑。

---

## 8. 开发与调试流程建议

1. **本地起服务**
   - 在本地起你的插件服务（例如 `http://localhost:4000`）；
   - 实现基本端点（`/health`, `/manifest`, `/install`, `/uninstall`）。

2. **在 Jiffoo 测试环境注册插件**
   - 平台运营 / 开发在测试环境中创建一条 `Plugin` 记录：
     - `runtimeType = 'external-http'`；
     - `externalBaseUrl = 'http://localhost:4000'`（通过隧道 / 代理暴露到云环境也可以）；
     - 配置好 `oauthInstallUrl`, `tokenUrl` 等。

3. **跑通 OAuth 安装**
   - 在测试环境 Admin 后台点击安装；
   - 从你的授权页面回跳平台；
   - 查看你的服务是否收到 `/install` 调用。

4. **调用业务 API**
   - 在 Mall/Admin 中触发一次业务操作（例如“创建支付会话”）；
   - 查看你的服务是否收到 `/api/...` 调用；
   - 检查 Header 与签名是否正确。

5. **对照平台日志**
   - 平台会在统一日志中记录插件调用（包括 `tenantId`, `pluginSlug`, `path`, `statusCode`, `latency` 等）；
   - 用于排查错误与优化性能。

---

## 9. 常见问题（FAQ 草案）

**Q：我可以直接让前端调用我的服务吗？**  
A：不建议。所有插件能力都应该通过 Jiffoo 平台网关暴露，这样才能保证多租户隔离、计费和安全控制。如果有特定场景需要直连，请与平台团队沟通专用方案。

**Q：插件是如何计费的？**  
A：平台会基于 `PluginUsage` 统一记录用量。你的插件也可以通过 SDK 主动报送更细粒度的用量数据，最终计费策略由平台与您协商定义。

**Q：如何在本地开发时绕过签名验证？**  
A：建议 SDK 提供“开发模式”开关，允许在开发环境使用固定 `sharedSecret` 或跳过时间戳校验。但在生产环境必须严格验证签名。

**Q：可以一个插件同时提供内部 + 外部能力吗？**  
A：目前建议一个插件选择一种运行类型（内部或外部）。如确有需要，可以通过两个协作插件实现（一个内部、一个外部）并在业务上组合。

---

如有更多问题或需要示例代码，可以参考平台提供的模板项目或联系平台团队获取支持。

