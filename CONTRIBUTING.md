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

