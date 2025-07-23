/**
 * Plugin Adapters Module
 * 
 * 提供新旧插件架构的桥接适配器，支持：
 * - 支付插件适配
 * - 认证插件适配
 * - 通知插件适配
 * - 配置迁移工具
 * - 测试框架
 */

// 基础适配器
export { LegacyPluginAdapter, LegacyPlugin, AdapterConfig } from './LegacyPluginAdapter';

// 专用适配器
export { 
  LegacyPaymentPluginAdapter, 
  LegacyPaymentPlugin,
  PaymentRequest,
  RefundRequest 
} from './LegacyPaymentPluginAdapter';

export { 
  LegacyAuthPluginAdapter, 
  LegacyAuthPlugin,
  UserProfile,
  AuthUrlRequest,
  AuthCallbackRequest,
  TokenRefreshRequest 
} from './LegacyAuthPluginAdapter';

// 配置迁移工具
export { 
  ConfigMigrator,
  LegacyPluginConfig,
  LegacyPaymentConfig,
  LegacyAuthConfig,
  LegacyNotificationConfig,
  MigrationOptions 
} from './ConfigMigrator';

// 测试框架已移除 - 仅保留生产环境所需的适配器

// 工厂函数
import { LegacyPaymentPluginAdapter, LegacyPaymentPlugin } from './LegacyPaymentPluginAdapter';
import { LegacyAuthPluginAdapter, LegacyAuthPlugin } from './LegacyAuthPluginAdapter';
import { ConfigMigrator, LegacyPaymentConfig, LegacyAuthConfig } from './ConfigMigrator';

/**
 * 创建支付插件适配器
 */
export function createPaymentAdapter(
  legacyPlugin: LegacyPaymentPlugin,
  legacyConfig: LegacyPaymentConfig,
  adapterConfig?: any
): LegacyPaymentPluginAdapter {
  return new LegacyPaymentPluginAdapter(legacyPlugin, legacyConfig, adapterConfig);
}

/**
 * 创建认证插件适配器
 */
export function createAuthAdapter(
  legacyPlugin: LegacyAuthPlugin,
  legacyConfig: LegacyAuthConfig,
  adapterConfig?: any
): LegacyAuthPluginAdapter {
  return new LegacyAuthPluginAdapter(legacyPlugin, legacyConfig, adapterConfig);
}

/**
 * 批量创建适配器
 */
export function createAdapters(configs: Array<{
  type: 'payment' | 'auth';
  plugin: any;
  config: any;
  adapterConfig?: any;
}>): Array<LegacyPaymentPluginAdapter | LegacyAuthPluginAdapter> {
  return configs.map(({ type, plugin, config, adapterConfig }) => {
    switch (type) {
      case 'payment':
        return createPaymentAdapter(plugin, config, adapterConfig);
      case 'auth':
        return createAuthAdapter(plugin, config, adapterConfig);
      default:
        throw new Error(`Unsupported adapter type: ${type}`);
    }
  });
}

/**
 * 适配器工厂类
 */
export class AdapterFactory {
  private static instances = new Map<string, any>();

  /**
   * 创建或获取适配器实例
   */
  static getOrCreate<T>(
    key: string,
    factory: () => T
  ): T {
    if (!this.instances.has(key)) {
      this.instances.set(key, factory());
    }
    return this.instances.get(key);
  }

  /**
   * 清除所有适配器实例
   */
  static clear(): void {
    this.instances.clear();
  }

  /**
   * 获取所有适配器实例
   */
  static getAll(): Map<string, any> {
    return new Map(this.instances);
  }
}

/**
 * 适配器管理器
 */
export class AdapterManager {
  private adapters = new Map<string, LegacyPaymentPluginAdapter | LegacyAuthPluginAdapter>();
  private running = new Set<string>();

  /**
   * 注册适配器
   */
  register(id: string, adapter: LegacyPaymentPluginAdapter | LegacyAuthPluginAdapter): void {
    this.adapters.set(id, adapter);
  }

  /**
   * 启动适配器
   */
  async start(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Adapter not found: ${id}`);
    }

    if (this.running.has(id)) {
      throw new Error(`Adapter already running: ${id}`);
    }

    await adapter.initialize();
    await adapter.start();
    this.running.add(id);
  }

  /**
   * 停止适配器
   */
  async stop(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Adapter not found: ${id}`);
    }

    if (!this.running.has(id)) {
      return; // 已经停止
    }

    await adapter.stop();
    await adapter.destroy();
    this.running.delete(id);
  }

  /**
   * 启动所有适配器
   */
  async startAll(): Promise<void> {
    const promises = Array.from(this.adapters.keys()).map(id => this.start(id));
    await Promise.all(promises);
  }

  /**
   * 停止所有适配器
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.running).map(id => this.stop(id));
    await Promise.all(promises);
  }

  /**
   * 获取适配器状态
   */
  getStatus(): Record<string, {
    registered: boolean;
    running: boolean;
    health?: boolean;
  }> {
    const status: Record<string, any> = {};
    
    for (const [id, adapter] of this.adapters) {
      status[id] = {
        registered: true,
        running: this.running.has(id)
      };
    }

    return status;
  }

  /**
   * 健康检查所有适配器
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [id, adapter] of this.adapters) {
      if (this.running.has(id)) {
        try {
          results[id] = await adapter.healthCheck();
        } catch (error) {
          results[id] = false;
        }
      } else {
        results[id] = false;
      }
    }

    return results;
  }

  /**
   * 获取适配器数量
   */
  getCount(): {
    total: number;
    running: number;
    stopped: number;
  } {
    return {
      total: this.adapters.size,
      running: this.running.size,
      stopped: this.adapters.size - this.running.size
    };
  }
}

// 默认适配器管理器实例
export const defaultAdapterManager = new AdapterManager();
