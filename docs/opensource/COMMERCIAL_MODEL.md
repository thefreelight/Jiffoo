# Jiffoo Mall Commercial Model

> **Version**: 1.0  
> **Effective Date**: December 2025

This document explains how Jiffoo Mall balances open source principles with sustainable business operations.

---

## Our Philosophy

We follow the **WordPress model**: a genuinely open source core that empowers a thriving ecosystem of services, hosting, and premium features.

**Open source is not anti-business — it's a foundation for trust.**

---

## What's Free & Open Source

### Core Platform (GPLv2+)

Everything you need to run a complete e-commerce platform:

| Component | Description |
|-----------|-------------|
| **Backend API** | Full Fastify + TypeScript + Prisma backend |
| **Shop Frontend** | Complete Next.js storefront |
| **Admin Dashboard** | Tenant management interface |
| **Plugin Framework** | Full plugin architecture with SDK |
| **Theme Engine** | Complete theming system |
| **Multi-tenant Core** | Basic multi-tenant capabilities |
| **i18n System** | Internationalization (6+ languages) |
| **Authentication** | JWT-based auth with RBAC |
| **Documentation** | Full API and developer docs |

### Community Plugins (GPLv2+)

| Plugin | Description |
|--------|-------------|
| Demo Payment | Example payment integration |
| Demo Email | Example email notifications |
| Basic Analytics | Simple analytics dashboard |
| SEO Tools | Basic SEO optimization |

---

## Commercial Offerings

### 1. Jiffoo Cloud ☁️

**Managed hosting service** — we handle everything.

| Tier | Features | Price |
|------|----------|-------|
| **Starter** | 1 store, shared hosting, community support | $29/mo |
| **Business** | 5 stores, dedicated resources, email support | $99/mo |
| **Enterprise** | Unlimited stores, private cloud, 24/7 support | Custom |

**Why pay for hosting?**
- Zero DevOps overhead
- Automatic updates and backups
- SSL, CDN, and security included
- Scalability handled for you

### 2. Premium Plugins 🔌

Advanced functionality as GPL-licensed plugins.

| Plugin | Description | Price |
|--------|-------------|-------|
| **Stripe Payment** | Full Stripe integration | $99 |
| **PayPal Commerce** | Complete PayPal support | $79 |
| **Advanced Analytics** | GA4, custom reports, funnels | $149 |
| **AI Recommendations** | ML-powered product suggestions | $199 |
| **Multi-currency** | Dynamic currency conversion | $99 |
| **Advanced SEO** | Schema markup, sitemaps, optimization | $79 |
| **Email Marketing** | Automated campaigns, segmentation | $149 |

**Note**: All premium plugins include **full source code** per GPL requirements. You're paying for:
- Access to the code
- Updates and improvements
- Support and documentation
- Time saved not building it yourself

### 3. Enterprise Support 🏢

| Tier | Response Time | Features | Price |
|------|---------------|----------|-------|
| **Standard** | 48h | Email support, bug fixes | $199/mo |
| **Priority** | 4h | Phone + email, priority fixes | $499/mo |
| **Enterprise** | 1h | Dedicated engineer, SLA | Custom |

### 4. Custom Development 🛠️

Bespoke development services:
- Custom plugin development
- Theme customization
- Integration with existing systems
- Migration from other platforms
- Performance optimization
- Security audits

**Starting at**: $150/hour

---

## How Commercial Plugins Work

Following the WordPress/GPL model:

```
┌─────────────────────────────────────────────────────────┐
│                    CUSTOMER PURCHASE                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              RECEIVES FULL SOURCE CODE                   │
│         (Not obfuscated, not encrypted)                  │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│   CAN MODIFY CODE   │       │  CAN REDISTRIBUTE   │
│   for their needs   │       │   (GPL allows it)   │
└─────────────────────┘       └─────────────────────┘
```

**What we sell:**
- ✅ Access to download the plugin
- ✅ Updates and new versions
- ✅ Support and documentation
- ✅ Time saved in development

**What we DON'T sell:**
- ❌ Exclusive rights to the code
- ❌ Restrictions on modification
- ❌ Restrictions on redistribution

---

## External Service Plugins

Some functionality requires external services. These work differently:

```
┌──────────────────┐     ┌──────────────────┐
│  OPEN SOURCE     │     │  EXTERNAL        │
│  CONNECTOR       │────▶│  SERVICE         │
│  PLUGIN (GPL)    │     │  (Commercial)    │
└──────────────────┘     └──────────────────┘
```

Examples:
- **AI Recommendations**: Connector is GPL, AI service is SaaS
- **Advanced Search**: Connector is GPL, search index is SaaS
- **Email Delivery**: Connector is GPL, email service is SaaS

This is similar to WordPress plugins that connect to Mailchimp, Stripe, etc.

---

## Why This Model Works

| Benefit | How |
|---------|-----|
| **Trust** | Users can inspect all code |
| **Security** | Community can audit for vulnerabilities |
| **Flexibility** | Users can modify for their needs |
| **Sustainability** | Services fund continued development |
| **Community** | Open ecosystem attracts contributors |

---

## Frequently Asked Questions

**Q: Can I use Jiffoo for free commercially?**  
A: Yes! The open source version is fully functional for commercial use.

**Q: Can I sell my own Jiffoo plugins?**  
A: Absolutely! Just follow the [Plugin License Policy](./PLUGIN_LICENSE_POLICY.md).

**Q: Why would anyone pay for plugins if they can get the source code?**  
A: Same reason people pay for WordPress themes: convenience, updates, support, and not having to build it yourself.

**Q: Can I fork Jiffoo and create a competitor?**  
A: Legally, yes (it's GPL). But you can't use our trademarks.

---

**Questions?** Contact sales@jiffoo.com or open a discussion on GitHub.

