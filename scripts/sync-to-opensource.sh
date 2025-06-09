#!/bin/bash

# 同步核心版本到开源版本
# 从 jiffoo-mall-core 同步到 Jiffoo

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "🔄 同步核心版本到开源版本..."

# 检查是否在核心仓库目录
if [ ! -f ".opensourceexclude" ]; then
    echo "❌ 请在 jiffoo-mall-core 目录运行此脚本"
    exit 1
fi

# 检查开源仓库是否存在
OPENSOURCE_DIR="../Jiffoo"
if [ ! -d "$OPENSOURCE_DIR" ]; then
    print_warning "开源仓库目录不存在: $OPENSOURCE_DIR"
    echo "请确保开源仓库在正确位置，或修改脚本中的路径"
    exit 1
fi

print_info "开始同步文件..."

# 同步文件，排除商业功能
rsync -av --exclude-from=.opensourceexclude \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='dist/' \
    ./ "$OPENSOURCE_DIR/"

print_status "文件同步完成"

# 进入开源仓库目录
cd "$OPENSOURCE_DIR"

print_info "处理开源版本特定修改..."

# 替换商业功能标记为演示版本
find . -name "*.ts" -type f -exec sed -i.bak 's/COMMERCIAL_FEATURE=true/COMMERCIAL_FEATURE=false/g' {} \;
find . -name "*.tsx" -type f -exec sed -i.bak 's/COMMERCIAL_FEATURE=true/COMMERCIAL_FEATURE=false/g' {} \;
find . -name "*.js" -type f -exec sed -i.bak 's/COMMERCIAL_FEATURE=true/COMMERCIAL_FEATURE=false/g' {} \;

# 清理可能遗漏的商业功能目录
print_info "清理可能遗漏的商业功能..."
rm -rf commercial commercial-repo-setup jiffoo-mall-commercial develop_doc logs src 2>/dev/null || true
rm -rf apps/backend/src/core/saas apps/backend/src/core/saas-marketplace 2>/dev/null || true
rm -rf apps/backend/src/core/licensing apps/backend/src/core/plugin-store 2>/dev/null || true
rm -rf apps/backend/src/core/templates apps/backend/src/core/tenant 2>/dev/null || true
rm -rf apps/backend/src/core/sales apps/backend/src/plugins/premium 2>/dev/null || true
rm -rf apps/backend/src/plugins/core 2>/dev/null || true
rm -rf apps/admin/app/business-model apps/admin/app/finance 2>/dev/null || true
rm -rf apps/admin/app/licenses apps/admin/app/marketplace 2>/dev/null || true
rm -rf apps/admin/app/plugin-store apps/admin/app/plugins/licenses 2>/dev/null || true
rm -rf apps/admin/app/api/commercial apps/admin/app/test-config 2>/dev/null || true
rm -rf apps/frontend/src/app/plugin-store 2>/dev/null || true
rm -f apps/backend/src/routes/license-routes.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/premium-analytics-plugin.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/license-service.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/monetization-examples.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/api-control.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/ecosystem-control.ts 2>/dev/null || true

# 清理商业相关文档
rm -f AI_FIRST_STRATEGY.md BUSINESS_MODEL.md BUSINESS_STRATEGY.md 2>/dev/null || true
rm -f COMMERCIALIZATION_*.md COMMERCIAL_*.md HYBRID_BUSINESS_*.md 2>/dev/null || true
rm -f MULTI_TENANT_OEM_*.md LICENSE-COMMERCIAL.md 2>/dev/null || true
rm -f DEPLOYMENT_ARCHITECTURE_ANALYSIS.md DUAL_ENVIRONMENT_*.md 2>/dev/null || true
rm -f FEATURES_COMPLETED.md FEATURE_COMPLETION_SUMMARY.md 2>/dev/null || true
rm -f PLUGIN_DEVELOPMENT_GUIDE.md PROJECT_FINAL_SUMMARY.md 2>/dev/null || true
rm -f REPOSITORY_ARCHITECTURE.md setup-commercial-repo.sh 2>/dev/null || true
rm -f setup-dual-environment.sh test-*.sh test-*.js 2>/dev/null || true

# 清理备份文件
find . -name "*.bak" -delete

# 更新 package.json 为开源版本
if [ -f "package.json" ]; then
    sed -i.bak 's/"name": "jiffoo-mall-core"/"name": "jiffoo"/' package.json
    sed -i.bak 's/"description": ".*"/"description": "A comprehensive, full-stack e-commerce platform built with modern technologies"/' package.json
    rm package.json.bak 2>/dev/null || true
fi

# 清理 server.ts 中的商业路由引用
if [ -f "apps/backend/src/server.ts" ]; then
    print_info "清理 server.ts 中的商业功能引用..."
    # 移除商业路由的导入
    sed -i.bak '/import.*licensing/d' apps/backend/src/server.ts
    sed -i.bak '/import.*plugin-store/d' apps/backend/src/server.ts
    sed -i.bak '/import.*saas/d' apps/backend/src/server.ts
    sed -i.bak '/import.*template/d' apps/backend/src/server.ts
    sed -i.bak '/import.*tenant/d' apps/backend/src/server.ts
    sed -i.bak '/import.*sales/d' apps/backend/src/server.ts
    sed -i.bak '/import.*saas-marketplace/d' apps/backend/src/server.ts

    # 移除商业路由的注册
    sed -i.bak '/licenseRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/pluginStoreRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/saasRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/templateRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/tenantRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/salesRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/saasMarketplaceRoutes/d' apps/backend/src/server.ts

    rm apps/backend/src/server.ts.bak 2>/dev/null || true
fi

# 更新 README 为开源版本
if [ -f "README.md" ] && grep -q "Private Development Repository" README.md; then
    print_info "创建开源版本的 README..."
    # 创建纯开源版本的 README
    cat > README.md << 'EOF'
# 🛍️ Jiffoo Mall - Modern E-commerce Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29-green.svg)](https://www.fastify.io/)

[中文](#中文文档) | **English**

A comprehensive, full-stack e-commerce platform built with modern technologies, featuring a robust backend API and a beautiful, responsive frontend interface.

## 🌟 Features

### Core E-commerce Features
- **User Authentication & Authorization** - JWT-based auth with role-based permissions
- **Product Management** - Complete CRUD operations with image upload support
- **Shopping Cart & Orders** - Full shopping experience with order tracking
- **Search & Filtering** - Advanced search functionality with smart suggestions
- **Inventory Management** - Real-time stock tracking with low-stock alerts
- **Payment Integration** - Ready for payment gateway integration

### Advanced Features
- **Redis Caching** - High-performance caching layer
- **Comprehensive Logging** - Operation tracking and audit logs
- **Granular Permissions** - Resource-level access control
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
   git clone https://github.com/thefreelight/Jiffoo.git
   cd Jiffoo
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

5. **Start the development servers**
   ```bash
   # Start both frontend and backend
   pnpm dev

   # Or start individually
   pnpm --filter backend dev    # Backend: http://localhost:3001
   pnpm --filter frontend dev   # Frontend: http://localhost:3002
   ```

## 📁 Project Structure

```
Jiffoo/
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
│   ├── frontend/             # Next.js web application
│   │   ├── src/
│   │   │   ├── app/          # App Router pages
│   │   │   ├── components/   # React components
│   │   │   ├── lib/          # Utility functions
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   └── stores/       # Zustand stores
│   │   └── public/           # Static assets
├── packages/
│   └── shared/               # Shared types and utilities
├── turbo.json               # Turbo build configuration
└── pnpm-workspace.yaml      # pnpm workspace configuration
```

## 🔌 Plugin System

Jiffoo Mall features an extensible plugin architecture that allows you to add custom functionality:

- **Payment Plugins** - Integrate with various payment providers
- **Shipping Plugins** - Add custom shipping methods and calculators
- **Analytics Plugins** - Extend reporting and analytics capabilities
- **UI Plugins** - Add custom components and themes

## 🌐 API Documentation

Once the backend is running, you can access the interactive API documentation at:
- **Swagger UI**: http://localhost:3001/docs
- **OpenAPI Spec**: http://localhost:3001/docs/json

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run backend tests
pnpm --filter backend test

# Run frontend tests
pnpm --filter frontend test

# Run tests in watch mode
pnpm test:watch
```

## 🚀 Production Deployment

### Using Docker

```bash
# Build the application
pnpm build

# Build Docker images
docker-compose build

# Start the application
docker-compose up -d
```

### Manual Deployment

```bash
# Build the application
pnpm build

# Start the production server
pnpm start
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

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
   git clone https://github.com/thefreelight/Jiffoo.git
   cd Jiffoo
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
EOF
fi

print_status "开源版本处理完成"

print_info "检查更改..."
if git diff --quiet; then
    print_info "没有新的更改需要提交"
else
    print_info "发现更改，准备提交..."
    git add .
    git commit -m "Sync from core repository

- Updated from jiffoo-mall-core
- Removed commercial features
- Updated for open-source distribution
- $(date '+%Y-%m-%d %H:%M:%S')"
    
    print_warning "更改已提交到本地，请手动推送到远程仓库:"
    echo "cd $OPENSOURCE_DIR && git push"
fi

print_status "同步完成！"
echo ""
echo "📋 同步结果:"
echo "   🔒 源: jiffoo-mall-core (完整版本)"
echo "   🌍 目标: Jiffoo (开源版本)"
echo "   📝 状态: 已同步并处理为开源版本"
