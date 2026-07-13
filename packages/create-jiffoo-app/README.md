# create-jiffoo-app

Create Jiffoo e-commerce application with one command.

[![npm version](https://img.shields.io/npm/v/create-jiffoo-app)](https://www.npmjs.com/package/create-jiffoo-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
npx create-jiffoo-app my-store
```

This will:
1. Prompt you to select a storefront template
2. Clone the [Jiffoo](https://github.com/thefreelight/Jiffoo) repository
3. Apply the selected template's configuration (theme, env presets, seed data)
4. Guide you through database configuration
5. Install dependencies and run migrations
6. Seed the database with template-specific sample products

## Templates

Jiffoo ships with vertical templates tailored to different commerce scenarios:

| Template | Theme | Description |
|----------|-------|-------------|
| `default` | Aurora (Default) | General-purpose e-commerce storefront with mixed physical products |
| `digital-goods` | Digital Vault | Gift cards, redemption codes, software licenses, and downloads with instant digital fulfillment |
| `esim` | eSIM Mall | eSIM marketplace with travel data plans, QR code delivery, and regional coverage |

### Using a Template

```bash
# Interactive selection (default)
npx create-jiffoo-app my-store

# Specify template directly
npx create-jiffoo-app my-store --template digital-goods
npx create-jiffoo-app my-esim-shop --template esim

# Template with auto-seeding
npx create-jiffoo-app my-store --template digital-goods --seed
```

When a non-default template is selected, the CLI automatically:
- Sets the active theme via `JIFFOO_ACTIVE_THEME_SLUG` env var
- Enables digital fulfillment via `JIFFOO_DIGITAL_FULFILLMENT_ENABLED=true`
- Configures the seed profile via `JIFFOO_SEED_PROFILE`
- Copies the template's seed dataset to `apps/api/prisma/seed-data/`
- Writes a `.jiffoo-template.json` manifest in the project root
- Auto-seeds the database (non-default templates include tailored sample data)

## Usage

```bash
# Create a new Jiffoo store (interactive)
npx create-jiffoo-app my-store

# Create a digital goods store
npx create-jiffoo-app my-store --template digital-goods

# Create an eSIM mall
npx create-jiffoo-app my-esim-shop --template esim

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
| `--template <name>` | Storefront template: `default`, `digital-goods`, `esim` |
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
- 🎨 **Theme System** - Customizable designs with vertical templates
- 🌍 **i18n** - Multi-language support
- 🔐 **Auth** - JWT authentication
- 📱 **Digital Fulfillment** - eSIM QR codes, redemption codes, download links

## After Installation

```bash
cd my-store
pnpm dev
```

Access your store:
- **Shop**: http://localhost:3003
- **Admin**: http://localhost:3002
- **API**: http://localhost:3001

## Adding Custom Templates

The template registry is defined in `src/templates/registry.ts`. To add a new template:

1. Add a `TemplateConfig` entry to the `TEMPLATES` array
2. Create a seed dataset JSON file in `src/templates/seed-data/`
3. Reference a published theme artifact (npm package or ZIP URL)

```typescript
{
  name: 'my-vertical',
  displayName: 'My Vertical Store',
  description: 'Description shown in the CLI prompt',
  category: 'general',
  theme: {
    slug: 'my-theme',
    packageName: '@my-org/my-theme',
    version: '^1.0.0',
    source: 'npm',
  },
  seedDataset: {
    id: 'my-vertical',
    description: 'Tailored sample products',
    profile: 'my-vertical',
  },
  envPresets: {
    JIFFOO_ACTIVE_THEME_SLUG: 'my-theme',
  },
  tags: ['custom'],
  stable: true,
}
```

## Documentation

- [Jiffoo Documentation](https://docs.jiffoo.com)
- [GitHub Repository](https://github.com/thefreelight/Jiffoo)
- [Community Discussions](https://github.com/thefreelight/Jiffoo/discussions)

## License

MIT © [Jiffoo Team](https://jiffoo.com)
