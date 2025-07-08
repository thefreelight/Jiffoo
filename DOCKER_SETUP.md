# 🐳 Jiffoo Mall Docker 开发环境

## 🚀 一键启动开发环境

### 方法1：使用便捷脚本（推荐）

```bash
# 启动开发环境
./docker-dev.sh start

# 查看服务状态
./docker-dev.sh status

# 查看日志
./docker-dev.sh logs

# 停止环境
./docker-dev.sh stop
```

### 方法2：直接使用 Docker Compose

```bash
# 启动开发环境
docker-compose -f docker-compose.dev.yml up -d

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f

# 停止环境
docker-compose -f docker-compose.dev.yml down
```

## 📊 服务访问地址

启动成功后，可以通过以下地址访问各个服务：

- **🛍️ 前端商城**: http://localhost:3000
- **⚙️ 管理后台**: http://localhost:3001  
- **📊 后端API**: http://localhost:8001
- **📚 API文档**: http://localhost:8001/docs
- **🗄️ PostgreSQL**: localhost:5433 (用户: jiffoo, 密码: jiffoo_dev_password)
- **🔴 Redis**: localhost:6380

## 🔧 环境说明

### 开发环境特性
- ✅ **热重载**: 代码修改自动重启
- ✅ **数据持久化**: 数据库和Redis数据持久化
- ✅ **完整日志**: 所有服务日志可查看
- ✅ **网络隔离**: 服务间通过Docker网络通信

### 包含的服务
1. **PostgreSQL 15** - 主数据库
2. **Redis 7** - 缓存和会话存储
3. **Backend API** - Fastify后端服务
4. **Frontend** - Next.js前端应用
5. **Admin Dashboard** - 管理后台

## 🛠️ 常用命令

```bash
# 查看所有服务状态
docker-compose -f docker-compose.dev.yml ps

# 重启特定服务
docker-compose -f docker-compose.dev.yml restart backend

# 查看特定服务日志
docker-compose -f docker-compose.dev.yml logs -f backend

# 进入容器调试
docker-compose -f docker-compose.dev.yml exec backend sh

# 清理所有数据（谨慎使用）
docker-compose -f docker-compose.dev.yml down -v
```

## 🐛 故障排除

### 端口冲突
如果遇到端口冲突，可以修改 `docker-compose.dev.yml` 中的端口映射。

### 数据库连接问题
确保PostgreSQL容器完全启动后再启动后端服务：
```bash
docker-compose -f docker-compose.dev.yml up -d postgres redis
# 等待10秒
docker-compose -f docker-compose.dev.yml up -d backend
```

### 权限问题
如果遇到文件权限问题：
```bash
sudo chown -R $USER:$USER ./apps/backend/uploads
sudo chown -R $USER:$USER ./apps/backend/logs
```

## 📝 开发提示

1. **代码修改**: 直接修改本地代码，容器会自动重载
2. **数据库迁移**: 在backend容器中运行 `pnpm exec prisma db push`
3. **安装依赖**: 重启对应的容器即可自动安装新依赖
4. **查看数据库**: 使用任何PostgreSQL客户端连接到 localhost:5433

## 🎯 下一步

环境启动成功后，你可以：
1. 访问前端应用开始测试功能
2. 查看API文档了解接口
3. 使用管理后台管理数据
4. 开始开发新功能
