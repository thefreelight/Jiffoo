/**
 * 统一插件系统核心模块 - Open Source Edition
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
  const pluginManager = new UnifiedPluginManagerImpl(app, prisma);
  const hotSwapManager = new PseudoHotSwapManager(app);
  const installer = new OneClickInstaller();

  return {
    pluginManager,
    hotSwapManager,
    installer,
    
    async initialize() {
      await hotSwapManager.initialize();
      app.log.info('Plugin system initialized successfully');
    },

    async getSystemStatus() {
      const hotSwapStatus = hotSwapManager.getSystemStatus();
      const pluginHealth = await pluginManager.healthCheck();
      
      return {
        hotSwap: hotSwapStatus,
        health: pluginHealth,
        timestamp: new Date().toISOString()
      };
    },

    async shutdown() {
      app.log.info('Plugin system shutdown completed');
    }
  };
}

export type PluginSystem = ReturnType<typeof createPluginSystem>;

// ==================== 常量 ====================

export const PLUGIN_SYSTEM_VERSION = '2.0.0';
export const SUPPORTED_PLUGIN_API_VERSIONS = ['1.0.0', '2.0.0'];

export const DEFAULT_PLUGIN_CONFIG = {
  directories: {
    official: 'plugins/official',
    community: 'plugins/community', 
    commercial: 'plugins/commercial'
  },
  security: {
    requireSignature: true,
    allowUnsignedDev: process.env.NODE_ENV === 'development',
    maxPluginSize: 50 * 1024 * 1024,
    allowedFileTypes: ['.js', '.ts', '.json']
  },
  performance: {
    maxConcurrentInstalls: 3,
    installTimeout: 300000,
    healthCheckInterval: 60000
  },
  hotSwap: {
    enabled: true,
    gracefulShutdown: true,
    shutdownTimeout: 30000
  }
};

// ==================== 工具函数 ====================

export function validatePluginId(pluginId: string): boolean {
  const regex = /^[a-zA-Z0-9_-]{3,50}$/;
  return regex.test(pluginId);
}

export function generatePluginKey(pluginId: string, tenantId?: string): string {
  return tenantId ? '\${pluginId}:\${tenantId}' : pluginId;
}

export function parsePluginKey(pluginKey: string): { pluginId: string; tenantId?: string } {
  const parts = pluginKey.split(':');
  return { pluginId: parts[0], tenantId: parts[1] };
}

export function checkPluginCompatibility(
  pluginApiVersion: string,
  systemApiVersion: string = PLUGIN_SYSTEM_VERSION
): boolean {
  return SUPPORTED_PLUGIN_API_VERSIONS.includes(pluginApiVersion);
}

// ==================== 错误类型 ====================

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

export class PluginInstallError extends PluginSystemError {
  constructor(message: string, pluginId: string) {
    super(message, 'PLUGIN_INSTALL_ERROR', pluginId);
    this.name = 'PluginInstallError';
  }
}

export class PluginLicenseError extends PluginSystemError {
  constructor(message: string, pluginId: string) {
    super(message, 'PLUGIN_LICENSE_ERROR', pluginId);
    this.name = 'PluginLicenseError';
  }
}

export class PluginDependencyError extends PluginSystemError {
  constructor(message: string, pluginId: string) {
    super(message, 'PLUGIN_DEPENDENCY_ERROR', pluginId);
    this.name = 'PluginDependencyError';
  }
}
