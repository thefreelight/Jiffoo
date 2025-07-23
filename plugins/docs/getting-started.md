# 插件开发快速入门

欢迎使用 Jiffoo 统一插件系统！本指南将帮助您快速开始插件开发。

## 🎯 概述

Jiffoo 插件系统是一个强大、灵活的插件架构，支持：

- **统一的插件接口**：所有插件都遵循相同的接口规范
- **类型安全**：完整的 TypeScript 支持
- **热插拔**：支持运行时安装/卸载插件
- **一键安装**：用户友好的安装体验
- **多种插件类型**：支付、认证、通知、分析等
- **商业化支持**：免费和商业插件并存

## 🚀 快速开始

### 1. 环境准备

确保您的开发环境已安装：

```bash
# Node.js 18+ 和 npm
node --version  # >= 18.0.0
npm --version

# TypeScript
npm install -g typescript

# 插件开发工具 (可选)
npm install -g @jiffoo/plugin-cli
```

### 2. 创建新插件

使用插件模板快速创建新插件：

```bash
# 方法1: 使用 CLI 工具 (推荐)
jiffoo-plugin create my-awesome-plugin

# 方法2: 手动复制模板
cp -r plugins/templates/basic plugins/community/my-awesome-plugin
cd plugins/community/my-awesome-plugin
```

### 3. 插件结构

标准的插件目录结构：

```
my-awesome-plugin/
├── index.ts              # 插件主文件
├── package.json          # 包信息
├── README.md             # 插件文档
├── config.schema.json    # 配置模式 (可选)
├── tests/                # 测试文件
│   ├── index.test.ts
│   └── integration.test.ts
├── docs/                 # 文档
│   ├── api.md
│   └── examples.md
└── assets/               # 静态资源
    ├── icon.png
    └── screenshots/
```

### 4. 基本插件代码

```typescript
import {
  UnifiedPlugin,
  UnifiedPluginMetadata,
  PluginContext,
  PluginType
} from '../../core/types';

// 插件元数据
const metadata: UnifiedPluginMetadata = {
  id: 'my-awesome-plugin',
  name: 'my-awesome-plugin',
  displayName: '我的超棒插件',
  version: '1.0.0',
  description: '这是一个示例插件',
  type: PluginType.CUSTOM,
  author: '您的名字',
  
  // 路由定义
  routes: [
    {
      method: 'GET',
      url: '/hello',
      handler: 'helloHandler',
      auth: false
    }
  ],
  
  // 权限要求
  permissions: {
    api: ['basic.read']
  }
};

// 插件实现
class MyAwesomeImplementation {
  constructor(private context: PluginContext) {}

  async initialize(): Promise<void> {
    this.context.logger.info('Plugin initialized');
  }

  async destroy(): Promise<void> {
    this.context.logger.info('Plugin destroyed');
  }

  async helloHandler(request: any, reply: any) {
    return reply.send({ message: 'Hello from my plugin!' });
  }
}

// 插件定义
const myAwesomePlugin: UnifiedPlugin = {
  metadata,
  
  async install(context: PluginContext): Promise<void> {
    // 安装逻辑
  },
  
  async activate(context: PluginContext): Promise<void> {
    const impl = new MyAwesomeImplementation(context);
    await impl.initialize();
    (this as any).implementation = impl;
  },
  
  async deactivate(context: PluginContext): Promise<void> {
    const impl = (this as any).implementation;
    if (impl) await impl.destroy();
  },
  
  async uninstall(context: PluginContext): Promise<void> {
    // 卸载逻辑
  },
  
  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        apiKey: { type: 'string', title: 'API密钥' }
      }
    };
  },
  
  async validateConfig(config: any): Promise<boolean> {
    return !!config.apiKey;
  },
  
  implementation: null
};

export default myAwesomePlugin;
```

## 📋 插件类型

### 支付插件 (Payment)

```typescript
import { PaymentPluginImplementation } from '../../core/types';

class MyPaymentPlugin implements PaymentPluginImplementation {
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    // 实现支付创建逻辑
  }
  
  async verifyPayment(paymentId: string): Promise<PaymentStatus> {
    // 实现支付验证逻辑
  }
  
  async refund(request: RefundRequest): Promise<RefundResponse> {
    // 实现退款逻辑
  }
}
```

### 认证插件 (Auth)

```typescript
import { AuthPluginImplementation } from '../../core/types';

class MyAuthPlugin implements AuthPluginImplementation {
  async authenticate(credentials: any): Promise<AuthResult> {
    // 实现认证逻辑
  }
  
  async authorize(user: any, resource: string): Promise<boolean> {
    // 实现授权逻辑
  }
}
```

### 通知插件 (Notification)

```typescript
import { NotificationPluginImplementation } from '../../core/types';

class MyNotificationPlugin implements NotificationPluginImplementation {
  async sendNotification(notification: NotificationRequest): Promise<void> {
    // 实现通知发送逻辑
  }
  
  async getDeliveryStatus(notificationId: string): Promise<DeliveryStatus> {
    // 实现状态查询逻辑
  }
}
```

## 🔧 开发工具

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 热重载插件
npm run plugin:reload my-awesome-plugin

# 测试插件
npm run plugin:test my-awesome-plugin
```

### 调试

```typescript
// 使用 context.logger 进行日志记录
context.logger.info('Info message');
context.logger.warn('Warning message');
context.logger.error('Error message', error);

// 使用调试工具
import { debugPlugin } from '../../tools/debug';
debugPlugin(myPlugin, context);
```

### 测试

```typescript
// tests/index.test.ts
import { createTestContext } from '../../tools/testing';
import myPlugin from '../index';

describe('My Awesome Plugin', () => {
  let context: PluginContext;
  
  beforeEach(() => {
    context = createTestContext({
      config: { apiKey: 'test-key' }
    });
  });
  
  test('should initialize successfully', async () => {
    await myPlugin.activate(context);
    expect(myPlugin.implementation).toBeDefined();
  });
  
  test('should handle requests', async () => {
    await myPlugin.activate(context);
    const response = await myPlugin.implementation.helloHandler({}, {
      send: jest.fn()
    });
    // 断言...
  });
});
```

## 📦 打包和发布

### 构建插件

```bash
# 构建插件
npm run build

# 验证插件
npm run plugin:validate

# 打包插件
npm run plugin:package
```

### 发布到插件市场

```bash
# 登录插件市场
jiffoo-plugin login

# 发布插件
jiffoo-plugin publish

# 更新插件
jiffoo-plugin update my-awesome-plugin
```

## 🔒 安全最佳实践

1. **输入验证**：严格验证所有输入数据
2. **权限控制**：只请求必要的权限
3. **数据加密**：敏感数据要加密存储
4. **错误处理**：不要泄露敏感信息
5. **依赖管理**：定期更新依赖包

```typescript
// 输入验证示例
async validateInput(data: any): Promise<boolean> {
  const schema = {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      amount: { type: 'number', minimum: 0 }
    },
    required: ['email', 'amount']
  };
  
  return ajv.validate(schema, data);
}

// 错误处理示例
try {
  await riskyOperation();
} catch (error) {
  this.context.logger.error('Operation failed', {
    error: error.message,
    // 不要记录敏感信息
  });
  throw new Error('操作失败，请稍后重试');
}
```

## 📚 进阶主题

- [API 参考文档](./api-reference.md)
- [最佳实践指南](./best-practices.md)
- [性能优化](./performance.md)
- [安全指南](./security.md)
- [测试指南](./testing.md)
- [部署指南](./deployment.md)

## 🤝 社区支持

- [GitHub 仓库](https://github.com/jiffoo/plugins)
- [开发者论坛](https://forum.jiffoo.com/plugins)
- [Discord 社区](https://discord.gg/jiffoo)
- [问题反馈](https://github.com/jiffoo/plugins/issues)

## 📄 许可证

本插件系统采用 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。

---

🎉 **恭喜！** 您已经掌握了插件开发的基础知识。现在可以开始创建您的第一个插件了！

如果遇到问题，请查看 [常见问题](./faq.md) 或在社区寻求帮助。
