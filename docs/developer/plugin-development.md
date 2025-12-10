# 插件开发指南

## 概述

Jiffoo Mall 支持两种类型的插件：
- **内置插件** - 在平台代码库中开发
- **外部插件** - 独立部署的服务

本指南主要介绍外部插件开发。

## 快速开始

### 1. 安装 SDK

```bash
npm install @jiffoo/plugin-sdk
```

### 2. 创建插件清单

```typescript
// manifest.json
{
  "slug": "my-payment-plugin",
  "name": "My Payment Plugin",
  "version": "1.0.0",
  "description": "A custom payment integration",
  "author": "Your Name",
  "category": "payment",
  "capabilities": ["payment.process", "payment.refund"],
  "webhooks": {
    "events": ["order.created", "order.paid"],
    "url": "/webhooks"
  },
  "configSchema": {
    "apiKey": {
      "type": "secret",
      "label": "API Key",
      "required": true
    },
    "sandbox": {
      "type": "boolean",
      "label": "Sandbox Mode",
      "default": true
    }
  }
}
```

### 3. 实现插件服务

```typescript
import express from 'express';
import {
  createSignatureMiddleware,
  createContextMiddleware,
  validateManifest
} from '@jiffoo/plugin-sdk';

const app = express();
const SHARED_SECRET = process.env.PLUGIN_SECRET!;

// 验证签名
app.use('/api', createSignatureMiddleware(SHARED_SECRET));

// 注入上下文
app.use('/api', createContextMiddleware());

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 安装回调
app.post('/api/install', (req, res) => {
  const { tenantId, installationId, config } = req.body;
  // 保存安装信息
  res.json({ success: true });
});

// 卸载回调
app.post('/api/uninstall', (req, res) => {
  const { tenantId, installationId } = req.body;
  // 清理数据
  res.json({ success: true });
});

// 业务 API
app.post('/api/process-payment', (req, res) => {
  const context = req.pluginContext;
  // 处理支付
  res.json({ success: true, transactionId: 'xxx' });
});

app.listen(3000);
```

## 插件清单 (Manifest)

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `slug` | string | 唯一标识符，小写字母和连字符 |
| `name` | string | 显示名称 |
| `version` | string | 版本号 (semver) |
| `description` | string | 描述 |
| `author` | string | 作者 |
| `category` | string | 分类 |
| `capabilities` | string[] | 能力列表 |

### 可选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `webhooks` | object | Webhook 配置 |
| `configSchema` | object | 配置 Schema |
| `requiredScopes` | string[] | 所需权限 |

### 分类 (Category)

- `payment` - 支付
- `email` - 邮件
- `integration` - 集成
- `analytics` - 分析
- `marketing` - 营销
- `shipping` - 物流
- `seo` - SEO
- `social` - 社交
- `security` - 安全

### 能力 (Capabilities)

```
payment.process    - 处理支付
payment.refund     - 退款
email.send         - 发送邮件
email.template     - 邮件模板
auth.oauth         - OAuth 登录
auth.sso           - 单点登录
webhook.receive    - 接收 Webhook
webhook.send       - 发送 Webhook
storage.upload     - 文件上传
storage.download   - 文件下载
analytics.track    - 事件追踪
analytics.report   - 报表
shipping.calculate - 运费计算
shipping.track     - 物流追踪
```

## 配置 Schema

### 字段类型

| 类型 | 说明 |
|------|------|
| `string` | 文本输入 |
| `number` | 数字输入 |
| `boolean` | 开关 |
| `select` | 单选下拉 |
| `multiselect` | 多选 |
| `secret` | 密码/密钥 |
| `url` | URL |
| `email` | 邮箱 |

### 示例

```json
{
  "apiKey": {
    "type": "secret",
    "label": "API Key",
    "description": "Your API key from the dashboard",
    "required": true
  },
  "environment": {
    "type": "select",
    "label": "Environment",
    "options": [
      { "value": "sandbox", "label": "Sandbox" },
      { "value": "production", "label": "Production" }
    ],
    "default": "sandbox"
  },
  "webhookUrl": {
    "type": "url",
    "label": "Webhook URL",
    "validation": {
      "pattern": "^https://",
      "message": "Must be HTTPS"
    }
  }
}
```

## 签名验证

平台发送的每个请求都包含 HMAC 签名：

```
X-Platform-Signature: sha256=xxx
X-Platform-Timestamp: 1234567890
```

使用 SDK 验证：

```typescript
import { verifySignature } from '@jiffoo/plugin-sdk';

const isValid = verifySignature(
  sharedSecret,
  req.method,
  req.path,
  req.body,
  req.headers['x-platform-timestamp'],
  req.headers['x-platform-signature']
);
```

## 上下文信息

每个请求包含以下 Header：

| Header | 说明 |
|--------|------|
| `x-tenant-id` | 租户 ID |
| `x-installation-id` | 安装 ID |
| `x-user-id` | 用户 ID (可选) |
| `x-platform-env` | 环境 |

## 发布插件

1. 验证清单：`validateManifest(manifest)`
2. 部署服务
3. 在插件商城提交审核
4. 审核通过后上架

