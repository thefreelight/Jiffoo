/**
 * Configuration Migrator
 * 
 * 负责将旧插件配置格式转换为新微服务插件配置格式
 * 支持：
 * - 支付插件配置迁移
 * - 认证插件配置迁移
 * - 通知插件配置迁移
 * - 自定义配置映射
 */

import { PluginConfig } from '../core/PluginConfig';
import { PluginType, PluginCapabilityType, PluginCapability } from '../types/PluginTypes';
import { DatabaseConfig, CacheConfig, AuthConfig, EventsConfig, MonitoringConfig, ResourceConfig } from '../types/ConfigTypes';

/**
 * 旧插件配置基础接口
 */
export interface LegacyPluginConfig {
  pluginId: string;
  pluginName: string;
  version: string;
  price?: number;
  licenseKey?: string;
  domain?: string;
  [key: string]: any;
}

/**
 * 支付插件旧配置接口
 */
export interface LegacyPaymentConfig extends LegacyPluginConfig {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  environment?: 'sandbox' | 'production';
  currency?: string;
  region?: string;
}

/**
 * 认证插件旧配置接口
 */
export interface LegacyAuthConfig extends LegacyPluginConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

/**
 * 通知插件旧配置接口
 */
export interface LegacyNotificationConfig extends LegacyPluginConfig {
  provider: string;
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  templates?: Record<string, any>;
}

/**
 * 迁移选项
 */
export interface MigrationOptions {
  // 端口分配
  portRange?: {
    start: number;
    end: number;
  };
  
  // 数据库配置
  databaseUrl?: string;
  databasePool?: {
    min: number;
    max: number;
  };
  
  // 缓存配置
  cacheUrl?: string;
  cacheTtl?: number;
  
  // 安全配置
  enableAuth?: boolean;
  jwtSecret?: string;
  
  // 监控配置
  enableMetrics?: boolean;
  enableTracing?: boolean;
  
  // 自定义映射
  customMappings?: Record<string, any>;
}

/**
 * 配置迁移器
 */
export class ConfigMigrator {
  private static portCounter = 3000;
  private static usedPorts = new Set<number>();

  /**
   * 分配可用端口
   */
  private static allocatePort(options?: MigrationOptions): number {
    const start = options?.portRange?.start || 3000;
    const end = options?.portRange?.end || 4000;
    
    for (let port = start; port <= end; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    
    throw new Error(`No available ports in range ${start}-${end}`);
  }

  /**
   * 创建基础微服务配置
   */
  private static createBaseConfig(
    legacyConfig: LegacyPluginConfig,
    type: PluginType,
    options?: MigrationOptions
  ): PluginConfig {
    const port = this.allocatePort(options);
    
    const configData = {
      // 基础信息
      name: legacyConfig.pluginId,
      version: legacyConfig.version,
      description: `Migrated ${legacyConfig.pluginName}`,
      author: 'Jiffoo Migration Tool',
      type,

      // 服务配置
      port,
      host: '0.0.0.0',
      environment: 'development' as const,

      // 数据库配置
      database: {
        host: 'localhost',
        port: 5432,
        database: 'jiffoo_dev',
        username: 'jiffoo',
        password: 'jiffoo123',
        pool: options?.databasePool || { min: 2, max: 10 }
      } as DatabaseConfig,

      // 缓存配置
      cache: {
        host: 'localhost',
        port: 6379,
        ttl: options?.cacheTtl || 3600,
        keyPrefix: `plugin:${legacyConfig.pluginId}:`
      } as CacheConfig,

      // 认证配置
      auth: {
        jwtSecret: options?.jwtSecret || process.env.JWT_SECRET || 'default-secret',
        jwtExpiration: '1h'
      } as AuthConfig,

      // 事件配置
      events: {
        broker: 'redis' as const,
        connection: { host: 'localhost', port: 6379 },
        topics: [`plugin.${legacyConfig.pluginId}`]
      },

      // 监控配置
      monitoring: {
        metrics: {
          enabled: options?.enableMetrics !== false,
          endpoint: '/metrics',
          interval: 30
        },
        tracing: {
          enabled: options?.enableTracing !== false,
          serviceName: legacyConfig.pluginId
        },
        logging: {
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
          format: 'json'
        }
      } as MonitoringConfig,

      // 日志配置
      logLevel: (process.env.NODE_ENV === 'production' ? 'info' : 'debug') as 'debug' | 'info' | 'warn' | 'error',

      // 插件特定配置
      pluginConfig: legacyConfig
    };

    // 使用PluginConfig构造函数来确保所有必需的方法都存在
    return new PluginConfig(configData);
  }

  /**
   * 迁移支付插件配置
   */
  static migratePaymentConfig(
    legacyConfig: LegacyPaymentConfig,
    options?: MigrationOptions
  ): PluginConfig {
    const baseConfig = this.createBaseConfig(legacyConfig, PluginType.PAYMENT, options);
    
    // 支付插件特定配置
    const capabilities = [
      PluginCapabilityType.PAYMENT_PROCESSING,
      PluginCapabilityType.WEBHOOK_HANDLING,
      PluginCapabilityType.REFUND_PROCESSING
    ];

    // 如果有webhook配置，添加webhook能力
    if (legacyConfig.webhookSecret) {
      capabilities.push(PluginCapabilityType.WEBHOOK_HANDLING);
    }

    (baseConfig as any).capabilities = capabilities;
    
    // 环境特定配置
    if (legacyConfig.environment === 'sandbox') {
      (baseConfig as any).resources = {
        memory: {
          request: '64Mi',
          limit: '128Mi'
        },
        cpu: {
          request: '50m',
          limit: '100m'
        }
      };
    }
    
    return baseConfig;
  }

  /**
   * 迁移认证插件配置
   */
  static migrateAuthConfig(
    legacyConfig: LegacyAuthConfig,
    options?: MigrationOptions
  ): PluginConfig {
    const baseConfig = this.createBaseConfig(legacyConfig, PluginType.AUTHENTICATION, options);
    
    // 认证插件特定配置
    const authCapabilities = [
      PluginCapabilityType.USER_AUTHENTICATION,
      PluginCapabilityType.TOKEN_MANAGEMENT,
      PluginCapabilityType.OAUTH_PROVIDER
    ];

    (baseConfig as any).capabilities = authCapabilities;
    
    return baseConfig;
  }

  /**
   * 迁移通知插件配置
   */
  static migrateNotificationConfig(
    legacyConfig: LegacyNotificationConfig,
    options?: MigrationOptions
  ): PluginConfig {
    const baseConfig = this.createBaseConfig(legacyConfig, PluginType.NOTIFICATION, options);
    
    // 通知插件特定配置
    const notificationCapabilities = [
      PluginCapabilityType.MESSAGE_SENDING,
      PluginCapabilityType.TEMPLATE_PROCESSING
    ];

    // 根据provider类型添加特定能力
    switch (legacyConfig.provider) {
      case 'email':
        notificationCapabilities.push(PluginCapabilityType.EMAIL_SENDING);
        break;
      case 'sms':
        notificationCapabilities.push(PluginCapabilityType.SMS_SENDING);
        break;
      case 'push':
        notificationCapabilities.push(PluginCapabilityType.PUSH_NOTIFICATION);
        break;
    }

    (baseConfig as any).capabilities = notificationCapabilities;
    
    return baseConfig;
  }

  /**
   * 通用配置迁移
   */
  static migrateGenericConfig(
    legacyConfig: LegacyPluginConfig,
    type: PluginType,
    options?: MigrationOptions
  ): PluginConfig {
    return this.createBaseConfig(legacyConfig, type, options);
  }

  /**
   * 批量迁移配置
   */
  static migrateBatchConfigs(
    configs: Array<{
      config: LegacyPluginConfig;
      type: PluginType;
    }>,
    options?: MigrationOptions
  ): PluginConfig[] {
    return configs.map(({ config, type }) => {
      switch (type) {
        case PluginType.PAYMENT:
          return this.migratePaymentConfig(config as LegacyPaymentConfig, options);
        case PluginType.AUTHENTICATION:
          return this.migrateAuthConfig(config as LegacyAuthConfig, options);
        case PluginType.NOTIFICATION:
          return this.migrateNotificationConfig(config as LegacyNotificationConfig, options);
        default:
          return this.migrateGenericConfig(config, type, options);
      }
    });
  }

  /**
   * 验证迁移后的配置
   */
  static validateMigratedConfig(config: PluginConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必需字段检查
    if (!config.name) errors.push('Plugin name is required');
    if (!config.version) errors.push('Plugin version is required');
    if (!config.type) errors.push('Plugin type is required');
    if (!config.port || config.port < 1000 || config.port > 65535) {
      errors.push('Valid port number (1000-65535) is required');
    }

    // 数据库配置检查
    if (!config.database?.host) {
      errors.push('Database host is required');
    }

    // 缓存配置检查
    if (!config.cache?.host) {
      warnings.push('Cache host not configured, using default');
    }

    // 端口冲突检查
    if (this.usedPorts.has(config.port)) {
      errors.push(`Port ${config.port} is already in use`);
    }

    // 资源限制检查
    if (!config.resources?.memory) {
      warnings.push('Memory limit not specified, using default');
    }
    if (!config.resources?.cpu) {
      warnings.push('CPU limit not specified, using default');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 生成迁移报告
   */
  static generateMigrationReport(
    originalConfigs: LegacyPluginConfig[],
    migratedConfigs: PluginConfig[]
  ): {
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
    details: Array<{
      original: LegacyPluginConfig;
      migrated?: PluginConfig;
      validation?: ReturnType<typeof ConfigMigrator.validateMigratedConfig>;
      error?: string;
    }>;
  } {
    const details = originalConfigs.map((original, index) => {
      const migrated = migratedConfigs[index];
      if (!migrated) {
        return {
          original,
          error: 'Migration failed - no output config'
        };
      }

      const validation = this.validateMigratedConfig(migrated);
      return {
        original,
        migrated,
        validation
      };
    });

    const successful = details.filter(d => d.validation?.valid).length;
    const failed = details.length - successful;

    return {
      summary: {
        total: originalConfigs.length,
        successful,
        failed
      },
      details
    };
  }

  /**
   * 重置端口分配器（用于测试）
   */
  static resetPortAllocator(): void {
    this.portCounter = 3000;
    this.usedPorts.clear();
  }
}
