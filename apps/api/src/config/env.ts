import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root directory
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: rootEnvPath });

// Only log in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('Loading .env from:', rootEnvPath);
  console.log('Environment variables loaded:');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
  console.log('NODE_ENV:', process.env.NODE_ENV);
}

// Environment schema - strictly follow variable definitions in the root .env file, do not use default values
// Service name mapping: BACKEND→API, ADMIN→STORE, FRONTEND→SHOP
const envSchema = z.object({
  // Environment configuration
  NODE_ENV: z.enum(['development', 'production', 'test']),
  LOG_LEVEL: z.string(),

  // Database configuration
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),

  // API configuration
  API_PORT: z.string().transform(Number),
  API_HOST: z.string(),
  CORS_ORIGIN: z.string(),

  // JWT configuration
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string(),

  // API service URL configuration
  API_SERVICE_URL: z.string(),

  // Client API URL configuration
  NEXT_PUBLIC_API_URL: z.string(),

  // Frontend application URL configuration
  NEXT_PUBLIC_ADMIN_URL: z.string(),
  NEXT_PUBLIC_SHOP_URL: z.string(),

  // Platform domain configuration
  PLATFORM_MAIN_DOMAIN: z.string().default('jiffoo.com'),
  PLATFORM_FRONTEND_DOMAIN: z.string().default('shop.jiffoo.com'),
  PLATFORM_ADMIN_DOMAIN: z.string().default('admin.jiffoo.com'),
  PLATFORM_API_DOMAIN: z.string().default('api.jiffoo.com'),
  PLATFORM_AUTH_DOMAIN: z.string().default('auth.jiffoo.com'),

  // Payment configuration
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_PUBLISHABLE_KEY: z.string(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),

  // Google OAuth configuration
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // Resend email configuration
  RESEND_API_KEY: z.string(),
  RESEND_WEBHOOK_SECRET: z.string(),

  // Email sending configuration
  EMAIL_FROM: z.string(),
  EMAIL_FROM_NAME: z.string(),
  EMAIL_REPLY_TO: z.string(),

  // CORS configuration
  CORS_ENABLED: z.string().transform((val) => val === 'true'),
  CORS_CREDENTIALS: z.string().transform((val) => val === 'true'),

  // Google OAuth configuration
  GOOGLE_REDIRECT_URI: z.string(),

  // Platform service configuration
  SERVICE_JWT_ISSUER: z.string().default('jiffoo-platform'),
});

const parsedEnv = envSchema.parse(process.env);

// Export environment variables object
export const env = parsedEnv;

export type Env = z.infer<typeof envSchema>;
