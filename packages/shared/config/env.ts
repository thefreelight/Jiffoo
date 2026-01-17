/**
 * Unified Environment Configuration Management
 * Provides type-safe access to environment variables for both frontend and backend
 * strictly following the definitions in the root .env file.
 */

// API Service Environment Interfaces
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
}

// Frontend Environment Interfaces
export interface FrontendEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_ADMIN_URL: string;
  NEXT_PUBLIC_SHOP_URL: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

/**
 * Unified Environment Configuration Class (Singleton)
 */
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

  // Environment checks
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

  /**
   * Get API Service URL (No /api path, for direct server-to-server calls)
   */
  getApiServiceUrl(): string {
    if (this.isServer) {
      return this.getRequired('API_SERVICE_URL');
    } else {
      return this.getRequired('NEXT_PUBLIC_API_URL');
    }
  }

  /**
   * Get API Service Base URL (Includes /api path, for axios baseURL)
   */
  getApiServiceBaseUrl(): string {
    if (this.isServer) {
      const baseUrl = this.getRequired('API_SERVICE_URL');
      return `${baseUrl}/api`;
    } else {
      return this.getRequired('NEXT_PUBLIC_API_URL');
    }
  }

  /**
   * Get Shop Frontend Application URL
   */
  getShopUrl(): string {
    return this.getRequired('NEXT_PUBLIC_SHOP_URL');
  }

  /**
   * Get full API endpoint URL
   */
  getApiUrl(endpoint: string): string {
    const baseUrl = this.getApiServiceUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }

  /**
   * Get required environment variable
   */
  getRequired<T = string>(key: string): T {
    const value = process.env[key];

    // Client-side: Provide development defaults for NEXT_PUBLIC_* variables
    if (this.isClient && key.startsWith('NEXT_PUBLIC_')) {
      if (!value || value === '') {
        const defaults: Record<string, string> = {
          'NEXT_PUBLIC_API_URL': '/api',
          'NEXT_PUBLIC_SHOP_URL': 'http://localhost:3003',
          'NEXT_PUBLIC_ADMIN_URL': 'http://localhost:3002',
        };

        if (defaults[key]) {
          return defaults[key] as T;
        }
      }
      return (value || '') as T;
    }

    // Server-side: Throw error if required variable is missing
    if (!value || value === '') {
      if (this.isServer) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
    }

    return value as T;
  }

  /**
   * Get numerical environment variable
   */
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

  /**
   * Get array environment variable (comma separated)
   */
  getArray(key: string): string[] {
    const value = process.env[key];
    if (value === undefined || value === '') {
      throw new Error(`Environment variable ${key} is not set`);
    }
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  /**
   * Validate required environment variables
   */
  validateRequired(keys: string[]): void {
    const missing = keys.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  // Database Configuration
  getDatabaseConfig() {
    return {
      url: this.getRequired('DATABASE_URL'),
    };
  }

  // Redis Configuration
  getRedisConfig() {
    return {
      url: this.getRequired('REDIS_URL'),
    };
  }

  // JWT Configuration
  getJwtConfig() {
    return {
      secret: this.getRequired('JWT_SECRET'),
      expiresIn: this.getRequired('JWT_EXPIRES_IN'),
    };
  }

  // CORS Configuration
  getCorsConfig() {
    return {
      origin: this.getArray('CORS_ORIGIN'),
    };
  }

  // Stripe Configuration
  getStripeConfig() {
    return {
      secretKey: this.getRequired('STRIPE_SECRET_KEY'),
      publishableKey: this.getRequired('STRIPE_PUBLISHABLE_KEY'),
      webhookSecret: this.getRequired('STRIPE_WEBHOOK_SECRET'),
    };
  }
}

// Export singleton instance
export const envConfig = EnvironmentConfig.getInstance();

// Export convenience functions
export const getApiServiceUrl = () => envConfig.getApiServiceUrl();
export const getApiServiceBaseUrl = () => envConfig.getApiServiceBaseUrl();
export const getShopUrl = () => envConfig.getShopUrl();
export const getApiUrl = (endpoint: string) => envConfig.getApiUrl(endpoint);
export const isDevelopment = envConfig.isDevelopment;
export const isProduction = envConfig.isProduction;
export const isServer = envConfig.isServer;
export const isClient = envConfig.isClient;
export const getStripeConfig = () => envConfig.getStripeConfig();
export const getDatabaseConfig = () => envConfig.getDatabaseConfig();
export const getRedisConfig = () => envConfig.getRedisConfig();
export const getJwtConfig = () => envConfig.getJwtConfig();
export const getCorsConfig = () => envConfig.getCorsConfig();
