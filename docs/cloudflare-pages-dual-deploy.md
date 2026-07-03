# Jiffoo 双部署兼容方案：Cloudflare Pages + 自托管服务器

> 目标：`apps/shop` 与 `apps/admin` 同时支持
> - ① 自托管 Docker（`output: 'standalone'`，保留现状，零改动）
> - ② Cloudflare Pages（`@cloudflare/next-on-pages`，SSR on Pages Functions）
>
> 两个部署共存、互不干扰，由环境变量切换 API 调用方式。

## 一、兼容性总览（为什么改动小）

扫过 `apps/shop` 与 `apps/admin` 全部源码，结论：

| 检查项 | 现状 | 对 Pages 的影响 |
|---|---|---|
| Next.js API 路由（`app/api/*/route.ts`） | **没有** | ✅ 无需迁移后端逻辑 |
| 业务代码调用 API | **全部走 `process.env.NEXT_PUBLIC_API_URL`**（`/api` 兜底） | ✅ 仅靠环境变量切换 |
| 服务端调用 API | `lib/server-api-url.ts` 用 `API_SERVICE_URL`，兜底读请求 origin | ✅ Pages 上配置 `API_SERVICE_URL` 即可 |
| `rewrites` 代理 `/api`、`/extensions`、`/uploads`、`/theme-app` | 存在但 **Pages 不支持外部 host 代理** | ⚠️ Pages 上需直连远端 API，见第三节 |
| `output: 'standalone'` | Docker 用 | ⚠️ Pages 不读这个字段，**保留不动**，`next-on-pages` 自己处理 |
| `next-pwa`（shop） | Service Worker | ⚠️ 见坑点 C |
| `generateBuildId` 跑 `git` | Pages 构建环境可能无 git | ✅ 已有兜底（md5 + 日期），不影响 |
| `middleware.ts` 源码 | **没有**（`.next/server/middleware.js` 是构建产物，非源码） | ✅ 无 middleware 阻塞 |
| Node 原生 API（fs/crypto/child_process） | 仅在 `next.config.base.js` 里用（构建期） | ✅ 构建期可用，运行期 Pages 限制不影响配置 |

**核心结论**：业务代码零改动，改造集中在 **配置文件 + 环境变量 + 一处 rewrite 兜底**。

---

## 二、代码改造（最小化）

### 改造 1：让 `next.config.js` 在 Pages 上跳过 `output: 'standalone'`

`output: 'standalone'` 只对 Docker 有用。`next-on-pages` 不需要它，但**留着也不会出错**（`next-on-pages` 内部覆盖构建模式）。**建议保留不动**，避免影响 Docker 部署。

如果构建时报错与 `standalone` 相关，再在 `next.config.base.js` 加条件：

```js
// packages/shared/config/next.config.base.js
output: process.env.CF_PAGES === '1' ? undefined : 'standalone',
```

> ⚠️ 先不动。只有构建报错时才加这一行（Cloudflare Pages 构建环境会注入 `CF_PAGES=1`）。

### 改造 2：让 `rewrites` 在 Pages 上禁用（避免无效代理）

Pages 不支持 rewrite 到外部 host。在 `next.config.base.js` 包一层条件：

```js
// packages/shared/config/next.config.base.js —— async rewrites() 部分
async rewrites() {
  // Cloudflare Pages 不支持外部 host rewrite，直连远端 API 即可
  if (process.env.CF_PAGES === '1') {
    return [];
  }
  const apiServiceUrl = process.env.API_SERVICE_URL || 'http://localhost:3001';
  return [
    { source: '/api/:path*', destination: `${apiServiceUrl}/api/:path*` },
    { source: '/extensions/:path*', destination: `${apiServiceUrl}/extensions/:path*` },
    { source: '/uploads/:path*', destination: `${apiServiceUrl}/uploads/:path*` },
    { source: '/theme-app/:path*', destination: `${apiServiceUrl}/theme-app/:path*` },
  ];
},
```

> 本地 / Docker：`rewrites` 正常代理到后端容器。
> Pages：`rewrites` 返回空，前端用 `NEXT_PUBLIC_API_URL=https://api.example.com/api` 直连。

### 改造 3：（可选）`images` 在 Pages 上用 unoptimized 或 CDN

Pages 的 `_next/image` 优化在 `next-on-pages` 下**有限制**（占用 Workers CPU）。两种处理方式，二选一：

**方式 A**（推荐，省心）：Pages 上关掉 Next 自带优化，靠 CDN/R2 + Images 处理：

```js
// shop/next.config.js 的 images 块外层
images: {
  ...,
  // Pages 上 _next/image 受限，交由 CDN/R2 处理
  unoptimized: process.env.CF_PAGES === '1' ? true : false,
},
```

**方式 B**：用 `NEXT_PUBLIC_CDN_URL` 走自定义 loader（您已有 `lib/image-loader.js`）。在 Pages 项目环境变量配 `NEXT_PUBLIC_CDN_URL=https://cdn.example.com` 即可自动启用。

> admin 的图片少，可直接 `unoptimized: true` 在 Pages 上。

---

## 三、部署步骤（Cloudflare Pages）

### 前置：后端 API 必须公网可达

Pages 上 SSR 需要服务端能访问后端 Fastify。两种方案：

- **方案 i**：后端跑在家里服务器，用 **Cloudflare Tunnel** 暴露成 `https://api.yourdomain.com`（免公网 IP，免费，推荐）
- **方案 ii**：后端跑在 Fly.io / VPS，已有公网域名

记下后端 API 地址，例如 `https://api.jiffoo.com`。

---

### 步骤 1：在根目录安装 `@cloudflare/next-on-pages`

```bash
pnpm add -D @cloudflare/next-on-pages wrangler --filter shop
pnpm add -D @cloudflare/next-on-pages wrangler --filter admin
```

> 同时在根 `package.json` 加便捷脚本（见步骤 6）。

---

### 步骤 2：为 shop 和 admin 各加一个 `wrangler` 配置

#### `apps/shop/wrangler.toml`

```toml
name = "jiffoo-shop"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# 用 Pages 直接部署时不需要这里，下面绑定 Pages 项目
# 此文件仅供 wrangler 预览/本地开发用
```

> 注：`next-on-pages` 实际部署走 Pages 控制台 + Git 集成，`wrangler.toml` 主要给本地 `npx @cloudflare/next-on-pages` 预览用。

#### `apps/admin/wrangler.toml`

```toml
name = "jiffoo-admin"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
```

---

### 步骤 3：构建命令

给 `apps/shop/package.json` 和 `apps/admin/package.json` 各加一条脚本：

```jsonc
{
  "scripts": {
    "pages:build": "npx @cloudflare/next-on-pages"
  }
}
```

在根 `package.json` 加：

```jsonc
{
  "scripts": {
    "pages:build:shop": "pnpm --filter shop pages:build",
    "pages:build:admin": "pnpm --filter admin pages:build",
    "pages:build:all": "pnpm pages:build:shop && pnpm pages:build:admin",
    "pages:preview:shop": "pnpm --filter shop exec npx wrangler pages dev .vercel/output/static --port 3003",
    "pages:preview:admin": "pnpm --filter admin exec npx wrangler pages dev .vercel/output/static --port 3002"
  }
}
```

---

### 步骤 4：在 Cloudflare Pages 控制台创建项目

**推荐用 Git 集成（自动构建）**，而不是 `wrangler` 手推——这样每次 push 自动部署。

1. 登录 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. 选您的仓库
3. **建两个项目**：`jiffoo-shop` 和 `jiffoo-admin`，分别配置：

#### 项目 `jiffoo-shop`

| 字段 | 值 |
|---|---|
| Production branch | `main`（或您要发的分支） |
| Framework preset | `Next.js (Static HTML Export)` ← **别选这个** |
| Build command | `pnpm install && pnpm --filter shop pages:build` |
| Build output directory | `apps/shop/.vercel/output/static` |
| Root directory | **留空**（仓库根） |

> 注：模板选 "None"，因为 `next-on-pages` 自己产出 `.vercel/output/static`，不是 `out/`。

#### 项目 `jiffoo-admin` 同理，把 `shop` 换成 `admin`，output 改成 `apps/admin/.vercel/output/static`。

---

### 步骤 5：配置环境变量（核心 ⚡）

在 Pages 项目 → Settings → Environment variables，分别给 Production 和 Preview 配：

#### shop 项目

| 变量 | 值 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.jiffoo.com/api` | **客户端直连后端** |
| `API_SERVICE_URL` | `https://api.jiffoo.com` | **SSR 时服务端调用后端用** |
| `NEXT_PUBLIC_SHOP_URL` | `https://shop.jiffoo.com` | 自身域名（OAuth/绝对 URL 用） |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe 前端 key |
| `NEXT_PUBLIC_SENTRY_DSN` | （可选） | Sentry 前端 DSN |
| `NEXT_PUBLIC_CDN_URL` | （可选，如用自定义 image loader） | CDN / R2 公开域名 |
| `NODE_ENV` | `production` | |
| `NEXT_TELEMETRY_DISABLED` | `1` | 关掉 Next 构建遥测，提速 |

#### admin 项目

| 变量 | 值 |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.jiffoo.com/api` |
| `API_SERVICE_URL` | `https://api.jiffoo.com` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.jiffoo.com` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `NODE_ENV` | `production` |

> ⚠️ 关键：**Pages 上 `NEXT_PUBLIC_API_URL` 必须是绝对 URL（带 https://）**，不能是 `/api`。
> 因为 Pages 没有 rewrite 代理，`/api` 会 404。

---

### 步骤 6：绑定自定义域名

Pages 项目 → Custom domains：
- shop → `shop.jiffoo.com`
- admin → `admin.jiffoo.com`

Cloudflare 自动签 SSL，自动开 CDN + DDoS（全免费）。

---

### 步骤 7：本地预览验证（可选但推荐）

```bash
# 在根目录
NEXT_PUBLIC_API_URL=https://api.jiffoo.com/api \
API_SERVICE_URL=https://api.jiffoo.com \
CF_PAGES=1 \
pnpm pages:build:shop

pnpm pages:preview:shop
# 浏览器开 http://localhost:3003，确认 SSR 渲染、API 调用正常
```

admin 同理。

---

## 四、可能踩的坑（按概率排序）

### 坑 A：`next-on-pages` 构建报某依赖用了 Node 原生模块

**症状**：`@cloudflare/next-on-pages` 报 "The package X requires Node.js runtime"。

**排查**：`@cloudflare/next-on-pages` 默认开 `nodejs_compat`。若仍报错，在 `wrangler.toml` / Pages 控制台设置里确认 `compatibility_flags = ["nodejs_compat"]`。

**根因**：您两个前端项目业务代码没用到 fs/crypto 运行期 API（已扫过），所以主要风险在**第三方库**。最常见嫌疑：
- `axios` ✅ Workers 兼容
- `@tanstack/react-query` ✅ 纯前端
- `zustand` ✅ 纯前端
- `idb`（shop）⚠️ IndexedDB，浏览器侧用，SSR 不应触碰，正常
- `recharts`/`chart.js`（admin）⚠️ 用了 canvas，但只在客户端渲染，SSR 不调用应无碍

> 如果某个库在 SSR 期被调用且用了 Node API，可能要给它加 `'use client'` 或动态 import。

### 坑 B：`next-pwa` 与 `next-on-pages` 冲突

**症状**：shop 构建报错或 Service Worker 注册异常。

**原因**：`@ducanh2912/next-pwa` 在构建期生成 SW，与 `next-on-pages` 产出格式偶尔有摩擦。

**对策**：Pages 上禁用 PWA（电商首屏 SEO 比离线缓存更重要）：

```js
// apps/shop/next.config.js
const withPWA = require('@ducanh2912/next-pwa').default;
// 把 disable 条件加上 CF_PAGES
// （在 withPWA 调用里）
disable: process.env.NODE_ENV === 'development' || process.env.CF_PAGES === '1',
```

### 坑 C：`_next/image` 优化在 Pages 上 CPU 超限

**症状**：图片请求慢或 522。

**对策**：用前面"改造 3"的方式 A，Pages 上 `unoptimized: true`，图直接走 R2/CDN。

### 坑 D：SSR 调后端时 `resolveServerApiOrigin()` 报 "Unable to resolve server API origin"

**原因**：`API_SERVICE_URL` 没配，且 Pages 上 `headers()` 拿不到 host。

**对策**：**必须配 `API_SERVICE_URL` 环境变量**（步骤 5 表格已列）。

### 坑 E：`generateBuildId` 用 `git` 在 Pages 失败

**症状**：构建日志有 `git rev-parse` 失败 warning。

**对策**：不用管，`next.config.base.js` 已有 `catch` 兜底走 md5+日期。但 Pages 构建环境**通常带 git**（因为是 Git 集成），一般不会触发兜底。

### 坑 F：CORS / Cookie 跨域

**症状**：Pages 域名 `shop.jiffoo.com` 调 `api.jiffoo.com` 时 cookie 不带、CORS 报错。

**对策**：后端 Fastify 的 CORS 配置要加：
- `origin: ['https://shop.jiffoo.com', 'https://admin.jiffoo.com']`
- `credentials: true`
- 前端 axios 请求带 `withCredentials: true`

Cookie 的 `Set-Cookie` 要设 `SameSite=None; Secure`（跨子域必须）。

### 坑 G：admin 的登录跳转 / OAuth 回调域名硬编码

**原因**：Google OAuth `GOOGLE_REDIRECT_URI` 在后端配，但前端登录页可能拼 URL。

**对策**：在 Pages 环境变量配 `NEXT_PUBLIC_ADMIN_URL`，确认登录页用它拼回调 URL（扫过 `login/page.tsx` 已用 `NEXT_PUBLIC_API_URL`，问题不大；提交后实际跑一遍登录流程验证）。

---

## 五、双部署对照表

| 维度 | 自托管 Docker（现状） | Cloudflare Pages（新增） |
|---|---|---|
| 构建产物 | `output: 'standalone'` → Docker 镜像 | `.vercel/output/static` → Pages Functions |
| API 调用 | rewrite 代理 `/api` → `API_SERVICE_URL`（容器内网） | 前端直连 `NEXT_PUBLIC_API_URL`（绝对 URL） |
| 服务端 SSR 调 API | `API_SERVICE_URL=http://api:80` | `API_SERVICE_URL=https://api.jiffoo.com` |
| 图片优化 | `_next/image` 本地 sharp | `unoptimized` 或 CDN loader |
| PWA（shop） | 生效 | 禁用（`CF_PAGES=1`） |
| rewrites | 生效 | 禁用（返回 `[]`） |
| 后端位置 | 同机/同网络容器 | 任意公网可达（推荐 Tunnel 暴露家用服务器） |
| 域名 | 自有域名 + Nginx | `*.pages.dev` 或自定义域名（免费 SSL） |
| 部署触发 | `docker compose up -d --build` | Git push 自动 |
| 改动代码量 | 0 | 仅 `next.config.base.js` rewrites 条件 + 可选 images/PWA 条件 |

---

## 六、落地清单（按顺序打勾）

- [ ] 后端 API 公网可达（Tunnel 或 VPS 域名），记下 `https://api.jiffoo.com`
- [ ] 后端 CORS 加上 Pages 域名 + `credentials: true`
- [ ] `next.config.base.js` rewrites 包 `CF_PAGES` 条件
- [ ] （可选）shop `next.config.js` images 加 `unoptimized` 条件 + PWA disable 条件
- [ ] `pnpm add -D @cloudflare/next-on-pages wrangler --filter shop --filter admin`
- [ ] 两个 `package.json` 加 `pages:build` 脚本
- [ ] 两个 `wrangler.toml` 加 `nodejs_compat`
- [ ] 根 `package.json` 加 `pages:build:*` / `pages:preview:*`
- [ ] 本地 `pnpm pages:build:shop && pnpm pages:preview:shop` 验证
- [ ] Cloudflare Pages 控制台创建 shop / admin 两个项目，连 Git
- [ ] 配全环境变量（重点 `NEXT_PUBLIC_API_URL` + `API_SERVICE_URL` 用绝对 URL）
- [ ] 绑定自定义域名
- [ ] 首次部署后：跑一遍 登录 / 浏览商品 / 加购物车 / checkout 验证
- [ ] 确认 OAuth 回调域名在 Google Console 加了 Pages 域名

---

## 七、一句话总结

业务代码零改动，只动**一个配置文件的 rewrites 条件**+ 配 **两个环境变量**，shop 和 admin 就能同时在 Cloudflare Pages 跑 SSR，且不影响您现在 Docker 自托管那条路径。后端继续留在容器里（家用服务器走 Tunnel 暴露），前后端各跑各的，免费额度吃满前端 + CDN + 安全这层。