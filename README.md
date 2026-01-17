# Jiffoo - Open Source E-Commerce Platform

[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2+-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js- black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-green.svg)](https://www.fastify.io/)

Jiffoo is a modern, open-source e-commerce platform built with TypeScript, Node.js, and React. It provides the core capabilities needed to run an independent online store with professional-grade engineering.

## Features

- 🛒 **Complete E-Commerce**: Products, cart, checkout, orders, payments
- 🎨 **Theme System**: Customizable themes with hot-swapping
- 🔌 **Plugin Architecture**: Extend functionality with plugins
- 🌐 **Internationalization**: Multi-language support (en, zh-Hans)
- 🔒 **Security**: Built-in rate limiting, CORS, input validation
- 📊 **Observability**: Structured logging, distributed tracing
- 🚀 **Modern Stack**: TypeScript, Fastify, Next.js, Prisma

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (optional for basic features)
- pnpm 8+

### Installation

```bash
# Clone repository
git clone https://github.com/jiffoo/jiffoo.git
cd jiffoo

# Install dependencies
pnpm install

# Setup database
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
pnpm --filter api db:migrate

# Start development servers
pnpm dev
```

### Access

- Shop: http://localhost:3003
- Admin: http://localhost:3002
- API: http://localhost:3001

## Architecture

```
jiffoo/
├── apps/
│   ├── api/          # Core API (Fastify)
│   ├── admin/        # Admin Dashboard (Next.js)
│   └── shop/         # Storefront (Next.js)
├── packages/
│   ├── shared/       # Shared types and utilities
│   ├── ui/           # UI component library
│   ├── plugin-sdk/   # Plugin development SDK
│   └── theme-sdk/    # Theme development SDK
└── extensions/
    ├── plugins/      # Installed plugins
    └── themes/       # Installed themes
```

## Documentation

- [Installation Guide](docs/installation.md)
- [API Documentation](docs/api.md)
- [Plugin Development](docs/plugins.md)
- [Theme Development](docs/themes.md)
- [Contributing Guide](CONTRIBUTING.md)

## License

Jiffoo is licensed under the [GNU General Public License v2.0 or later](LICENSE).

This means you can:
- ✅ Use commercially
- ✅ Modify
- ✅ Distribute
- ✅ Use privately

But you must:
- 📄 Disclose source
- 📄 Include license and copyright
- 📄 State changes
- 📄 Use same license

## Community

- [GitHub Discussions](https://github.com/jiffoo/jiffoo/discussions)
- [Discord](https://discord.gg/jiffoo)
- [Twitter](https://twitter.com/jiffoo)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

Made with ❤️ by the Jiffoo team
