/**
 * 统一插件系统核心模块
 * 
 * 这是插件系统的统一入口，提供了完整的插件管理功能：
 * - 统一的插件接口和类型定义
 * - 插件生命周期管理
 * - 伪热插拔支持
 * - 一键安装/卸载
 * - 路由管理
 * - 许可证验证
 */

// ==================== 类型定义 ====================
export * from './types';

// ==================== 管理器 ====================
export { UnifiedPluginManagerImpl as UnifiedPluginManager } from './managers/unified-manager';
export { PseudoHotSwapManager } from './managers/hot-swap';
export { OneClickInstaller } from './managers/installer';
export { DynamicRouteManager } from './managers/route-manager';

// ==================== 服务 ====================
export { LicenseService } from './services/license';
export { LicenseValidator } from './services/validator';

// ==================== 工厂函数 ====================

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { UnifiedPluginManagerImpl } from './managers/unified-manager';
import { PseudoHotSwapManager } from './managers/hot-swap';
import { OneClickInstaller } from './managers/installer';

/**
 * 创建完整的插件系统实例
 */
export function createPluginSystem(app: FastifyInstance, prisma: PrismaClient) {
  // 创建核心管理器
  const pluginManager = new UnifiedPluginManagerImpl(app, prisma);
  const hotSwapManager = new PseudoHotSwapManager(app);
  const installer = new OneClickInstaller(app, pluginManager, hotSwapManager);

  return {
    pluginManager,
    hotSwapManager,
    installer,
    
    /**
     * 初始化插件系统
     */
    async initialize() {
      await hotSwapManager.initialize();
      app.log.info('Plugin system initialized successfully');
    },

    /**
     * 获取系统状态
     */
    async getSystemStatus() {
      const hotSwapStatus = hotSwapManager.getSystemStatus();
      const pluginHealth = await pluginManager.healthCheckAll();
      
      return {
        hotSwap: hotSwapStatus,
        health: pluginHealth,
        timestamp: new Date().toISOString()
      };
    },

    /**
     * 优雅关闭
     */
    async shutdown() {
      // 这里可以添加清理逻辑
      app.log.info('Plugin system shutdown completed');
    }
  };
}

/**
 * 插件系统类型
 */
export type PluginSystem = ReturnType<typeof createPluginSystem>;

// ==================== 常量 ====================

/**
 * 插件系统版本
 */
export const PLUGIN_SYSTEM_VERSION = '2.0.0';

/**
 * 支持的插件API版本
 */
export const SUPPORTED_PLUGIN_API_VERSIONS = ['1.0.0', '2.0.0'];

/**
 * 默认配置
 */
export const DEFAULT_PLUGIN_CONFIG = {
  // 插件目录
  directories: {
    official: 'plugins/official',
    community: 'plugins/community', 
    commercial: 'plugins/commercial'
  },
  
  // 安全设置
  security: {
    requireSignature: true,
    allowUnsignedDev: process.env.NODE_ENV === 'development',
    maxPluginSize: 50 * 1024 * 1024, // 50MB
    allowedFileTypes: ['.js', '.ts', '.json']
  },
  
  // 性能设置
  performance: {
    maxConcurrentInstalls: 3,
    installTimeout: 300000, // 5分钟
    healthCheckInterval: 60000 // 1分钟
  },
  
  // 热插拔设置
  hotSwap: {
    enabled: true,
    gracefulShutdown: true,
    shutdownTimeout: 30000 // 30秒
  }
};

// ==================== 工具函数 ====================

/**
 * 验证插件ID格式
 */
export function validatePluginId(pluginId: string): boolean {
  // 插件ID格式: 字母、数字、连字符、下划线，长度3-50
  const regex = /^[a-zA-Z0-9_-]{3,50}$/;
  return regex.test(pluginId);
}

/**
 * 生成插件键
 */
export function generatePluginKey(pluginId: string, tenantId?: string): string {
  return tenantId ? `${pluginId}:${tenantId}` : pluginId;
}

/**
 * 解析插件键
 */
export function parsePluginKey(pluginKey: string): { pluginId: string; tenantId?: string } {
  const parts = pluginKey.split(':');
  return {
    pluginId: parts[0],
    tenantId: parts[1]
  };
}

/**
 * 检查插件兼容性
 */
export function checkPluginCompatibility(
  pluginApiVersion: string,
  systemApiVersion: string = PLUGIN_SYSTEM_VERSION
): boolean {
  // 简单的版本兼容性检查
  return SUPPORTED_PLUGIN_API_VERSIONS.includes(pluginApiVersion);
}

// ==================== 错误类型 ====================

/**
 * 插件系统错误基类
 */
export class PluginSystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly pluginId?: string
  ) {
    super(message);
    this.name = 'PluginSystemError';
  }
}

/**
 * 插件安装错误
 */
export class PluginInstallError extends PluginSystemError {
  constructor(message: string, pluginId: string) {
    super(message, 'PLUGIN_INSTALL_ERROR', pluginId);
    this.name = 'PluginInstallError';
  }
}

/**
 * 插件许可证错误
 */
export class PluginLicenseError extends PluginSystemError {
  constructor(message: string, pluginId: string) {
    super(message, 'PLUGIN_LICENSE_ERROR', pluginId);
    this.name = 'PluginLicenseError';
  }
}

/**
 * 插件依赖错误
 */
export class PluginDependencyError extends PluginSystemError {
  constructor(message: string, pluginId: string) {
    super(message, 'PLUGIN_DEPENDENCY_ERROR', pluginId);
    this.name = 'PluginDependencyError';
  }
}
