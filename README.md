# 🛒 Jiffoo Mall - Fastify + TypeScript 商城系统

基于 Fastify + TypeScript 技术栈的现代化电商系统，具有完整的用户管理、商品管理、订单处理和支付功能。

## 🚀 技术栈

- **框架**: Fastify + TypeScript
- **ORM**: Prisma
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **身份认证**: JWT
- **缓存**: Redis
- **文件上传**: Multer + 本地存储
- **邮件服务**: Nodemailer
- **日志系统**: Pino (Fastify 内置)
- **插件系统**: 基于 Hook + Metadata 注入
- **国际化**: 自研 i18n 系统
- **API 文档**: Swagger/OpenAPI

## 📁 项目结构

```
src/
├── core/              # 核心模块
│   ├── auth/          # 认证模块
│   ├── user/          # 用户管理
│   ├── product/       # 商品管理
│   ├── order/         # 订单处理
│   ├── search/        # 搜索优化
│   ├── cache/         # Redis 缓存
│   ├── logging/       # 操作日志
│   ├── permissions/   # 细粒度权限
│   ├── statistics/    # 销售统计
│   ├── notifications/ # 通知系统
│   ├── inventory/     # 库存管理
│   ├── upload/        # 文件上传
│   └── i18n/          # 国际化
├── plugins/           # 插件系统
├── config/            # 配置文件
├── utils/             # 工具函数
├── middleware/        # 中间件
├── types/             # TypeScript 类型定义
├── prisma/            # Prisma schema
└── server.ts          # 服务器入口
```

## 🛠️ 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境配置

复制 `.env` 文件并配置：

```bash
# Database
DATABASE_URL="file:./dev.db"  # SQLite for development
# DATABASE_URL="postgresql://user:password@localhost:5432/mall"  # PostgreSQL for production

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Server
PORT=3001
HOST="0.0.0.0"
NODE_ENV="development"

# Redis
REDIS_URL="redis://localhost:6379"

# Email (可选)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760  # 10MB

# i18n
DEFAULT_LANGUAGE="zh-CN"
FALLBACK_LANGUAGE="en-US"
```

### 3. 数据库初始化

```bash
# 生成 Prisma 客户端
pnpm db:generate

# 运行数据库迁移
pnpm db:migrate

# 初始化种子数据
pnpm db:seed

# (可选) 打开 Prisma Studio
pnpm db:studio
```

### 4. 启动 Redis (可选，用于缓存)

```bash
# 使用 Docker 启动 Redis
docker run -d -p 6379:6379 redis:alpine

# 或者使用本地安装的 Redis
redis-server
```

### 5. 启动开发服务器

```bash
pnpm dev
```

服务器将在 `http://localhost:3001` 启动。

### 6. 访问 API 文档

打开浏览器访问：
- API 文档: http://localhost:3001/docs
- 健康检查: http://localhost:3001/health

## 🌟 功能特性

### 🔐 用户认证与授权
- JWT 认证机制
- 角色权限管理 (USER, ADMIN, SUPER_ADMIN)
- 安全的密码加密存储
- 完整的登录/登出流程

### 🛍️ 商品管理
- 商品 CRUD 操作
- 图片上传和管理
- 库存跟踪
- 分类和标签系统

### 🛒 订单管理
- 购物车功能
- 订单创建和状态管理
- 订单查询和筛选
- 订单统计分析

### 🔍 搜索优化
- 全文搜索功能
- 智能搜索建议
- 高级筛选 (价格、分类、库存)
- 搜索性能优化

### 💾 Redis 缓存
- 多层缓存策略
- 自动缓存失效
- 缓存性能监控
- 数据一致性保证

### 📝 操作日志
- 全面的操作记录
- 日志分类和查询
- 用户行为分析
- 系统监控

### 🔐 细粒度权限
- 资源级权限控制
- 操作权限管理
- 角色权限分配
- 权限继承机制

### 📊 销售统计
- 实时销售数据
- 多维度统计分析
- 商品销售排行
- 用户行为分析

### 📧 通知系统
- 邮件通知
- 短信通知 (可扩展)
- 通知模板管理
- 批量通知功能

### 📦 库存管理
- 实时库存跟踪
- 库存预警
- 库存操作记录
- 库存分析报告

### 📁 文件上传
- 多格式文件支持
- 文件安全验证
- 存储管理
- 文件处理

### 🔌 插件系统
- 模块化架构
- 动态插件加载
- 插件生命周期管理
- 标准化插件 API

### 🌍 国际化 (i18n)
- 15 种语言支持
- 智能语言检测
- 翻译管理系统
- 本地化数据格式
- 高性能翻译缓存

## 📚 API 文档

### 认证接口

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 用户管理

- `GET /api/users` - 获取用户列表 (管理员)
- `GET /api/users/:id` - 获取用户详情
- `PUT /api/users/:id` - 更新用户信息
- `PATCH /api/users/:id/role` - 更新用户角色 (管理员)
- `DELETE /api/users/:id` - 删除用户 (管理员)

### 商品管理

- `GET /api/products` - 获取商品列表 (公开)
- `GET /api/products/:id` - 获取商品详情 (公开)
- `POST /api/products` - 创建商品 (管理员)
- `PUT /api/products/:id` - 更新商品 (管理员)
- `DELETE /api/products/:id` - 删除商品 (管理员)
- `PATCH /api/products/:id/stock` - 更新库存 (管理员)

### 订单管理

- `POST /api/orders` - 创建订单
- `GET /api/orders/my-orders` - 获取我的订单
- `GET /api/orders` - 获取所有订单 (管理员)
- `GET /api/orders/:id` - 获取订单详情
- `PATCH /api/orders/:id/status` - 更新订单状态 (管理员)
- `POST /api/orders/:id/cancel` - 取消订单

### 支付处理

- `POST /api/payments/process` - 处理支付
- `GET /api/payments/status/:orderId` - 获取支付状态

## 🔧 开发脚本

```bash
# 开发模式
pnpm dev

# 构建项目
pnpm build

# 生产模式启动
pnpm start

# 数据库相关
pnpm db:generate    # 生成 Prisma 客户端
pnpm db:migrate     # 运行迁移
pnpm db:studio      # 打开 Prisma Studio
pnpm db:reset       # 重置数据库
```

## 🔐 认证说明

系统使用 JWT 进行身份认证：

1. 用户注册/登录后获得 JWT token
2. 在请求头中携带 token：`Authorization: Bearer <token>`
3. 系统支持两种角色：`USER` 和 `ADMIN`

## 🧩 插件系统

系统支持插件扩展，插件需要实现 `Plugin` 接口：

```typescript
interface Plugin {
  name: string;
  register(app: FastifyInstance): Promise<void>;
}
```

将插件文件放在 `src/plugins/` 目录下，系统会自动加载。

## 📝 数据模型

### User (用户)
- id, email, username, password
- avatar, role, createdAt, updatedAt

### Product (商品)
- id, name, description, price
- stock, images, createdAt, updatedAt

### Order (订单)
- id, userId, status, totalAmount
- createdAt, updatedAt

### OrderItem (订单项)
- id, orderId, productId
- quantity, unitPrice

## 🚀 部署

1. 设置生产环境变量
2. 构建项目：`pnpm build`
3. 运行迁移：`pnpm db:migrate`
4. 启动服务：`pnpm start`

## 📄 许可证

MIT License
