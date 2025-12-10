# 宝塔面板部署指南

## 前置要求

- 宝塔面板 7.x+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- PM2 进程管理器

## 安装步骤

### 1. 安装依赖软件

在宝塔面板中安装：
- **软件商店** → **运行环境** → **Node.js版本管理器** → 安装 Node.js 20
- **软件商店** → **数据库** → **PostgreSQL 15**
- **软件商店** → **缓存** → **Redis**
- **软件商店** → **运行环境** → **PM2管理器**

### 2. 创建数据库

1. 打开 **数据库** → **PostgreSQL**
2. 添加数据库：
   - 数据库名：`jiffoo_mall`
   - 用户名：`jiffoo`
   - 密码：自动生成或自定义

### 3. 上传代码

1. 打开 **文件** → 进入 `/www/wwwroot/`
2. 上传项目代码或使用 Git 克隆：
```bash
cd /www/wwwroot/
git clone https://github.com/jiffoo/mall.git jiffoo-mall
cd jiffoo-mall
```

### 4. 安装依赖

```bash
# 安装 pnpm
npm install -g pnpm

# 安装项目依赖
pnpm install

# 构建项目
pnpm build
```

### 5. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
NODE_ENV=production
DATABASE_URL=postgresql://jiffoo:密码@localhost:5432/jiffoo_mall
REDIS_URL=redis://localhost:6379
JWT_SECRET=你的密钥
API_PORT=3001
```

### 6. 运行数据库迁移

```bash
cd apps/api
npx prisma migrate deploy
```

### 7. 配置 PM2

创建 `ecosystem.config.js`：
```javascript
module.exports = {
  apps: [
    {
      name: 'jiffoo-api',
      cwd: './apps/api',
      script: 'dist/server.js',
      env: { NODE_ENV: 'production', PORT: 3001 }
    },
    {
      name: 'jiffoo-admin',
      cwd: './apps/admin',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'jiffoo-shop',
      cwd: './apps/shop',
      script: 'node_modules/.bin/next',
      args: 'start -p 3004',
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

启动服务：
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 8. 配置反向代理

在宝塔面板中：
1. **网站** → **添加站点**
2. 域名：`api.yourdomain.com`
3. **设置** → **反向代理** → 添加：
   - 目标URL：`http://127.0.0.1:3001`

重复以上步骤为 admin、shop 等服务配置反向代理。

### 9. 配置 SSL

1. **网站** → 选择站点 → **SSL**
2. 选择 **Let's Encrypt** 或上传证书
3. 开启 **强制HTTPS**

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs jiffoo-api

# 重启服务
pm2 restart all

# 更新代码后重新部署
git pull
pnpm install
pnpm build
pm2 restart all
```

