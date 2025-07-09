# 🛍️ Jiffoo Mall - Modern E-commerce Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29-green.svg)](https://www.fastify.io/)
[![i18n](https://img.shields.io/badge/i18n-6_languages-green.svg)](https://github.com/thefreelight/Jiffoo)

> 🎉 **Latest Update**: Complete multilingual system implemented! Full i18n support with 6 languages, real-time switching, and comprehensive admin interface.
>
> 🌟 **Open Source E-commerce Platform** - A complete, modern e-commerce solution with plugin architecture, advanced multilingual support, and enterprise-ready features.

**English**

A comprehensive, full-stack e-commerce platform built with modern technologies, featuring a robust backend API, beautiful responsive frontend interface, and comprehensive multilingual support.

## 💼 Business Model

**Open Source Core + Commercial Plugins + SaaS Services**

- 🆓 **Open Source**: Core e-commerce functionality, plugin framework, demo plugins (MIT License)
- 💰 **Commercial Plugins**: Advanced payment gateways, authentication providers, marketing tools ($19.99-$99.99/month)
- 🌐 **SaaS Services**: AI-powered features, analytics, customer service automation ($199-$499/month)
- 🏢 **Enterprise**: Multi-tenant, white-label, custom development (Custom pricing)

> **Note**: This repository contains the open source core. Commercial plugins and SaaS services are available separately to ensure sustainable development and professional support.

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
- **Multilingual Support** - Complete i18n system with 6 languages, real-time switching, and admin management

### 🏢 Commercial Features
- **Plugin Store** - Marketplace for premium plugins with subscription model
- **License Management** - Secure license validation and usage tracking
- **Custom SaaS Applications** - Enterprise-grade solution licensing
- **Template Marketplace** - Design templates with multiple license types
- **Multi-tenant OEM System** - White-label reseller network with revenue sharing
- **Unified Sales Platform** - Integrated direct and OEM sales processing

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

5. **Start development servers**
   ```bash
   # Start all services (backend, frontend, admin)
   pnpm dev

   # Or start individually
   pnpm --filter backend dev    # Backend API: http://localhost:3001
   pnpm --filter frontend dev   # Frontend: http://localhost:3002
   pnpm --filter admin dev      # Admin Dashboard: http://localhost:3003
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
│   │   │   └── store/        # State management
│   │   └── public/           # Static assets
│   └── admin/                # Admin dashboard (with multilingual support)
│       ├── app/              # Admin pages and API routes
│       ├── components/       # Admin UI components
│       │   ├── ui/           # Base UI components
│       │   └── i18n/         # Multilingual components
│       ├── lib/              # Admin utilities and i18n system
│       └── docs/             # Admin documentation
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

#### Commercial APIs
- `GET /api/plugin-store/plugins` - Browse plugin marketplace
- `POST /api/plugin-store/purchase` - Purchase premium plugins
- `GET /api/licenses/validate` - Validate plugin licenses
- `GET /api/templates` - Browse template marketplace
- `POST /api/tenants/register` - Register OEM tenant
- `POST /api/sales/process` - Process unified sales (direct/OEM)

## 🧪 Testing & Status

### ✅ Testing Status (v1.0.0-beta.2)
- **Backend API** - ✅ Fully operational (port 3001)
- **Frontend Interface** - ✅ Fully operational (port 3002)
- **Admin Interface** - ✅ Fully operational (port 3003)
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

**Happy coding! 🚀**
