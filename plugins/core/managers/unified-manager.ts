/**
 * Unified Plugin Manager - Open Source Stub Version
 * 
 * This is a stub implementation for the open source version.
 * Commercial plugin management features are available in the commercial version.
 */

import { EventEmitter } from 'events';

// 使用类型别名避免直接依赖
type FastifyInstance = any;
type PrismaClient = any;

export interface UnifiedPluginManager {
  initialize(): Promise<void>;
  getActivePlugins(): any[];
  installPlugin(pluginId: string, config?: any): Promise<void>;
  uninstallPlugin(pluginId: string): Promise<void>;
  activatePlugin(pluginId: string): Promise<void>;
  deactivatePlugin(pluginId: string): Promise<void>;
  getPluginStats(): any;
  healthCheck(): Promise<any>;
}

class UnifiedPluginManagerStub extends EventEmitter implements UnifiedPluginManager {
  private fastifyInstance: FastifyInstance;
  private prisma: PrismaClient;
  private initialized = false;

  constructor(fastifyInstance: FastifyInstance, prisma: PrismaClient) {
    super();
    this.fastifyInstance = fastifyInstance;
    this.prisma = prisma;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🔌 Initializing Unified Plugin Manager (Open Source Stub)');
    console.log('ℹ️  Commercial plugin features are available in the commercial version');
    
    this.initialized = true;
  }

  getActivePlugins(): any[] {
    // Return empty array for open source version
    return [];
  }

  async installPlugin(pluginId: string, config?: any): Promise<void> {
    throw new Error('Plugin installation is available in the commercial version. Upgrade to Jiffoo Mall Commercial for advanced plugin management.');
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    throw new Error('Plugin uninstallation is available in the commercial version. Upgrade to Jiffoo Mall Commercial for advanced plugin management.');
  }

  async activatePlugin(pluginId: string): Promise<void> {
    throw new Error('Plugin activation is available in the commercial version. Upgrade to Jiffoo Mall Commercial for advanced plugin management.');
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    throw new Error('Plugin deactivation is available in the commercial version. Upgrade to Jiffoo Mall Commercial for advanced plugin management.');
  }

  getPluginStats(): any {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      commercial: 0,
      opensource: 0,
      message: 'Plugin statistics are available in the commercial version'
    };
  }

  async healthCheck(): Promise<any> {
    return {
      status: 'ok',
      version: 'opensource-stub',
      message: 'Open source version - commercial plugin features available with upgrade',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'Advanced plugin management',
          'Commercial payment plugins',
          'Plugin marketplace access',
          'Automated plugin updates'
        ]
      }
    };
  }
}

// Global instance
let globalUnifiedManager: UnifiedPluginManager | null = null;

export function createUnifiedPluginManager(
  fastifyInstance: FastifyInstance, 
  prisma: PrismaClient
): UnifiedPluginManager {
  if (!globalUnifiedManager) {
    globalUnifiedManager = new UnifiedPluginManagerStub(fastifyInstance, prisma);
  }
  return globalUnifiedManager;
}

export function getUnifiedPluginManager(): UnifiedPluginManager | null {
  return globalUnifiedManager;
}

// Export for compatibility
export { UnifiedPluginManagerStub as UnifiedPluginManagerImpl };
export default createUnifiedPluginManager;
