# CartService Test Suite

## 测试状态

✅ **测试代码已完成** - 14个测试用例全部编写完成
⚠️ **需要Prisma客户端** - 运行测试需要先生成Prisma客户端

## 测试覆盖

### getCart() - 3个测试用例
- ✅ 应该返回用户的购物车（从缓存）
- ✅ 用户无购物车时应返回空购物车
- ✅ 应该从数据库获取购物车并缓存

### addToCart() - 5个测试用例
- ✅ 应成功添加新商品到购物车
- ✅ 商品已存在时应更新数量
- ✅ 超过库存限制应抛出错误
- ✅ 产品不存在应抛出错误
- ✅ 应正确处理租户隔离

### updateCartItem() - 3个测试用例
- ✅ 应成功更新商品数量
- ✅ 数量为0应删除商品
- ✅ 超过库存应抛出错误

### removeFromCart() - 2个测试用例
- ✅ 应成功删除商品
- ✅ 商品不存在时应正常返回（幂等操作）

### clearCart() - 1个测试用例
- ✅ 应清空所有商品

## 测试基础设施

### 测试数据工厂
- `tests/factories/product.factory.ts` - 产品数据工厂
  - createMockProduct()
  - createMockProducts()
  - createOutOfStockProduct()
  - createLowStockProduct()

- `tests/factories/cart.factory.ts` - 购物车数据工厂
  - createMockCart()
  - createMockCartItem()
  - createMockCartWithItems()
  - createEmptyCart()

### Mock设置
- Prisma Client Mock
- CacheService Mock
- LoggerService Mock

## 如何运行测试

### 前置要求

1. 生成Prisma客户端：
   ```bash
   cd apps/backend
   pnpm prisma generate
   ```

2. 运行测试：
   ```bash
   NODE_ENV=test pnpm test tests/unit/cart-service.test.ts
   ```

3. 运行测试并查看覆盖率：
   ```bash
   NODE_ENV=test pnpm exec tsx --test --experimental-test-coverage tests/unit/cart-service.test.ts
   ```

## 技术债务

⚠️ **Prisma客户端生成问题**
- 当前环境无法访问网络下载Prisma引擎二进制文件
- 需要在有网络的环境中运行 `prisma generate`
- 或使用离线模式：`PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 prisma generate`

## 测试策略

本测试套件使用以下策略：

1. **单元测试隔离**
   - 所有外部依赖都被mock
   - 不依赖真实数据库
   - 不依赖真实Redis

2. **测试数据工厂**
   - 使用工厂函数创建一致的测试数据
   - 支持部分覆盖以自定义测试场景
   - ID计数器可重置以确保测试隔离

3. **Mock策略**
   - Module.prototype.require拦截
   - 在导入CartService前设置所有mock
   - 每个测试前重置mock调用记录

## 预期测试结果

当Prisma客户端可用时，预期：
- ✅ 14/14 测试通过
- ✅ CartService覆盖率 > 75%
- ✅ 所有边界条件测试通过
- ✅ 租户隔离验证通过

## 下一步

1. 在支持网络的环境中生成Prisma客户端
2. 运行测试验证所有14个测试通过
3. 生成测试覆盖率报告
4. 如覆盖率不足75%，补充额外测试用例
