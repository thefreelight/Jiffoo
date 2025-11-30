# 🔥 Jiffoo Mall - Open Source E-commerce Platform 🔥

[![License: GPL v2+](https://img.shields.io/badge/License-GPL_v2+-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![Open Source](https://img.shields.io/badge/Open_Source-100%25_Genuine-brightgreen.svg)](./docs/opensource/OPEN_SOURCE_POLICY.md)
[![No Obfuscation](https://img.shields.io/badge/Obfuscation-None-success.svg)](./docs/opensource/PLUGIN_LICENSE_POLICY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29-green.svg)](https://www.fastify.io/)
[![Plugin System](https://img.shields.io/badge/Plugin_System-Extensible-brightgreen.svg)](./PLUGIN_SYSTEM_ARCHITECTURE.md)

> 🌟 **Open Source E-commerce Platform** - A complete, modern e-commerce solution with extensible plugin architecture.
>
> 🔥 **100% Genuinely Open Source** - GPLv2+ Licensed (same as WordPress), community-driven development, no obfuscation, no hidden features.

## 📜 Open Source Commitment

Jiffoo Mall is **genuinely open source** — not "open source but obfuscated". We follow the WordPress model with GPLv2+ licensing.

| Promise | Description |
|---------|-------------|
| 🔓 **No Obfuscation** | All source code is human-readable. We will NEVER obfuscate or encrypt code. |
| 📖 **Full Source Access** | Complete platform available — backend, frontend, admin, plugin SDK. |
| 🤝 **GPL Licensed** | You can use, modify, and distribute Jiffoo under GPL terms. |

> **Historical Note**: Earlier versions included some obfuscated code. Starting from v1.0 (December 2025), we have removed ALL obfuscation and fully committed to open source principles.

📚 **Learn more**: [Open Source Policy](./docs/opensource/OPEN_SOURCE_POLICY.md) | [Plugin License Policy](./docs/opensource/PLUGIN_LICENSE_POLICY.md) | [Commercial Model](./docs/opensource/COMMERCIAL_MODEL.md)

---

## 🏗️ Architecture

```
jiffoo-mall/
├── apps/
│   ├── api/          # Backend API (Fastify + Prisma)
│   ├── shop/         # Customer-facing storefront (Next.js)
│   ├── admin/        # Admin dashboard (Next.js)
│   └── frontend/     # Alternative frontend
├── packages/
│   ├── shared/       # Shared utilities and types
│   ├── plugin-sdk/   # Plugin development SDK
│   └── shop-themes/  # Theme system
└── docs/
    └── opensource/   # Open source policies
```

## 🌟 Features

### 🔥 Plugin Ecosystem
- **🏗️ Modular Architecture** - Extensible plugin system
- **🔄 Hot-Swappable** - Install/remove plugins without downtime
- **💎 Production-Ready** - Battle-tested reliability

### 🛒 E-commerce Core
- Product management with variants and inventory
- Shopping cart and checkout flow
- Order management and fulfillment
- Customer accounts and authentication
- Multi-language support (i18n)

### 🎨 Modern Tech Stack
- **Backend**: Fastify, TypeScript, Prisma, PostgreSQL, Redis
- **Frontend**: Next.js 15, React, Tailwind CSS
- **Infrastructure**: Docker, Kubernetes-ready

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone the repository
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env

# Generate Prisma client & run migrations
pnpm db:generate
pnpm db:migrate

# Start development servers
pnpm dev:all
```

### Development URLs
| Service | URL |
|---------|-----|
| API | http://localhost:8001 |
| Shop | http://localhost:3000 |
| Admin | http://localhost:3001 |

## 📦 Available Scripts

```bash
# Development
pnpm dev:api        # Start API server
pnpm dev:shop       # Start shop frontend
pnpm dev:admin      # Start admin dashboard
pnpm dev:all        # Start all services

# Database
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:studio      # Open Prisma Studio
pnpm db:seed        # Seed database

# Build & Deploy
pnpm build          # Build all apps
pnpm docker:build   # Build Docker images
```

## 🔌 Plugin Development

Jiffoo supports two types of plugins:

1. **Internal Plugins** (Fastify) - Run inside the API process
2. **External Plugins** (HTTP) - Run as separate microservices

📚 See [Plugin Development Guide](./EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md) and [Plugin Architecture](./PLUGIN_SYSTEM_ARCHITECTURE.md)

## 📄 License

Jiffoo Mall is free software, licensed under the **GNU General Public License v2.0 or later (GPLv2+)** — the same license used by WordPress.

This means you are free to:
- ✅ Use Jiffoo for any purpose (including commercial)
- ✅ Study how it works and modify it
- ✅ Distribute copies to help others
- ✅ Distribute your modified versions

Under the condition that derivative works are also licensed under GPL.

See [LICENSE.txt](./LICENSE.txt) for the complete license text.

## 🤝 Contributing

We welcome contributions! Please read our contributing guidelines before submitting PRs.

## 🙏 Acknowledgments

- Inspired by WordPress's open source model
- Built with amazing open source technologies

---

**Made with ❤️ by the Jiffoo Team**
