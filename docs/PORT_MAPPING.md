# Jiffoo Mall Core - 端口映射文档

## 服务架构说明

本仓库包含两层服务：

### 开源核心服务 (对外发布)

| 服务 | 代码目录 | 说明 |
|------|---------|------|
| jiffoo-shop | `apps/shop` | Shop 前端 |
| jiffoo-api | `apps/api` | 后端 API |
| jiffoo-admin | `apps/admin` | 商户管理后台 |
| jiffoo-opendocs | `apps/docs-public` | 公开文档 |

### Jiffoo Cloud 运营服务 (内部使用)

| 服务 | 代码目录 | 说明 |
|------|---------|------|
| jiffoo-super-admin | `apps/super-admin` | 超级管理后台（官方运营控制台） |

> **注意**：`agent`、`white-label`、`distribution-plugin`、`docs-internal` 功能已收敛为 super-admin 的内置模块/插件，不再作为独立服务部署。

---

## NodePort 端口分配 (开发/测试环境)

路由器端口转发配置：`192.168.0.100` → `106.57.7.169`

| 服务名称 | NodePort | 内部端口 | 描述 | 开源暴露 |
|---------|----------|---------|------|---------|
| jiffoo-shop | 30001 | 3000 | Shop 前端 | ✅ |
| jiffoo-api | 30002 | 3001 | 后端 API | ✅ |
| jiffoo-admin | 30003 | 3000 | 商户管理后台 | ✅ |
| jiffoo-super-admin | 30004 | 3000 | 超级管理后台 | ❌ |
| jiffoo-opendocs | 30005 | 3000 | 公开文档 | ✅ |

## 服务名称映射

| 代码目录 | K8s 服务名 | CI 构建名 | 说明 |
|---------|-----------|----------|------|
| `apps/shop` | jiffoo-shop | shop | Shop 前端 |
| `apps/api` | jiffoo-api | api | 后端 API 服务 |
| `apps/admin` | jiffoo-admin | admin | 商户管理后台 |
| `apps/super-admin` | jiffoo-super-admin | super-admin | 超级管理后台 |
| `apps/docs-public` | jiffoo-opendocs | docs-public | 公开 API 文档 |

---

## 访问 URL (开发环境)

基础域名：`http://jiffoo.chfastpay.com`

**开源核心服务：**
- 🛒 **Shop**: http://jiffoo.chfastpay.com:30001
- 🔧 **Backend API**: http://jiffoo.chfastpay.com:30002
- 👩‍💼 **Admin**: http://jiffoo.chfastpay.com:30003
- 📖 **Docs Public**: http://jiffoo.chfastpay.com:30005

**Jiffoo Cloud 运营服务：**
- 👑 **Super Admin**: http://jiffoo.chfastpay.com:30004

---

## 注意事项

1. **NodePort 范围**: Kubernetes NodePort 默认范围是 30000-32767
2. **端口 30000 未使用**: 为避免与默认端口冲突，从 30001 开始分配
3. **CORS 配置**: API 服务需要配置允许所有前端服务的跨域请求
4. **开源用户**: 只需部署 frontend + api + admin + docs-public 四个服务
5. **Super Admin**: 仅 Jiffoo Cloud 官方运营使用，包含代理管理、白标系统、分销管理等功能模块
