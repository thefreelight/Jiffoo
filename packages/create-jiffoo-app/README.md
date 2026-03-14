# create-jiffoo-app

Create Jiffoo e-commerce application with one command.

[![npm version](https://img.shields.io/npm/v/create-jiffoo-app)](https://www.npmjs.com/package/create-jiffoo-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
npx create-jiffoo-app my-store
```

This will:
1. Clone the [Jiffoo](https://github.com/thefreelight/Jiffoo) template
2. Guide you through database configuration
3. Install dependencies
4. Run database migrations
5. Start your development server

## Usage

```bash
# Create a new Jiffoo store
npx create-jiffoo-app my-store

# Skip dependency installation
npx create-jiffoo-app my-store --skip-install

# Skip database setup
npx create-jiffoo-app my-store --skip-db

# Seed database with sample data
npx create-jiffoo-app my-store --seed

# Use a specific branch
npx create-jiffoo-app my-store --branch dev
```

## Options

| Option | Description |
|--------|-------------|
| `--skip-install` | Skip installing dependencies |
| `--skip-db` | Skip database setup |
| `--seed` | Seed database with sample data |
| `--branch <branch>` | Branch to clone from (default: `main`) |
| `-V, --version` | Output version number |
| `-h, --help` | Display help |

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- PostgreSQL
- Git

## What's Included

Jiffoo is a modern e-commerce platform with:

- 🛒 **Shop Frontend** - Next.js 15 storefront
- 📊 **Admin Dashboard** - Merchant management
- 🔌 **Plugin System** - Extensible architecture
- 🎨 **Theme System** - Customizable designs
- 🌍 **i18n** - Multi-language support
- 🔐 **Auth** - JWT authentication

## After Installation

```bash
cd my-store
pnpm dev
```

Access your store:
- **Shop**: http://localhost:3003
- **Admin**: http://localhost:3002
- **API**: http://localhost:3001

## Documentation

- [Jiffoo Documentation](https://docs.jiffoo.com)
- [GitHub Repository](https://github.com/thefreelight/Jiffoo)
- [Community Discussions](https://github.com/thefreelight/Jiffoo/discussions)

## License

MIT © [Jiffoo Team](https://jiffoo.com)
