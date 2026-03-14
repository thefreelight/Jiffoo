# @jiffoo/plugin-sdk

SDK for building external plugins for the Jiffoo Mall platform.

[![npm version](https://img.shields.io/npm/v/@jiffoo/plugin-sdk)](https://www.npmjs.com/package/@jiffoo/plugin-sdk)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## Quick Start

Create a new plugin in seconds:

```bash
npx jiffoo-plugin init my-plugin
cd my-plugin
npm install
npm run dev
```

Or install in an existing project:

```bash
npm install @jiffoo/plugin-sdk
```

## Features

- 🔐 **HMAC Signature Verification** - Secure request validation
- 📦 **Plugin Definition Helpers** - Simple plugin configuration
- 🔌 **Express/Fastify Middleware** - Easy integration
- 🎯 **TypeScript Support** - Full type definitions
- 🛠️ **CLI Tools** - Development, build, and packaging commands
- 🔄 **Context Extraction** - Automatic platform context handling
- 📝 **Manifest Validation** - Schema validation for plugin manifests
- 🗄️ **Sandboxed Storage** - Safe database and file storage

## Installation

```bash
# npm
npm install @jiffoo/plugin-sdk

# pnpm
pnpm add @jiffoo/plugin-sdk

# yarn
yarn add @jiffoo/plugin-sdk
```

## Prerequisites

- Node.js 18+
- npm, pnpm, or yarn

## Usage

### Define a Plugin

```typescript
import { definePlugin } from '@jiffoo/plugin-sdk';

const plugin = definePlugin({
  schemaVersion: 1,
  slug: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'My awesome Jiffoo plugin',
  author: 'Your Name',
  runtimeType: 'external-http',
  externalBaseUrl: 'https://my-plugin.example.com',
  permissions: [],
  category: 'integration',
  capabilities: ['webhook.receive'],
});
```

### Verify Request Signatures

```typescript
import { verifySignature, createSignatureMiddleware } from '@jiffoo/plugin-sdk';

// Manual verification
const isValid = verifySignature(
  sharedSecret,
  method,
  path,
  body,
  timestamp,
  signature
);

// As Express middleware
app.use('/api', createSignatureMiddleware(process.env.SHARED_SECRET));

// As Fastify middleware
fastify.addHook('preHandler', createSignatureMiddleware(process.env.SHARED_SECRET));
```

### Extract Platform Context

```typescript
import { getContext, createContextMiddleware } from '@jiffoo/plugin-sdk';

// Manual extraction
const context = getContext(req.headers);
console.log(context.platformId, context.installationId);

// As middleware
app.use(createContextMiddleware());

// Then access in routes
app.post('/webhook', (req, res) => {
  const context = req.pluginContext;
  console.log(`Request from platform: ${context.platformId}`);
});
```

### Create Routes and Hooks

```typescript
import { createRoute, createHook } from '@jiffoo/plugin-sdk';

// Define a route
const webhookRoute = createRoute(
  '/webhook',
  async (req, res, context) => {
    console.log(`Webhook from ${context.platformId}`);
    res.json({ success: true });
  },
  {
    method: 'POST',
    requiresAuth: true,
  }
);

plugin.addRoute(webhookRoute);

// Define a hook
const orderHook = createHook(
  'order.created',
  async (data, context) => {
    console.log('New order created:', data);
    // Send notification, update inventory, etc.
  },
  {
    priority: 10,
  }
);

plugin.addHook(orderHook);
```

### Sandboxed Storage

```typescript
import { createPluginDatabase, createPluginStorage } from '@jiffoo/plugin-sdk';

// Create sandboxed database connection
const db = createPluginDatabase(context.installationId, {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Create sandboxed file storage
const storage = createPluginStorage(context.installationId);
await storage.writeFile('config.json', JSON.stringify(config));
const data = await storage.readFile('config.json');
```

### Utilities

```typescript
import { createLogger, formatError, retry } from '@jiffoo/plugin-sdk';

// Create logger
const logger = createLogger('my-plugin');
logger.info('Plugin initialized');
logger.error('Something went wrong', error);

// Format errors
const formatted = formatError(error);

// Retry with exponential backoff
await retry(async () => {
  await someAsyncOperation();
}, { maxRetries: 3, delay: 1000 });
```

## CLI Commands

The plugin-sdk includes a CLI tool `jiffoo-plugin` for plugin development:

### `jiffoo-plugin init`

Create a new plugin project with scaffolding:

```bash
jiffoo-plugin init my-plugin

# Interactive mode
jiffoo-plugin init

# With options
jiffoo-plugin init my-plugin --template payment --typescript
```

**Options:**
- `--template <type>` - Template to use: basic, payment, email, integration, analytics, shipping
- `--typescript` - Use TypeScript (default: true)
- `--directory <path>` - Target directory

### `jiffoo-plugin dev`

Start development server with hot reload:

```bash
jiffoo-plugin dev

# With custom port
jiffoo-plugin dev --port 3001
```

**Options:**
- `--port <number>` - Port to run on (default: 3000)
- `--watch` - Watch for changes (default: true)

### `jiffoo-plugin build`

Build plugin for production:

```bash
jiffoo-plugin build

# With custom output directory
jiffoo-plugin build --outdir dist
```

**Options:**
- `--outdir <path>` - Output directory (default: dist)
- `--minify` - Minify output (default: true)
- `--sourcemap` - Generate source maps (default: false)

### `jiffoo-plugin validate`

Validate plugin manifest and configuration:

```bash
jiffoo-plugin validate

# Validate specific manifest file
jiffoo-plugin validate --manifest custom-manifest.json
```

**Options:**
- `--manifest <path>` - Path to manifest file (default: manifest.json)
- `--strict` - Enable strict validation mode

### `jiffoo-plugin pack`

Package plugin for submission to marketplace:

```bash
jiffoo-plugin pack

# With custom output
jiffoo-plugin pack --output my-plugin.zip
```

**Options:**
- `--output <path>` - Output file path (default: plugin.zip)
- `--skip-build` - Skip build step
- `--skip-validation` - Skip validation step

## API Reference

### Plugin Definition

#### `definePlugin(config: PluginConfig): Plugin`

Define a new plugin with configuration.

#### `createRoute(path, handler, options): PluginRoute`

Create a plugin route definition.

#### `createHook(event, handler, options): PluginHook`

Create a plugin hook definition.

### Signature Verification

#### `verifySignature(secret: string, method: string, path: string, body: any, timestamp: string, signature: string, options?: VerifyOptions): boolean`

Verify HMAC signature from platform.

#### `generateSignature(secret: string, method: string, path: string, body: any, timestamp: string): string`

Generate HMAC signature for requests.

#### `createSignatureMiddleware(secret: string, options?: VerifyOptions): MiddlewareFunction`

Create Express/Fastify middleware for signature verification.

### Context Extraction

#### `getContext(headers: Record<string, string | string[] | undefined>): PluginContext`

Extract platform context from request headers.

#### `createContextMiddleware(): MiddlewareFunction`

Create middleware to extract and attach context to requests.

#### `isFromJiffooPlatform(headers: Record<string, string | string[] | undefined>): boolean`

Check if request is from Jiffoo platform.

### Validation

#### `validateManifest(manifest: any): ValidationResult`

Validate plugin manifest against schema.

#### `validateSettingsSchema(schema: any): ValidationResult`

Validate settings schema.

#### `validateSettings(settings: any, schema: SettingsSchema): ValidationResult`

Validate settings against schema.

### Sandboxed Storage

#### `createPluginDatabase(installationId: string, config: DatabaseConfig): Database`

Create sandboxed database connection.

#### `createPluginStorage(installationId: string, basePath?: string): Storage`

Create sandboxed file storage.

### Utilities

#### `createLogger(namespace: string): Logger`

Create namespaced logger.

#### `formatError(error: Error | unknown): FormattedError`

Format error for consistent error handling.

#### `retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`

Retry async operation with exponential backoff.

## Type Definitions

The SDK exports comprehensive TypeScript types:

```typescript
import type {
  // Core types
  PluginManifest,
  PluginConfig,
  Plugin,
  PluginContext,

  // Request/Response
  PluginRequest,
  PluginResponse,
  PlatformHeaders,

  // Routes and Hooks
  PluginRoute,
  PluginHook,
  HookEvent,

  // Lifecycle
  InstallRequest,
  UninstallRequest,

  // API
  ApiResponse,
  HealthResponse,

  // Validation
  ValidationResult,
  ValidationError,
  SettingsSchema,
  SettingsField,
} from '@jiffoo/plugin-sdk';
```

## Plugin Manifest Schema

A valid plugin manifest (`manifest.json`):

```json
{
  "schemaVersion": 1,
  "slug": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Your Name",
  "runtimeType": "external-http",
  "externalBaseUrl": "https://my-plugin.example.com",
  "permissions": ["orders.read", "orders.write"],
  "category": "integration",
  "capabilities": ["webhook.receive"],
  "webhooks": {
    "events": ["order.created", "order.updated"],
    "url": "https://my-plugin.example.com/webhooks"
  },
  "configSchema": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "required": true,
      "secret": true
    }
  }
}
```

## Plugin Categories

- `payment` - Payment gateway integrations
- `email` - Email service integrations
- `integration` - Third-party API integrations
- `theme` - Theme and design plugins
- `analytics` - Analytics and tracking
- `marketing` - Marketing and promotion tools
- `shipping` - Shipping provider integrations
- `seo` - SEO optimization tools
- `social` - Social media integrations
- `security` - Security enhancements
- `other` - Other plugin types

## Hook Events

The SDK supports listening to various platform events:

**Order Events:** `order.created`, `order.updated`, `order.paid`, `order.shipped`, `order.delivered`, `order.cancelled`, `order.refunded`

**Product Events:** `product.created`, `product.updated`, `product.deleted`, `product.stock_low`, `product.out_of_stock`

**Customer Events:** `customer.created`, `customer.updated`, `customer.deleted`, `customer.login`, `customer.logout`

**Cart Events:** `cart.updated`, `cart.abandoned`

**Payment Events:** `payment.pending`, `payment.completed`, `payment.failed`, `payment.refunded`

**Shipping Events:** `shipping.label_created`, `shipping.tracking_updated`

**Store Events:** `store.settings_updated`

## Documentation

- [Plugin Development Guide](https://docs.jiffoo.com/developer/plugin-development)
- [API Reference](https://docs.jiffoo.com/api/plugin-sdk)
- [Plugin Submission](https://docs.jiffoo.com/marketplace/submission)
- [Security Best Practices](https://docs.jiffoo.com/developer/security)
- [GitHub Repository](https://github.com/jiffoo/jiffoo-mall)
- [Community Discussions](https://github.com/jiffoo/jiffoo-mall/discussions)

## Examples

Check out example plugins in the [examples directory](https://github.com/jiffoo/jiffoo-mall/tree/main/examples/plugins):

- **payment-plugin** - Payment gateway integration
- **email-plugin** - Email service integration
- **analytics-plugin** - Analytics tracking
- **shipping-plugin** - Shipping provider integration

## Support

- **Issues**: [GitHub Issues](https://github.com/jiffoo/jiffoo-mall/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jiffoo/jiffoo-mall/discussions)
- **Documentation**: [docs.jiffoo.com](https://docs.jiffoo.com)

## License

GPL-3.0 © [Jiffoo Team](https://jiffoo.com)
