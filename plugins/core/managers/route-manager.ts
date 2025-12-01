import { RouteDefinition } from '../types';

// 使用类型别名避免直接依赖
type FastifyInstance = any;
type RouteOptions = any;

/**
 * 动态路由管理器
 * 负责插件路由的动态注册和注销
 */
export class DynamicRouteManager {
  private fastify: FastifyInstance;
  private pluginRoutes: Map<string, RouteDefinition[]> = new Map();
  private registeredRoutes: Map<string, Set<string>> = new Map();
  private pluginHandlers: Map<string, Map<string, Function>> = new Map(); // pluginId -> routeKey -> handler
  private proxyRoutesRegistered = false;
  private unifiedManager: any; // 统一管理器引用

  constructor(fastify: FastifyInstance, unifiedManager?: any) {
    this.fastify = fastify;
    this.unifiedManager = unifiedManager;
  }

  /**
   * 确保代理路由已注册 - 现在由 PaymentService 预注册，这里只是标记
   */
  private async ensureProxyRoutesRegistered(): Promise<void> {
    if (this.proxyRoutesRegistered) {
      return;
    }

    // 代理路由现在由 PaymentService 在服务器启动时预注册
    // 这里只需要标记为已注册
    this.proxyRoutesRegistered = true;
    console.log('✅ Proxy routes already registered by PaymentService');
  }

  /**
   * 处理代理请求 - 公共方法，供 PaymentService 调用
   */
  public async handleProxyRequest(request: any, reply: any): Promise<any> {
    try {
      const { pluginId } = request.params;
      const method = request.method.toUpperCase();
      const url = request.url;

      // 提取插件特定的路径
      // URL 格式: /plugins/:pluginId/api/*
      // Fastify 会将剩余路径放在 params['*'] 中
      const remainingPath = request.params['*'] || '';
      const pluginPath = remainingPath ? `/${remainingPath}` : '';
      const routeKey = `${method}:${pluginPath}`;

      console.log(`🔄 Proxy request: ${method} ${url} -> Plugin: ${pluginId}, Path: ${pluginPath}`);

      // 1. 首先检查插件是否真正激活
      const isActive = await this.isPluginActive(pluginId);
      if (!isActive) {
        console.log(`🚫 Plugin ${pluginId} is not active`);
        return reply.status(503).send({
          error: 'Service unavailable',
          message: `Plugin ${pluginId} is not active`
        });
      }

      // 2. 检查插件是否有注册的处理器
      const pluginHandlers = this.pluginHandlers.get(pluginId);
      if (!pluginHandlers) {
        return reply.status(404).send({
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed or active`
        });
      }

      const handler = pluginHandlers.get(routeKey);
      if (!handler) {
        return reply.status(404).send({
          error: 'Route not found',
          message: `Route ${method} ${pluginPath} not found for plugin ${pluginId}`
        });
      }

      // 3. 调用插件处理器
      return await handler(request, reply);
    } catch (error) {
      console.error(`❌ Proxy request error:`, error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 注册插件路由
   */
  async registerPluginRoutes(pluginId: string, routes: RouteDefinition[]): Promise<void> {
    try {
      console.log(`🔧 Registering routes for plugin ${pluginId} using proxy system`);
      console.log(`🔧 Total routes to register: ${routes.length}`);
      console.log(`🔧 Routes:`, routes.map(r => `${r.method}:${r.url}`));

      // 确保代理路由已注册
      await this.ensureProxyRoutesRegistered();

      const registeredUrls = new Set<string>();
      const handlers = new Map<string, Function>();

      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        console.log(`🔧 Processing route ${i + 1}/${routes.length}: ${route.method}:${route.url}`);

        try {
          const fullUrl = route.prefix ? `${route.prefix}${route.url}` : route.url;
          const routeKey = `${route.method.toUpperCase()}:${route.url}`;

          // 创建路由处理器
          const routeHandler = await this.createRouteHandler(pluginId, route);
          handlers.set(routeKey, routeHandler);

          registeredUrls.add(routeKey);
          console.log(`📝 Registered handler for ${routeKey}`);
        } catch (routeError) {
          console.error(`❌ Failed to register route ${route.method}:${route.url}:`, routeError);
          // 继续处理下一个路由，不要中断整个过程
        }
      }

      // 存储插件处理器
      this.pluginHandlers.set(pluginId, handlers);
      this.pluginRoutes.set(pluginId, routes);
      this.registeredRoutes.set(pluginId, registeredUrls);

      console.log(`✅ Registered ${registeredUrls.size}/${routes.length} routes for plugin ${pluginId} via proxy system`);
    } catch (error) {
      console.error(`❌ Failed to register routes for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * 注销插件路由
   */
  async unregisterPluginRoutes(pluginId: string): Promise<void> {
    try {
      const routes = this.pluginRoutes.get(pluginId);
      const registeredUrls = this.registeredRoutes.get(pluginId);

      if (!routes || !registeredUrls) {
        console.log(`⚠️ No routes found for plugin ${pluginId}`);
        return;
      }

      // 移除插件处理器
      this.pluginHandlers.delete(pluginId);
      this.pluginRoutes.delete(pluginId);
      this.registeredRoutes.delete(pluginId);

      console.log(`✅ Unregistered ${registeredUrls.size} routes for plugin ${pluginId}`);
    } catch (error) {
      console.error(`❌ Failed to unregister routes for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * 检查路由是否已注册
   */
  private isRouteRegistered(url: string, method: string): boolean {
    // 检查我们的记录
    for (const [, registeredUrls] of this.registeredRoutes) {
      if (registeredUrls.has(`${method}:${url}`)) {
        return true;
      }
    }

    // 检查Fastify是否已经注册了这个路由
    try {
      // 尝试获取Fastify的路由表
      const routes = (this.fastify as any).printRoutes();
      const routePattern = `${method.toUpperCase()} ${url}`;
      return routes.includes(routePattern);
    } catch (error) {
      // 如果无法检查，假设没有注册
      return false;
    }
  }

  /**
   * 创建路由处理器
   */
  private async createRouteHandler(pluginId: string, route: RouteDefinition) {
    return async (request: any, reply: any) => {
      try {
        // 检查插件是否仍然活跃
        const pluginActive = await this.isPluginActive(pluginId);
        if (!pluginActive) {
          return reply.status(503).send({
            error: 'Service unavailable',
            message: `Plugin ${pluginId} is not active`
          });
        }

        // 调用实际的插件处理器
        return await this.callPluginHandler(pluginId, route.handler, request, reply);
      } catch (error) {
        console.error(`Plugin ${pluginId} route error:`, error);
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
  }

  /**
   * 调用插件处理器
   */
  private async callPluginHandler(pluginId: string, handlerName: string | ((...args: any[]) => any), request: any, reply: any) {
    try {
      // 如果 handlerName 是函数，直接调用
      if (typeof handlerName === 'function') {
        return await handlerName(request, reply);
      }
      // 特殊处理测试插件
      if (pluginId === 'test-plugin') {
        return await this.handleTestPluginRoute(handlerName, request, reply);
      }

      // 从统一管理器获取插件实例
      if (!this.unifiedManager) {
        console.log('🚨 Unified manager not available');
        throw new Error('Unified manager not available');
      }

      console.log(`🔍 Looking for plugin: ${pluginId}`);
      const plugin = await this.unifiedManager.getPlugin(pluginId);
      console.log(`🔍 Plugin found:`, plugin ? 'YES' : 'NO');
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      const implementation = plugin.implementation;
      if (!implementation) {
        throw new Error(`Plugin ${pluginId} implementation not found`);
      }

      // 获取处理器方法
      const handler = implementation[handlerName];
      if (!handler || typeof handler !== 'function') {
        throw new Error(`Handler ${handlerName} not found in plugin ${pluginId}`);
      }

      // 调用实际的插件处理器
      return await handler.call(implementation, request, reply);
    } catch (error) {
      console.error(`Error calling plugin handler ${handlerName} for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * 处理测试插件路由
   */
  private async handleTestPluginRoute(handlerName: string, request: any, reply: any) {
    switch (handlerName) {
      case 'hello':
        return {
          message: 'Hello from test plugin!',
          plugin: 'test-plugin',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        };

      case 'echo':
        const body = request.body as any;
        return {
          message: 'Echo from test plugin',
          plugin: 'test-plugin',
          echo: body,
          timestamp: new Date().toISOString()
        };

      case 'status':
        return {
          plugin: 'test-plugin',
          status: 'active',
          version: '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        };

      default:
        throw new Error(`Unknown handler: ${handlerName}`);
    }
  }

  /**
   * 检查插件是否活跃
   */
  private async isPluginActive(pluginId: string): Promise<boolean> {
    try {
      // 1. 检查插件是否有注册的处理器
      if (!this.pluginHandlers.has(pluginId)) {
        return false;
      }

      // 2. 检查统一管理器中的插件状态
      if (this.unifiedManager) {
        const status = await this.unifiedManager.getPluginStatus(pluginId);
        // 只有状态为 ACTIVE 的插件才被认为是活跃的
        return status === 'ACTIVE';
      }

      // 3. 如果没有统一管理器，回退到只检查处理器
      return true;
    } catch (error) {
      console.error(`Error checking plugin ${pluginId} status:`, error);
      return false;
    }
  }

  /**
   * 停用插件 - 标记插件为非活跃状态
   */
  deactivatePlugin(pluginId: string): void {
    console.log(`🔄 Deactivating plugin ${pluginId} in route manager`);
    // 注意：我们不删除处理器，只是在 isPluginActive 中通过数据库状态来控制访问
    // 这样可以保持路由定义，但阻止实际的请求处理
  }

  /**
   * 获取插件的路由信息
   */
  getPluginRoutes(pluginId: string): RouteDefinition[] {
    return this.pluginRoutes.get(pluginId) || [];
  }

  /**
   * 获取所有已注册的路由
   */
  getAllRegisteredRoutes(): Map<string, RouteDefinition[]> {
    return new Map(this.pluginRoutes);
  }

  /**
   * 注册单个路由处理器 - 供插件直接调用
   */
  registerRouteHandler(pluginId: string, handlerName: string, handler: Function): void {
    if (!this.pluginHandlers.has(pluginId)) {
      this.pluginHandlers.set(pluginId, new Map());
    }

    const handlers = this.pluginHandlers.get(pluginId)!;
    handlers.set(handlerName, handler);

    console.log(`📝 Registered individual handler ${handlerName} for plugin ${pluginId}`);
  }

  /**
   * 清理所有路由
   */
  async cleanup(): Promise<void> {
    for (const pluginId of this.pluginHandlers.keys()) {
      await this.unregisterPluginRoutes(pluginId);
    }
  }
}
