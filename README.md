# 🛍️ Jiffoo Mall - Modern E-commerce Platform

[中文](#中文文档) | **English**

A comprehensive, full-stack e-commerce platform built with modern technologies, featuring a robust backend API and a beautiful, responsive frontend interface.

## 🌟 Features

### Core E-commerce Features
- **User Authentication & Authorization** - JWT-based auth with role-based permissions
- **Product Management** - Complete CRUD operations with image uploads
- **Shopping Cart & Orders** - Full shopping experience with order tracking
- **Search & Filtering** - Advanced search with intelligent suggestions
- **Inventory Management** - Real-time stock tracking with alerts
- **Payment Integration** - Ready for payment gateway integration

### Advanced Features
- **Redis Caching** - High-performance caching layer
- **Comprehensive Logging** - Operation tracking and audit trails
- **Fine-grained Permissions** - Resource-level access control
- **Sales Analytics** - Business intelligence and reporting
- **Email Notifications** - Template-based notification system
- **File Upload System** - Secure file handling with validation
- **Plugin Architecture** - Extensible modular system
- **Internationalization** - Multi-language support (15 languages)

## 🏗️ Tech Stack

### Backend
- **Framework**: Fastify + TypeScript
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- **Authentication**: JWT with bcrypt password hashing
- **Caching**: Redis for high-performance data caching
- **File Upload**: Multer with image processing
- **Email**: Nodemailer with template support
- **Validation**: Zod schema validation
- **Documentation**: OpenAPI/Swagger integration

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives
- **State Management**: Zustand + React Query
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion
- **Icons**: Lucide React

### DevOps & Tools
- **Package Manager**: pnpm with workspace support
- **Build Tool**: Turbo for monorepo builds
- **Code Quality**: ESLint + Prettier
- **Type Safety**: TypeScript strict mode
- **API Testing**: Built-in Swagger UI
- **Development**: Hot reload for both frontend and backend

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jiffoo-mall
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   # Backend environment
   cp apps/backend/.env.example apps/backend/.env
   
   # Edit the .env file with your configuration
   ```

4. **Initialize the database**
   ```bash
   pnpm --filter backend db:generate
   pnpm --filter backend db:push
   pnpm --filter backend db:seed
   ```

5. **Start development servers**
   ```bash
   # Start both frontend and backend
   pnpm dev
   
   # Or start individually
   pnpm --filter backend dev    # Backend: http://localhost:3001
   pnpm --filter frontend dev   # Frontend: http://localhost:3002
   ```

## 📁 Project Structure

```
jiffoo-mall/
├── apps/
│   ├── backend/              # Fastify API server
│   │   ├── src/
│   │   │   ├── routes/       # API route handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── middleware/   # Custom middleware
│   │   │   ├── core/         # Core systems (cache, logging, etc.)
│   │   │   └── plugins/      # Plugin system
│   │   ├── prisma/           # Database schema and migrations
│   │   └── uploads/          # File upload storage
│   └── frontend/             # Next.js web application
│       ├── src/
│       │   ├── app/          # App Router pages
│       │   ├── components/   # React components
│       │   ├── lib/          # Utility functions
│       │   ├── hooks/        # Custom React hooks
│       │   └── store/        # State management
│       └── public/           # Static assets
├── packages/
│   └── shared/               # Shared types and utilities
└── docs/                     # Documentation
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Email (optional)
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_USER="your-email@example.com"
SMTP_PASS="your-password"

# Server
PORT=3001
NODE_ENV="development"
```

## 📚 API Documentation

The API documentation is automatically generated and available at:
- **Swagger UI**: http://localhost:3001/docs
- **OpenAPI JSON**: http://localhost:3001/openapi.json

### Key API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

#### Products
- `GET /api/products` - List products with pagination
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)

#### Orders
- `GET /api/orders` - List user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details

#### Search
- `GET /api/search/products` - Search products
- `GET /api/search/suggestions` - Get search suggestions

## 🧪 Testing

```bash
# Run backend tests
pnpm --filter backend test

# Run frontend tests
pnpm --filter frontend test

# Run all tests
pnpm test
```

## 🚀 Deployment

### Production Build
```bash
# Build all packages
pnpm build

# Start production servers
pnpm start
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Environment Setup
1. Set up PostgreSQL database
2. Configure Redis for caching
3. Set up email service (SMTP)
4. Configure file storage (local/cloud)
5. Set production environment variables

## 🔌 Plugin System

The platform includes a powerful plugin system for extending functionality:

```typescript
// Example plugin
export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  async register(fastify) {
    fastify.get('/api/my-plugin/hello', async () => {
      return { message: 'Hello from plugin!' };
    });
  }
};
```

## 🌍 Internationalization

Supports 15 languages with automatic detection:
- English (en-US) - Default
- Chinese Simplified (zh-CN)
- Japanese (ja-JP)
- Korean (ko-KR)
- Spanish (es-ES)
- French (fr-FR)
- And more...

## 📊 Monitoring & Analytics

### Built-in Analytics
- User behavior tracking
- Sales performance metrics
- Inventory monitoring
- System performance stats

### Health Checks
- `GET /health` - System health status
- `GET /api/cache/health` - Cache system status
- `GET /api/plugins/health` - Plugin system status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by best practices in e-commerce development
- Community-driven development approach

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API documentation at `/docs`

---

# 中文文档

**中文** | [English](#jiffoo-mall---modern-e-commerce-platform)

一个使用现代技术构建的全面全栈电商平台，具有强大的后端 API 和美观的响应式前端界面。

## 🌟 功能特性

### 核心电商功能
- **用户认证与授权** - 基于 JWT 的认证，支持角色权限管理
- **商品管理** - 完整的 CRUD 操作，支持图片上传
- **购物车与订单** - 完整的购物体验，支持订单跟踪
- **搜索与筛选** - 高级搜索功能，智能搜索建议
- **库存管理** - 实时库存跟踪，库存预警
- **支付集成** - 支持支付网关集成

### 高级功能
- **Redis 缓存** - 高性能缓存层
- **全面日志记录** - 操作跟踪和审计日志
- **细粒度权限** - 资源级访问控制
- **销售分析** - 商业智能和报表
- **邮件通知** - 基于模板的通知系统
- **文件上传系统** - 安全的文件处理和验证
- **插件架构** - 可扩展的模块化系统
- **国际化** - 多语言支持（15种语言）

## 🏗️ 技术栈

### 后端
- **框架**: Fastify + TypeScript
- **数据库**: SQLite（开发）/ PostgreSQL（生产）+ Prisma ORM
- **认证**: JWT + bcrypt 密码加密
- **缓存**: Redis 高性能数据缓存
- **文件上传**: Multer + 图片处理
- **邮件**: Nodemailer + 模板支持
- **验证**: Zod 模式验证
- **文档**: OpenAPI/Swagger 集成

### 前端
- **框架**: Next.js 15 + App Router
- **语言**: TypeScript
- **样式**: Tailwind CSS + 自定义设计系统
- **UI 组件**: Radix UI 原语
- **状态管理**: Zustand + React Query
- **表单**: React Hook Form + Zod 验证
- **动画**: Framer Motion
- **图标**: Lucide React

### 开发工具
- **包管理器**: pnpm + workspace 支持
- **构建工具**: Turbo monorepo 构建
- **代码质量**: ESLint + Prettier
- **类型安全**: TypeScript 严格模式
- **API 测试**: 内置 Swagger UI
- **开发**: 前后端热重载

## 🚀 快速开始

### 环境要求
- Node.js 18+ 
- pnpm（推荐）或 npm
- Redis（可选，用于缓存）

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd jiffoo-mall
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **设置环境变量**
   ```bash
   # 后端环境变量
   cp apps/backend/.env.example apps/backend/.env
   
   # 编辑 .env 文件配置
   ```

4. **初始化数据库**
   ```bash
   pnpm --filter backend db:generate
   pnpm --filter backend db:push
   pnpm --filter backend db:seed
   ```

5. **启动开发服务器**
   ```bash
   # 同时启动前后端
   pnpm dev
   
   # 或单独启动
   pnpm --filter backend dev    # 后端: http://localhost:3001
   pnpm --filter frontend dev   # 前端: http://localhost:3002
   ```

---

**Happy coding! 🚀**
