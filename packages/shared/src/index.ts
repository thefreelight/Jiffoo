// API Types
export * from './types/api';
export * from './types/auth';
export * from './types/user';
export * from './types/product';
export * from './types/order';
export * from './types/cart';
export * from './types/common';
export * from './types/theme';
export * from './extensions/plugin-contract';
export * from './extensions/commercial-package';
export * from './extensions/official-catalog';
export * from './extensions/platform-connection';

export * from './events/core-events';
export * from './core-update/public-manifest';


// Validation Schemas
export * from './schemas/auth';
export * from './schemas/product';
export * from './schemas/order';
export * from './schemas/theme-config';
export * from './security/admin-rbac';

// Utilities
export * from './utils/constants';
export * from './utils/helpers';
export * from './utils/validation';

// i18n - Internationalization
// Note: React components require 'use client' directive
// For server-side use, import config/messages directly from './i18n/config' or './i18n/messages'
export * from './i18n';

// Logger - Not exported here, choose based on environment:
// - Browser environment: import from 'shared/src/logger/index.browser'
// - Node.js environment: import from 'shared/src/logger'

// Security - Security module
// Only use in Node.js environment, contains crypto dependencies
// import { RateLimiter, CircuitBreaker, ... } from '@shared/security'
