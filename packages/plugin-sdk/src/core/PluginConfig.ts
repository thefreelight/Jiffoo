import { PluginConfigInterface, PluginType } from '../types/PluginTypes';
import { ConfigValidator } from '../utils/ConfigValidator';
import { PluginConfigurationError } from '../types/PluginTypes';

/**
 * 插件配置管理类
 * 负责加载、验证和管理插件配置
 */
export class PluginConfig implements PluginConfigInterface {
  public readonly name: string;
  public readonly version: string;
  public readonly description: string;
  public readonly author: string;
  public readonly type: PluginType;
  public readonly port: number;
  public readonly host?: string;
  public readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  public readonly database: PluginConfigInterface['database'];
  public readonly cache: PluginConfigInterface['cache'];
  public readonly auth: PluginConfigInterface['auth'];
  public readonly events: PluginConfigInterface['events'];
  public readonly cors?: PluginConfigInterface['cors'];
  public readonly rateLimit?: PluginConfigInterface['rateLimit'];
  public readonly swagger?: PluginConfigInterface['swagger'];
  public readonly monitoring?: PluginConfigInterface['monitoring'];
  public readonly pluginConfig?: Record<string, any>;
  public readonly environment: 'development' | 'staging' | 'production';
  public readonly security?: PluginConfigInterface['security'];

  // 额外的配置属性
  public readonly dependencies?: Array<{
    name: string;
    version: string;
    type: 'plugin' | 'service' | 'library';
    required: boolean;
  }>;
  
  public readonly capabilities?: Array<{
    name: string;
    version: string;
    description: string;
    required: boolean;
  }>;
  
  public readonly resources?: {
    cpu?: { request?: string; limit?: string; };
    memory?: { request?: string; limit?: string; };
    storage?: { request?: string; limit?: string; };
    network?: { bandwidth?: string; connections?: number; };
  };

  constructor(config: Partial<PluginConfigInterface> & { name: string; version: string }) {
    // 验证必需字段
    this.validateRequiredFields(config);
    
    // 基本信息
    this.name = config.name;
    this.version = config.version;
    this.description = config.description || `${config.name} plugin`;
    this.author = config.author || 'Unknown';
    this.type = config.type || PluginType.CUSTOM;
    this.port = config.port || this.getDefaultPort();
    this.host = config.host || '0.0.0.0';
    this.logLevel = config.logLevel || 'info';
    this.environment = config.environment || 'development';

    // 数据库配置
    this.database = this.buildDatabaseConfig(config.database);
    
    // 缓存配置
    this.cache = this.buildCacheConfig(config.cache);
    
    // 认证配置
    this.auth = this.buildAuthConfig(config.auth);
    
    // 事件配置
    this.events = this.buildEventsConfig(config.events);
    
    // 可选配置
    this.cors = config.cors;
    this.rateLimit = config.rateLimit || this.getDefaultRateLimit();
    this.swagger = config.swagger || this.getDefaultSwaggerConfig();
    this.monitoring = config.monitoring || this.getDefaultMonitoringConfig();
    this.security = config.security || this.getDefaultSecurityConfig();
    this.pluginConfig = config.pluginConfig || {};
    
    // 插件元数据
    this.dependencies = (config as any).dependencies || [];
    this.capabilities = (config as any).capabilities || [];
    this.resources = (config as any).resources || this.getDefaultResources();

    // 验证完整配置（仅在生产环境）
    if (process.env.NODE_ENV === 'production') {
      this.validateConfiguration();
    }
  }

  /**
   * 从环境变量和配置文件加载配置
   */
  public static async load(configPath?: string): Promise<PluginConfig> {
    let config: Partial<PluginConfigInterface> = {};

    // 从配置文件加载
    if (configPath) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, 'utf8');
          const ext = path.extname(configPath);
          
          if (ext === '.json') {
            config = JSON.parse(configContent);
          } else if (ext === '.yaml' || ext === '.yml') {
            const yaml = await import('yaml');
            config = yaml.parse(configContent);
          }
        }
      } catch (error) {
        throw new PluginConfigurationError(`Failed to load config from ${configPath}`, error);
      }
    }

    // 从环境变量覆盖配置
    const envConfig = PluginConfig.loadFromEnvironment();
    config = { ...config, ...envConfig };

    // 确保必需字段存在
    if (!config.name) {
      throw new PluginConfigurationError('Plugin name is required');
    }
    if (!config.version) {
      throw new PluginConfigurationError('Plugin version is required');
    }

    return new PluginConfig(config as any);
  }

  /**
   * 从环境变量加载配置
   */
  private static loadFromEnvironment(): Partial<PluginConfigInterface> {
    const env = process.env;
    
    return {
      name: env.PLUGIN_NAME,
      version: env.PLUGIN_VERSION,
      description: env.PLUGIN_DESCRIPTION,
      author: env.PLUGIN_AUTHOR,
      type: env.PLUGIN_TYPE as PluginType,
      port: env.PLUGIN_PORT ? parseInt(env.PLUGIN_PORT) : undefined,
      host: env.PLUGIN_HOST,
      logLevel: env.LOG_LEVEL as any,
      environment: env.NODE_ENV as any,
      
      database: {
        host: env.DB_HOST || 'localhost',
        port: env.DB_PORT ? parseInt(env.DB_PORT) : 5432,
        database: env.DB_NAME || 'plugin_db',
        username: env.DB_USER || 'plugin_user',
        password: env.DB_PASSWORD || '',
        ssl: env.DB_SSL === 'true',
        pool: {
          min: env.DB_POOL_MIN ? parseInt(env.DB_POOL_MIN) : 2,
          max: env.DB_POOL_MAX ? parseInt(env.DB_POOL_MAX) : 10,
          idle: env.DB_POOL_IDLE ? parseInt(env.DB_POOL_IDLE) : 10000
        }
      },
      
      cache: {
        host: env.REDIS_HOST || 'localhost',
        port: env.REDIS_PORT ? parseInt(env.REDIS_PORT) : 6379,
        password: env.REDIS_PASSWORD,
        username: env.REDIS_USERNAME,
        database: env.REDIS_DB ? parseInt(env.REDIS_DB) : 0,
        keyPrefix: env.REDIS_KEY_PREFIX,
        ttl: env.REDIS_TTL ? parseInt(env.REDIS_TTL) : 3600
      },
      
      auth: {
        jwtSecret: env.JWT_SECRET || 'default-secret',
        jwtExpiration: env.JWT_EXPIRATION || '1h',
        apiKeys: env.API_KEYS ? env.API_KEYS.split(',') : [],
        allowedOrigins: env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : []
      },
      
      events: {
        broker: (env.EVENT_BROKER as any) || 'redis',
        connection: {
          host: env.EVENT_HOST || env.REDIS_HOST || 'localhost',
          port: env.EVENT_PORT ? parseInt(env.EVENT_PORT) : 6379,
          password: env.EVENT_PASSWORD || env.REDIS_PASSWORD
        }
      }
    };
  }

  /**
   * 验证必需字段
   */
  private validateRequiredFields(config: any): void {
    const required = ['name', 'version'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new PluginConfigurationError(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * 构建数据库配置
   */
  private buildDatabaseConfig(config?: any): PluginConfigInterface['database'] {
    if (!config) {
      // 在开发环境提供默认配置
      if (process.env.NODE_ENV !== 'production') {
        return {
          host: 'localhost',
          port: 5432,
          database: 'jiffoo_dev',
          username: 'postgres',
          password: 'password',
          ssl: false
        };
      }
      throw new PluginConfigurationError('Database configuration is required in production');
    }

    return {
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || `plugin_${this.name}`,
      username: config.username || `${this.name}_user`,
      password: config.password || '',
      ssl: config.ssl || false,
      pool: {
        min: config.pool?.min || 2,
        max: config.pool?.max || 10,
        idle: config.pool?.idle || 10000
      }
    };
  }

  /**
   * 构建缓存配置
   */
  private buildCacheConfig(config?: any): PluginConfigInterface['cache'] {
    if (!config) {
      // 在开发环境提供默认配置
      if (process.env.NODE_ENV !== 'production') {
        return {
          host: 'localhost',
          port: 6379,
          keyPrefix: 'dev:'
        };
      }
      throw new PluginConfigurationError('Cache configuration is required in production');
    }

    return {
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      username: config.username,
      database: config.database || 0,
      keyPrefix: config.keyPrefix || `plugin:${this.name}:`,
      ttl: config.ttl || 3600
    };
  }

  /**
   * 构建认证配置
   */
  private buildAuthConfig(config?: any): PluginConfigInterface['auth'] {
    if (!config) {
      // 在开发环境提供默认配置
      if (process.env.NODE_ENV !== 'production') {
        return {
          jwtSecret: 'dev-secret-key-not-for-production',
          jwtExpiration: '1h'
        };
      }
      throw new PluginConfigurationError('Auth configuration is required in production');
    }

    return {
      jwtSecret: config.jwtSecret || 'default-secret',
      jwtExpiration: config.jwtExpiration || '1h',
      apiKeys: config.apiKeys || [],
      allowedOrigins: config.allowedOrigins || []
    };
  }

  /**
   * 构建事件配置
   */
  private buildEventsConfig(config?: any): PluginConfigInterface['events'] {
    if (!config) {
      // 在开发环境提供默认配置
      return {
        broker: 'redis',
        connection: {
          host: 'localhost',
          port: 6379
        }
      };
    }

    return {
      broker: config.broker || 'redis',
      connection: config.connection || {},
      topics: config.topics || []
    };
  }

  /**
   * 获取默认端口
   */
  private getDefaultPort(): number {
    const basePort = 3000;
    const typeOffset = Object.values(PluginType).indexOf(this.type) * 100;
    return basePort + typeOffset;
  }

  /**
   * 获取默认限流配置
   */
  private getDefaultRateLimit() {
    return {
      max: 100,
      timeWindow: '1 minute',
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };
  }

  /**
   * 获取默认Swagger配置
   */
  private getDefaultSwaggerConfig() {
    return {
      enabled: this.environment === 'development',
      title: `${this.name} API`,
      description: this.description,
      version: this.version
    };
  }

  /**
   * 获取默认监控配置
   */
  private getDefaultMonitoringConfig() {
    return {
      metrics: {
        enabled: true,
        endpoint: '/metrics',
        interval: 15000
      },
      tracing: {
        enabled: true,
        endpoint: 'http://jaeger:14268/api/traces',
        serviceName: this.name
      },
      logging: {
        level: this.logLevel,
        format: 'json' as const,
        destination: 'stdout'
      }
    };
  }

  /**
   * 获取默认安全配置
   */
  private getDefaultSecurityConfig() {
    return {
      encryption: {
        algorithm: 'aes-256-gcm',
        key: process.env.ENCRYPTION_KEY || 'default-key'
      },
      validation: {
        strict: true,
        sanitize: true
      }
    };
  }

  /**
   * 获取默认资源配置
   */
  private getDefaultResources() {
    return {
      cpu: {
        request: '100m',
        limit: '500m'
      },
      memory: {
        request: '128Mi',
        limit: '512Mi'
      },
      storage: {
        request: '1Gi',
        limit: '5Gi'
      },
      network: {
        bandwidth: '100Mbps',
        connections: 1000
      }
    };
  }

  /**
   * 验证完整配置
   */
  private validateConfiguration(): void {
    const validator = new ConfigValidator();
    
    try {
      // 验证端口范围
      if (this.port < 1 || this.port > 65535) {
        throw new Error('Port must be between 1 and 65535');
      }

      // 验证数据库配置
      validator.validateDatabaseConfig(this.database);
      
      // 验证缓存配置
      validator.validateCacheConfig(this.cache);
      
      // 验证认证配置
      validator.validateAuthConfig(this.auth);
      
      // 验证事件配置
      validator.validateEventsConfig(this.events);
      
    } catch (error) {
      throw new PluginConfigurationError('Configuration validation failed', error);
    }
  }

  /**
   * 获取配置的JSON表示
   */
  public toJSON(): PluginConfigInterface {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      type: this.type,
      port: this.port,
      host: this.host,
      logLevel: this.logLevel,
      database: this.database,
      cache: this.cache,
      auth: this.auth,
      events: this.events,
      cors: this.cors,
      rateLimit: this.rateLimit,
      swagger: this.swagger,
      monitoring: this.monitoring,
      pluginConfig: this.pluginConfig,
      environment: this.environment,
      security: this.security
    };
  }

  /**
   * 克隆配置
   */
  public clone(): PluginConfig {
    return new PluginConfig(this.toJSON());
  }
}
