# Admin Core

> **状态:** 待实现 (Placeholder)

## 职责
- 提供 `apps/admin` 与 `apps/super-admin` 共享的 UI/路由/模块
- 减少重复造轮子,提升开发效率

## 复用边界
- **UI 组件与布局**: 通用的管理后台 UI 组件
- **共享路由与页面模块**: 商户和平台都需要的页面(如仪表盘、设置等)
- **插件/主题运行时集成**: UI 层的集成能力

## 约束
- ❌ **不允许 import 任何 `apps/*` 代码**
- ❌ **不在内部 hardcode 平台专属业务逻辑**(保持可复用)
- ✅ 只提供可复用的 UI/路由/模块,具体业务逻辑由各 app 实现

## 差异化方式
- 通过 **feature flags** 或 **权限策略层** 控制同一路由在 admin/super-admin 的可见性与行为差异
- 不在 admin-core 内 hardcode 平台专属业务逻辑

## 参考
- 蓝图: `../../.kiro/specs/PLATFORM_FINAL_BLUEPRINT.md` 第 7 章
- PRD: `../../.kiro/specs/PRD.md`
