# 测试指南 - API 服务

本文档描述 API 服务的测试架构、运行方式和编写指南。

## 测试架构

```
tests/
├── setup.ts              # 全局测试设置
├── unit/                 # 单元测试
│   ├── auth/            # 认证模块测试
│   ├── cart/            # 购物车模块测试
│   └── order/           # 订单模块测试
├── property/            # 属性测试 (fast-check)
├── integration/         # 集成测试
├── fixtures/            # 测试数据
│   ├── tenants.fixture.ts
│   ├── users.fixture.ts
│   ├── products.fixture.ts
│   └── orders.fixture.ts
└── utils/               # 测试工具
    ├── create-test-app.ts
    ├── auth-helpers.ts
    ├── test-database.ts
    └── mocks/           # Mock 服务
```

## 运行测试

```bash
# 运行所有测试
pnpm test

# 运行单元测试
pnpm test:unit

# 运行属性测试
pnpm test:property

# 运行集成测试
pnpm test:integration

# 监视模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage

# UI 模式
pnpm test:ui
```

## 测试类型

### 单元测试

测试独立的函数和类，不依赖外部服务。

```typescript
import { describe, it, expect } from 'vitest';

describe('MyService', () => {
  it('should do something', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### 属性测试

使用 fast-check 进行属性测试，验证不变性。

```typescript
import * as fc from 'fast-check';

it('should maintain invariant', () => {
  fc.assert(
    fc.property(fc.integer(), (n) => {
      expect(myFunction(n)).toBeGreaterThanOrEqual(0);
    }),
    { numRuns: 100 }
  );
});
```

### 集成测试

测试 API 端点，使用 supertest。

```typescript
import { createTestApp } from '../utils/create-test-app';

describe('Auth Routes', () => {
  it('should register user', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { /* ... */ }
    });
    expect(response.statusCode).toBe(201);
  });
});
```

## 测试工具

### 认证辅助

```typescript
import { createTestToken, createUserToken, createAdminToken } from '../utils/auth-helpers';

const token = createUserToken({ tenantId: 999 });
const headers = { Authorization: `Bearer ${token}` };
```

### 测试 Fixtures

```typescript
import { TEST_USER, TEST_PRODUCT, TEST_ORDER } from '../fixtures';

// 使用预定义的测试数据
const userId = TEST_USER.id;
```

### Mock 服务

```typescript
import { createMockStripe, createMockResend, createMockRedis } from '../utils/mocks';

const mockStripe = createMockStripe();
const mockRedis = createMockRedis();
```

## 编写测试指南

1. **命名约定**: `*.test.ts` 或 `*.spec.ts`
2. **隔离性**: 每个测试应该独立运行
3. **清理**: 使用 `beforeEach`/`afterEach` 清理状态
4. **断言**: 使用明确的断言，避免 `toBeTruthy()`
5. **Mock**: 隔离外部依赖，使用 Mock 服务

## 覆盖率目标

- Lines: 60%+
- Branches: 60%+
- Functions: 60%+
- Statements: 60%+

查看覆盖率报告: `coverage/index.html`

