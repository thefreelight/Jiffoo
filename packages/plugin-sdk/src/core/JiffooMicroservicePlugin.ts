import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastify from 'fastify';
import { PluginConfig } from './PluginConfig';
import { DatabaseManager } from '../database/DatabaseManager';
import { CacheManager } from '../cache/CacheManager';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { TracingManager } from '../monitoring/TracingManager';
import { HealthChecker } from '../monitoring/HealthChecker';
import { AuthManager } from '../security/AuthManager';
import { EventBus } from '../events/EventBus';
import { Logger } from '../utils/Logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { PluginMetadata, PluginStatus, PluginLifecycleHook } from '../types/PluginTypes';

/**
 * Jiffoo微服务插件基础类
 * 所有插件微服务都应该继承此类
 */
export abstract class JiffooMicroservicePlugin {
  protected app!: FastifyInstance;
  protected config: PluginConfig;
  protected database!: DatabaseManager;
  protected cache!: CacheManager;
  protected metrics!: MetricsCollector;
  protected tracing!: TracingManager;
  protected health!: HealthChecker;
  protected auth!: AuthManager;
  protected events!: EventBus;
  protected logger: Logger;
  protected errorHandler: ErrorHandler;
  
  private _status: PluginStatus = PluginStatus.STOPPED;
  private _metadata: PluginMetadata;
  private _startTime?: Date;

  constructor(config: PluginConfig) {
    this.config = config;
    this.logger = new Logger(config.name, config.logLevel);
    this.errorHandler = new ErrorHandler(this.logger);
    
    // 初始化Fastify应用
    this.app = fastify({
      logger: this.logger.getPinoLogger() as any,
      trustProxy: true,
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'requestId'
    });

    // 初始化核心组件
    this.initializeComponents();
    
    // 设置插件元数据
    this._metadata = {
      name: config.name,
      version: config.version,
      description: config.description,
      author: config.author,
      type: config.type,
      dependencies: config.dependencies || [],
      capabilities: config.capabilities || [],
      resources: config.resources || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 注册全局错误处理
    this.setupErrorHandling();
    
    // 注册核心中间件
    this.setupMiddleware();
    
    // 注册核心路由
    this.setupCoreRoutes();
  }

  /**
   * 初始化核心组件
   */
  private async initializeComponents(): Promise<void> {
    try {
      this.database = new DatabaseManager(this.config.database);
      this.cache = new CacheManager(this.config.cache);
      this.metrics = new MetricsCollector({ enabled: true });
      this.tracing = new TracingManager({ enabled: true, serviceName: this.config.name });
      this.health = new HealthChecker();
      this.auth = new AuthManager(this.config.auth);
      this.events = new EventBus(this.config.events);
      
      this.logger.info('Core components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize core components', error);
      throw error;
    }
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.app.setErrorHandler(async (error, request, reply) => {
      await this.errorHandler.handleError(error, request, reply);
    });

    this.app.setNotFoundHandler(async (request, reply) => {
      await this.errorHandler.handleNotFound(request, reply);
    });
  }

  /**
   * 设置核心中间件
   */
  private async setupMiddleware(): Promise<void> {
    // CORS
    await this.app.register(require('@fastify/cors'), {
      origin: this.config.cors?.origins || true,
      credentials: this.config.cors?.credentials || false
    });

    // 安全头
    await this.app.register(require('@fastify/helmet'), {
      contentSecurityPolicy: false
    });

    // 限流
    await this.app.register(require('@fastify/rate-limit'), {
      max: this.config.rateLimit?.max || 100,
      timeWindow: this.config.rateLimit?.timeWindow || '1 minute'
    });

    // Swagger文档
    if (this.config.swagger?.enabled) {
      await this.app.register(require('@fastify/swagger'), {
        swagger: {
          info: {
            title: `${this.config.name} API`,
            description: this.config.description,
            version: this.config.version
          },
          host: `localhost:${this.config.port}`,
          schemes: ['http', 'https'],
          consumes: ['application/json'],
          produces: ['application/json']
        }
      });

      await this.app.register(require('@fastify/swagger-ui'), {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'full',
          deepLinking: false
        }
      });
    }

    // Prometheus指标
    await this.app.register(require('prometheus-api-metrics'), {
      endpoint: '/metrics'
    });
  }

  /**
   * 设置核心路由
   */
  private setupCoreRoutes(): void {
    // 健康检查
    this.app.get('/health', async (request, reply) => {
      const healthStatus = await this.health.getStatus();
      const status = healthStatus.status === 'healthy' ? 200 : 503;
      return reply.status(status).send(healthStatus);
    });

    // 就绪检查
    this.app.get('/ready', async (request, reply) => {
      const isReady = await this.isReady();
      const status = isReady ? 200 : 503;
      return reply.status(status).send({ ready: isReady });
    });

    // 插件信息
    this.app.get('/info', async (request, reply) => {
      return reply.send({
        metadata: this._metadata,
        status: this._status,
        startTime: this._startTime,
        uptime: this._startTime ? Date.now() - this._startTime.getTime() : 0
      });
    });

    // 指标端点
    this.app.get('/metrics', async (request, reply) => {
      const metrics = this.metrics.getAllMetrics();
      return reply.type('text/plain').send(metrics);
    });
  }

  /**
   * 启动插件微服务
   */
  public async start(): Promise<void> {
    try {
      this._status = PluginStatus.STARTING;
      this.logger.info(`Starting ${this.config.name} plugin microservice...`);

      // 执行启动前钩子
      await this.executeLifecycleHook('beforeStart');

      // 连接数据库
      await this.database.connect();
      this.logger.info('Database connected');

      // 连接缓存
      await this.cache.connect();
      this.logger.info('Cache connected');

      // 初始化事件总线
      await this.events.initialize();
      this.logger.info('Event bus initialized');

      // 注册插件特定路由
      await this.registerRoutes();
      this.logger.info('Routes registered');

      // 启动HTTP服务器
      await this.app.listen({
        port: this.config.port,
        host: this.config.host || '0.0.0.0'
      });

      this._status = PluginStatus.RUNNING;
      this._startTime = new Date();
      
      this.logger.info(`Plugin microservice started on ${this.config.host}:${this.config.port}`);

      // 执行启动后钩子
      await this.executeLifecycleHook('afterStart');

      // 注册到插件注册表
      await this.registerToRegistry();

    } catch (error) {
      this._status = PluginStatus.ERROR;
      this.logger.error('Failed to start plugin microservice', error);
      throw error;
    }
  }

  /**
   * 停止插件微服务
   */
  public async stop(): Promise<void> {
    try {
      this._status = PluginStatus.STOPPING;
      this.logger.info(`Stopping ${this.config.name} plugin microservice...`);

      // 执行停止前钩子
      await this.executeLifecycleHook('beforeStop');

      // 从注册表注销
      await this.unregisterFromRegistry();

      // 关闭HTTP服务器
      await this.app.close();

      // 断开事件总线
      await this.events.disconnect();

      // 断开缓存
      await this.cache.disconnect();

      // 断开数据库
      await this.database.disconnect();

      this._status = PluginStatus.STOPPED;
      this.logger.info('Plugin microservice stopped');

      // 执行停止后钩子
      await this.executeLifecycleHook('afterStop');

    } catch (error) {
      this._status = PluginStatus.ERROR;
      this.logger.error('Failed to stop plugin microservice', error);
      throw error;
    }
  }

  /**
   * 重启插件微服务
   */
  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * 检查插件是否就绪
   */
  public async isReady(): Promise<boolean> {
    try {
      const dbReady = await this.database.isConnectedToDatabase();
      const cacheReady = await this.cache.isConnectedToCache();
      const eventsReady = await this.events.isConnected();
      
      return dbReady && cacheReady && eventsReady && this._status === PluginStatus.RUNNING;
    } catch (error) {
      this.logger.error('Error checking readiness', error);
      return false;
    }
  }

  /**
   * 获取插件状态
   */
  public getStatus(): PluginStatus {
    return this._status;
  }

  /**
   * 获取插件元数据
   */
  public getMetadata(): PluginMetadata {
    return { ...this._metadata };
  }

  /**
   * 执行生命周期钩子
   */
  private async executeLifecycleHook(hook: PluginLifecycleHook): Promise<void> {
    try {
      switch (hook) {
        case 'beforeStart':
          await this.beforeStart();
          break;
        case 'afterStart':
          await this.afterStart();
          break;
        case 'beforeStop':
          await this.beforeStop();
          break;
        case 'afterStop':
          await this.afterStop();
          break;
      }
    } catch (error) {
      this.logger.error(`Error executing ${hook} hook`, error);
      throw error;
    }
  }

  /**
   * 注册到插件注册表
   */
  private async registerToRegistry(): Promise<void> {
    // TODO: 实现插件注册逻辑
    this.logger.info('Registered to plugin registry');
  }

  /**
   * 从插件注册表注销
   */
  private async unregisterFromRegistry(): Promise<void> {
    // TODO: 实现插件注销逻辑
    this.logger.info('Unregistered from plugin registry');
  }

  // 抽象方法 - 子类必须实现
  protected abstract registerRoutes(): Promise<void>;

  // 生命周期钩子 - 子类可以重写
  protected async beforeStart(): Promise<void> {}
  protected async afterStart(): Promise<void> {}
  protected async beforeStop(): Promise<void> {}
  protected async afterStop(): Promise<void> {}
}
