# Jiffoo Mall Commercial License

## Overview

This document outlines the licensing terms for different components of the Jiffoo Mall platform.

## Open Source Components (MIT License)

The following components are released under the MIT License and are freely available:

### ✅ Included in Open Source
- Core e-commerce functionality
- Product management system
- Order processing engine
- User authentication framework
- Basic payment interface
- Plugin system architecture
- Admin dashboard framework
- API framework and documentation
- Demo authentication plugins
- Basic email notifications
- Database schema and migrations
- Frontend UI components and themes

### 📁 Open Source Directories
```
apps/backend/src/
├── routes/           # Core API routes
├── services/         # Business logic services
├── middleware/       # Authentication, validation
├── core/            # Core systems (cache, logging)
├── plugins/core/    # Plugin system framework
└── plugins/examples/ # Demo plugins

apps/frontend/src/
├── app/             # Next.js pages
├── components/      # UI components
├── lib/            # Utilities
└── hooks/          # React hooks
```

## Commercial Components

The following components require commercial licenses and are NOT included in this repository:

### 💰 Commercial Plugins ($19.99 - $99.99/month)
- **WeChat Pay Plugin** - Full WeChat payment integration
- **Alipay Plugin** - Complete Alipay payment processing
- **Stripe Pro Plugin** - Advanced Stripe features with webhooks
- **Enterprise Authentication** - SAML, LDAP, SSO, MFA support
- **Email Marketing Pro** - Advanced email campaigns and automation
- **Smart Recommendations** - AI-powered product recommendations
- **Advanced Analytics** - Business intelligence and reporting
- **Inventory Optimization** - Predictive inventory management

### 🌐 SaaS Services ($199 - $499/month)
- **Smart Customer Service** - AI chatbot and live chat
- **Marketing Automation Platform** - Campaign builder and A/B testing
- **Supply Chain Management** - Supplier and logistics optimization
- **Business Intelligence Suite** - Advanced analytics and dashboards

### 🏢 Enterprise Features (Custom Pricing)
- **Multi-tenant Architecture** - White-label solutions
- **OEM Reseller Network** - Partner management system
- **Custom Development** - Tailored solutions
- **Dedicated Support** - SLA-backed professional support
- **Advanced Security** - Enterprise-grade security features

## Demo vs Commercial Functionality

### Demo Plugins (Open Source)
- Limited functionality for demonstration purposes
- Usage restrictions (e.g., 10-100 transactions/month)
- Mock data and simulated responses
- Clear upgrade prompts to commercial versions
- No production support

### Commercial Plugins
- Full functionality without restrictions
- Unlimited usage based on license tier
- Real integrations with third-party services
- Professional support and documentation
- Regular updates and security patches

## License Validation

Commercial plugins include license validation:

```typescript
// Example license check in commercial plugins
if (!await validateLicense(pluginId, licenseKey)) {
  throw new Error('Valid license required for production use');
}
```

## Getting Commercial Licenses

### Individual Plugins
Visit [https://jiffoo.com/plugins](https://jiffoo.com/plugins) to:
- Browse available commercial plugins
- Compare features and pricing
- Purchase individual plugin licenses
- Manage your plugin subscriptions

### SaaS Services
Visit [https://jiffoo.com/saas](https://jiffoo.com/saas) to:
- Explore cloud-based services
- Start free trials
- Subscribe to monthly plans
- Access service dashboards

### Enterprise Solutions
Contact [enterprise@jiffoo.com](mailto:enterprise@jiffoo.com) for:
- Custom development projects
- Multi-tenant deployments
- White-label solutions
- Volume licensing discounts
- Dedicated support contracts

## Support Levels

### Open Source (Community Support)
- GitHub issues and discussions
- Community-driven documentation
- Best-effort community support
- No SLA guarantees

### Commercial (Professional Support)
- Priority email support
- Dedicated support portal
- Professional documentation
- Bug fix guarantees
- Feature request priority

### Enterprise (Premium Support)
- Dedicated support team
- Phone and video support
- Custom SLA agreements
- On-site consulting available
- Priority feature development

## Compliance and Legal

### Open Source Compliance
- MIT License allows commercial use
- Attribution required in derivative works
- No warranty or liability guarantees

### Commercial Compliance
- Commercial licenses include warranty
- Professional liability coverage
- GDPR and privacy compliance
- Security audit reports available
- Legal indemnification included

## Revenue Sharing (OEM Partners)

For qualified partners, we offer:
- White-label licensing options
- Revenue sharing agreements
- Co-marketing opportunities
- Technical partnership programs
- Reseller certification programs

Contact [partners@jiffoo.com](mailto:partners@jiffoo.com) for partnership opportunities.

---

## Questions?

For licensing questions:
- **General**: [licensing@jiffoo.com](mailto:licensing@jiffoo.com)
- **Enterprise**: [enterprise@jiffoo.com](mailto:enterprise@jiffoo.com)
- **Partners**: [partners@jiffoo.com](mailto:partners@jiffoo.com)
- **Support**: [support@jiffoo.com](mailto:support@jiffoo.com)

**Last Updated**: December 2024
