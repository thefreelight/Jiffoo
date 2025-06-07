# 🏗️ Jiffoo Mall 双环境架构实施指南

## 🎯 架构概述

我们设计了一个**双环境策略**，让你既有高效的开发环境，又能真实体验用户的使用流程：

```
🔒 jiffoo-mall-core (私有)     🌍 jiffoo-mall (公开)        🔐 jiffoo-mall-commercial (私有)
├── 完整功能开发               ├── 开源版本                  ├── 商业插件
├── 快速迭代                   ├── 用户体验测试              ├── 许可证保护
├── 实验性功能                 ├── 社区友好                  └── 独立安装
└── 内部工具                   └── 从核心版本同步

你的工作流程：
开发阶段 → 核心仓库 (效率优先)
测试阶段 → 开源版本 + 插件 (用户体验)
生产部署 → 任选其一 (灵活选择)
```

## 🚀 实施步骤

### 步骤1: 运行设置脚本

```bash
# 在当前 Jiffoo 项目目录运行
./setup-dual-environment.sh
```

这个脚本会：
- ✅ 创建私有核心仓库 `jiffoo-mall-core`
- ✅ 复制完整项目到核心仓库
- ✅ 创建同步脚本和测试脚本
- ✅ 设置开发工作流工具

### 步骤2: 验证设置

```bash
# 检查仓库结构
ls -la ../
# 应该看到:
# - Jiffoo (开源版本)
# - jiffoo-mall-core (私有核心)
# - jiffoo-mall-commercial (商业插件)

# 进入核心仓库
cd ../jiffoo-mall-core

# 测试同步功能
./scripts/sync-to-opensource.sh

# 测试用户体验
./scripts/test-user-experience.sh
```

## 🔄 日常工作流程

### 开发阶段 (在核心仓库)

```bash
cd jiffoo-mall-core

# 正常开发
git checkout -b feature/new-feature
# 开发新功能...
git add .
git commit -m "Add new feature"
git push

# 快速测试
pnpm dev
```

### 用户体验测试 (定期进行)

```bash
# 在核心仓库运行
./scripts/dev-workflow.sh test

# 或者分步骤:
./scripts/sync-to-opensource.sh  # 同步到开源版本
./scripts/test-user-experience.sh  # 测试用户体验
```

### 发布流程

```bash
# 完整发布流程
./scripts/dev-workflow.sh release

# 这会自动:
# 1. 同步到开源版本
# 2. 运行用户体验测试
# 3. 推送核心仓库
# 4. 提示推送开源仓库
```

## 🛠️ 可用脚本

### 1. 同步脚本
```bash
./scripts/sync-to-opensource.sh
```
- 从核心版本同步到开源版本
- 自动移除商业功能
- 转换为开源友好的配置

### 2. 用户体验测试
```bash
./scripts/test-user-experience.sh
```
- 模拟真实用户安装流程
- 测试基本功能
- 验证插件安装体验

### 3. 开发工作流助手
```bash
./scripts/dev-workflow.sh [命令]

# 可用命令:
sync     # 同步到开源版本
test     # 用户体验测试
dev      # 启动开发服务器
build    # 构建项目
release  # 完整发布流程
status   # 显示仓库状态
help     # 显示帮助
```

## 📋 最佳实践

### 1. 开发习惯
- ✅ **主要开发在核心仓库** - 完整功能，快速迭代
- ✅ **定期同步测试** - 每周至少一次用户体验测试
- ✅ **发布前必测** - 确保开源版本可用
- ✅ **文档基于真实体验** - 用测试结果更新文档

### 2. 代码组织
```typescript
// 使用特性标记区分开源/商业功能
const COMMERCIAL_FEATURE = process.env.NODE_ENV === 'production' && 
                          process.env.COMMERCIAL_FEATURE === 'true';

if (COMMERCIAL_FEATURE) {
  // 商业功能
  return new WeChatPayProPlugin(config);
} else {
  // 开源演示功能
  return new WeChatPayDemoPlugin(config);
}
```

### 3. 环境变量管理
```bash
# 核心仓库 (.env.local)
COMMERCIAL_FEATURE=true
WECHAT_PAY_REAL_API=true

# 开源版本 (自动转换)
COMMERCIAL_FEATURE=false
WECHAT_PAY_REAL_API=false
```

## 🧪 测试策略

### 1. 开发测试 (核心仓库)
```bash
cd jiffoo-mall-core
pnpm test
pnpm build
pnpm start
```

### 2. 用户体验测试 (开源版本)
```bash
# 自动化测试
./scripts/test-user-experience.sh

# 手动测试
cd ../Jiffoo
rm -rf node_modules
pnpm install  # 体验用户的安装过程
pnpm start    # 体验用户的启动过程
```

### 3. 插件安装测试
```bash
# 在开源版本中测试插件安装
cd ../Jiffoo
pnpm add ../jiffoo-mall-commercial/plugins/payment/wechat-pay-pro
# 验证插件是否正常工作
```

## 🔍 监控和反馈

### 1. 用户体验指标
- ✅ 安装成功率
- ✅ 启动时间
- ✅ 插件安装成功率
- ✅ 文档准确性

### 2. 开发效率指标
- ✅ 同步频率
- ✅ 测试通过率
- ✅ 问题修复时间
- ✅ 发布周期

## 🎯 解决的问题

### ✅ 用户体验洞察
- 你会真实体验开源版本的安装过程
- 你会发现插件安装的痛点
- 你会理解用户的升级决策过程
- 你会确保开源版本确实有价值

### ✅ 开发效率
- 核心开发在完整环境中进行
- 不需要每次都组装插件
- 可以快速实验新功能
- 内部工具和脚本更方便

### ✅ 产品质量
- 开源版本经过你的实际使用测试
- 商业插件的安装体验得到验证
- 升级路径清晰且经过验证
- 用户文档基于真实体验编写

## 🚀 下一步

1. **运行设置脚本**
   ```bash
   ./setup-dual-environment.sh
   ```

2. **开始双环境开发**
   ```bash
   cd ../jiffoo-mall-core
   ./scripts/dev-workflow.sh help
   ```

3. **建立测试习惯**
   - 每周运行用户体验测试
   - 发布前必须测试
   - 基于测试结果改进产品

## 🎉 总结

这个双环境架构让你：
- 🚀 **高效开发** - 在完整环境中快速迭代
- 🧪 **真实测试** - 体验用户的真实使用流程
- 📈 **持续改进** - 基于真实体验优化产品
- 💰 **商业成功** - 确保付费升级路径顺畅

你现在拥有了一个既高效又贴近用户的开发环境！🎉
