# 🔐 Jiffoo 服务器地址保护系统

## 概述

这个系统使用多层加密技术保护商业服务器地址，**同时允许开源版本用户访问商业服务**来购买插件和订阅 SaaS 服务，但防止用户篡改服务器地址来绕过付费验证。

## 🎯 核心目标

1. **开源用户可以购买商业服务** - 插件、SaaS 订阅、系统更新
2. **防止服务器地址篡改** - 加密保护，无法修改为恶意服务器
3. **商业版本额外保护** - 更强的加密和验证机制

## 🛡️ 安全特性

### 多层加密保护
1. **AES-256-CBC 加密** - 核心数据加密
2. **XOR 混淆** - 基于服务器类型的动态混淆
3. **Base64 编码** - 最终编码层
4. **密钥分散存储** - 密钥组件分布在多个函数中

### 动态验证
- **时间戳验证** - 每日密钥轮换
- **环境特征绑定** - 基于 Node.js 版本和应用版本
- **服务器类型匹配** - 确保解密结果与预期服务器类型一致
- **域名白名单** - 只允许 `.jiffoo.com` 域名

### 安全降级
- 解密失败时自动降级到开源服务器
- 详细的错误日志记录
- 缓存机制减少解密开销

## 📁 文件结构

```
apps/backend/src/core/security/
├── server-config.ts      # 核心加密/解密逻辑
├── usage-example.ts      # 使用示例
└── README.md            # 本文档

scripts/
└── encrypt-servers.js   # 服务器地址加密工具
```

## 🚀 使用方法

### 1. 基本使用

```typescript
import { getSecureServerUrl, SERVER_TYPES } from './core/security/server-config';

// 获取许可证服务器地址
const licenseServerUrl = getSecureServerUrl(SERVER_TYPES.LICENSE);

// 使用服务器地址
const response = await fetch(`${licenseServerUrl}validate`, {
  method: 'POST',
  body: JSON.stringify({ license: 'your-license-key' })
});
```

### 2. 健康检查

```typescript
import { validateServerConnectivity } from './core/security/server-config';

// 检查服务器连通性
const isHealthy = await validateServerConnectivity(SERVER_TYPES.PLUGIN);
```

### 3. 服务类集成

```typescript
import { licenseService, pluginService } from './core/security/usage-example';

// 验证许可证
const isValid = await licenseService.validateLicense('your-license');

// 获取可用插件
const plugins = await pluginService.getAvailablePlugins();
```

## 🔧 配置管理

### 生成新的加密配置

```bash
# 设置加密令牌
export JIFFOO_ENCRYPT_TOKEN=jiffoo-encrypt-2024

# 生成加密配置
node scripts/encrypt-servers.js --generate

# 测试加密/解密
node scripts/encrypt-servers.js --test
```

### 更新服务器地址

1. 修改 `scripts/encrypt-servers.js` 中的 `REAL_SERVERS`
2. 运行加密工具生成新的配置
3. 更新 `server-config.ts` 中的 `ENCRYPTED_SERVERS`

## 🔒 安全最佳实践

### 1. 密钥管理
- 定期轮换加密密钥
- 密钥组件分散存储
- 避免在日志中记录解密后的地址

### 2. 代码保护
- 使用代码混淆工具
- 启用 TypeScript 编译优化
- 移除开发时的调试信息

### 3. 运行时保护
- 监控异常的解密尝试
- 实施访问频率限制
- 记录所有服务器访问日志

## 🚨 故障排除

### 常见问题

**Q: 解密失败，返回开源服务器地址**
A: 检查以下项目：
- 环境变量 `APP_VERSION` 是否正确
- Node.js 版本是否匹配
- 系统时间是否正确

**Q: 服务器连接失败**
A: 验证：
- 网络连接是否正常
- 服务器地址是否正确
- 认证参数是否有效

**Q: 缓存问题**
A: 清除缓存：
```typescript
import { SecureServerConfig } from './server-config';
SecureServerConfig.getInstance().clearCache();
```

## 📊 性能考虑

- **缓存机制**: 解密结果缓存 1 小时
- **延迟加载**: 只在需要时进行解密
- **批量验证**: 支持并行健康检查

## 🔍 监控和日志

系统会记录以下事件：
- 解密成功/失败
- 服务器连接状态
- 缓存命中率
- 异常访问尝试

## ⚠️ 注意事项

1. **不要在开源版本中包含此模块**
2. **定期更新加密密钥**
3. **监控解密失败率**
4. **保护加密工具脚本**
5. **在生产环境中禁用调试日志**

## 🔄 版本兼容性

- Node.js 18+
- TypeScript 5.0+
- 支持 ESM 和 CommonJS

## 📞 支持

如有问题，请联系开发团队或查看内部文档。
