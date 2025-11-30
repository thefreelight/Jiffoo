# Jiffoo Mall Open Source Policy

> **Version**: 1.0  
> **Effective Date**: December 2025  
> **Last Updated**: December 2025

## Our Commitment to Open Source

Jiffoo Mall is committed to being a **genuinely open source** e-commerce platform. We believe that open source software thrives on transparency, community trust, and shared values.

### The Four Freedoms

In accordance with the principles of free software, Jiffoo Mall guarantees users the following freedoms:

1. **Freedom to Run** - The freedom to run the program for any purpose.
2. **Freedom to Study** - The freedom to study how the program works, and change it to make it do what you wish. Access to the source code is a precondition for this.
3. **Freedom to Redistribute** - The freedom to redistribute copies so you can help others.
4. **Freedom to Improve** - The freedom to distribute copies of your modified versions to others. By doing this you can give the whole community a chance to benefit from your changes.

---

## License

Jiffoo Mall is licensed under the **GNU General Public License version 2 or later (GPLv2+)**, the same license used by WordPress.

This means:
- You can use Jiffoo Mall for any purpose, including commercial use
- You can modify Jiffoo Mall to suit your needs
- You can distribute Jiffoo Mall and your modifications
- Any derivative work must also be licensed under GPL

See [LICENSE.txt](./LICENSE.txt) for the full license text.

---

## Our Promises

### ✅ No Obfuscation

**We will NEVER obfuscate, encrypt, or deliberately obscure the source code in our open source repository.**

All code in the official Jiffoo repository is:
- Human-readable TypeScript/JavaScript
- Well-documented with comments
- Structured for easy understanding and modification

Standard build processes (minification, tree-shaking, bundling) are acceptable for production deployments, but the **source code itself will always remain clear and accessible**.

### ✅ True Open Source

The following components are and will remain fully open source:

| Component | Description | Status |
|-----------|-------------|--------|
| **Core Platform** | Backend API (Fastify + Prisma) | ✅ Open Source |
| **Shop Frontend** | Customer-facing storefront (Next.js) | ✅ Open Source |
| **Admin Panel** | Tenant administration dashboard | ✅ Open Source |
| **Plugin Framework** | Plugin architecture and SDK | ✅ Open Source |
| **Theme System** | Theming engine and base themes | ✅ Open Source |
| **Demo Plugins** | Example plugins for learning | ✅ Open Source |

### ✅ Community-First Development

- All core development happens in public repositories
- Issues, discussions, and roadmap are publicly visible
- Community contributions are welcome and valued
- We maintain clear contribution guidelines

---

## What Is NOT Open Source

While we are committed to open source, we also operate a sustainable business. The following are **not part of the open source offering**:

| Component | Description | License |
|-----------|-------------|---------|
| **Jiffoo Cloud** | Managed hosting service | Commercial Service |
| **Premium Plugins** | Advanced features (payment gateways, AI, etc.) | Commercial (GPL source available) |
| **Enterprise Support** | Priority support and SLA | Commercial Service |
| **Custom Development** | Bespoke development services | Commercial Service |

**Important Note on Premium Plugins**: Even our commercial plugins follow the GPL model—**source code is provided** to paying customers, but redistribution rights are governed by the GPL. We do NOT sell obfuscated or encrypted plugins.

---

## Historical Note

> **Transparency Statement**
>
> In earlier versions of Jiffoo, some code was distributed in obfuscated form. We recognize this was inconsistent with open source principles and community expectations.
>
> **Starting from version 1.0 (December 2025)**, we have:
> - Removed ALL code obfuscation from the open source repository
> - Adopted the GPLv2+ license (aligned with WordPress)
> - Established this Open Source Policy
> - Committed to full transparency in our development process
>
> We apologize for any confusion this may have caused and are committed to being a good citizen of the open source community going forward.

---

## How to Verify

You can verify our commitment by:

1. **Inspecting the Source Code**
   - Clone the repository: `git clone https://github.com/thefreelight/Jiffoo.git`
   - All `.ts`, `.tsx`, `.js` files should be human-readable

2. **Checking Build Processes**
   - Review `package.json` scripts
   - No obfuscation tools (like `javascript-obfuscator`) in dependencies
   - Build output is standard bundled code, not encrypted

3. **Reviewing Git History**
   - All changes are tracked and attributable
   - No binary blobs containing hidden code

---

## Questions?

If you have questions about our open source practices, please:

- Open an issue on GitHub
- Email: opensource@jiffoo.com
- Join our community discussions

---

**Jiffoo Mall — Built on trust, powered by community.**

