/**
 * Legacy Plugin Adapter Base Class
 * 
 * 这是新旧插件架构的桥接基础类，提供：
 * - 配置格式转换
 * - 生命周期适配
 * - 错误处理统一
 * - 监控指标集成
 * - 健康检查适配
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { JiffooMicroservicePlugin } from '../core/JiffooMicroservicePlugin';
import { PluginConfig } from '../core/PluginConfig';
import { PluginType, PluginStatus } from '../types/PluginTypes';
import { Logger } from '../utils/Logger';

/**
 * 旧插件基础接口
 */
export interface LegacyPlugin {
  pluginId: string;
  pluginName: string;
  version: string;
  price?: number;
  
  // 基础方法
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
  healthCheck?(): Promise<boolean>;
  getPluginInfo?(): any;
  validateConfig?(config: any): Promise<boolean>;
}

/**
 * 适配器配置接口
 */
export interface AdapterConfig {
  // 适配器特定配置
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableHealthCheck?: boolean;
  
  // 路由配置
  routePrefix?: string;
  enableCors?: boolean;
  
  // 性能配置
  timeout?: number;
  retryAttempts?: number;
  
  // 安全配置
  enableAuth?: boolean;
  rateLimiting?: {
    max: number;
    timeWindow: string;
  };
}

/**
 * 旧插件适配器基础类
 */
export abstract class LegacyPluginAdapter<T extends LegacyPlugin> {
  protected legacyPlugin: T;
  protected adapterConfig: AdapterConfig;
  protected adapterLogger: Logger;
  protected app?: FastifyInstance;
  protected config: PluginConfig;
  protected initialized = false;

  constructor(
    legacyPlugin: T,
    config: PluginConfig,
    adapterConfig: AdapterConfig = {}
  ) {
    this.config = config;
    this.legacyPlugin = legacyPlugin;
    this.adapterConfig = {
      enableMetrics: true,
      enableTracing: true,
      enableHealthCheck: true,
      routePrefix: '/api/v1',
      enableCors: true,
      timeout: 30000,
      retryAttempts: 3,
      enableAuth: false,
      ...adapterConfig
    };

    this.adapterLogger = new Logger(`adapter-${legacyPlugin.pluginId}`, config.logLevel);
  }

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    try {
      this.adapterLogger.info('Initializing legacy plugin adapter...', {
        pluginId: this.legacyPlugin.pluginId,
        pluginName: this.legacyPlugin.pluginName,
        version: this.legacyPlugin.version
      });

      // 1. 创建Fastify应用
      const fastify = require('fastify');
      this.app = fastify({
        logger: false,
        trustProxy: true
      });

      // 2. 初始化旧插件
      if (this.legacyPlugin.initialize) {
        await this.legacyPlugin.initialize();
      }

      // 3. 设置基础路由
      await this.setupBaseRoutes();

      // 4. 设置适配器路由
      await this.setupAdapterRoutes();

      this.initialized = true;

      this.adapterLogger.info('Legacy plugin adapter initialized successfully');
      
    } catch (error) {
      this.adapterLogger.error('Failed to initialize legacy plugin adapter', error);
      throw error;
    }
  }

  /**
   * 销毁适配器
   */
  async destroy(): Promise<void> {
    try {
      this.adapterLogger.info('Destroying legacy plugin adapter...');

      // 1. 销毁旧插件
      if (this.legacyPlugin.destroy) {
        await this.legacyPlugin.destroy();
      }

      // 2. 关闭Fastify应用
      if (this.app) {
        await this.app.close();
      }

      this.initialized = false;

      this.adapterLogger.info('Legacy plugin adapter destroyed successfully');
      
    } catch (error) {
      this.adapterLogger.error('Failed to destroy legacy plugin adapter', error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 1. 检查适配器是否已初始化
      if (!this.initialized) {
        return false;
      }

      // 2. 检查旧插件健康状态
      if (this.legacyPlugin.healthCheck) {
        const legacyHealth = await this.legacyPlugin.healthCheck();
        if (!legacyHealth) {
          this.adapterLogger.warn('Legacy plugin health check failed');
          return false;
        }
      }

      return true;
      
    } catch (error) {
      this.adapterLogger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * 设置基础路由
   */
  private async setupBaseRoutes(): Promise<void> {
    if (!this.app) return;

    // 健康检查路由
    this.app.get('/health', async (request, reply) => {
      const isHealthy = await this.healthCheck();
      return reply.status(isHealthy ? 200 : 503).send({
        status: isHealthy ? 'healthy' : 'unhealthy',
        plugin: {
          id: this.legacyPlugin.pluginId,
          name: this.legacyPlugin.pluginName,
          version: this.legacyPlugin.version
        },
        timestamp: new Date().toISOString()
      });
    });

    // 就绪检查路由
    this.app.get('/health/ready', async (request, reply) => {
      const isReady = this.initialized && await this.healthCheck();
      return reply.status(isReady ? 200 : 503).send({
        status: isReady ? 'ready' : 'not ready',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 启动适配器
   */
  async start(): Promise<void> {
    if (!this.app) {
      throw new Error('Adapter not initialized');
    }

    const port = this.config.port || 3000;
    const host = this.config.host || '0.0.0.0';

    await this.app.listen({ port, host });
    this.adapterLogger.info(`Adapter started on ${host}:${port}`);
  }

  /**
   * 停止适配器
   */
  async stop(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.adapterLogger.info('Adapter stopped');
    }
  }

  /**
   * 获取配置
   */
  getConfig(): PluginConfig {
    return this.config;
  }

  /**
   * 获取Fastify应用实例
   */
  getApp(): FastifyInstance | undefined {
    return this.app;
  }

  /**
   * 设置适配器中间件
   */
  private async setupAdapterMiddleware(): Promise<void> {
    if (!this.app) return;

    // 请求日志
    this.app.addHook('onRequest', async (request, reply) => {
      this.adapterLogger.debug('Incoming request', {
        method: request.method,
        url: request.url
      });
    });

    // 错误处理
    this.app.setErrorHandler(async (error, request, reply) => {
      this.adapterLogger.error('Request error', {
        error: error.message,
        method: request.method,
        url: request.url
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An error occurred while processing your request'
      });
    });
  }

  /**
   * 抽象方法：子类必须实现具体的路由设置
   */
  protected abstract setupAdapterRoutes(): Promise<void>;

  /**
   * 获取旧插件实例
   */
  protected getLegacyPlugin(): T {
    return this.legacyPlugin;
  }

  /**
   * 获取适配器配置
   */
  protected getAdapterConfig(): AdapterConfig {
    return this.adapterConfig;
  }

  /**
   * 包装旧插件方法调用，添加错误处理和监控
   */
  protected async wrapLegacyCall<R>(
    methodName: string,
    fn: () => Promise<R>,
    context?: any
  ): Promise<R> {
    const startTime = Date.now();

    try {
      this.adapterLogger.debug(`Calling legacy method: ${methodName}`, context);

      const result = await fn();

      const duration = Date.now() - startTime;
      this.adapterLogger.debug(`Legacy method completed: ${methodName}`, {
        duration,
        context
      });

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.adapterLogger.error(`Legacy method failed: ${methodName}`, {
        error: error.message,
        duration,
        context
      });

      throw error;
    }
  }
}
