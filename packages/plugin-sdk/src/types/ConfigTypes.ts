/**
 * Configuration Types for Plugin SDK
 * 
 * 定义插件配置相关的类型接口
 */

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min?: number;
    max?: number;
    idle?: number;
  };
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  username?: string;
  database?: number;
  keyPrefix?: string;
  ttl?: number;
}

/**
 * 认证配置接口
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration?: string;
  apiKeys?: string[];
  allowedOrigins?: string[];
}

/**
 * 事件配置接口
 */
export interface EventsConfig {
  enabled: boolean;
  broker: 'redis' | 'kafka' | 'memory';
  topics: string[];
}

/**
 * 监控配置接口
 */
export interface MonitoringConfig {
  metrics: {
    enabled: boolean;
    endpoint?: string;
    interval?: number;
  };
  tracing: {
    enabled: boolean;
    endpoint?: string;
    serviceName?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
}

/**
 * 资源配置接口
 */
export interface ResourceConfig {
  memory: {
    request?: string;
    limit?: string;
  };
  cpu: {
    request?: string;
    limit?: string;
  };
}
