# Vercel 部署指南

## 概述

Vercel 适合部署前端应用 (Admin, Tenant, Shop)。后端 API 需要单独部署到支持 Node.js 的平台。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │  Admin  │  │ Tenant  │  │  Shop   │  │  Agent  │    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │
└───────┼────────────┼────────────┼────────────┼─────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           │
                    ┌──────▼──────┐
                    │   API 服务   │  (Railway/Render/自建)
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐            ┌──────▼─────┐
        │ PostgreSQL │            │   Redis    │
        └───────────┘            └────────────┘
```

## 部署前端到 Vercel

### 1. 连接 Git 仓库

1. 登录 [Vercel](https://vercel.com)
2. 点击 **New Project**
3. 导入 Git 仓库

### 2. 配置项目

为每个前端应用创建单独的项目：

#### Admin 应用
- **Root Directory**: `apps/admin`
- **Framework Preset**: Next.js
- **Build Command**: `pnpm build`
- **Output Directory**: `.next`

环境变量：
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### Shop 应用
- **Root Directory**: `apps/shop`
- 其他配置同上

#### Tenant 应用
- **Root Directory**: `apps/tenant`
- 其他配置同上

### 3. 配置域名

1. 进入项目 **Settings** → **Domains**
2. 添加自定义域名
3. 配置 DNS 记录

## 部署 API 到 Railway

### 1. 创建项目

1. 登录 [Railway](https://railway.app)
2. 点击 **New Project** → **Deploy from GitHub repo**

### 2. 配置服务

- **Root Directory**: `apps/api`
- **Start Command**: `node dist/server.js`

### 3. 添加数据库

1. 点击 **New** → **Database** → **PostgreSQL**
2. 点击 **New** → **Database** → **Redis**

### 4. 配置环境变量

```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=your-secret-key
API_PORT=3001
```

## 部署 API 到 Render

### 1. 创建 Web Service

1. 登录 [Render](https://render.com)
2. 点击 **New** → **Web Service**
3. 连接 Git 仓库

### 2. 配置

- **Root Directory**: `apps/api`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `node dist/server.js`

### 3. 添加数据库

1. **New** → **PostgreSQL**
2. **New** → **Redis**

## Monorepo 配置

在项目根目录创建 `vercel.json`：

```json
{
  "buildCommand": "pnpm build --filter=admin",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

## 环境变量汇总

### 前端应用
| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_URL` | API 服务地址 |

### API 服务
| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `REDIS_URL` | Redis 连接字符串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `NODE_ENV` | `production` |

## 注意事项

1. **冷启动**: Serverless 平台可能有冷启动延迟
2. **数据库连接**: 使用连接池管理数据库连接
3. **文件上传**: 需要配置外部存储 (如 S3, Cloudflare R2)
4. **WebSocket**: 如需实时功能，考虑使用 Pusher 或 Ably

