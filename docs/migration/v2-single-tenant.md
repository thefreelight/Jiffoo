# 迁移指南：从多服务架构到单商户核心

本文档说明如何从旧的多服务架构迁移到新的单商户核心架构。

## 架构变更概述

### 旧架构 (v1.x)

```
apps/
├── api (3001)
├── shop (3004)
├── tenant (3003)
├── admin (3002)
├── agent (3005)           # 代理商后台
├── white-label (3006)     # 白标系统
├── distribution-plugin (3007)
├── docs-internal
└── docs-public
```

### 新架构 (v2.x)

```
apps/
├── shop (3001)            # 商城前端
├── api (3002)             # 后端 API
├── tenant → admin (3003)  # 商户管理后台
├── admin → super-admin (3004)  # 超级管理后台
└── docs-public (3005)     # 公开文档

extensions/
├── plugins/
│   ├── multi-tenant/      # 多租户插件 (可选)
│   └── distribution/      # 分销系统插件 (可选)
└── themes/
```

## 主要变更

### 1. 端口映射变更

| 服务 | 旧端口 | 新端口 | 说明 |
|------|--------|--------|------|
| Shop | 3004 | 3001 | 商城前端 |
| API | 3001 | 3002 | 后端 API |
| Admin (tenant) | 3003 | 3003 | 商户后台 (不变) |
| Super Admin (admin) | 3002 | 3004 | 超管后台 |
| Docs | - | 3005 | 公开文档 |

### 2. 服务精简

以下服务已被移除或整合：
- `agent` → 整合到 `super-admin` 模块
- `white-label` → 整合到 `super-admin` 模块
- `distribution-plugin` → 转为可选插件
- `docs-internal` → 整合到 `super-admin` 模块

### 3. 多租户功能插件化

多租户功能从核心代码移到可选插件：
- 默认运行在单商户模式
- 通过安装 `multi-tenant` 插件启用多租户
- 数据完全兼容，无需迁移

## 迁移步骤

### 步骤 1: 更新代码

```bash
git pull origin main
pnpm install
```

### 步骤 2: 更新环境变量

```bash
# 旧配置
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# 新配置
API_PORT=3002
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### 步骤 3: 更新 Docker Compose

```bash
# 使用新的配置
docker-compose down
docker-compose up -d

# 或使用单商户精简模式
docker-compose -f docker-compose.single-tenant.yml up -d
```

### 步骤 4: 启用多租户 (可选)

如果需要多租户功能：

```bash
# 1. 确保插件目录存在
ls extensions/plugins/multi-tenant/

# 2. 通过 API 启用插件
curl -X POST http://localhost:3002/api/plugins/multi-tenant/enable

# 3. 重启服务
docker-compose restart api
```

## 数据库迁移

数据库 Schema 保持兼容，无需手动迁移。

```bash
# 运行数据库迁移
pnpm db:migrate

# 验证数据
pnpm db:studio
```

## 注意事项

1. **端口冲突**: 确保新端口没有被占用
2. **环境变量**: 更新所有引用旧端口的配置
3. **反向代理**: 如使用 Nginx，更新上游配置
4. **CI/CD**: 更新部署脚本中的端口和服务名

## 回滚方案

如需回滚到旧架构：

```bash
git checkout v1.x.x
pnpm install
docker-compose down
docker-compose up -d
```

## 获取帮助

- 创建 GitHub Issue
- 查看 [开发者文档](../developer/)
- 联系: opensource@jiffoo.com

