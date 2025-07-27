import { EventEmitter } from 'events';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { UnifiedPlugin, UnifiedPluginManager, PluginStatus, PluginType, InstallOptions, PaymentPluginImplementation } from '../types';
/**
 * 统一插件管理器
 * 整合了原有的 PaymentPluginManager 和 HotSwapManager 功能
 *
 * 主要功能：
 * - 插件生命周期管理（安装、激活、停用、卸载）
 * - 支付插件专用功能
 * - 热插拔支持
 * - 许可证验证
 * - 依赖管理
 * - 多租户支持
 */
export declare class UnifiedPluginManagerImpl extends EventEmitter implements UnifiedPluginManager {
    private plugins;
    private pluginInstances;
    private pluginModules;
    private routeManager;
    private prisma;
    private app;
    private licenseService;
    private licenseValidator;
    private pluginRegistry;
    constructor(app: FastifyInstance, prisma: PrismaClient);
    /**
     * 公共初始化方法
     */
    initialize(): Promise<void>;
    /**
     * 初始化插件注册表
     */
    private initializePluginRegistry;
    /**
     * 从数据库加载已安装的插件
     */
    private loadInstalledPluginsFromDB;
    /**
     * 加载官方插件到注册表
     */
    private loadOfficialPlugins;
    /**
     * 加载商业插件到注册表
     */
    private loadCommercialPlugins;
    /**
     * 加载社区插件到注册表
     */
    private loadCommunityPlugins;
    /**
     * 安装插件
     * 整合了 PaymentPluginManager 和 HotSwapManager 的安装逻辑
     */
    installPlugin(pluginId: string, options?: InstallOptions): Promise<void>;
    /**
     * 下载并验证插件包
     * 整合了 HotSwapManager 的下载逻辑
     */
    private downloadAndValidatePlugin;
    /**
     * 加载本地插件
     */
    private loadLocalPlugin;
    /**
     * 创建插件实例
     */
    private createPluginInstance;
    /**
     * 验证插件完整性
     */
    private validatePlugin;
    /**
     * 激活插件
     * 整合了 PaymentPluginManager 和 HotSwapManager 的激活逻辑
     */
    activatePlugin(pluginId: string, tenantId?: string): Promise<void>;
    /**
     * 停用插件
     */
    deactivatePlugin(pluginId: string, tenantId?: string): Promise<void>;
    /**
     * 卸载插件
     */
    uninstallPlugin(pluginId: string, tenantId?: string): Promise<void>;
    /**
     * 获取插件
     */
    getPlugin(pluginId: string, tenantId?: string): Promise<UnifiedPlugin | null>;
    /**
     * 获取所有已安装的插件
     */
    getPlugins(tenantId?: string): Promise<UnifiedPlugin[]>;
    /**
     * 获取所有可用插件（从注册表）
     */
    getAvailablePlugins(): UnifiedPlugin[];
    /**
     * 获取活跃插件列表
     */
    getActivePlugins(tenantId?: string): UnifiedPlugin[];
    /**
     * 按类型获取插件
     */
    getPluginsByType(type: PluginType, tenantId?: string): Promise<UnifiedPlugin[]>;
    /**
     * 获取插件状态
     */
    getPluginStatus(pluginId: string, tenantId?: string): Promise<PluginStatus>;
    /**
     * 获取插件数据库实例（用于调试）
     */
    getPluginDatabaseInstance(pluginId: string, tenantId?: string): Promise<any>;
    /**
     * 获取支付提供商
     */
    getPaymentProvider(providerName: string, tenantId?: string): PaymentPluginImplementation | undefined;
    /**
     * 获取所有支付提供商
     */
    getPaymentProviders(tenantId?: string): PaymentPluginImplementation[];
    /**
     * 获取支付插件统计
     */
    getPaymentPluginStats(tenantId?: string): Promise<{
        total: number;
        byLicense: {
            free: number;
            basic: number;
            premium: number;
            enterprise: number;
        };
        byStatus: {
            active: any;
            inactive: any;
            error: any;
            installed: any;
            uninstalled: any;
        };
    }>;
    /**
     * 注册支付插件（兼容旧API）
     */
    registerPaymentPlugin(metadata: any, providerClass: new () => PaymentPluginImplementation, config: any, licenseKey?: string, tenantId?: string): Promise<void>;
    /**
     * 转换旧的元数据格式到统一格式
     */
    private convertToUnifiedMetadata;
    /**
     * 更新插件配置
     */
    updatePluginConfig(pluginId: string, config: any, tenantId?: string): Promise<void>;
    /**
     * 获取插件配置
     */
    getPluginConfig(pluginId: string, tenantId?: string): Promise<any>;
    /**
     * 验证插件许可证
     */
    validatePluginLicense(pluginId: string, licenseKey?: string): Promise<boolean>;
    /**
     * 检查单个插件健康状态
     */
    healthCheckPlugin(pluginId: string, tenantId?: string): Promise<boolean>;
    /**
     * 检查所有插件健康状态
     */
    healthCheckAll(tenantId?: string): Promise<Record<string, boolean>>;
    /**
     * 生成插件键
     */
    private getPluginKey;
    /**
     * 创建插件上下文
     */
    private createPluginContext;
    /**
     * 加载插件模块
     */
    private loadPluginModule;
    /**
     * 验证插件依赖关系
     */
    private validateDependencies;
    /**
     * 从数据库获取插件实例
     */
    private getPluginInstanceFromDB;
    /**
     * 保存插件实例到数据库
     */
    private savePluginInstanceToDB;
    /**
     * 更新插件状态
     */
    private updatePluginStatus;
    /**
     * 更新插件配置
     */
    private updatePluginConfigInDB;
    /**
     * 从数据库删除插件实例
     */
    private removePluginInstanceFromDB;
    /**
     * 重新加载插件
     */
    reloadPlugin(pluginId: string, tenantId?: string): Promise<void>;
    /**
     * 获取插件实例（用于直接调用插件方法）
     */
    getPluginImplementation<T = any>(pluginId: string, tenantId?: string): Promise<T | null>;
    /**
     * 批量操作插件
     */
    batchOperation(operation: 'install' | 'activate' | 'deactivate' | 'uninstall', pluginIds: string[], tenantId?: string): Promise<{
        success: string[];
        failed: Array<{
            pluginId: string;
            error: string;
        }>;
    }>;
    /**
     * 解析插件键
     */
    private parsePluginKey;
    /**
     * 获取插件状态统计
     */
    private getPluginStatusStats;
    /**
     * 健康检查所有插件
     * 整合 PaymentPluginManager 的健康检查功能
     */
    healthCheck(tenantId?: string): Promise<{
        [pluginId: string]: boolean;
    }>;
    /**
     * 清理模块缓存
     */
    private clearModuleCache;
    /**
     * 检查插件健康状态
     */
    checkPluginHealth(pluginId: string, tenantId?: string): Promise<{
        isHealthy: boolean;
        status: string;
        lastCheck: Date;
        errors?: string[];
    }>;
}
export declare function createUnifiedPluginManager(app: FastifyInstance, prisma: PrismaClient): UnifiedPluginManagerImpl;
export declare function getUnifiedPluginManager(): UnifiedPluginManagerImpl;
export declare const unifiedPluginManager: {
    readonly instance: UnifiedPluginManagerImpl;
    initialize: () => Promise<void>;
    getActivePlugins: () => UnifiedPlugin[];
    on: (event: string, listener: (...args: any[]) => void) => UnifiedPluginManagerImpl;
};
//# sourceMappingURL=unified-manager.d.ts.map