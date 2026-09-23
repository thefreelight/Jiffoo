import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from apps/api directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const envSchema = z.object({
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
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3001/api/v1'),
  NEXT_PUBLIC_ADMIN_URL: z.string().default('http://localhost:3002'),
  STOREFRONT_URL: z.string().url().optional(),

  VAULT_ADDR: z.string().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_NAMESPACE: z.string().optional(),
  VAULT_TIMEOUT_MS: z.string().transform(Number).default('5000'),
  VAULT_CACHE_TTL_MS: z.string().transform(Number).default('60000'),

  // Optional: Email
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  AUTH_REQUIRE_EMAIL_VERIFICATION: z.string().transform((v) => v.trim().toLowerCase() !== 'false').default('true'),

  // Optional: Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Platform integration (for closed-source deployment)
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

  // Worker deployment mode: embedded (default), standalone, off
  WORKER_MODE: z.enum(['embedded', 'standalone', 'off']).default('embedded'),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.STOREFRONT_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['STOREFRONT_URL'],
      message: 'STOREFRONT_URL is required in production',
    });
  }
});

export const env = {
  ...envSchema.parse(process.env),
  STOREFRONT_URL: process.env.STOREFRONT_URL || 'http://localhost:3003',
};
export type Env = z.infer<typeof envSchema>;
