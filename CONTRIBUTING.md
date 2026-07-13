# Contributing to Jiffoo Mall

Thank you for your interest in contributing to Jiffoo Mall! We welcome contributions from everyone.

## 📜 License Agreement

By contributing to Jiffoo Mall, you agree that:

1. Your contributions will be licensed under the **GNU General Public License v2.0 or later (GPLv2+)**
2. You have the right to submit the work under this license
3. Your contributions are your original work or properly attributed

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Git

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo

# Install dependencies
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env

# Initialize database
pnpm --filter api db:generate
pnpm --filter api db:push
pnpm --filter api db:seed

# Start development servers
pnpm dev
```

## 📝 How to Contribute

### 1. Find or Create an Issue

- Check existing issues for something you'd like to work on
- If you have a new idea, create an issue first to discuss it
- Wait for maintainer approval before starting major changes

### 2. Fork and Branch

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Jiffoo.git

# Create a feature branch
git checkout -b feature/amazing-feature
```

### 3. Make Your Changes

Follow our coding standards (see below).

### 4. Test Your Changes

```bash
# Run tests
pnpm test

# Check TypeScript
pnpm type-check

# Lint code
pnpm lint
```

### 5. Commit Your Changes

```bash
git commit -m 'feat: add amazing feature'
```

Use conventional commit messages:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 6. Push and Create PR

```bash
git push origin feature/amazing-feature
```

Then create a Pull Request on GitHub.

## 📋 Coding Standards

### TypeScript

- Use strict TypeScript mode
- Define proper types for all functions and variables
- Avoid `any` type unless absolutely necessary

### Code Style

- Use 2-space indentation
- Use single quotes for strings
- Always use semicolons
- Follow existing code patterns

### File Organization

```
apps/
├── api/           # Backend API
├── shop/          # Customer storefront
├── tenant/        # Tenant admin
├── admin/         # Platform admin
└── agent/         # Agent portal

packages/
├── shared/        # Shared utilities
└── shop-themes/   # Theme packages
```

## 🗄️ Prisma Schema Management

The Prisma schema is split across multiple files in `apps/api/prisma/schema/`:

```
apps/api/prisma/schema/
├── _base.prisma         # datasource + generator + shared enums
├── commerce.prisma      # Store, Product, Variant, Category, Cart, Order, Discount, Recommendation*
├── inventory.prisma     # Warehouse, WarehouseInventory, StockAlert, Transfer, Adjustment
├── payment.prisma       # Payment, Refund, PaymentLedger
├── extension.prisma     # PluginInstall*, Webhook*, PluginThemeExtension
├── platform-links.prisma# External*Link, OutboxEvent, PushSubscription
├── system.prisma        # User, SystemSettings, ErrorLog, SeoRedirect
└── _dormant.prisma      # Frozen models (zero code references)
```

### Rules

1. **Never reference dormant models** — Models in `_dormant.prisma` have `// DORMANT` comments. Do not use `prisma.<model>` for any of them. The CI check `node scripts/check-dormant-models.cjs` will fail if you do.

2. **Add new models to the correct domain file** — Don't create new `.prisma` files without team discussion. Use the existing domain files.

3. **Always create a migration** — After changing any schema file, run:
   ```bash
   cd apps/api && pnpm db:migrate --name descriptive_name
   ```

4. **Schema drift is blocked by CI** — The CI pipeline runs `prisma validate` and `check-dormant-models.cjs`. Any schema that doesn't validate or references dormant models will fail.

5. **Reactivating a dormant model** — If you need to use a dormant model:
   - Move the model definition from `_dormant.prisma` to the appropriate domain file
   - Remove the `// DORMANT` comment
   - Create a migration (if table structure changed)
   - The model will automatically pass the dormant check on next CI run

## 📦 Dependency Notes

Two versions are pinned via `pnpm.overrides` in the root `package.json` (package.json cannot carry comments, so the rationale lives here):

- **`stripe: 18.4.0`** — the API server and the official Stripe plugin embed different stripe SDK ranges (`^18.2.1` / `^17.7.0`); the override keeps the whole workspace on one audited SDK version so payment-intent typings and webhook event shapes stay consistent.
- **`next: 16.0.7`** — `apps/shop`, `apps/admin`, and the theme packages that ship Next app trees (e.g. `app-landingpage`) must resolve the exact same Next build; a mixed-minor workspace breaks `transpilePackages` and the CF Pages build.

Remove an override only together with a full regression (`pnpm type-check` + the CI gate suite).

## ✅ CI Quality Gates

Every PR into `main` runs four parallel jobs (`.github/workflows/pr-quality-gates.yml`). All must be green before merge.

| Job | What it checks | Local equivalent |
|-----|----------------|------------------|
| `static-checks` | Repo-wide TypeScript type-check (all packages) | `pnpm type-check` (build `shared`/`@jiffoo/ui`/SDK packages first if dists are stale) |
| `api-tests` | Full API vitest suite against postgres + redis, incl. 350+ OpenAPI contract tests | `cd apps/api && pnpm export:openapi && npx vitest run tests/` |
| `drift-gate` | Prisma schema vs migrations sync | `DATABASE_URL=<throwaway-db> pnpm --filter api db:check-drift` — **never point this at a real database; the script uses it as a shadow DB and resets it** |
| `theme-gate` | Theme matrix type-check/validate + theme API surface snapshot | `pnpm theme-matrix:type-check && pnpm theme-matrix:validate && pnpm surface:check` |

When a gate fails:

- **static-checks** — run the local equivalent; fresh checkouts need the shared package dists built first.
- **api-tests** — failures list the test file; run it in isolation first (`npx vitest run tests/<file>`). If it passes alone but fails in the full run, suspect shared test-state (default warehouse, Redis `warehouse:*` keys — see `apps/api/tests/KNOWN-FAILURES.md`).
- **drift-gate** — you changed a schema file without a migration: `cd apps/api && pnpm db:migrate --name descriptive_name`.
- **theme-gate** — surface snapshot mismatches mean the theme API surface changed; if intentional, regenerate with `pnpm surface:generate` and commit the snapshot.

`pnpm lint` is not gated yet — the ESLint 9 flat-config migration is pending (tracked in `.kiro/specs/repo-hardening-2026h2/`).

## ⛔ Prohibited Practices

The following are **strictly prohibited**:

### 1. Code Obfuscation

**Never submit obfuscated code.** This includes:
- JavaScript obfuscators
- Variable/function name mangling
- Control flow obfuscation
- String encoding/encryption

### 2. Encrypted Code

**Never submit encrypted or encoded source code.**

### 3. Hidden Functionality

**Never add hidden or undocumented functionality.**

### 4. License Violations

**Never include code that violates GPL or other licenses.**

## 🔍 Code Review Process

1. All PRs require at least one maintainer approval
2. CI checks must pass (tests, linting, type checking)
3. Code must follow our coding standards
4. Documentation must be updated if needed
5. No obfuscation or encrypted code

## 📚 Documentation

When adding new features:
- Update relevant README files
- Add JSDoc comments to functions
- Update API documentation if applicable
- Add usage examples

## 🐛 Bug Reports

When reporting bugs, include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots if applicable

## 💡 Feature Requests

When requesting features:
- Describe the use case
- Explain the expected behavior
- Consider potential implementation approaches
- Discuss any breaking changes

## 🤝 Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Give constructive feedback
- Celebrate contributions

## 📞 Getting Help

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and discussions
- **Email** - opensource@jiffoo.com

---

Thank you for contributing to Jiffoo Mall! 🎉

