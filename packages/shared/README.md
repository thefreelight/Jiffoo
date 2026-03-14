# @jiffoo/shared

Shared utilities, types, and core modules for the Jiffoo e-commerce platform.

[![npm version](https://img.shields.io/npm/v/@jiffoo/shared)](https://www.npmjs.com/package/@jiffoo/shared)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The `@jiffoo/shared` package provides a unified set of utilities, types, and core modules used across all Jiffoo applications (shop, admin, API services). It ensures consistency in logging, internationalization, security, observability, and API communication.

## Installation

```bash
# Using pnpm (recommended)
pnpm add @jiffoo/shared

# Using npm
npm install @jiffoo/shared

# Using yarn
yarn add @jiffoo/shared
```

## Prerequisites

- Node.js 18+
- TypeScript 5.0+
- React 18+ (for React-specific modules)
- Next.js 15+ (for Next.js-specific modules)

## Core Modules

### 🔍 Logger

Unified logging system with environment-aware adapters (Winston for Node.js, console for browsers).

```typescript
import { createLogger } from '@jiffoo/shared/logger';

// Node.js environment
const logger = createLogger({
  service: 'my-service',
  level: 'info',
  transports: ['console', 'file']
});

logger.info('Application started', { port: 3000 });
logger.error('Connection failed', { error: err.message });
```

```typescript
// Browser environment
import { createLogger } from '@jiffoo/shared/src/logger/index.browser';

const logger = createLogger({
  service: 'shop-frontend',
  level: 'debug'
});

logger.debug('User action', { action: 'add-to-cart', productId: '123' });
```

**Features:**
- Environment-aware adapters (Winston/Browser)
- Multiple transports (console, file, remote)
- Automatic data sanitization for sensitive fields
- Structured logging with metadata

### 🌍 i18n (Internationalization)

Multi-language support with server and client utilities.

**Supported Languages:**
- `en` - English (default)
- `zh-Hant` - Traditional Chinese

```typescript
// Server-side usage
import { getMessages, DEFAULT_LOCALE } from '@jiffoo/shared/src/i18n';

const messages = getMessages('en', 'common');
console.log(messages.welcome); // "Welcome to Jiffoo"
```

```typescript
// React components (client-side)
import { I18nProvider, useT } from '@jiffoo/shared/src/i18n/react';

function MyComponent() {
  const t = useT();
  return <h1>{t('common.welcome')}</h1>;
}

// In your app root
<I18nProvider locale="en" namespace="shop">
  <MyComponent />
</I18nProvider>
```

**Features:**
- Server-safe utilities for SSR
- React hooks and context providers
- Locale middleware for Next.js
- Browser language detection
- Namespace-based message organization

### 🔐 Security

Production-grade security utilities for Node.js environments.

```typescript
import {
  RateLimiter,
  CircuitBreaker,
  WebhookVerifier,
  InputValidator,
  generateSecurityHeaders
} from '@jiffoo/shared/security';

// Rate limiting
const limiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100
});

const result = await limiter.check('user-123');
if (!result.allowed) {
  throw new Error('Rate limit exceeded');
}

// Circuit breaker for API calls
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000
});

const data = await breaker.execute(async () => {
  return await externalAPI.call();
});

// Webhook verification (Stripe example)
const verifier = new WebhookVerifier({
  secret: process.env.STRIPE_WEBHOOK_SECRET
});

const isValid = await verifier.verify(
  req.body,
  req.headers['stripe-signature']
);

// Input validation
const validator = new InputValidator();
const emailResult = validator.validateEmail('user@example.com');
const urlResult = validator.validateUrl('https://example.com');

// Security headers
const headers = generateSecurityHeaders({
  enableHSTS: true,
  enableCSP: true
});
```

**Features:**
- Rate limiting with multiple storage backends
- Circuit breaker pattern for fault tolerance
- Webhook signature verification
- Input validation and sanitization
- Security headers generation
- CORS management
- Retry handler with exponential backoff

### 📊 Observability

APM, health checks, and log forwarding for production monitoring.

```typescript
import {
  initializeObservability,
  createHealthCheckService,
  createSentryClient,
  LogRedactor
} from '@jiffoo/shared/observability';

// Initialize full observability stack
const obs = initializeObservability({
  serviceName: 'shop-api',
  serviceVersion: '1.0.0',
  environment: 'production',
  sentry: {
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1
  },
  otel: {
    traceExporterUrl: 'http://otel-collector:4318',
    samplingRatio: 0.1
  },
  loki: {
    url: 'http://loki:3100',
    batchSize: 100
  }
});

// Health checks
const healthCheck = createHealthCheckService({
  version: '1.0.0',
  timeout: 5000
});

healthCheck.register('database', async () => {
  await db.ping();
  return { healthy: true };
});

healthCheck.register('redis', async () => {
  await redis.ping();
  return { healthy: true };
});

const status = await healthCheck.check();
// { healthy: true, checks: { database: {...}, redis: {...} } }

// Log redaction
const redactor = new LogRedactor({
  sensitiveFields: ['password', 'token', 'apiKey'],
  enablePatternMatching: true
});

const safeData = redactor.redact({
  username: 'john',
  password: 'secret123',
  email: 'john@example.com'
});
// { username: 'john', password: '[REDACTED]', email: 'john@example.com' }
```

**Features:**
- Sentry integration for error tracking
- OpenTelemetry for distributed tracing
- Log forwarding to Loki/Grafana
- Health check service with custom checks
- Automatic sensitive data redaction

### 🔄 Proxy

Next.js proxy utilities for theme app forwarding and locale handling.

```typescript
// proxy.ts (Next.js 16)
import { createProxyHandler, UNIFIED_PROXY_MATCHER } from '@jiffoo/shared/src/proxy';

export const config = {
  matcher: UNIFIED_PROXY_MATCHER
};

const handler = createProxyHandler({
  target: 'shop', // or 'admin'
  defaultLocale: 'en',
  locales: ['en', 'zh-Hant']
});

export default handler;
```

**Features:**
- Theme App forwarding (type='app' themes)
- Automatic locale detection and redirect
- Smart path handling and caching
- Next.js 16 compatible

### 🔌 API Client

Type-safe API clients for shop and admin applications.

```typescript
import { createShopClient, createAdminClient } from '@jiffoo/shared';

// Shop client (customer-facing)
const shopClient = createShopClient({
  baseURL: 'https://api.example.com',
  storageAdapter: 'cookie' // or 'localStorage'
});

const products = await shopClient.get('/products');
const cart = await shopClient.post('/cart/items', {
  productId: '123',
  quantity: 2
});

// Admin client (authenticated)
const adminClient = createAdminClient({
  baseURL: 'https://api.example.com',
  storageAdapter: 'localStorage'
});

await adminClient.auth.login('admin@example.com', 'password');
const orders = await adminClient.get('/admin/orders');
```

**Features:**
- Automatic authentication handling
- Token refresh logic
- Multiple storage adapters (cookie, localStorage)
- Request/response interceptors
- Type-safe API methods

## Shared Types

```typescript
import type {
  // Product DTOs
  ShopProductListItemDTO,
  ShopProductDetailDTO,
  AdminProductDetailDTO,

  // Order DTOs
  ShopOrderDetailDTO,
  AdminOrderListItemDTO,
  OrderStatus,
  PaymentStatus,

  // Cart DTOs
  CartDTO,
  AddToCartRequestDTO,

  // Core Events
  JiffooEvent,
  OrderCreatedPayload,
  ProductStockChangedPayload,

  // eSIM Types
  ESimProduct,
  ESimVariantAttributes
} from '@jiffoo/shared';
```

## Configuration Utilities

```typescript
import {
  envConfig,
  getApiServiceUrl,
  isDevelopment,
  isProduction
} from '@jiffoo/shared';

// Environment detection
if (isDevelopment) {
  console.log('Running in development mode');
}

// Service URL helpers
const apiUrl = getApiServiceUrl('auth');
// Returns: http://localhost:4001/api/auth (dev)
//       or https://api.example.com/api/auth (prod)
```

## Validation Schemas

```typescript
import {
  loginSchema,
  registerSchema,
  type LoginFormData
} from '@jiffoo/shared';

// Form validation with Zod
const result = loginSchema.safeParse({
  email: 'user@example.com',
  password: 'password123'
});

if (result.success) {
  const data: LoginFormData = result.data;
  // Proceed with login
}
```

## Constants

```typescript
import {
  API_ENDPOINTS,
  USER_ROLES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  CURRENCIES,
  LANGUAGES
} from '@jiffoo/shared';

console.log(API_ENDPOINTS.AUTH.LOGIN); // '/api/auth/login'
console.log(USER_ROLES.CUSTOMER); // 'customer'
console.log(ORDER_STATUS.COMPLETED); // 'completed'
```

## Package Exports

The package provides multiple entry points for different use cases:

- `@jiffoo/shared` - Main exports (types, utils, API client)
- `@jiffoo/shared/logger` - Logging system (Node.js)
- `@jiffoo/shared/src/logger/index.browser` - Logging system (Browser)
- `@jiffoo/shared/src/i18n` - i18n utilities (server-safe)
- `@jiffoo/shared/src/i18n/react` - i18n React components
- `@jiffoo/shared/security` - Security utilities (Node.js only)
- `@jiffoo/shared/observability` - Observability stack
- `@jiffoo/shared/src/proxy` - Next.js proxy utilities
- `@jiffoo/shared/config/env` - Environment configuration

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Clean build artifacts
pnpm clean
```

## Best Practices

### Environment-Specific Imports

- **Node.js**: Use `@jiffoo/shared/logger` for server-side logging
- **Browser**: Use `@jiffoo/shared/src/logger/index.browser` for client-side logging
- **Security**: Only import `@jiffoo/shared/security` in Node.js environments (contains crypto)

### React Components

- **Server Components**: Import from `@jiffoo/shared/src/i18n` for server-safe utilities
- **Client Components**: Import from `@jiffoo/shared/src/i18n/react` for hooks and context

### Type Safety

Always import types explicitly to maintain type safety across your application:

```typescript
import type { ShopProductDetailDTO, OrderStatus } from '@jiffoo/shared';
```

## Documentation

- [Jiffoo Documentation](https://docs.jiffoo.com)
- [API Reference](https://docs.jiffoo.com/api)
- [GitHub Repository](https://github.com/thefreelight/Jiffoo)

## License

MIT © [Jiffoo Team](https://jiffoo.com)
