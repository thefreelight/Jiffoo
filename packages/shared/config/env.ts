/**
 * 统一的环境配置管理
 * 为所有前端和后端应用提供类型安全的环境变量访问
 * 严格按照根目录 .env 文件中的环境变量定义
 */

// API服务环境变量类型（严格按照 .env 文件）
// 服务名映射: backend→api, super-admin→admin, admin→tenant, frontend→shop, agent-portal→agent
export interface ApiServiceEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  API_PORT: number;
  API_HOST: string;
  CORS_ORIGIN: string;
  CORS_ENABLED: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  API_SERVICE_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_WEBHOOK_SECRET: string;
  // 🆕 平台域名配置
  PLATFORM_MAIN_DOMAIN: string;
  PLATFORM_FRONTEND_DOMAIN: string;
  PLATFORM_ADMIN_DOMAIN: string;
  PLATFORM_API_DOMAIN: string;
  PLATFORM_AUTH_DOMAIN: string;
}

// 前端环境变量类型（严格按照 .env 文件）
// 服务名映射: SUPER_ADMIN→ADMIN, ADMIN→TENANT, FRONTEND→SHOP, AGENT_PORTAL→AGENT
export interface FrontendEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_ADMIN_URL: string;
  NEXT_PUBLIC_TENANT_URL: string;
  NEXT_PUBLIC_SHOP_URL: string;
  NEXT_PUBLIC_AGENT_URL: string;
  NEXT_PUBLIC_WHITE_LABEL_URL: string;
  NEXT_PUBLIC_DISTRIBUTION_PLUGIN_URL: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  // 🆕 前端平台域名配置
  NEXT_PUBLIC_PLATFORM_MAIN_DOMAIN: string;
  NEXT_PUBLIC_PLATFORM_FRONTEND_DOMAIN: string;
  NEXT_PUBLIC_PLATFORM_ADMIN_DOMAIN: string;
  NEXT_PUBLIC_PLATFORM_API_DOMAIN: string;
  NEXT_PUBLIC_PLATFORM_AUTH_DOMAIN: string;
}

// 统一的环境配置类
class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private _isServer: boolean;
  private _isDevelopment: boolean;
  private _isProduction: boolean;
  private _isTest: boolean;

  private constructor() {
    this._isServer = typeof window === 'undefined';
    this._isDevelopment = process.env.NODE_ENV === 'development';
    this._isProduction = process.env.NODE_ENV === 'production';
    this._isTest = process.env.NODE_ENV === 'test';
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  // 环境检查
  get isServer(): boolean {
    return this._isServer;
  }

  get isClient(): boolean {
    return !this._isServer;
  }

  get isDevelopment(): boolean {
    return this._isDevelopment;
  }

  get isProduction(): boolean {
    return this._isProduction;
  }

  get isTest(): boolean {
    return this._isTest;
  }

  // 获取API服务URL (不含/api路径，用于服务端直连)
  getApiServiceUrl(): string {
    if (this.isServer) {
      // 服务端：使用内部地址
      return this.getRequired('API_SERVICE_URL');
    } else {
      // 客户端：使用公共地址
      return this.getRequired('NEXT_PUBLIC_API_URL');
    }
  }

  // 获取API服务 Base URL (含/api路径，用于axios baseURL)
  getApiServiceBaseUrl(): string {
    if (this.isServer) {
      // 服务端：使用内部地址 + /api
      const baseUrl = this.getRequired('API_SERVICE_URL');
      return `${baseUrl}/api`;
    } else {
      // 客户端：使用Next.js代理路径
      // Next.js rewrites 会转发 headers（包括 X-Tenant-ID）
      return this.getRequired('NEXT_PUBLIC_API_URL');
    }
  }

  // 获取商城前端应用URL
  getShopUrl(): string {
    return this.getRequired('NEXT_PUBLIC_SHOP_URL');
  }

  // 获取API端点URL
  getApiUrl(endpoint: string): string {
    const baseUrl = this.getApiServiceUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }

  // 获取必需的环境变量
  getRequired<T = string>(key: string): T {
    // Next.js 16: 在客户端，process.env 只包含 NEXT_PUBLIC_* 变量
    // 在构建时，这些变量会被内联到代码中
    const value = process.env[key];

    // 客户端：为 NEXT_PUBLIC_* 变量提供静默的默认值（避免开发环境噪音）
    // 服务名映射: SUPER_ADMIN→ADMIN, ADMIN→TENANT, FRONTEND→SHOP, AGENT_PORTAL→AGENT
    if (this.isClient && key.startsWith('NEXT_PUBLIC_')) {
      if (!value || value === '') {
        // 为常见的环境变量提供开发环境默认值（完全静默）
        const defaults: Record<string, string> = {
          'NEXT_PUBLIC_API_URL': '/api',
          'NEXT_PUBLIC_SHOP_URL': 'http://localhost:3004',
          'NEXT_PUBLIC_ADMIN_URL': 'http://localhost:3002',
          'NEXT_PUBLIC_TENANT_URL': 'http://localhost:3003',
          'NEXT_PUBLIC_AGENT_URL': 'http://localhost:3005',
          'NEXT_PUBLIC_WHITE_LABEL_URL': 'http://localhost:3006',
          'NEXT_PUBLIC_DISTRIBUTION_PLUGIN_URL': 'http://localhost:3007',
        };

        if (defaults[key]) {
          return defaults[key] as T;
        }
      }
      // 如果有值或有默认值，直接返回
      return (value || '') as T;
    }

    // 服务端：必需的环境变量未设置才抛出错误
    if (!value || value === '') {
      if (this.isServer) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
    }
    
    return value as T;
  }

  // 获取数字环境变量
  getNumber(key: string): number {
    const value = process.env[key];
    if (value === undefined || value === '') {
      throw new Error(`Environment variable ${key} is not set`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} is not a valid number: ${value}`);
    }
    return parsed;
  }

  // 获取数组环境变量（逗号分隔）
  getArray(key: string): string[] {
    const value = process.env[key];
    if (value === undefined || value === '') {
      throw new Error(`Environment variable ${key} is not set`);
    }
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  // 验证必需的环境变量
  validateRequired(keys: string[]): void {
    const missing = keys.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  // 获取数据库配置
  getDatabaseConfig() {
    return {
      url: this.getRequired('DATABASE_URL'),
    };
  }

  // 获取Redis配置
  getRedisConfig() {
    return {
      url: this.getRequired('REDIS_URL'),
    };
  }

  // 获取JWT配置
  getJwtConfig() {
    return {
      secret: this.getRequired('JWT_SECRET'),
      expiresIn: this.getRequired('JWT_EXPIRES_IN'),
    };
  }

  // 获取CORS配置
  getCorsConfig() {
    return {
      origin: this.getArray('CORS_ORIGIN'),
    };
  }

  // 获取Stripe配置
  getStripeConfig() {
    return {
      secretKey: this.getRequired('STRIPE_SECRET_KEY'),
      publishableKey: this.getRequired('STRIPE_PUBLISHABLE_KEY'),
      webhookSecret: this.getRequired('STRIPE_WEBHOOK_SECRET'),
    };
  }

  // 🆕 获取平台域名配置
  getPlatformDomainConfig() {
    if (this.isServer) {
      return {
        mainDomain: process.env.PLATFORM_MAIN_DOMAIN || 'jiffoo.com',
        frontendDomain: process.env.PLATFORM_FRONTEND_DOMAIN || 'shop.jiffoo.com',
        adminDomain: process.env.PLATFORM_ADMIN_DOMAIN || 'admin.jiffoo.com',
        apiDomain: process.env.PLATFORM_API_DOMAIN || 'api.jiffoo.com',
        authDomain: process.env.PLATFORM_AUTH_DOMAIN || 'auth.jiffoo.com',
      };
    } else {
      return {
        mainDomain: process.env.NEXT_PUBLIC_PLATFORM_MAIN_DOMAIN || 'jiffoo.com',
        frontendDomain: process.env.NEXT_PUBLIC_PLATFORM_FRONTEND_DOMAIN || 'shop.jiffoo.com',
        adminDomain: process.env.NEXT_PUBLIC_PLATFORM_ADMIN_DOMAIN || 'admin.jiffoo.com',
        apiDomain: process.env.NEXT_PUBLIC_PLATFORM_API_DOMAIN || 'api.jiffoo.com',
        authDomain: process.env.NEXT_PUBLIC_PLATFORM_AUTH_DOMAIN || 'auth.jiffoo.com',
      };
    }
  }

  // 🆕 检查域名是否为平台域名
  isPlatformDomain(hostname: string): boolean {
    const config = this.getPlatformDomainConfig();
    return [
      config.mainDomain,
      config.frontendDomain,
      config.adminDomain,
      config.apiDomain,
      config.authDomain,
    ].some(domain => hostname === domain || hostname.endsWith(`.${config.mainDomain}`));
  }
}

// 导出单例实例
export const envConfig = EnvironmentConfig.getInstance();

// 导出便捷函数（新命名）
export const getApiServiceUrl = () => envConfig.getApiServiceUrl();
export const getApiServiceBaseUrl = () => envConfig.getApiServiceBaseUrl();
export const getShopUrl = () => envConfig.getShopUrl();
export const getApiUrl = (endpoint: string) => envConfig.getApiUrl(endpoint);
export const isDevelopment = envConfig.isDevelopment;
export const isProduction = envConfig.isProduction;
export const isServer = envConfig.isServer;
export const isClient = envConfig.isClient;
export const getPlatformDomainConfig = () => envConfig.getPlatformDomainConfig();
export const isPlatformDomain = (hostname: string) => envConfig.isPlatformDomain(hostname);
