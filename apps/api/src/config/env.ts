import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from apps/api directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  // Database
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PRISMA_LOG_QUERY: z.string().transform((v) => v === 'true').default('false'),

  // Server
  API_PORT: z.string().transform(Number).default('3001'),
  API_HOST: z.string().default('0.0.0.0'),

  // Rate Limiting
  RATE_LIMITER_FAIL_CLOSED: z.string().transform((v) => v === 'true').default('true'),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS
  CORS_ENABLED: z.string().transform((v) => v === 'true').default('true'),
  CORS_CREDENTIALS: z.string().transform((v) => v === 'true').default('true'),
  CORS_ORIGIN: z.string().default('http://localhost:3002,http://localhost:3003'),

  // URLs
  API_SERVICE_URL: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3001/api'),
  NEXT_PUBLIC_ADMIN_URL: z.string().default('http://localhost:3002'),
  NEXT_PUBLIC_SHOP_URL: z.string().default('http://localhost:3003'),

  // Platform domains (production)
  PLATFORM_MAIN_DOMAIN: z.string().default('jiffoo.com'),
  PLATFORM_SHOP_DOMAIN: z.string().default('shop.jiffoo.com'),
  PLATFORM_ADMIN_DOMAIN: z.string().default('admin.jiffoo.com'),
  PLATFORM_API_DOMAIN: z.string().default('api.jiffoo.com'),

  // Optional: Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  VAULT_ADDR: z.string().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_NAMESPACE: z.string().optional(),
  VAULT_TIMEOUT_MS: z.string().transform(Number).default('5000'),
  VAULT_CACHE_TTL_MS: z.string().transform(Number).default('60000'),

  // Optional: Email
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),

  // Optional: Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Platform integration (for closed-source deployment)
  SERVICE_JWT_ISSUER: z.string().default('jiffoo-platform'),
  SERVICE_JWT_SECRET: z.string().optional(),
  // CDN Configuration
  CDN_ENABLED: z.string().transform((v) => v === 'true').default('false'),
  CDN_URL: z.string().optional(),
  CDN_DISTRIBUTION_ID: z.string().optional(),
  CDN_ACCESS_KEY_ID: z.string().optional(),
  CDN_SECRET_ACCESS_KEY: z.string().optional(),
  CDN_REGION: z.string().default('us-east-1'),
  CDN_BUCKET: z.string().optional(),
  CDN_CACHE_CONTROL_MAX_AGE: z.string().transform(Number).default('31536000'), // 1 year
  CDN_IMAGE_FORMATS: z.string().default('webp,avif,jpeg,png'),
  CDN_IMAGE_QUALITY: z.string().transform(Number).default('80'),

  // Extension Package Signing (Phase 5, Section 4.8)
  EXTENSION_SIGNATURE_VERIFY: z.enum(['required', 'optional', 'disabled']).default('optional'),

  // Market Integration (Phase 6, Section 4.9)
  MARKET_API_URL: z.string().default('https://platform-api.jiffoo.com/api'),
  MARKET_API_KEY: z.string().optional(),
  ENABLE_MARKET_UPDATE_CHECKER: z.string().transform((v) => v === 'true').default('false'),

  // External catalog import (integration projector)
  CATALOG_IMPORT_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
