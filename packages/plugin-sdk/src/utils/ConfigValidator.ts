import { z } from 'zod';
import { PluginValidationError } from '../types/PluginTypes';

/**
 * 配置验证器
 * 使用Zod进行配置验证
 */
export class ConfigValidator {
  
  /**
   * 数据库配置验证模式
   */
  private static readonly databaseConfigSchema = z.object({
    host: z.string().min(1, 'Database host is required'),
    port: z.number().int().min(1).max(65535, 'Database port must be between 1 and 65535'),
    database: z.string().min(1, 'Database name is required'),
    username: z.string().min(1, 'Database username is required'),
    password: z.string(),
    ssl: z.boolean().optional(),
    pool: z.object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(1).optional(),
      idle: z.number().int().min(0).optional()
    }).optional()
  });

  /**
   * 缓存配置验证模式
   */
  private static readonly cacheConfigSchema = z.object({
    host: z.string().min(1, 'Cache host is required'),
    port: z.number().int().min(1).max(65535, 'Cache port must be between 1 and 65535'),
    password: z.string().optional(),
    username: z.string().optional(),
    database: z.number().int().min(0).max(15).optional(),
    keyPrefix: z.string().optional(),
    ttl: z.number().int().min(1).optional()
  });

  /**
   * 认证配置验证模式
   */
  private static readonly authConfigSchema = z.object({
    jwtSecret: z.string().min(8, 'JWT secret must be at least 8 characters'),
    jwtExpiration: z.string().optional(),
    apiKeys: z.array(z.string()).optional(),
    allowedOrigins: z.array(z.string()).optional()
  });

  /**
   * 事件配置验证模式
   */
  private static readonly eventsConfigSchema = z.object({
    broker: z.enum(['redis', 'rabbitmq', 'kafka']),
    connection: z.any(),
    topics: z.array(z.string()).optional()
  });

  /**
   * 插件元数据验证模式
   */
  private static readonly pluginMetadataSchema = z.object({
    name: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Plugin name must contain only lowercase letters, numbers, and hyphens'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (x.y.z)'),
    description: z.string().min(1),
    author: z.string().min(1),
    type: z.enum(['payment', 'authentication', 'notification', 'analytics', 'shipping', 'marketing', 'inventory', 'custom']),
    dependencies: z.array(z.object({
      name: z.string(),
      version: z.string(),
      type: z.enum(['plugin', 'service', 'library']),
      required: z.boolean()
    })).optional(),
    capabilities: z.array(z.object({
      name: z.string(),
      version: z.string(),
      description: z.string(),
      required: z.boolean()
    })).optional(),
    resources: z.object({
      cpu: z.object({
        request: z.string().optional(),
        limit: z.string().optional()
      }).optional(),
      memory: z.object({
        request: z.string().optional(),
        limit: z.string().optional()
      }).optional(),
      storage: z.object({
        request: z.string().optional(),
        limit: z.string().optional()
      }).optional(),
      network: z.object({
        bandwidth: z.string().optional(),
        connections: z.number().optional()
      }).optional()
    }).optional()
  });

  /**
   * 网络配置验证模式
   */
  private static readonly networkConfigSchema = z.object({
    port: z.number().int().min(1).max(65535),
    host: z.string().optional(),
    cors: z.object({
      origins: z.union([z.array(z.string()), z.boolean()]).optional(),
      credentials: z.boolean().optional(),
      methods: z.array(z.string()).optional(),
      headers: z.array(z.string()).optional()
    }).optional(),
    rateLimit: z.object({
      max: z.number().int().min(1),
      timeWindow: z.string(),
      skipSuccessfulRequests: z.boolean().optional(),
      skipFailedRequests: z.boolean().optional()
    }).optional()
  });

  /**
   * 安全配置验证模式
   */
  private static readonly securityConfigSchema = z.object({
    encryption: z.object({
      algorithm: z.string().optional(),
      key: z.string().min(16, 'Encryption key must be at least 16 characters').optional()
    }).optional(),
    validation: z.object({
      strict: z.boolean().optional(),
      sanitize: z.boolean().optional()
    }).optional()
  });

  /**
   * 验证数据库配置
   */
  public validateDatabaseConfig(config: any): void {
    try {
      ConfigValidator.databaseConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid database configuration', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证缓存配置
   */
  public validateCacheConfig(config: any): void {
    try {
      ConfigValidator.cacheConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid cache configuration', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证认证配置
   */
  public validateAuthConfig(config: any): void {
    try {
      ConfigValidator.authConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid auth configuration', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证事件配置
   */
  public validateEventsConfig(config: any): void {
    try {
      ConfigValidator.eventsConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid events configuration', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证插件元数据
   */
  public validatePluginMetadata(metadata: any): void {
    try {
      ConfigValidator.pluginMetadataSchema.parse(metadata);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid plugin metadata', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证网络配置
   */
  public validateNetworkConfig(config: any): void {
    try {
      ConfigValidator.networkConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid network configuration', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证安全配置
   */
  public validateSecurityConfig(config: any): void {
    try {
      ConfigValidator.securityConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid security configuration', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证环境变量
   */
  public validateEnvironmentVariables(requiredVars: string[]): void {
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new PluginValidationError('Missing required environment variables', {
        missing
      });
    }
  }

  /**
   * 验证端口可用性
   */
  public async validatePortAvailability(port: number, host: string = 'localhost'): Promise<void> {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, host, () => {
        server.once('close', () => {
          resolve();
        });
        server.close();
      });
      
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          reject(new PluginValidationError(`Port ${port} is already in use on ${host}`));
        } else {
          reject(new PluginValidationError(`Port validation failed: ${err.message}`));
        }
      });
    });
  }

  /**
   * 验证URL格式
   */
  public validateUrl(url: string, protocols: string[] = ['http', 'https']): void {
    try {
      const parsed = new URL(url);
      if (!protocols.includes(parsed.protocol.slice(0, -1))) {
        throw new Error(`Protocol must be one of: ${protocols.join(', ')}`);
      }
    } catch (error) {
      throw new PluginValidationError(`Invalid URL: ${url}`, { error: (error as Error).message });
    }
  }

  /**
   * 验证JSON Schema
   */
  public validateJsonSchema(data: any, schema: z.ZodSchema): any {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Schema validation failed', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
            received: (e as any).received
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证资源限制格式
   */
  public validateResourceLimits(resources: any): void {
    const resourceSchema = z.object({
      cpu: z.object({
        request: z.string().regex(/^\d+m?$/, 'CPU request must be in format like "100m" or "1"').optional(),
        limit: z.string().regex(/^\d+m?$/, 'CPU limit must be in format like "500m" or "2"').optional()
      }).optional(),
      memory: z.object({
        request: z.string().regex(/^\d+[KMGT]?i?$/, 'Memory request must be in format like "128Mi" or "1Gi"').optional(),
        limit: z.string().regex(/^\d+[KMGT]?i?$/, 'Memory limit must be in format like "512Mi" or "2Gi"').optional()
      }).optional(),
      storage: z.object({
        request: z.string().regex(/^\d+[KMGT]?i?$/, 'Storage request must be in format like "1Gi" or "10Gi"').optional(),
        limit: z.string().regex(/^\d+[KMGT]?i?$/, 'Storage limit must be in format like "5Gi" or "100Gi"').optional()
      }).optional()
    });

    try {
      resourceSchema.parse(resources);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PluginValidationError('Invalid resource limits', {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      throw error;
    }
  }

  /**
   * 验证版本号格式
   */
  public validateVersion(version: string): void {
    const versionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*))?(?:\+([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*))?$/;
    
    if (!versionRegex.test(version)) {
      throw new PluginValidationError('Invalid version format. Must follow semantic versioning (e.g., 1.0.0, 1.0.0-alpha.1)');
    }
  }

  /**
   * 验证插件名称格式
   */
  public validatePluginName(name: string): void {
    const nameRegex = /^[a-z0-9-]+$/;
    
    if (!nameRegex.test(name)) {
      throw new PluginValidationError('Plugin name must contain only lowercase letters, numbers, and hyphens');
    }
    
    if (name.length < 3 || name.length > 50) {
      throw new PluginValidationError('Plugin name must be between 3 and 50 characters');
    }
    
    if (name.startsWith('-') || name.endsWith('-')) {
      throw new PluginValidationError('Plugin name cannot start or end with a hyphen');
    }
  }

  /**
   * 创建自定义验证器
   */
  public static createCustomValidator<T>(schema: z.ZodSchema<T>) {
    return (data: any): T => {
      try {
        return schema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new PluginValidationError('Custom validation failed', {
            errors: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message,
              code: e.code
            }))
          });
        }
        throw error;
      }
    };
  }
}
