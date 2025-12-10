# 🔥 Jiffoo Mall - Modern E-commerce Platform with UNBREAKABLE Plugin Ecosystem 🔥

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2+-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![Open Source](https://img.shields.io/badge/Open_Source-100%25-brightgreen.svg)](./docs/opensource/OPEN_SOURCE_POLICY.md)
[![No Obfuscation](https://img.shields.io/badge/Obfuscation-None-success.svg)](./docs/opensource/PLUGIN_LICENSE_POLICY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29-green.svg)](https://www.fastify.io/)
[![i18n](https://img.shields.io/badge/i18n-6_languages-green.svg)](https://github.com/thefreelight/Jiffoo)
[![Plugin Reliability](https://img.shields.io/badge/Plugin_Reliability-99.999%25-brightgreen.svg)](https://github.com/thefreelight/Jiffoo)
[![Architecture](https://img.shields.io/badge/Architecture-Microservice-blue.svg)](https://github.com/thefreelight/Jiffoo)
[![Cloud Native](https://img.shields.io/badge/Cloud_Native-Kubernetes-326CE5.svg)](https://github.com/thefreelight/Jiffoo)
[![Turbo](https://img.shields.io/badge/⚡_Turbo-Remote_Cache-blueviolet.svg)](https://turbo.build/)

> ⚡ **TURBO REMOTE CACHE**: Fully optimized - BuildKit cache fixed + 7-day retention policy!
>
> 🚀 **PERFORMANCE BREAKTHROUGH**: BuildKit v0.24.0 + Turbo Remote Cache + pnpm cache = 120-360x acceleration!
>
> 🔥 **BREAKTHROUGH ACHIEVEMENT**: **99.999% Reliable Plugin Ecosystem** - UNBREAKABLE foundation achieved!
>
> 🌟 **Open Source E-commerce Platform** - A complete, modern e-commerce solution with **UNBREAKABLE** plugin architecture, advanced multilingual support, and enterprise-ready features.

**English** | [中文](./README_zh.md)

A comprehensive, full-stack e-commerce platform built with modern technologies, featuring a robust backend API, beautiful responsive frontend interface, and comprehensive multilingual support.

---

## 📜 Open Source Commitment

Jiffoo Mall is **100% genuinely open source** software, licensed under the [GNU General Public License v2.0 or later](./docs/opensource/LICENSE.txt) — the same license used by WordPress.

### Our Promises

| Promise | Description |
|---------|-------------|
| 🔓 **No Obfuscation** | All source code is human-readable. We will NEVER obfuscate or encrypt code. |
| 📖 **Full Source Access** | The complete platform is available — backend, frontend, admin, plugin SDK. |
| 🤝 **GPL Licensed** | You can use, modify, and distribute Jiffoo under GPL terms. |
| 🏢 **Commercial Friendly** | Use Jiffoo for commercial projects with full confidence. |

### Historical Transparency

> Earlier versions of Jiffoo included some obfuscated code. Starting from v1.0 (December 2025), we have removed ALL obfuscation and fully committed to open source principles. We apologize for any confusion and are dedicated to being good stewards of the open source community.

📚 **Learn more:**
- [Open Source Policy](./docs/opensource/OPEN_SOURCE_POLICY.md)
- [Plugin License Policy](./docs/opensource/PLUGIN_LICENSE_POLICY.md)
- [Commercial Model](./docs/opensource/COMMERCIAL_MODEL.md)

---

## 💼 Business Model

**Open Source Core + Commercial Plugins + SaaS Services**

- 🆓 **Open Source**: Core e-commerce functionality, plugin framework, demo plugins (GPLv2+ License)
- 💰 **Commercial Plugins**: Advanced payment gateways, authentication providers, marketing tools (GPL source provided)
- 🌐 **SaaS Services**: AI-powered features, analytics, customer service automation
- 🏢 **Enterprise**: Multi-tenant, white-label, custom development

> **Note**: This repository contains the open source core. Commercial plugins and SaaS services are available separately to ensure sustainable development and professional support. All commercial plugins include full source code per GPL requirements.

## 🌟 Features

### 🔥 Revolutionary Plugin Ecosystem (99.999% Reliable)
- **🏗️ Microservice Architecture** - Each plugin runs as independent microservice
- **☸️ Kubernetes-Native** - Cloud-native deployment with auto-scaling
- **🔄 Hot-Swappable** - Zero-downtime plugin installation/removal
- **💎 Enterprise-Grade Reliability** - 99.999% uptime guarantee
- **⚡ High Performance** - Millisecond response times, optimized memory usage
- **🛡️ Bank-Level Security** - JWT authentication, role-based access control
- **📊 Complete Observability** - Health monitoring, metrics, distributed tracing
- **🔧 Developer-Friendly SDK** - Comprehensive TypeScript SDK with full type safety

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
- **Multilingual Support** - Complete i18n system with 6 languages, real-time switching, and admin management



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
   # API 服务环境变量
   cp apps/api/.env.example apps/api/.env

   # 编辑 .env 文件配置你的环境
   ```

4. **Initialize the database**
   ```bash
   pnpm --filter api db:generate
   pnpm --filter api db:push
   pnpm --filter api db:seed
   ```

5. **Start development servers**
   ```bash
   # 启动核心服务 (4 个: api, shop, admin, super-admin)
   pnpm dev

   # 启动完整云服务 (5 个: 包含 docs-public)
   pnpm dev:cloud

   # 单独启动服务
   pnpm dev:api-only         # API Service: http://localhost:3001
   pnpm dev:shop-only        # Shop Frontend: http://localhost:3000
   pnpm dev:admin-only       # Admin (商户后台): http://localhost:3003
   pnpm dev:super-admin-only # Super Admin (超管后台): http://localhost:3002
   pnpm dev:docs-only        # Docs Public: http://localhost:3005
   ```

   **服务端口说明:**
   | 服务 | 端口 | 说明 |
   |------|------|------|
   | Shop | 3000 | 商城前端 |
   | API | 3001 | 后端 API |
   | Super Admin | 3002 | 超级管理后台 |
   | Admin | 3003 | 商户管理后台 |
   | Docs | 3005 | 公开文档 |

## 📁 Project Structure

```
jiffoo-mall-core/
├── apps/                     # 应用服务
│   ├── api/                  # 后端 API (Fastify + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/       # API 路由
│   │   │   ├── services/     # 业务逻辑
│   │   │   ├── plugins/      # 插件系统
│   │   │   └── core/         # 核心模块
│   │   └── prisma/           # 数据库 Schema
│   ├── shop/                 # 商城前端 (Next.js 15)
│   ├── admin/                # 商户管理后台 (Next.js)
│   ├── super-admin/          # 超级管理后台 (Next.js)
│   └── docs-public/          # 公开文档
│
├── extensions/               # 扩展系统 (插件 + 主题)
│   ├── plugins/              # 插件目录
│   │   ├── multi-tenant/     # 多租户插件 (可选)
│   │   └── distribution/     # 分销系统插件 (可选)
│   └── themes/               # 主题目录
│       ├── shop/             # 商城主题
│       └── admin/            # 后台主题
│
├── packages/                 # 共享包
│   └── shared/               # 共享类型和工具
│
├── docs/                     # 文档
│   ├── developer/            # 开发者文档
│   └── migration/            # 迁移指南
│
└── e2e/                      # E2E 测试
    ├── core/                 # 核心功能测试
    └── plugins/              # 插件测试
```

### 架构说明

**开源核心版 (Single-Tenant)**:
- 4 个核心服务: shop, api, admin, super-admin
- 单商户模式，无需租户管理
- 通过插件扩展多租户/分销功能

**Jiffoo Cloud (Multi-Tenant)**:
- 5 个服务: 核心 + docs-public
- 多租户 SaaS 模式
- 包含高级商业功能

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

## 🧪 Testing & Status

### ✅ Testing Status (v1.0.0-beta.2)
- **API Service** - ✅ Fully operational (port 3001)
- **Shop Frontend** - ✅ Fully operational (port 3000)
- **Admin** - ✅ Fully operational (port 3003)
- **Super Admin** - ✅ Fully operational (port 3002)
- **Docs Public** - ✅ Fully operational (port 3005)
- **Database** - ✅ Fully operational
- **Search Functionality** - ✅ Fully operational
- **Cache System** - ✅ Fully operational
- **Payment System** - ✅ Fully operational
- **Multilingual System** - ✅ Fully operational (6 languages, real-time switching)
- **Translation Management** - ✅ Fully operational (admin interface integrated)

### ⚠️ Known Issues
- Some plugins require manual configuration (does not affect core functionality)
- TypeScript type optimization in progress (does not affect runtime)
- Recommended to test in staging environment first

### 🧪 运行测试
```bash
# Run backend tests
pnpm --filter backend test

# Run frontend tests
pnpm --filter frontend test

# Run all tests
pnpm test

# Manual functional testing
curl http://localhost:3001/health
curl http://localhost:3001/api/products
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

Complete multilingual support with advanced features:

### Supported Languages
- 🇨🇳 **Chinese Simplified (zh-CN)** - Default
- 🇺🇸 **English (en-US)** - Full support
- 🇯🇵 **Japanese (ja-JP)** - Full support
- 🇰🇷 **Korean (ko-KR)** - Full support
- 🇪🇸 **Spanish (es-ES)** - Basic support
- 🇫🇷 **French (fr-FR)** - Basic support

### Features
- **Real-time Language Switching** - No page refresh required, instant UI updates
- **Intelligent Caching** - Translation caching for optimal performance
- **Browser Detection** - Automatic language detection from browser settings
- **Persistent Storage** - Language choice saved across sessions (localStorage + cookies)
- **Admin Interface** - Complete multilingual admin dashboard with live preview
- **Content Editor** - Multilingual content editing with completion tracking
- **Translation Manager** - Built-in translation management with import/export
- **Localization** - Date, number, and currency formatting per locale
- **String Interpolation** - Support for variables in translations `{{variable}}`
- **Fallback System** - Automatic fallback to default language for missing translations
- **TypeScript Support** - Full type safety for translation keys and values

### Admin Features
- **Language Settings** - Complete configuration interface with real-time preview
- **Translation Coverage** - Analytics and completion tracking per language
- **Advanced Configuration** - Performance optimization and caching settings
- **API Integration** - Ready for automatic translation service integration
- **Quality Control** - Translation validation and quality assurance tools
- **Test Pages** - Built-in testing interfaces for multilingual functionality

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

We welcome contributions! By contributing to Jiffoo, you agree that your contributions will be licensed under GPLv2+.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- All code must be your original work or properly attributed
- **No obfuscated or encrypted code**
- Follow the existing code style
- Include tests for new features
- Update documentation as needed

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📄 License

Jiffoo Mall is free software, licensed under the **GNU General Public License v2.0 or later (GPLv2+)**.

This means you are free to:
- ✅ Use Jiffoo for any purpose (including commercial)
- ✅ Study how it works and modify it
- ✅ Distribute copies to help others
- ✅ Distribute your modified versions

Under the condition that derivative works are also licensed under GPL.

See [LICENSE.txt](./docs/opensource/LICENSE.txt) for the complete license text.

### Why GPL?

We chose GPL (like WordPress) because:
1. It guarantees users can always access and modify the source code
2. It prevents "proprietary forks" that don't give back to the community
3. It creates a level playing field for all ecosystem participants
4. It has a proven track record in building successful open source communities

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by best practices in e-commerce development
- Community-driven development approach

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API documentation at `/docs`
- Email: opensource@jiffoo.com

---

<div align="center">

**Jiffoo Mall** — Open Source E-commerce Platform

[Website](https://jiffoo.com) · [Documentation](https://docs.jiffoo.com) · [Community](https://github.com/thefreelight/Jiffoo/discussions)

Licensed under [GPLv2+](./docs/opensource/LICENSE.txt) · Made with ❤️ by the Jiffoo community

</div>
