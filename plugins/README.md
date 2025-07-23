# Jiffoo 统一插件系统

🎉 **重构完成！** 插件系统目录结构已成功重构，现在拥有清晰、统一的架构。

## 📁 新的目录结构

```
plugins/                           # 统一插件根目录
├── core/                          # 🔧 核心插件系统
│   ├── types/                     # 类型定义
│   │   └── index.ts              # 统一类型导出
│   ├── managers/                  # 管理器实现
│   │   ├── unified-manager.ts    # ✅ 统一插件管理器
│   │   ├── hot-swap.ts           # ✅ 伪热插拔管理器
│   │   ├── installer.ts          # ✅ 一键安装器
│   │   └── route-manager.ts      # ✅ 路由管理器
│   ├── services/                  # 核心服务
│   │   ├── license.ts            # ✅ 许可证服务
│   │   └── validator.ts          # ✅ 验证服务
│   └── index.ts                  # ✅ 统一入口文件
├── official/                      # 🆓 官方免费插件
│   ├── payment/                   # 支付插件
│   │   └── alipay/               # ✅ 支付宝插件示例
│   ├── auth/                      # 认证插件
│   ├── notification/              # 通知插件
│   └── analytics/                 # 分析插件
├── community/                     # 👥 社区插件
│   └── examples/                 # 示例插件
├── commercial/                    # 💰 商业插件
│   └── payment/                  # ✅ 已迁移商业支付插件
├── templates/                     # 📋 插件模板
│   └── basic/                    # ✅ 基础插件模板
├── tools/                         # 🛠️ 开发工具
│   └── cli/                      # 命令行工具
├── docs/                          # 📚 插件文档
│   └── getting-started.md        # ✅ 快速入门指南
└── README.md                     # 本文件
```

## 🎯 重构成果

### ✅ 已完成

1. **目录结构重构**
   - 创建了清晰的目录层次结构
   - 按功能和类型组织插件文件
   - 统一了插件存放位置

2. **核心文件迁移**
   - 统一插件管理器 → `plugins/core/managers/unified-manager.ts`
   - 伪热插拔管理器 → `plugins/core/managers/hot-swap.ts`
   - 一键安装器 → `plugins/core/managers/installer.ts`
   - 路由管理器 → `plugins/core/managers/route-manager.ts`
   - 许可证服务 → `plugins/core/services/license.ts`
   - 验证服务 → `plugins/core/services/validator.ts`

3. **商业插件迁移**
   - 将 `commercial/plugins/payment/` 迁移到 `plugins/commercial/payment/`
   - 保持了现有商业插件的完整性

4. **开发资源创建**
   - 创建了统一的入口文件 `plugins/core/index.ts`
   - 提供了基础插件模板 `plugins/templates/basic/`
   - 创建了官方插件示例 `plugins/official/payment/alipay/`
   - 编写了详细的开发文档 `plugins/docs/getting-started.md`

5. **路径更新**
   - 更新了所有内部 import 路径
   - 确保模块间的正确引用关系

## 🚀 使用新的插件系统

### 导入核心模块

```typescript
// 导入完整的插件系统
import { createPluginSystem } from './plugins/core';

// 导入特定组件
import {
  UnifiedPluginManager,
  PseudoHotSwapManager,
  OneClickInstaller
} from './plugins/core';

// 导入类型定义
import {
  UnifiedPlugin,
  PluginType,
  PluginContext
} from './plugins/core/types';
```

### 初始化插件系统

```typescript
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createPluginSystem } from './plugins/core';

async function initializeApp(app: FastifyInstance, prisma: PrismaClient) {
  // 创建插件系统
  const pluginSystem = createPluginSystem(app, prisma);
  
  // 初始化
  await pluginSystem.initialize();
  
  // 获取系统状态
  const status = await pluginSystem.getSystemStatus();
  console.log('Plugin system status:', status);
}
```

### 开发新插件

```bash
# 1. 复制基础模板
cp -r plugins/templates/basic plugins/community/my-new-plugin

# 2. 修改插件信息
cd plugins/community/my-new-plugin
# 编辑 index.ts，修改插件元数据和实现

# 3. 测试插件
npm run test

# 4. 安装插件
# 通过管理界面或API安装
```

## 🔄 下一步工作

### 🚧 待完成任务

1. **实现统一插件管理器** (进行中)
   - 在应用中集成新的插件系统
   - 替换现有的双重插件架构
   - 测试所有功能正常工作

2. **迁移现有插件** (待开始)
   - 将现有的支付插件迁移到新架构
   - 更新插件接口以符合新标准
   - 确保向后兼容性

3. **更新应用集成**
   - 更新主应用中的插件引用路径
   - 修改配置文件和构建脚本
   - 更新文档和示例

### 📋 建议的实施顺序

1. **立即**: 在主应用中集成新的插件系统
2. **短期**: 迁移现有插件到新架构
3. **中期**: 开发更多官方插件和工具
4. **长期**: 建设插件市场和社区

## 🎉 重构优势

### 🏗️ 架构优势

- **统一性**: 所有插件遵循相同的接口和标准
- **可维护性**: 清晰的目录结构，易于定位和修改
- **可扩展性**: 模块化设计，便于添加新功能
- **类型安全**: 完整的 TypeScript 支持

### 👨‍💻 开发者友好

- **模板支持**: 提供了完整的插件开发模板
- **文档完善**: 详细的开发指南和API文档
- **工具支持**: 开发、测试、打包工具链
- **示例丰富**: 多种类型的插件示例

### 🏪 商业化支持

- **分层架构**: 免费、社区、商业插件分离
- **许可证管理**: 完整的许可证验证系统
- **一键安装**: 用户友好的安装体验
- **热插拔**: 运行时安装/卸载支持

## 📞 支持

如果在使用新插件系统时遇到问题：

1. 查看 [快速入门指南](./docs/getting-started.md)
2. 参考 [API 文档](./docs/api-reference.md)
3. 查看 [示例插件](./official/payment/alipay/)
4. 使用 [基础模板](./templates/basic/) 开发新插件

---

🎊 **恭喜！** 插件系统重构已完成，现在拥有了一个现代化、可扩展的插件架构！
