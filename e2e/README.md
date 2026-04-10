# E2E 测试指南

本文档描述了 Jiffoo Mall 项目的端到端测试规范和最佳实践。

## 目录结构

```
e2e/
├── admin/           # Admin 管理后台测试
├── shop/            # Shop 商城前端测试
├── tenant/          # Tenant 商户后台测试
├── error-scenarios/ # 错误场景测试
├── pages/           # Page Objects
├── utils/           # 测试工具
└── visual/          # 视觉回归测试
```

## 测试工具

### StrictAssertions

严格断言工具，用于替代条件检查模式。

```typescript
import { test } from '../utils/test-fixtures';

test('example', async ({ page, strict }) => {
  // ✅ 正确：使用严格断言
  await strict.mustExist(page.locator('.element'));
  await strict.mustHaveText(page.locator('.title'), 'Expected Text');
  await strict.mustNavigateTo(/\/products/);
  
  // ❌ 避免：条件检查后跳过
  // if (await element.isVisible()) { ... }
});
```

### ApiInterceptor

API 拦截器，用于验证 API 调用。

```typescript
test('example', async ({ page, apiInterceptor }) => {
  await page.goto('/products');
  await page.waitForLoadState('networkidle');
  
  // 检查 API 调用
  const calls = apiInterceptor.getCallsTo('/api/products');
  expect(calls.length).toBeGreaterThan(0);
  
  // 断言 API 被调用
  apiInterceptor.assertCalled('/api/products', { method: 'GET' });
});
```

### DataFactory

测试数据工厂，用于创建和清理测试数据。

```typescript
test('example', async ({ dataFactory }) => {
  // 创建测试用户
  const user = await dataFactory.createUser({
    email: 'test@example.com',
    password: 'Password123!',
  });
  
  // 创建测试产品
  const product = await dataFactory.createProduct(tenantId, {
    name: 'Test Product',
    price: 99.99,
  });
  
  // 数据会在测试结束后自动清理
});
```

### AuthHelper

认证助手，用于登录不同角色。

```typescript
test('example', async ({ page, auth }) => {
  // 以用户身份登录
  await auth.loginAsUser();
  
  // 以管理员身份登录
  await auth.loginAsAdmin();
  
  // 以商户身份登录
  await auth.loginAsTenant();
  
  // 登出
  await auth.logout();
});
```

## 测试 Fixtures

### 预配置的 Fixtures

```typescript
import { test } from '../utils/test-fixtures';

test('example', async ({
  page,              // 标准 Playwright page
  strict,            // StrictAssertions 实例
  apiInterceptor,    // ApiInterceptor 实例
  auth,              // AuthHelper 实例
  dataFactory,       // DataFactory 实例
  testUser,          // 预创建的测试用户
  testProduct,       // 预创建的测试产品
  authenticatedPage, // 已登录用户的 page
  adminPage,         // 已登录管理员的 page
}) => {
  // 使用 fixtures
});
```

## 测试规范

### 命名规范

- 测试文件：`{feature}.spec.ts`
- 测试描述：使用 `test.describe` 分组
- 测试名称：`should {expected behavior}`

```typescript
test.describe('Products - List', () => {
  test('should display product list', async ({ page }) => {
    // ...
  });
  
  test('should filter products by category', async ({ page }) => {
    // ...
  });
});
```

### 选择器规范

优先使用以下选择器（按优先级排序）：

1. `data-testid` 属性
2. 语义化选择器（role, aria-label）
3. 文本内容选择器
4. CSS 类选择器

```typescript
const SELECTORS = {
  // ✅ 推荐
  productList: '[data-testid="product-list"]',
  addButton: 'button:has-text("Add")',
  
  // ⚠️ 备选
  productCard: '.product-card',
};
```

### 断言规范

```typescript
// ✅ 使用严格断言
await strict.mustExist(element);
await strict.mustHaveText(element, 'text');
await strict.mustNavigateTo(/\/path/);

// ✅ 使用 Playwright expect
await expect(element).toBeVisible();
await expect(element).toHaveText('text');

// ❌ 避免软断言
// expect(await element.isVisible()).toBeTruthy();
```

### 等待策略

```typescript
// ✅ 等待网络空闲
await page.waitForLoadState('networkidle');

// ✅ 等待特定元素
await page.waitForSelector('.element');

// ⚠️ 谨慎使用固定等待
await page.waitForTimeout(1000);
```

## 错误处理

### 网络错误测试

```typescript
test('should handle API error', async ({ page }) => {
  await page.route('**/api/**', route => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Server Error' }),
    });
  });
  
  await page.goto('/products');
  // 验证错误处理
});
```

### 空状态测试

```typescript
test('should display empty state', async ({ page }) => {
  await page.route('**/api/products**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ products: [], total: 0 }),
    });
  });
  
  await page.goto('/products');
  // 验证空状态显示
});
```

## 运行测试

```bash
# 运行所有测试
pnpm test:e2e

# 运行特定测试文件
pnpm test:e2e e2e/shop/products.spec.ts

# 运行特定测试组
pnpm test:e2e --grep "Products"

# 以 UI 模式运行
pnpm test:e2e --ui

# 生成报告
pnpm test:e2e --reporter=html
```

## 调试技巧

```bash
# 启用调试模式
PWDEBUG=1 pnpm test:e2e

# 显示浏览器
pnpm test:e2e --headed

# 慢速执行
pnpm test:e2e --slow-mo=500
```

## 最佳实践

1. **独立性**：每个测试应该独立运行，不依赖其他测试的状态
2. **清理**：使用 fixtures 自动清理测试数据
3. **稳定性**：避免使用固定等待，使用适当的等待策略
4. **可读性**：使用清晰的测试名称和注释
5. **维护性**：使用 Page Objects 和选择器常量
