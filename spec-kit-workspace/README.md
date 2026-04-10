# Jiffoo Spec-Kit 工作区

这是为Jiffoo电商平台项目配置的规格驱动开发(Spec-Driven Development)工作区。

## 🎯 项目概述

**Spec-Kit** 是GitHub开源的规格驱动开发工具包，它将规格说明书变成**可执行的**，直接生成工作实现，而不仅仅是指导开发。

### 核心价值
- ✅ **AI辅助开发** - 通过AI助手进行结构化开发
- ✅ **规格驱动** - 先定义需求，再生成实现
- ✅ **多应用协调** - 支持前后端分离项目的跨应用开发
- ✅ **质量保证** - 内置TDD和最佳实践

## 🚀 快速开始

### 1. 启动AI助手
在此目录中启动您的AI助手（推荐使用GitHub Copilot、Claude或Cursor）：

```bash
# 如果使用VS Code + Copilot
code .

# 如果使用Cursor
cursor .

# 如果使用Claude Desktop
# 直接在此目录打开
```

### 2. 验证斜杠命令
确认您的AI助手可以识别以下命令：
- `/constitution` - 查看/更新项目治理原则
- `/specify` - 定义新功能需求
- `/plan` - 制定技术实现计划
- `/tasks` - 生成可执行任务列表
- `/implement` - 执行实现

### 3. 开始开发新功能

#### 步骤1: 定义功能需求
```
/specify 为商城前端添加商品收藏功能。用户可以收藏/取消收藏商品，查看收藏列表，收藏的商品会在商品页面显示收藏状态。需要支持多租户，每个租户的用户只能看到自己的收藏。
```

#### 步骤2: 制定技术计划
```
/plan 使用现有的技术栈：后端使用Fastify + Prisma + PostgreSQL添加收藏相关的API，前端使用Next.js + React + TailwindCSS实现收藏功能UI。需要在shared包中添加相关的TypeScript类型定义。
```

#### 步骤3: 生成任务列表
```
/tasks
```

#### 步骤4: 执行实现
```
/implement
```

## 📁 项目结构

```
spec-kit-workspace/
├── .specify/                 # Spec-Kit配置文件
│   ├── memory/
│   │   └── constitution.md   # 项目治理原则
│   ├── scripts/             # 自动化脚本
│   └── templates/           # 模板文件
├── specs/                   # 功能规格说明（自动生成）
├── README.md               # 本文件
└── spec-kit/               # Spec-Kit源码（可忽略）
```

## 🎯 使用场景

### 适合使用Spec-Kit的场景：
- ✅ 为商城前端添加新的用户功能
- ✅ 为管理后台添加新的管理模块  
- ✅ 为后端API添加新的业务逻辑
- ✅ 跨应用的功能开发（如通知系统）
- ✅ 复杂的多租户功能实现

### 不适合的场景：
- ❌ 简单的样式调整
- ❌ 配置文件修改
- ❌ Bug修复（除非是复杂的架构性问题）

## 📋 项目宪法要点

我们的项目遵循以下核心原则：

1. **多租户架构优先** - 所有功能必须支持租户隔离
2. **TypeScript优先** - 所有代码必须使用TypeScript
3. **测试驱动开发** - TDD是强制性的
4. **API优先设计** - 功能从API设计开始
5. **性能与可扩展性** - 不能降低现有性能

详细内容请查看：[.specify/memory/constitution.md](.specify/memory/constitution.md)

## 🔄 工作流程

```mermaid
graph TD
    A[/specify - 定义需求] --> B[/plan - 技术计划]
    B --> C[/tasks - 任务分解]
    C --> D[/implement - 执行实现]
    D --> E[测试验证]
    E --> F[集成到主项目]
    F --> G[部署]
```

## 💡 最佳实践

1. **明确需求** - 在`/specify`时要详细描述功能的what和why
2. **技术一致性** - 在`/plan`时确保使用项目现有技术栈
3. **任务粒度** - 确保每个任务可以在20分钟内完成
4. **测试优先** - 始终遵循TDD原则
5. **文档同步** - 实现后更新相关文档

## 🔗 相关链接

- [主项目目录](../) - Jiffoo电商平台主项目
- [Spec-Kit官方文档](https://github.com/github/spec-kit)
- [项目API文档](../API_DESCRIPTION.md)

## 📞 支持

如果在使用过程中遇到问题：
1. 查看项目宪法确保符合开发原则
2. 检查AI助手是否正确识别斜杠命令
3. 参考Spec-Kit官方文档
4. 向团队寻求帮助

---

**开始您的规格驱动开发之旅吧！** 🚀
