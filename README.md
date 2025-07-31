# 🔥 Jiffoo Mall - Open Source E-commerce Platform 🔥

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29-green.svg)](https://www.fastify.io/)
[![i18n](https://img.shields.io/badge/i18n-6_languages-green.svg)](https://github.com/thefreelight/Jiffoo)
[![Plugin System](https://img.shields.io/badge/Plugin_System-Extensible-brightgreen.svg)](https://github.com/thefreelight/Jiffoo)
[![Architecture](https://img.shields.io/badge/Architecture-Microservice-blue.svg)](https://github.com/thefreelight/Jiffoo)
[![Cloud Native](https://img.shields.io/badge/Cloud_Native-Ready-326CE5.svg)](https://github.com/thefreelight/Jiffoo)

> 🌟 **Open Source E-commerce Platform** - A complete, modern e-commerce solution with extensible plugin architecture, advanced multilingual support, and production-ready features.
>
> 🎉 **Latest Update**: Revolutionary plugin ecosystem with microservice architecture, achieving enterprise-grade reliability and unlimited scalability.
>
> 🔥 **100% Open Source** - MIT Licensed, community-driven development, no hidden commercial features.

**English**

A comprehensive, full-stack e-commerce platform built with modern technologies, featuring a robust backend API, beautiful responsive frontend interface, and comprehensive multilingual support.

## 🌟 Features

### 🔥 Revolutionary Plugin Ecosystem
- **🏗️ Microservice Architecture** - Each plugin runs as independent microservice
- **☸️ Cloud-Native** - Kubernetes-ready deployment with auto-scaling
- **🔄 Hot-Swappable** - Zero-downtime plugin installation/removal
- **💎 Production-Ready** - Battle-tested reliability and performance
- **⚡ High Performance** - Optimized for speed and efficiency
- **🛡️ Secure** - JWT authentication, role-based access control
- **📊 Observable** - Health monitoring, metrics, and logging
- **🔧 Developer-Friendly** - Comprehensive TypeScript SDK

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
- **Caching**: Redis for session management and performance
- **File Storage**: Local filesystem with upload validation
- **Logging**: Winston with structured logging
- **API Documentation**: Swagger/OpenAPI integration

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict type checking
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for client state
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Custom component library
- **Internationalization**: next-i18next with 6 languages

### Admin Panel
- **Framework**: Next.js 15 with TypeScript
- **Authentication**: JWT-based admin authentication
- **UI**: Modern dashboard with responsive design
- **Features**: User management, product management, order tracking
- **Analytics**: Sales reports and business intelligence

### DevOps & Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for development
- **Database**: PostgreSQL with automated migrations
- **Caching**: Redis for performance optimization
- **Monitoring**: Health checks and logging
- **Deployment**: Production-ready configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Docker and Docker Compose
- PostgreSQL (for production)
- Redis (for caching)

### Development Setup
```bash
# Clone the repository
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start development servers
pnpm dev
```

### Production Deployment
```bash
# Build and start with Docker
docker-compose up -d

# Or build manually
pnpm build
pnpm start
```

## 📚 Documentation

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

#### Products
- `GET /api/products` - List products with pagination
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

#### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:id` - Update cart item
- `DELETE /api/cart/items/:id` - Remove cart item

#### Orders
- `GET /api/orders` - List user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details

#### Search
- `GET /api/search/products` - Search products
- `GET /api/search/suggestions` - Get search suggestions

## 🧪 Testing & Status

### ✅ Testing Status
- **Backend API** - ✅ Fully operational (port 3001)
- **Frontend Interface** - ✅ Fully operational (port 3002)
- **Admin Interface** - ✅ Fully operational (port 3003)
- **Database** - ✅ Fully operational
- **Search Functionality** - ✅ Fully operational
- **Plugin System** - ✅ Core framework operational
- **Multilingual Support** - ✅ 6 languages supported
- **Authentication** - ✅ JWT-based auth working
- **File Upload** - ✅ Image upload working
- **Email System** - ✅ Template-based notifications

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by the open source community
- Designed for developers, by developers

---

**Made with ❤️ by the Jiffoo community**
