import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RouteDefinition } from '../types';

/**
 * 伪热插拔路由管理器
 * 
 * 由于 Fastify 不支持动态移除路由，我们使用以下策略：
 * 1. 路由代理：所有插件路由通过代理层处理
 * 2. 状态控制：通过插件状态控制路由的启用/禁用
 * 3. 优雅降级：提供友好的错误信息和重定向
 */
export class PseudoHotSwapManager {
  private app: FastifyInstance;
  private pluginRoutes: Map<string, RouteDefinition[]> = new Map();
  private pluginStatus: Map<string, boolean> = new Map();
  private routeHandlers: Map<string, Function> = new Map();
  private isInitialized = false;

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  /**
   * 初始化伪热插拔系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 注册通用插件路由代理
    await this.registerPluginProxy();
    
    this.isInitialized = true;
    this.app.log.info('Pseudo hot-swap system initialized');
  }

  /**
   * 注册插件路由代理
   */
  private async registerPluginProxy(): Promise<void> {
    // 注册通用插件路由处理器
    this.app.register(async (fastify) => {
      // 处理所有插件路由
      fastify.all('/api/plugins/:pluginId/*', {
        schema: {
          params: {
            type: 'object',
            properties: {
              pluginId: { type: 'string' }
            }
          }
        }
      }, this.handlePluginRequest.bind(this));

      // 处理插件根路由
      fastify.all('/api/plugins/:pluginId', {
        schema: {
          params: {
            type: 'object',
            properties: {
              pluginId: { type: 'string' }
            }
          }
        }
      }, this.handlePluginRequest.bind(this));
    });
  }

  /**
   * 处理插件请求
   */
  private async handlePluginRequest(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const { pluginId } = request.params as { pluginId: string };
    const path = (request.params as any)['*'] || '';
    const method = request.method;
    const fullPath = path ? `/${path}` : '';

    try {
      // 1. 检查插件是否激活
      if (!this.isPluginActive(pluginId)) {
        return this.handleInactivePlugin(pluginId, reply);
      }

      // 2. 查找匹配的路由
      const route = this.findMatchingRoute(pluginId, method, fullPath);
      if (!route) {
        return reply.status(404).send({
          error: 'Route not found',
          message: `Route ${method} ${fullPath} not found in plugin ${pluginId}`,
          pluginId,
          availableRoutes: this.getPluginRoutes(pluginId)
        });
      }

      // 3. 获取路由处理器
      const handlerKey = `${pluginId}:${route.handler}`;
      const handler = this.routeHandlers.get(handlerKey);
      
      if (!handler) {
        return reply.status(500).send({
          error: 'Handler not found',
          message: `Handler ${route.handler} not found for plugin ${pluginId}`,
          pluginId
        });
      }

      // 4. 执行路由处理器
      return await handler(request, reply);

    } catch (error) {
      this.app.log.error(`Error handling plugin request for ${pluginId}:`, error);
      return reply.status(500).send({
        error: 'Plugin execution error',
        message: error instanceof Error ? error.message : 'Unknown error',
        pluginId
      });
    }
  }

  /**
   * 处理非激活插件的请求
   */
  private async handleInactivePlugin(pluginId: string, reply: FastifyReply): Promise<any> {
    const isInstalled = this.pluginRoutes.has(pluginId);
    
    if (!isInstalled) {
      return reply.status(404).send({
        error: 'Plugin not found',
        message: `Plugin ${pluginId} is not installed`,
        pluginId,
        suggestion: 'Please install the plugin first'
      });
    }

    return reply.status(503).send({
      error: 'Plugin inactive',
      message: `Plugin ${pluginId} is installed but not active`,
      pluginId,
      suggestion: 'Please activate the plugin to use its features'
    });
  }

  /**
   * 查找匹配的路由
   */
  private findMatchingRoute(pluginId: string, method: string, path: string): RouteDefinition | null {
    const routes = this.pluginRoutes.get(pluginId);
    if (!routes) {
      return null;
    }

    // 精确匹配
    for (const route of routes) {
      if (route.method === method && route.url === path) {
        return route;
      }
    }

    // 模糊匹配（支持参数路由）
    for (const route of routes) {
      if (route.method === method && this.isRouteMatch(route.url, path)) {
        return route;
      }
    }

    return null;
  }

  /**
   * 检查路由是否匹配（支持参数）
   */
  private isRouteMatch(routePattern: string, actualPath: string): boolean {
    // 简单的参数匹配实现
    const routeParts = routePattern.split('/');
    const pathParts = actualPath.split('/');

    if (routeParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      // 参数匹配（:param 格式）
      if (routePart.startsWith(':')) {
        continue;
      }

      // 精确匹配
      if (routePart !== pathPart) {
        return false;
      }
    }

    return true;
  }

  /**
   * 注册插件路由
   */
  async registerPluginRoutes(pluginId: string, routes: RouteDefinition[]): Promise<void> {
    this.app.log.info(`Registering routes for plugin ${pluginId}`);

    // 存储路由定义
    this.pluginRoutes.set(pluginId, routes);

    // 注册路由处理器（这里需要实际的处理器实现）
    for (const route of routes) {
      const handlerKey = `${pluginId}:${route.handler}`;
      
      // 这里应该从插件实例中获取实际的处理器
      // 暂时使用占位符处理器
      this.routeHandlers.set(handlerKey, this.createPlaceholderHandler(pluginId, route));
    }

    this.app.log.info(`Registered ${routes.length} routes for plugin ${pluginId}`);
  }

  /**
   * 注销插件路由
   */
  async unregisterPluginRoutes(pluginId: string): Promise<void> {
    this.app.log.info(`Unregistering routes for plugin ${pluginId}`);

    const routes = this.pluginRoutes.get(pluginId);
    if (routes) {
      // 移除路由处理器
      for (const route of routes) {
        const handlerKey = `${pluginId}:${route.handler}`;
        this.routeHandlers.delete(handlerKey);
      }
    }

    // 移除路由定义
    this.pluginRoutes.delete(pluginId);

    this.app.log.info(`Unregistered routes for plugin ${pluginId}`);
  }

  /**
   * 激活插件
   */
  activatePlugin(pluginId: string): void {
    this.pluginStatus.set(pluginId, true);
    this.app.log.info(`Plugin ${pluginId} activated in route manager`);
  }

  /**
   * 停用插件
   */
  deactivatePlugin(pluginId: string): void {
    this.pluginStatus.set(pluginId, false);
    this.app.log.info(`Plugin ${pluginId} deactivated in route manager`);
  }

  /**
   * 检查插件是否激活
   */
  isPluginActive(pluginId: string): boolean {
    return this.pluginStatus.get(pluginId) === true;
  }

  /**
   * 获取插件路由列表
   */
  getPluginRoutes(pluginId: string): RouteDefinition[] {
    return this.pluginRoutes.get(pluginId) || [];
  }

  /**
   * 更新插件路由处理器
   */
  updatePluginHandler(pluginId: string, handlerName: string, handler: Function): void {
    const handlerKey = `${pluginId}:${handlerName}`;
    this.routeHandlers.set(handlerKey, handler);
  }

  /**
   * 创建占位符处理器
   */
  private createPlaceholderHandler(pluginId: string, route: RouteDefinition): Function {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        message: `Handler ${route.handler} for plugin ${pluginId}`,
        route: `${route.method} ${route.url}`,
        timestamp: new Date().toISOString(),
        pluginId
      });
    };
  }

  /**
   * 获取系统状态
   */
  getSystemStatus(): {
    totalPlugins: number;
    activePlugins: number;
    totalRoutes: number;
    plugins: Array<{
      pluginId: string;
      active: boolean;
      routeCount: number;
    }>;
  } {
    const plugins: Array<{ pluginId: string; active: boolean; routeCount: number }> = [];
    let totalRoutes = 0;
    let activePlugins = 0;

    for (const [pluginId, routes] of this.pluginRoutes.entries()) {
      const active = this.isPluginActive(pluginId);
      plugins.push({
        pluginId,
        active,
        routeCount: routes.length
      });
      
      totalRoutes += routes.length;
      if (active) {
        activePlugins++;
      }
    }

    return {
      totalPlugins: this.pluginRoutes.size,
      activePlugins,
      totalRoutes,
      plugins
    };
  }
}
