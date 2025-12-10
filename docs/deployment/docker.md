# Docker 部署指南

## 快速开始

### 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/jiffoo/mall/main/scripts/install.sh | bash
```

### 手动安装

1. **克隆仓库**
```bash
git clone https://github.com/jiffoo/mall.git
cd mall
```

2. **配置环境变量**
```bash
cp .env.example .env.production
# 编辑 .env.production 设置必要的密码和配置
```

3. **启动服务**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

4. **运行数据库迁移**
```bash
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

5. **访问安装向导**
打开浏览器访问 `http://admin.yourdomain.com/install`

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DOMAIN` | 是 | 主域名 (如 `jiffoo.com`) |
| `DB_PASSWORD` | 是 | PostgreSQL 密码 |
| `REDIS_PASSWORD` | 是 | Redis 密码 |
| `JWT_SECRET` | 是 | JWT 签名密钥 |
| `STRIPE_SECRET_KEY` | 否 | Stripe 支付密钥 |
| `RESEND_API_KEY` | 否 | Resend 邮件 API 密钥 |

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| API | 3001 | 后端 API |
| Admin | 3002 | 超级管理后台 |
| Tenant | 3003 | 商户后台 |
| Shop | 3004 | 商城前端 |
| Agent | 3005 | 代理商后台 |

## 常用命令

```bash
# 查看日志
docker-compose -f docker-compose.prod.yml logs -f api

# 重启服务
docker-compose -f docker-compose.prod.yml restart api

# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 备份数据库
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres jiffoo_mall > backup.sql
```

## SSL 配置

### 使用 Traefik (推荐)

启用 Traefik profile 自动获取 Let's Encrypt 证书：

```bash
docker-compose -f docker-compose.prod.yml --profile with-traefik up -d
```

### 使用 Nginx

参考 `docs/deployment/nginx.md`

## 故障排除

### 数据库连接失败
```bash
# 检查 PostgreSQL 状态
docker-compose -f docker-compose.prod.yml ps postgres
docker-compose -f docker-compose.prod.yml logs postgres
```

### API 启动失败
```bash
# 检查 API 日志
docker-compose -f docker-compose.prod.yml logs api
```

