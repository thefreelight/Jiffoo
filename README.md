# 🛒 Jiffoo Mall - Fastify + TypeScript 商城系统

基于 Fastify + TypeScript 技术栈的现代化电商系统，具有完整的用户管理、商品管理、订单处理和支付功能。

## 🚀 技术栈

- **框架**: Fastify + TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **身份认证**: JWT
- **缓存**: Redis (可选)
- **插件系统**: 基于 Hook + Metadata 注入

## 📁 项目结构

```
src/
├── core/              # 核心模块
│   ├── auth/          # 认证模块
│   ├── user/          # 用户管理
│   ├── product/       # 商品管理
│   ├── order/         # 订单处理
│   └── payment/       # 支付处理
├── plugins/           # 插件系统
├── config/            # 配置文件
├── utils/             # 工具函数
├── prisma/            # Prisma schema
└── server.ts          # 服务器入口
```

## 🛠️ 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境配置

复制 `.env` 文件并配置数据库连接：

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mall"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Server
PORT=3000
HOST="0.0.0.0"
NODE_ENV="development"
```

### 3. 数据库初始化

```bash
# 生成 Prisma 客户端
pnpm db:generate

# 运行数据库迁移
pnpm db:migrate

# (可选) 打开 Prisma Studio
pnpm db:studio
```

### 4. 启动开发服务器

```bash
pnpm dev
```

服务器将在 `http://localhost:3000` 启动。

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
