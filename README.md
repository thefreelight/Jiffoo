# Jiffoo

Jiffoo is an open-source commerce platform for self-hosted stores. It provides the core services required to run an online store and leaves official marketplace themes and plugins to a post-install download flow.

## What is included

- `apps/api`: core commerce API
- `apps/admin`: merchant admin
- `apps/shop`: storefront
- `packages/shared`: shared types and utilities
- `packages/ui`: UI components
- `packages/plugin-sdk`: public plugin SDK
- `packages/theme-api-sdk`: theme-facing API client
- `packages/core-api-sdk`: admin and storefront API client

## What is not included

This public repository does not ship Jiffoo commercial or official marketplace assets.

- Official themes such as `eSIM Mall` and `Yevbi`
- Official plugins such as `Stripe`, `i18n`, and `Odoo`
- Platform control-plane services such as `platform-api` and `super-admin`

Those assets are installed from the Jiffoo Marketplace after the instance is connected to the platform.

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 9
- PostgreSQL 14+
- Redis 6+ for optional background features

### Development

```bash
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo
pnpm install
cp apps/api/.env.example .env
pnpm --filter api db:migrate
pnpm dev
```

### Default local ports

- API: `http://localhost:3001`
- Admin: `http://localhost:3003`
- Shop: `http://localhost:3000`

## Deployment

Officially supported self-hosted deployment targets:

- Single host install
- Docker Compose
- Kubernetes

The public repository is paired with dedicated OSS CI/CD pipelines for:

- `dev` -> OSS test environment
- `main` -> OSS production environment

## Updating the open-source core

Jiffoo is moving toward a unified in-admin update experience for the open-source core. The user-facing flow is designed to be consistent across:

- Single-host installations
- Docker Compose deployments
- Kubernetes deployments

The update UX is unified, while the execution path is environment-specific.

## Repository policy

- Public repository content is English-first
- Marketplace-only themes and plugins are excluded
- Commercial control-plane services are excluded
- Versioning follows strict semantic versioning

## Documentation

- [Contributing](./CONTRIBUTING.md)
- [API Overview](./API_DESCRIPTION.md)
- [Plugin System Architecture](./PLUGIN_SYSTEM_ARCHITECTURE.md)
- [External Plugin Development Guide](./EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md)
- [Backup and Recovery](./docs/operations/backup-and-recovery.md)

## License

Jiffoo is licensed under the [GNU General Public License v2.0 or later](./LICENSE).
