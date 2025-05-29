# 🔌 Jiffoo Mall 插件开发指南

## 📋 概述

Jiffoo Mall 提供了一个强大的插件系统，允许开发者扩展系统功能而无需修改核心代码。插件系统基于 Fastify 的插件架构，提供了类型安全和模块化的开发体验。

## 🏗️ 插件架构

### 核心组件

1. **Plugin Interface** (`src/plugins/types.ts`)
   - 定义插件的基本结构
   - 提供类型安全的插件开发接口

2. **Plugin Manager** (`src/plugins/manager.ts`)
   - 负责插件的加载和管理
   - 提供插件生命周期管理

3. **Plugin Routes** (`src/plugins/routes.ts`)
   - 提供插件管理的 API 端点
   - 支持插件状态查询和管理

## 🚀 快速开始

### 1. 创建基础插件

```typescript
// src/plugins/my-plugin.ts
import { FastifyInstance } from 'fastify';
import { Plugin } from './types';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: '我的第一个插件',
  
  async register(app: FastifyInstance) {
    // 添加路由
    app.get('/api/plugins/my-plugin', async (request, reply) => {
      return {
        message: 'Hello from my plugin!',
        timestamp: new Date().toISOString()
      };
    });

    app.log.info(`${this.name} plugin registered successfully`);
  },
};

export default myPlugin;
```

### 2. 插件自动加载

插件文件放在 `src/plugins/` 目录下，系统会自动扫描并加载所有符合规范的插件文件。

## 📚 插件开发最佳实践

### 1. 插件结构

```typescript
interface Plugin {
  name: string;           // 插件名称（必需）
  version?: string;       // 版本号（推荐）
  description?: string;   // 描述（推荐）
  register(app: FastifyInstance): Promise<void>; // 注册函数（必需）
}
```

### 2. 路由命名规范

- 所有插件路由应以 `/api/plugins/{plugin-name}` 开头
- 使用 RESTful 风格的路由设计
- 提供健康检查端点：`/api/plugins/{plugin-name}/health`

### 3. 权限控制

```typescript
import { authMiddleware } from '@/core/auth/middleware';
import { requireRole } from '@/core/permissions/middleware';
import { UserRole } from '@/core/permissions/types';

// 需要认证的路由
app.get('/api/plugins/my-plugin/admin', {
  preHandler: [authMiddleware, requireRole(UserRole.ADMIN)]
}, async (request, reply) => {
  // 只有管理员可以访问
});
```

### 4. 错误处理

```typescript
app.get('/api/plugins/my-plugin/data', async (request, reply) => {
  try {
    // 插件逻辑
    const data = await getPluginData();
    return reply.send({ success: true, data });
  } catch (error) {
    return reply.status(500).send({
      error: 'Plugin operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

### 5. 数据库访问

```typescript
import { prisma } from '@/config/database';

// 在插件中使用数据库
const data = await prisma.user.findMany();
```

### 6. 缓存使用

```typescript
import { redisCache } from '@/core/cache/redis';

// 使用 Redis 缓存
const cacheKey = 'plugin:my-plugin:data';
const cachedData = await redisCache.get(cacheKey);

if (!cachedData) {
  const freshData = await fetchData();
  await redisCache.set(cacheKey, JSON.stringify(freshData), 300); // 5分钟
  return freshData;
}

return JSON.parse(cachedData);
```

## 🔧 高级功能

### 1. 中间件注册

```typescript
// 添加全局中间件
app.addHook('onRequest', async (request, reply) => {
  // 请求前处理
});

app.addHook('onResponse', async (request, reply) => {
  // 响应后处理
});
```

### 2. 定时任务

```typescript
// 注册定时任务
const interval = setInterval(async () => {
  // 定时执行的任务
  await performScheduledTask();
}, 60000); // 每分钟执行一次

// 清理资源（如果需要）
app.addHook('onClose', async () => {
  clearInterval(interval);
});
```

### 3. 事件监听

```typescript
// 监听系统事件
app.addHook('onReady', async () => {
  app.log.info('Plugin is ready');
});

app.addHook('onClose', async () => {
  app.log.info('Plugin is shutting down');
});
```

## 📖 API 文档集成

### 1. Schema 定义

```typescript
app.get('/api/plugins/my-plugin/data', {
  schema: {
    tags: ['my-plugin'],
    summary: '获取插件数据',
    description: '获取插件的相关数据',
    querystring: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array' },
          total: { type: 'integer' }
        }
      }
    }
  }
}, async (request, reply) => {
  // 路由处理逻辑
});
```

## 🧪 插件示例

### 1. 简单插件 (example-plugin.ts)

提供基本的插件功能演示，包括：
- 简单的 API 端点
- 健康检查
- 插件信息返回

### 2. 高级插件 (analytics-plugin.ts)

提供高级功能演示，包括：
- API 使用统计
- 实时监控
- 数据库统计
- 权限控制
- 配置管理

## 🔍 插件管理 API

### 获取插件列表
```bash
GET /api/plugins/list
Authorization: Bearer <admin_token>
```

### 获取插件状态
```bash
GET /api/plugins/status
Authorization: Bearer <admin_token>
```

### 插件健康检查
```bash
GET /api/plugins/health
```

### 重新加载插件
```bash
POST /api/plugins/reload
Authorization: Bearer <super_admin_token>
```

## 🚨 注意事项

### 1. 安全考虑
- 所有敏感操作都应该有适当的权限检查
- 验证用户输入，防止注入攻击
- 不要在插件中硬编码敏感信息

### 2. 性能考虑
- 使用缓存减少数据库查询
- 避免阻塞操作
- 合理使用异步操作

### 3. 错误处理
- 提供详细的错误信息
- 使用适当的 HTTP 状态码
- 记录错误日志

### 4. 兼容性
- 遵循系统的 API 设计规范
- 使用系统提供的工具和服务
- 保持向后兼容性

## 🔄 插件生命周期

1. **加载阶段**：系统扫描插件目录
2. **注册阶段**：调用插件的 `register` 方法
3. **运行阶段**：插件正常提供服务
4. **卸载阶段**：系统关闭时清理资源

## 📝 开发工具

### 1. 类型检查
```bash
pnpm tsc --noEmit
```

### 2. 代码格式化
```bash
pnpm prettier --write src/plugins/
```

### 3. 测试插件
```bash
curl http://localhost:3001/api/plugins/my-plugin
```

## 🎯 最佳实践总结

1. **模块化设计**：保持插件功能单一和独立
2. **类型安全**：充分利用 TypeScript 的类型系统
3. **错误处理**：提供完善的错误处理机制
4. **文档完整**：为插件 API 提供完整的文档
5. **测试覆盖**：编写充分的测试用例
6. **性能优化**：使用缓存和异步操作
7. **安全第一**：实施适当的权限控制

通过遵循这些指南，您可以开发出高质量、安全、高性能的插件来扩展 Jiffoo Mall 系统的功能。
