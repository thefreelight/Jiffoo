# License Exceptions & Boundary Statement

> **Effective from**: v1.1.0  
> **Governs**: Jiffoo open-source core (`jiffoo-mall-core`) and its SDK packages

## 1. Three-Layer Boundary

Jiffoo's open-source ecosystem is structured in three license layers:

### Layer 1 — GPL Core (the monolith)

**Applies to**: `apps/api`, `apps/shop`, `apps/admin`, `packages/shared`, root `package.json`

**License**: GPL-2.0-or-later

Anyone who modifies and distributes the GPL core must open-source their changes under the same GPL terms. This is the copyleft core — the "engine" of the platform.

### Layer 2 — External-HTTP Plugins (independent works)

**Applies to**: Third-party plugins that communicate with Jiffoo API exclusively via HTTP (no shared process, no in-process imports)

**License**: Any license (proprietary, MIT, Apache, etc.)

External-HTTP plugins are **independent works**. They run as separate processes/services and communicate with Jiffoo through the documented Plugin Gateway HTTP protocol. They are **not derivative works** of the GPL core and are not subject to copyleft.

**Requirements**:
- Must communicate only via documented HTTP endpoints
- Must not import or link against GPL-licensed code
- Must respect the Plugin Gateway protocol contract (see §3)

### Layer 3 — Internal-Fastify Plugins (derivative works)

**Applies to**: Plugins that run inside the Jiffoo API process (loaded via the extension-installer, sharing the Fastify runtime)

**License**: GPL-2.0-or-later (same as core)

Internal-fastify plugins are **derivative works** of the GPL core. They share the process, memory space, and Fastify runtime. Distributing them requires compliance with GPL copyleft.

**Trust levels**:
- `builtin`: Ships with the core (GPL, always trusted)
- `official`: Signed by Jiffoo team (Ed25519 signature, trusted)
- `third-party`: Unsigned — **must use external-http runtime** (rejected if internal-fastify)

## 2. SDK Packages (MIT)

The following packages are licensed under MIT:

| Package | Purpose |
|---------|---------|
| `@jiffoo/plugin-sdk` | Plugin development SDK (types, utilities, gateway client) |
| `@jiffoo/theme-api-sdk` | Theme API SDK (types, client) |
| `@jiffoo/core-api-sdk` | Core API SDK (types, client) |
| `@jiffoo/ui` | Shared UI component library |
| `create-jiffoo-app` | Project scaffolding CLI |
| `shared` | Shared utilities and types |

MIT-licensed SDKs allow anyone to build commercial products that **interface with** Jiffoo without triggering copyleft — as long as they communicate via documented APIs (not by importing GPL core code).

## 3. Interface Exceptions (protocol contracts)

The following interfaces are designated as **stable protocol contracts** that plugins/themes may implement without becoming derivative works:

1. **Plugin Gateway HTTP Protocol**: The request/response contract between Jiffoo API and external-http plugins (documented in `EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md`)
2. **Webhook Protocol**: Outbound webhook payload schema (documented in API docs under `/webhooks`)
3. **Theme Pack Declarative Format**: The `theme.json` + template JSON schema (documented in `PLUGIN_SYSTEM_ARCHITECTURE.md`)

Implementing these protocols in a separate process/service does **not** make your work a derivative of the GPL core.

## 4. Commercial Distribution Path

To distribute a **closed-source commercial plugin** for Jiffoo:

```
Your Plugin (proprietary)
    ↕ HTTP only
Plugin Gateway (GPL core, runs in Jiffoo API)
```

1. Build your plugin as an independent HTTP service (any language, any license)
2. Register it via the Plugin Gateway HTTP protocol
3. Use MIT-licensed SDKs (`@jiffoo/plugin-sdk`) for type definitions and utilities
4. **Do not** import or link against any GPL-licensed package in your plugin process

This is the **only compliant path** for closed-source plugins. Internal-fastify (in-process) plugins must be GPL.

## 5. Versioning

This document takes effect from version `1.1.0` of the Jiffoo open-source core. Future versions may update this statement; each version's boundaries are governed by the document in effect at that version's release.