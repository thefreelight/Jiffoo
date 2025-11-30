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

// 环境变量 schema - 严格按照根目录 .env 文件中的变量定义，不使用 default 值
// 服务名映射: BACKEND→API, SUPER_ADMIN→ADMIN, ADMIN→TENANT, FRONTEND→SHOP, AGENT_PORTAL→AGENT
const envSchema = z.object({
  // 环境配置
  NODE_ENV: z.enum(['development', 'production', 'test']),
  LOG_LEVEL: z.string(),

  // 数据库配置
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),

  // API配置
  API_PORT: z.string().transform(Number),
  API_HOST: z.string(),
  CORS_ORIGIN: z.string(),

  // JWT配置
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string(),

  // API服务URL配置（新命名）
  API_SERVICE_URL: z.string(),

  // 客户端API URL配置
  NEXT_PUBLIC_API_URL: z.string(),

  // 前端应用URL配置（新命名：ADMIN=平台管理员, TENANT=租户管理员, SHOP=商城前台, AGENT=代理）
  NEXT_PUBLIC_ADMIN_URL: z.string(),
  NEXT_PUBLIC_TENANT_URL: z.string(),
  NEXT_PUBLIC_SHOP_URL: z.string(),
  NEXT_PUBLIC_AGENT_URL: z.string(),
  NEXT_PUBLIC_WHITE_LABEL_URL: z.string(),
  NEXT_PUBLIC_DISTRIBUTION_PLUGIN_URL: z.string(),

  // 🆕 平台域名配置
  PLATFORM_MAIN_DOMAIN: z.string().default('jiffoo.com'),
  PLATFORM_FRONTEND_DOMAIN: z.string().default('shop.jiffoo.com'),
  PLATFORM_ADMIN_DOMAIN: z.string().default('admin.jiffoo.com'),
  PLATFORM_API_DOMAIN: z.string().default('api.jiffoo.com'),
  PLATFORM_AUTH_DOMAIN: z.string().default('auth.jiffoo.com'),

  // 支付配置
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_PUBLISHABLE_KEY: z.string(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),

  // Google OAuth配置
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // Resend邮件配置
  RESEND_API_KEY: z.string(),
  RESEND_WEBHOOK_SECRET: z.string(),

  // 邮件发送配置
  EMAIL_FROM: z.string(),
  EMAIL_FROM_NAME: z.string(),
  EMAIL_REPLY_TO: z.string(),

  // CORS配置
  CORS_ENABLED: z.string().transform((val) => val === 'true'),
  CORS_CREDENTIALS: z.string().transform((val) => val === 'true'),

  // Google OAuth配置
  GOOGLE_REDIRECT_URI: z.string(),
});

const parsedEnv = envSchema.parse(process.env);

// 导出环境变量对象
export const env = parsedEnv;

export type Env = z.infer<typeof envSchema>;
