# Jiffoo - Open Source E-Commerce Platform

[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2+-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-green.svg)](https://www.fastify.io/)

Jiffoo is a TypeScript commerce core for self-hosted storefronts, admin tooling, and extension-driven customization.

The public runtime surface owned by this repository is:

- `shop`
- `api`
- `admin`

In the long-term deployment model, this repository is the source of the public/open-source runtime surface, including the future `jiffoo-prod` production namespace.

## Features

- Complete commerce flows for catalog, cart, checkout, orders, and payments
- Theme packs and plugin-based extensibility
- Fastify API with Prisma-backed data access
- Next.js shop and admin applications
- Shared SDKs for frontend, theme, and plugin integrations

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 6+ for caching and async jobs
- pnpm 9+

### Installation

```bash
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo
pnpm install
cp apps/api/.env.example .env
pnpm --filter api db:migrate
pnpm dev
```

### One-Command Server Install

For a fresh server, the quickest self-hosted path is:

```bash
curl -fsSL https://get.jiffoo.com | bash
```

If you already have the repository on the server, you can also run:

```bash
./install.sh
```

This path installs Docker if needed, prepares a production `.env.production.local`,
builds `shop + api + admin`, starts PostgreSQL and Redis, runs Prisma migrations,
and optionally seeds demo data with:

- Admin: `admin@jiffoo.com / admin123`

The underlying production compose file is:

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d --build
```

### Public update-feed topology

The public self-hosted update flow currently has two separate publication surfaces:

1. `jiffoo-installer`
   - a Kubernetes-side installer/static helper service used by the Singapore cluster topology
2. `get.jiffoo.com`
   - the canonical public self-hosted update-feed and source-archive origin used by OSS update checks

`https://get.jiffoo.com/releases/core/manifest.json` is the source of truth for self-hosted version detection. Updating the Kubernetes `jiffoo-installer` service alone does not update the public OSS manifest or source archive assets.

### Maintainer OSS Patch Release Helper

Maintainers can prepare or publish an OSS patch release with:

```bash
pnpm release:oss:patch -- --version 1.0.12 --notes "Short release summary"
```

Add `--publish` to let the helper:

- stage the release files only
- create the release commit and tag
- push the current branch and tag
- create the GitHub Release
- upload `core-update-manifest.json`, `jiffoo-source.tar.gz`, and `jiffoo-source.tar.gz.sha256`

Use `--dry-run` first if you want to inspect the planned actions before it touches git state.

### Local URLs

- Shop: `http://localhost:3003`
- Admin: `http://localhost:3002`
- API: `http://localhost:3001`

## Repository Layout

```text
Jiffoo/
├── apps/
│   ├── api/
│   ├── admin/
│   └── shop/
├── packages/
│   ├── core-api-sdk/
│   ├── plugin-sdk/
│   ├── shared/
│   ├── shop-themes/
│   ├── theme-api-sdk/
│   └── ui/
└── scripts/
```

## Documentation

- [Create App CLI](packages/create-jiffoo-app/README.md)
- [Core API SDK](packages/core-api-sdk/README.md)
- [Plugin SDK](packages/plugin-sdk/README.md)
- [Theme API SDK](packages/theme-api-sdk/README.md)
- [Cross-Platform Theme Client Contract](docs/theme-client-platform-contract.md)
- [Theme Client API Catalog](docs/theme-client-api-catalog.json)
- [Theme Client Compatibility Matrix](docs/theme-client-compatibility-matrix.md)
- [Official Theme Support Inventory](docs/theme-client-official-theme-support.md)
- [First-Wave Theme Rollout](docs/theme-client-first-wave-rollout.md)
- [Default Theme Pack](packages/shop-themes/default/README.md)

## License

Jiffoo is licensed under the [GNU General Public License v2.0 or later](LICENSE).
