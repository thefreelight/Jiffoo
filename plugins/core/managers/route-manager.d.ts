import { FastifyInstance } from 'fastify';
import { RouteDefinition } from './types';
/**
 * 动态路由管理器
 * 负责插件路由的动态注册和注销
 */
export declare class DynamicRouteManager {
    private fastify;
    private pluginRoutes;
    private registeredRoutes;
    private pluginHandlers;
    private proxyRoutesRegistered;
    private unifiedManager;
    constructor(fastify: FastifyInstance, unifiedManager?: any);
    /**
     * 确保代理路由已注册 - 现在由 PaymentService 预注册，这里只是标记
     */
    private ensureProxyRoutesRegistered;
    /**
     * 处理代理请求 - 公共方法，供 PaymentService 调用
     */
    handleProxyRequest(request: any, reply: any): Promise<any>;
    /**
     * 注册插件路由
     */
    registerPluginRoutes(pluginId: string, routes: RouteDefinition[]): Promise<void>;
    /**
     * 注销插件路由
     */
    unregisterPluginRoutes(pluginId: string): Promise<void>;
    /**
     * 检查路由是否已注册
     */
    private isRouteRegistered;
    /**
     * 创建路由处理器
     */
    private createRouteHandler;
    /**
     * 调用插件处理器
     */
    private callPluginHandler;
    /**
     * 处理测试插件路由
     */
    private handleTestPluginRoute;
    /**
     * 检查插件是否活跃
     */
    private isPluginActive;
    /**
     * 获取插件的路由信息
     */
    getPluginRoutes(pluginId: string): RouteDefinition[];
    /**
     * 获取所有已注册的路由
     */
    getAllRegisteredRoutes(): Map<string, RouteDefinition[]>;
    /**
     * 注册单个路由处理器 - 供插件直接调用
     */
    registerRouteHandler(pluginId: string, handlerName: string, handler: Function): void;
    /**
     * 清理所有路由
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=route-manager.d.ts.map