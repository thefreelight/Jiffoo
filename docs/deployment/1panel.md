# 1Panel 部署指南

## 前置要求

- 1Panel 面板已安装
- Docker 和 Docker Compose 已安装

## 安装步骤

### 1. 安装应用商店依赖

在 1Panel 应用商店中安装：
- **PostgreSQL** (选择 15.x 版本)
- **Redis** (选择 7.x 版本)

### 2. 创建数据库

1. 进入 **数据库** → **PostgreSQL**
2. 点击 **创建数据库**
   - 名称：`jiffoo_mall`
   - 用户名：`jiffoo`
   - 密码：自动生成

### 3. 部署 Jiffoo Mall

#### 方式一：使用 Docker Compose (推荐)

1. 进入 **容器** → **编排**
2. 点击 **创建编排**
3. 上传或粘贴 `docker-compose.prod.yml` 内容
4. 配置环境变量
5. 点击 **部署**

#### 方式二：使用应用商店

如果 Jiffoo Mall 已上架 1Panel 应用商店：
1. 进入 **应用商店**
2. 搜索 "Jiffoo Mall"
3. 点击 **安装**
4. 配置参数后确认

### 4. 配置环境变量

在编排配置中设置：
```yaml
environment:
  DOMAIN: yourdomain.com
  DB_PASSWORD: 数据库密码
  REDIS_PASSWORD: Redis密码
  JWT_SECRET: 随机生成的密钥
```

### 5. 配置反向代理

1. 进入 **网站** → **网站**
2. 点击 **创建网站** → **反向代理**
3. 配置各服务：

| 域名 | 代理地址 |
|------|----------|
| api.yourdomain.com | http://jiffoo-api:3001 |
| admin.yourdomain.com | http://jiffoo-admin:3000 |
| yourdomain.com | http://jiffoo-shop:3000 |

### 6. 配置 SSL

1. 进入网站设置 → **HTTPS**
2. 选择 **申请证书** (Let's Encrypt)
3. 开启 **强制HTTPS**

### 7. 运行数据库迁移

```bash
# 进入 API 容器
docker exec -it jiffoo-api sh

# 运行迁移
npx prisma migrate deploy
```

### 8. 完成安装向导

访问 `https://admin.yourdomain.com/install` 完成安装。

## 备份配置

### 自动备份

1. 进入 **计划任务**
2. 创建备份任务：
   - 类型：数据库备份
   - 数据库：PostgreSQL - jiffoo_mall
   - 周期：每天

### 手动备份

```bash
# 备份数据库
docker exec jiffoo-postgres pg_dump -U jiffoo jiffoo_mall > backup.sql

# 备份上传文件
tar -czvf uploads.tar.gz /opt/1panel/apps/jiffoo-mall/uploads
```

## 更新升级

```bash
# 拉取最新镜像
docker-compose -f docker-compose.prod.yml pull

# 重启服务
docker-compose -f docker-compose.prod.yml up -d

# 运行迁移
docker exec jiffoo-api npx prisma migrate deploy
```

## 故障排除

### 查看日志
```bash
# 1Panel 界面
容器 → jiffoo-api → 日志

# 命令行
docker logs -f jiffoo-api
```

### 重启服务
```bash
docker-compose -f docker-compose.prod.yml restart
```

