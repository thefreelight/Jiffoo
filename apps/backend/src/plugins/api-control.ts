import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ecosystemController } from './ecosystem-control';

/**
 * API访问控制系统
 * 确保只有官方认证的插件才能访问核心API
 */

export class APIAccessController {
  private readonly protectedAPIs: Set<string>;
  private readonly pluginAPIKeys: Map<string, string>;

  constructor() {
    // 受保护的核心API列表
    this.protectedAPIs = new Set([
      '/api/core/users',
      '/api/core/orders', 
      '/api/core/products',
      '/api/core/payments',
      '/api/core/settings',
      '/api/core/analytics',
      '/api/core/notifications'
    ]);

    this.pluginAPIKeys = new Map();
  }

  /**
   * 注册插件API访问权限
   */
  async registerPluginAPIAccess(pluginName: string, permissions: string[]): Promise<string> {
    // 生成插件专用的API密钥
    const apiKey = this.generateAPIKey(pluginName);
    this.pluginAPIKeys.set(apiKey, pluginName);

    // 记录插件权限
    await this.storePluginPermissions(pluginName, permissions);

    return apiKey;
  }

  /**
   * API访问中间件
   */
  createAPIMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const path = request.url.split('?')[0];
      
      // 检查是否为受保护的API
      if (!this.isProtectedAPI(path)) {
        return; // 非受保护API，直接通过
      }

      // 检查请求来源
      const apiKey = this.extractAPIKey(request);
      const userAgent = request.headers['user-agent'] || '';

      // 如果是管理员直接访问，允许通过
      if (this.isAdminAccess(request)) {
        return;
      }

      // 如果是插件访问，验证插件权限
      if (apiKey && this.pluginAPIKeys.has(apiKey)) {
        const pluginName = this.pluginAPIKeys.get(apiKey)!;
        const hasPermission = await this.checkPluginPermission(pluginName, path);
        
        if (!hasPermission) {
          return reply.status(403).send({
            error: 'Insufficient permissions',
            message: `Plugin ${pluginName} does not have permission to access ${path}`
          });
        }
        
        // 记录API使用情况
        await this.logAPIUsage(pluginName, path, request.ip);
        return;
      }

      // 检查是否为官方插件的内部调用
      if (userAgent.includes('Jiffoo-Plugin/')) {
        const pluginInfo = this.parsePluginUserAgent(userAgent);
        if (await this.verifyOfficialPlugin(pluginInfo)) {
          return;
        }
      }

      // 拒绝未授权访问
      return reply.status(401).send({
        error: 'Unauthorized access',
        message: 'This API requires official plugin authentication'
      });
    };
  }

  /**
   * 检查是否为受保护的API
   */
  private isProtectedAPI(path: string): boolean {
    return Array.from(this.protectedAPIs).some(api => path.startsWith(api));
  }

  /**
   * 提取API密钥
   */
  private extractAPIKey(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    const apiKeyHeader = request.headers['x-api-key'] as string;
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    return null;
  }

  /**
   * 检查是否为管理员访问
   */
  private isAdminAccess(request: FastifyRequest): boolean {
    // 这里应该检查用户的认证状态和权限
    // 简化实现，实际应该集成认证系统
    const authHeader = request.headers.authorization;
    return authHeader && authHeader.includes('admin-token');
  }

  /**
   * 检查插件权限
   */
  private async checkPluginPermission(pluginName: string, apiPath: string): Promise<boolean> {
    try {
      // 从数据库或缓存中获取插件权限
      const permissions = await this.getPluginPermissions(pluginName);
      
      // 检查是否有访问该API的权限
      return permissions.some(permission => {
        if (permission === '*') return true; // 超级权限
        if (permission === apiPath) return true; // 精确匹配
        if (apiPath.startsWith(permission.replace('*', ''))) return true; // 通配符匹配
        return false;
      });
    } catch (error) {
      console.error(`Error checking plugin permission for ${pluginName}:`, error);
      return false;
    }
  }

  /**
   * 解析插件User-Agent
   */
  private parsePluginUserAgent(userAgent: string): { name: string; version: string } | null {
    const match = userAgent.match(/Jiffoo-Plugin\/([^\/]+)\/([^\s]+)/);
    if (match) {
      return {
        name: match[1],
        version: match[2]
      };
    }
    return null;
  }

  /**
   * 验证官方插件
   */
  private async verifyOfficialPlugin(pluginInfo: { name: string; version: string } | null): Promise<boolean> {
    if (!pluginInfo) return false;

    try {
      // 使用生态控制器验证插件
      const validation = await ecosystemController.validatePluginAuthenticity({
        name: pluginInfo.name,
        version: pluginInfo.version,
        license: { type: 'COMMERCIAL' as any }
      } as any);

      return validation.valid;
    } catch (error) {
      console.error('Plugin verification failed:', error);
      return false;
    }
  }

  /**
   * 生成API密钥
   */
  private generateAPIKey(pluginName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `jiffoo_${pluginName}_${timestamp}_${random}`;
  }

  /**
   * 存储插件权限
   */
  private async storePluginPermissions(pluginName: string, permissions: string[]): Promise<void> {
    // 这里应该存储到数据库
    // 简化实现，使用内存存储
    const key = `plugin_permissions:${pluginName}`;
    // await redis.set(key, JSON.stringify(permissions));
    console.log(`Stored permissions for ${pluginName}:`, permissions);
  }

  /**
   * 获取插件权限
   */
  private async getPluginPermissions(pluginName: string): Promise<string[]> {
    // 这里应该从数据库获取
    // 简化实现，返回默认权限
    const defaultPermissions = [
      '/api/core/products/*',
      '/api/core/orders/*'
    ];
    
    return defaultPermissions;
  }

  /**
   * 记录API使用情况
   */
  private async logAPIUsage(pluginName: string, apiPath: string, ip: string): Promise<void> {
    const logEntry = {
      pluginName,
      apiPath,
      ip,
      timestamp: new Date().toISOString()
    };
    
    // 这里应该记录到日志系统
    console.log('API Usage:', logEntry);
  }

  /**
   * 获取API使用统计
   */
  async getAPIUsageStats(pluginName?: string): Promise<any> {
    // 返回API使用统计
    return {
      totalRequests: 1000,
      pluginBreakdown: {
        'premium-analytics': 450,
        'marketing-automation': 350,
        'inventory-manager': 200
      },
      topAPIs: [
        { path: '/api/core/products', count: 400 },
        { path: '/api/core/orders', count: 350 },
        { path: '/api/core/analytics', count: 250 }
      ]
    };
  }
}

// 单例实例
export const apiController = new APIAccessController();
