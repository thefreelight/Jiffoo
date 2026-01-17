# Jiffoo Mall API - Route-Level Tests

## 测试目标定义

本目录包含 **接口级单元测试 (Route-Level Tests)**，使用 Fastify `app.inject()` 直接调用接口，不启动真实端口。

### 测试分层

| 层级 | 位置 | 用途 | 特点 |
|------|------|------|------|
| **Route-Level Tests** | `apps/api/tests/` | 全接口覆盖 | Fastify inject，验证鉴权/校验/状态码/响应结构/DB副作用 |
| **Service/Unit Tests** | `apps/api/tests/unit/` | 纯函数/复杂业务 | 不依赖 Fastify/DB |
| **E2E Tests** | `tests/e2e/` | 关键链路冒烟 | 只覆盖核心流程，不承担全接口覆盖 |

### 覆盖目标

- OpenAPI 定义的 **92 个 operations / 81 个 paths** 全覆盖
- 每个 operation 最少覆盖 **2-4 条用例**

## 目录结构

```
apps/api/tests/
├── README.md                   # 本文件
├── setup.ts                    # Vitest 全局 setup
├── helpers/                    # 测试辅助工具
│   ├── create-test-app.ts      # 创建测试用 Fastify 实例
│   ├── db.ts                   # 数据库连接/迁移/清理
│   ├── auth.ts                 # 认证工厂 (createUser, signJwt)
│   ├── fixtures.ts             # 数据工厂 (products, orders, etc.)
│   └── openapi.ts              # OpenAPI schema 校验工具
├── routes/                     # Route-level 测试 (按模块组织)
│   ├── system.test.ts          # /, /health, /health/*
│   ├── auth.test.ts            # /api/auth/*
│   ├── account.test.ts         # /api/account/*
│   ├── products.test.ts        # /api/products/*
│   ├── cart.test.ts            # /api/cart/*
│   ├── orders.test.ts          # /api/orders/*
│   ├── payments.test.ts        # /api/payments/*, /success, /cancel
│   ├── admin-users.test.ts     # /api/admin/users/*
│   ├── admin-products.test.ts  # /api/admin/products/*
│   ├── admin-orders.test.ts    # /api/admin/orders/*
│   ├── admin-themes.test.ts    # /api/admin/themes/*
│   ├── admin-plugins.test.ts   # /api/admin/plugins/*
│   ├── plugins-public.test.ts  # /api/plugins/*
│   ├── themes-public.test.ts   # /api/themes/*
│   ├── upload.test.ts          # /api/upload/*
│   ├── install.test.ts         # /api/install/*
│   ├── upgrade.test.ts         # /api/upgrade/*
│   ├── extensions.test.ts      # /api/extensions/*
│   ├── logger.test.ts          # /api/logs/*
│   ├── cache.test.ts           # /api/cache/*
│   └── mall.test.ts            # /api/mall/*
└── contract/                   # 契约一致性测试
    └── openapi-contract.test.ts
```

## 如何运行测试

```bash
# 运行所有测试
pnpm --filter api test

# 运行单元测试
pnpm --filter api test:unit

# 运行集成测试 (route-level)
pnpm --filter api test:integration

# 运行覆盖率测试
pnpm --filter api test:coverage

# 监听模式
pnpm --filter api test:watch
```

## 环境准备

### 1. 测试数据库

```bash
# 复制测试环境配置
cp tests/.env.test.example tests/.env.test

# 修改 tests/.env.test 中的 DATABASE_URL 指向测试数据库
# DATABASE_URL="postgresql://user:pass@localhost:5432/jiffoo_test"

# 运行迁移
pnpm --filter api db:mode:test
```

### 2. 环境变量

测试需要以下环境变量（在 `.env.test` 中配置）：

```env
NODE_ENV=test
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key-for-testing
```

## 用例矩阵规范

每个 operation 至少覆盖以下场景：

### AuthZ 测试 (如果接口需要认证)

- [ ] 未带 token => 401
- [ ] 带普通用户 token => 200/201（或 403 如果需要 admin）
- [ ] 带 admin token => 200/201

### Validation 测试 (如果有 body/params/query 约束)

- [ ] 缺 required 字段 => 400/422
- [ ] 非法类型 => 400/422

### Business 测试

- [ ] Happy path: 返回体关键字段存在
- [ ] 响应 schema 与 OpenAPI 一致
- [ ] DB 副作用验证（如果有）

### 特殊场景 (按需)

| 接口 | 额外用例 |
|------|---------|
| POST /api/auth/login | 错误密码 => 401 |
| POST /api/cart/items | 商品不存在 => 404, 库存不足 => 400 |
| POST /api/orders/ | 购物车为空 => 400 |
| POST /api/payments/stripe/webhook | 签名错误 => 400 |
| POST /api/upload/* | 文件过大 => 413 |
| admin 系列 | 普通用户 => 403 |

## OpenAPI 鉴权规则（预期行为）

根据 `openapi.json` 分析，以下是各接口的鉴权预期：

### 需要认证的接口 (security: bearerAuth)

- `/api/auth/me` (GET)
- `/api/auth/refresh` (POST)
- `/api/auth/change-password` (POST)
- `/api/cart/*` (所有)
- `/api/orders/*` (所有)
- `/api/payments/create-session` (POST)
- `/api/admin/*` (所有)

### 公开接口 (无 security)

- `/`, `/health`, `/health/*`
- `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `/api/products/*`
- `/api/plugins/*` (public)
- `/api/themes/*` (public)
- `/api/install/*`
- `/api/mall/context`
- `/api/logs/*`
- `/api/cache/health`

### ⚠️ 需要确认的接口

| 接口 | OpenAPI 状态 | 建议 |
|------|-------------|------|
| `/api/account/profile` | 无 security | **应该需要认证** - 需要修复 |
| `/api/upgrade/*` | 无 security | **应该需要 admin 认证** - 需要修复 |
| `/api/extensions/*` | 无 security | 部分可能需要 admin 认证 |

## 编写测试示例

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../helpers/create-test-app';
import { createTestUser, signJwt } from '../helpers/auth';
import { cleanupDatabase } from '../helpers/db';
import type { FastifyInstance } from 'fastify';

describe('GET /api/auth/me', () => {
  let app: FastifyInstance;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const user = await createTestUser({ role: 'USER' });
    userToken = signJwt(user);
  });

  afterAll(async () => {
    await cleanupDatabase();
    await app.close();
  });

  it('should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return user info with valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email');
  });
});
```

## CI/CD 门禁

- 所有 PR 必须通过 route-level tests
- 覆盖率阈值：
  - Lines: 60%
  - Branches: 60%
  - Functions: 60%
  - Statements: 60%

## 维护者

- Jiffoo Team
