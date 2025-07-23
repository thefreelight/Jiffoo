"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedPluginManager = exports.UnifiedPluginManagerImpl = void 0;
exports.createUnifiedPluginManager = createUnifiedPluginManager;
exports.getUnifiedPluginManager = getUnifiedPluginManager;
const events_1 = require("events");
const types_1 = require("../types");
const route_manager_1 = require("./route-manager");
const license_1 = require("../services/license");
const validator_1 = require("../services/validator");
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
class UnifiedPluginManagerImpl extends events_1.EventEmitter {
    plugins = new Map(); // pluginKey -> plugin definition
    pluginInstances = new Map(); // pluginKey -> active instance
    pluginModules = new Map(); // pluginKey -> loaded module
    routeManager;
    prisma;
    app;
    licenseService;
    licenseValidator;
    // 插件注册表 - 存储可用插件的元数据
    pluginRegistry = new Map();
    constructor(app, prisma) {
        super();
        this.app = app;
        this.prisma = prisma;
        this.routeManager = new route_manager_1.DynamicRouteManager(app, this);
        this.licenseService = license_1.licenseService;
        this.licenseValidator = new validator_1.LicenseValidator();
        this.setMaxListeners(100);
        // 初始化插件注册表
        this.initializePluginRegistry();
    }
    /**
     * 公共初始化方法
     */
    async initialize() {
        await this.initializePluginRegistry();
        await this.loadInstalledPluginsFromDB();
    }
    /**
     * 初始化插件注册表
     */
    async initializePluginRegistry() {
        try {
            // 加载官方插件
            await this.loadOfficialPlugins();
            // 加载商业插件
            await this.loadCommercialPlugins();
            // 加载社区插件
            await this.loadCommunityPlugins();
            this.app.log.info(`Plugin registry initialized with ${this.pluginRegistry.size} plugins`);
        }
        catch (error) {
            this.app.log.error('Failed to initialize plugin registry:', error);
        }
    }
    /**
     * 从数据库加载已安装的插件
     */
    async loadInstalledPluginsFromDB() {
        try {
            const installedInstances = await this.prisma.pluginInstance.findMany({
                where: {
                    status: {
                        in: [types_1.PluginStatus.INSTALLED, types_1.PluginStatus.ACTIVE, types_1.PluginStatus.INACTIVE]
                    }
                }
            });
            this.app.log.info(`Loading ${installedInstances.length} installed plugins from database...`);
            for (const instance of installedInstances) {
                try {
                    // 将数据库中的 'global' 转换回 undefined
                    const effectiveTenantId = instance.tenantId === 'global' ? undefined : instance.tenantId;
                    // 从注册表获取插件定义
                    const pluginFromRegistry = this.pluginRegistry.get(instance.pluginId);
                    if (pluginFromRegistry) {
                        const pluginKey = this.getPluginKey(instance.pluginId, effectiveTenantId);
                        // 直接使用注册表中的插件对象，并设置状态
                        pluginFromRegistry.status = instance.status;
                        this.plugins.set(pluginKey, pluginFromRegistry);
                        // 如果插件状态为 ACTIVE，激活插件并注册路由
                        if (instance.status === types_1.PluginStatus.ACTIVE) {
                            // 创建插件上下文
                            const config = instance.config ? JSON.parse(instance.config) : {};
                            const context = this.createPluginContext(instance.pluginId, instance.version, config, effectiveTenantId);
                            // 激活插件
                            try {
                                await pluginFromRegistry.activate(context);
                                this.app.log.info(`Activated plugin: ${instance.pluginId}`);
                            }
                            catch (activationError) {
                                this.app.log.error(`Failed to activate plugin ${instance.pluginId}:`, activationError);
                                console.error(`❌ Plugin activation error for ${instance.pluginId}:`, activationError);
                                continue; // 跳过这个插件，继续处理下一个
                            }
                            // 注册路由
                            if (pluginFromRegistry.metadata.routes && pluginFromRegistry.metadata.routes.length > 0) {
                                await this.routeManager.registerPluginRoutes(instance.pluginId, pluginFromRegistry.metadata.routes);
                                this.app.log.info(`Registered routes for active plugin: ${instance.pluginId}`);
                            }
                        }
                        this.app.log.info(`Loaded installed plugin: ${instance.pluginId} (${instance.status})`);
                    }
                    else {
                        this.app.log.warn(`Plugin ${instance.pluginId} found in database but not in registry`);
                    }
                }
                catch (error) {
                    this.app.log.error(`Failed to load plugin ${instance.pluginId}:`, error);
                }
            }
            this.app.log.info(`Successfully loaded ${this.plugins.size} plugins from database`);
        }
        catch (error) {
            this.app.log.error('Failed to load installed plugins from database:', error);
        }
    }
    /**
     * 加载官方插件到注册表
     */
    async loadOfficialPlugins() {
        try {
            // 支付宝插件
            try {
                const alipayPlugin = await Promise.resolve().then(() => __importStar(require('../../official/payment/alipay/index.js')));
                if (alipayPlugin.default?.metadata) {
                    this.pluginRegistry.set(alipayPlugin.default.metadata.id, alipayPlugin.default);
                    this.app.log.info(`Loaded official plugin: ${alipayPlugin.default.metadata.displayName}`);
                }
                else {
                    this.app.log.warn('Alipay plugin has no metadata or default export');
                }
            }
            catch (error) {
                this.app.log.warn('Failed to load Alipay plugin:', {
                    error: error instanceof Error ? error.message : error,
                    stack: error instanceof Error ? error.stack : undefined,
                    name: error instanceof Error ? error.name : undefined
                });
            }
            // Stripe插件
            try {
                const stripePlugin = await Promise.resolve().then(() => __importStar(require('../../official/payment/stripe/index.js')));
                if (stripePlugin.default?.metadata) {
                    this.pluginRegistry.set(stripePlugin.default.metadata.id, stripePlugin.default);
                    this.app.log.info(`Loaded official plugin: ${stripePlugin.default.metadata.displayName}`);
                }
                else {
                    this.app.log.warn('Stripe plugin has no metadata or default export');
                }
            }
            catch (error) {
                this.app.log.warn('Failed to load Stripe plugin:', error);
            }
            this.app.log.info('Official plugins loaded to registry');
        }
        catch (error) {
            this.app.log.warn('Some official plugins failed to load:', error);
        }
    }
    /**
     * 加载商业插件到注册表
     */
    async loadCommercialPlugins() {
        try {
            // 从商业插件目录扫描
            // 这里应该实现动态扫描逻辑
            this.app.log.debug('Commercial plugins loaded to registry');
        }
        catch (error) {
            this.app.log.warn('Some commercial plugins failed to load:', error);
        }
    }
    /**
     * 加载社区插件到注册表
     */
    async loadCommunityPlugins() {
        try {
            // 从社区插件目录扫描
            // 这里应该实现动态扫描逻辑
            this.app.log.debug('Community plugins loaded to registry');
        }
        catch (error) {
            this.app.log.warn('Some community plugins failed to load:', error);
        }
    }
    // ==================== 插件生命周期管理 ====================
    /**
     * 安装插件
     * 整合了 PaymentPluginManager 和 HotSwapManager 的安装逻辑
     */
    async installPlugin(pluginId, options = {}) {
        const { tenantId, config, licenseKey, autoActivate = false, force = false, packageUrl } = options;
        try {
            this.app.log.info(`Installing plugin ${pluginId}...`);
            // 1. 检查插件是否已安装
            const existingInstance = await this.getPluginInstanceFromDB(pluginId, tenantId);
            // 允许从 UNINSTALLED 或 ERROR 状态重新安装
            if (existingInstance &&
                existingInstance.status !== types_1.PluginStatus.UNINSTALLED &&
                existingInstance.status !== types_1.PluginStatus.ERROR &&
                !force) {
                throw new Error(`Plugin ${pluginId} is already installed`);
            }
            // 2. 从注册表获取插件元数据
            const pluginFromRegistry = this.pluginRegistry.get(pluginId);
            if (!pluginFromRegistry) {
                throw new Error(`Plugin ${pluginId} not found in registry`);
            }
            const pluginMetadata = pluginFromRegistry.metadata;
            if (!pluginMetadata) {
                throw new Error(`Plugin ${pluginId} has no metadata`);
            }
            // 3. 验证许可证（商业插件）
            if (pluginMetadata.license.type !== 'MIT' && pluginMetadata.pricing?.type !== 'free') {
                if (!licenseKey) {
                    throw new Error(`License key required for plugin ${pluginId}`);
                }
                const isValidLicense = await this.validatePluginLicense(pluginId, licenseKey);
                if (!isValidLicense) {
                    throw new Error(`Invalid license for plugin ${pluginId}`);
                }
            }
            // 4. 获取插件实例（从注册表或下载）
            let plugin;
            let pluginModule = null;
            if (pluginFromRegistry) {
                // 从注册表直接使用已加载的插件
                plugin = pluginFromRegistry;
                // 对于注册表中的插件，我们不需要存储 pluginModule
            }
            else {
                // 下载并验证插件包
                pluginModule = await this.downloadAndValidatePlugin(pluginId, packageUrl);
                // 创建插件实例
                plugin = await this.createPluginInstance(pluginModule);
            }
            // 6. 验证插件完整性
            await this.validatePlugin(plugin);
            // 7. 验证依赖关系
            await this.validateDependencies(plugin.metadata);
            // 8. 创建插件上下文
            const context = this.createPluginContext(pluginId, plugin.metadata.version, config, tenantId);
            // 9. 执行插件安装钩子
            await plugin.install(context);
            // 10. 保存到数据库
            await this.savePluginInstanceToDB(pluginId, plugin, tenantId, config, types_1.PluginStatus.INSTALLED);
            // 11. 存储插件实例
            const pluginKey = this.getPluginKey(pluginId, tenantId);
            this.plugins.set(pluginKey, plugin);
            // 只有当 pluginModule 存在时才存储（下载的插件）
            if (pluginModule) {
                this.pluginModules.set(pluginKey, pluginModule);
            }
            this.app.log.info(`Plugin ${pluginId} installed successfully`);
            // 12. 自动激活（如果需要）
            if (autoActivate) {
                await this.activatePlugin(pluginId, tenantId);
            }
            // 13. 发送事件
            this.emitPluginEvent('install', pluginId, tenantId, { config, licenseKey });
        }
        catch (error) {
            this.app.log.error(`Failed to install plugin ${pluginId}:`, error);
            // 保存错误状态到数据库
            await this.savePluginInstanceToDB(pluginId, null, tenantId, config, types_1.PluginStatus.ERROR, error instanceof Error ? error.message : 'Unknown error');
            this.emitPluginEvent('error', pluginId, tenantId, undefined, error);
            throw error;
        }
    }
    /**
     * 下载并验证插件包
     * 整合了 HotSwapManager 的下载逻辑
     */
    async downloadAndValidatePlugin(pluginId, packageUrl) {
        try {
            // 如果没有提供包URL，尝试从本地加载
            if (!packageUrl) {
                return await this.loadLocalPlugin(pluginId);
            }
            // 下载插件包（这里简化实现）
            this.app.log.info(`Downloading plugin ${pluginId} from ${packageUrl}`);
            // 实际实现中应该：
            // 1. 下载插件包
            // 2. 验证数字签名
            // 3. 解压到临时目录
            // 4. 验证插件结构
            // 5. 返回插件模块
            // 这里暂时返回本地插件
            return await this.loadLocalPlugin(pluginId);
        }
        catch (error) {
            this.app.log.error(`Failed to download plugin ${pluginId}:`, error);
            throw error;
        }
    }
    /**
     * 加载本地插件
     */
    async loadLocalPlugin(pluginId) {
        try {
            // 1. 尝试从官方插件目录加载
            try {
                const officialPath = `../../official/payment/${pluginId}`;
                const pluginModule = await Promise.resolve(`${officialPath}`).then(s => __importStar(require(s)));
                return pluginModule.default || pluginModule;
            }
            catch (error) {
                // 继续尝试其他目录
            }
            // 2. 尝试从商业插件目录加载
            try {
                const commercialPath = `../../commercial/payment/${pluginId}`;
                const pluginModule = await Promise.resolve(`${commercialPath}`).then(s => __importStar(require(s)));
                return pluginModule.default || pluginModule;
            }
            catch (error) {
                // 继续尝试其他目录
            }
            // 3. 尝试从社区插件目录加载
            try {
                const communityPath = `../../community/${pluginId}`;
                const pluginModule = await Promise.resolve(`${communityPath}`).then(s => __importStar(require(s)));
                return pluginModule.default || pluginModule;
            }
            catch (error) {
                // 继续尝试其他目录
            }
            // 4. 如果都没找到，创建示例插件（开发模式）
            if (process.env.NODE_ENV === 'development') {
                return this.createExamplePlugin(pluginId);
            }
            throw new Error(`Plugin ${pluginId} not found in any directory`);
        }
        catch (error) {
            this.app.log.error(`Failed to load local plugin ${pluginId}:`, error);
            throw error;
        }
    }
    /**
     * 创建插件实例
     */
    async createPluginInstance(pluginModule) {
        if (typeof pluginModule === 'function') {
            return new pluginModule();
        }
        return pluginModule;
    }
    /**
     * 验证插件完整性
     */
    async validatePlugin(plugin) {
        if (!plugin.metadata) {
            throw new Error('Plugin must have metadata');
        }
        if (!plugin.metadata.id) {
            throw new Error('Plugin must have an ID');
        }
        if (!plugin.install || typeof plugin.install !== 'function') {
            throw new Error('Plugin must have an install function');
        }
        if (!plugin.activate || typeof plugin.activate !== 'function') {
            throw new Error('Plugin must have an activate function');
        }
        if (!plugin.deactivate || typeof plugin.deactivate !== 'function') {
            throw new Error('Plugin must have a deactivate function');
        }
        if (!plugin.uninstall || typeof plugin.uninstall !== 'function') {
            throw new Error('Plugin must have an uninstall function');
        }
        // 验证配置模式
        const configSchema = plugin.getConfigSchema();
        if (!configSchema) {
            throw new Error('Plugin must provide a configuration schema');
        }
        this.app.log.debug(`Plugin ${plugin.metadata.id} validation passed`);
    }
    /**
     * 激活插件
     * 整合了 PaymentPluginManager 和 HotSwapManager 的激活逻辑
     */
    async activatePlugin(pluginId, tenantId) {
        try {
            this.app.log.info(`Activating plugin ${pluginId}...`);
            const pluginKey = this.getPluginKey(pluginId, tenantId);
            const plugin = this.plugins.get(pluginKey);
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} is not installed`);
            }
            // 1. 创建插件上下文
            const config = await this.getPluginConfig(pluginId, tenantId);
            const context = this.createPluginContext(pluginId, plugin.metadata.version, config, tenantId);
            // 2. 执行插件激活
            await plugin.activate(context);
            // 3. 注册路由
            if (plugin.metadata.routes && plugin.metadata.routes.length > 0) {
                await this.routeManager.registerPluginRoutes(pluginId, plugin.metadata.routes);
            }
            // 4. 更新数据库状态
            await this.updatePluginStatus(pluginId, tenantId, types_1.PluginStatus.ACTIVE);
            this.app.log.info(`Plugin ${pluginId} activated successfully`);
            this.emitPluginEvent('activate', pluginId, tenantId);
        }
        catch (error) {
            this.app.log.error(`Failed to activate plugin ${pluginId}:`, error);
            this.emitPluginEvent('error', pluginId, tenantId, undefined, error);
            throw error;
        }
    }
    /**
     * 停用插件
     */
    async deactivatePlugin(pluginId, tenantId) {
        try {
            this.app.log.info(`Deactivating plugin ${pluginId}...`);
            const pluginKey = this.getPluginKey(pluginId, tenantId);
            const plugin = this.plugins.get(pluginKey);
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} is not installed`);
            }
            // 1. 首先更新数据库状态，确保新请求不会被处理
            await this.updatePluginStatus(pluginId, tenantId, types_1.PluginStatus.INACTIVE);
            // 2. 创建插件上下文
            const config = await this.getPluginConfig(pluginId, tenantId);
            const context = this.createPluginContext(pluginId, plugin.metadata.version, config, tenantId);
            // 3. 执行插件停用
            await plugin.deactivate(context);
            // 4. 注销路由
            if (plugin.metadata.routes && plugin.metadata.routes.length > 0) {
                await this.routeManager.unregisterPluginRoutes(pluginId);
            }
            // 5. 在路由管理器中标记插件为停用状态
            this.routeManager.deactivatePlugin(pluginId);
            this.app.log.info(`Plugin ${pluginId} deactivated successfully`);
            this.emitPluginEvent('deactivate', pluginId, tenantId);
        }
        catch (error) {
            this.app.log.error(`Failed to deactivate plugin ${pluginId}:`, error);
            this.emitPluginEvent('error', pluginId, tenantId, undefined, error);
            throw error;
        }
    }
    /**
     * 卸载插件
     */
    async uninstallPlugin(pluginId, tenantId) {
        try {
            this.app.log.info(`Uninstalling plugin ${pluginId}...`);
            // 1. 先停用插件
            const status = await this.getPluginStatus(pluginId, tenantId);
            if (status === types_1.PluginStatus.ACTIVE) {
                await this.deactivatePlugin(pluginId, tenantId);
            }
            const pluginKey = this.getPluginKey(pluginId, tenantId);
            const plugin = this.plugins.get(pluginKey);
            if (plugin) {
                // 2. 创建插件上下文
                const config = await this.getPluginConfig(pluginId, tenantId);
                const context = this.createPluginContext(pluginId, plugin.metadata.version, config, tenantId);
                // 3. 执行插件卸载
                await plugin.uninstall(context);
                // 4. 移除插件实例
                this.plugins.delete(pluginKey);
            }
            // 5. 从数据库删除
            await this.removePluginInstanceFromDB(pluginId, tenantId);
            this.app.log.info(`Plugin ${pluginId} uninstalled successfully`);
            this.emitPluginEvent('uninstall', pluginId, tenantId);
        }
        catch (error) {
            this.app.log.error(`Failed to uninstall plugin ${pluginId}:`, error);
            this.emitPluginEvent('error', pluginId, tenantId, undefined, error);
            throw error;
        }
    }
    // ==================== 插件查询 ====================
    /**
     * 获取插件
     */
    async getPlugin(pluginId, tenantId) {
        const pluginKey = this.getPluginKey(pluginId, tenantId);
        return this.plugins.get(pluginKey) || null;
    }
    /**
     * 获取所有已安装的插件
     */
    async getPlugins(tenantId) {
        const plugins = [];
        for (const [key, plugin] of this.plugins.entries()) {
            if (tenantId) {
                if (key.endsWith(`:${tenantId}`)) {
                    plugins.push(plugin);
                }
            }
            else {
                if (!key.includes(':')) {
                    plugins.push(plugin);
                }
            }
        }
        return plugins;
    }
    /**
     * 获取所有可用插件（从注册表）
     */
    getAvailablePlugins() {
        return Array.from(this.pluginRegistry.values());
    }
    /**
     * 获取活跃插件列表
     */
    getActivePlugins(tenantId) {
        const activePlugins = [];
        for (const [key, plugin] of this.plugins.entries()) {
            if (tenantId) {
                if (key.endsWith(`:${tenantId}`) && plugin.status === types_1.PluginStatus.ACTIVE) {
                    activePlugins.push(plugin);
                }
            }
            else {
                if (!key.includes(':') && plugin.status === types_1.PluginStatus.ACTIVE) {
                    activePlugins.push(plugin);
                }
            }
        }
        return activePlugins;
    }
    /**
     * 按类型获取插件
     */
    async getPluginsByType(type, tenantId) {
        const allPlugins = await this.getPlugins(tenantId);
        return allPlugins.filter(plugin => plugin.metadata.type === type);
    }
    /**
     * 获取插件状态
     */
    async getPluginStatus(pluginId, tenantId) {
        const instance = await this.getPluginInstanceFromDB(pluginId, tenantId);
        return instance ? instance.status : types_1.PluginStatus.UNINSTALLED;
    }
    /**
     * 获取插件数据库实例（用于调试）
     */
    async getPluginDatabaseInstance(pluginId, tenantId) {
        return await this.getPluginInstanceFromDB(pluginId, tenantId);
    }
    // ==================== 支付插件专用功能 ====================
    // 整合 PaymentPluginManager 的功能
    /**
     * 获取支付提供商
     */
    getPaymentProvider(providerName, tenantId) {
        for (const [pluginKey, plugin] of this.plugins) {
            if (plugin.metadata.type === types_1.PluginType.PAYMENT) {
                const keyTenantId = this.parsePluginKey(pluginKey).tenantId;
                if (keyTenantId === tenantId && plugin.implementation) {
                    const impl = plugin.implementation;
                    if (impl.constructor.name.toLowerCase().includes(providerName.toLowerCase())) {
                        return impl;
                    }
                }
            }
        }
        return undefined;
    }
    /**
     * 获取所有支付提供商
     */
    getPaymentProviders(tenantId) {
        const providers = [];
        for (const [pluginKey, plugin] of this.plugins) {
            if (plugin.metadata.type === types_1.PluginType.PAYMENT) {
                const keyTenantId = this.parsePluginKey(pluginKey).tenantId;
                if (keyTenantId === tenantId && plugin.implementation) {
                    providers.push(plugin.implementation);
                }
            }
        }
        return providers;
    }
    /**
     * 获取支付插件统计
     */
    async getPaymentPluginStats(tenantId) {
        const paymentPlugins = Array.from(this.plugins.values()).filter(plugin => {
            if (plugin.metadata.type !== types_1.PluginType.PAYMENT)
                return false;
            // 如果指定了租户ID，只统计该租户的插件
            if (tenantId) {
                const pluginKey = this.getPluginKey(plugin.metadata.id, tenantId);
                return this.plugins.has(pluginKey);
            }
            return true;
        });
        // 从数据库获取状态统计
        const statusStats = await this.getPluginStatusStats(types_1.PluginType.PAYMENT, tenantId);
        return {
            total: paymentPlugins.length,
            byLicense: {
                free: paymentPlugins.filter(p => p.metadata.pricing?.type === 'free').length,
                basic: paymentPlugins.filter(p => p.metadata.pricing?.type === 'basic').length,
                premium: paymentPlugins.filter(p => p.metadata.pricing?.type === 'premium').length,
                enterprise: paymentPlugins.filter(p => p.metadata.pricing?.type === 'enterprise').length,
            },
            byStatus: statusStats
        };
    }
    /**
     * 注册支付插件（兼容旧API）
     */
    async registerPaymentPlugin(metadata, providerClass, config, licenseKey, tenantId) {
        try {
            this.app.log.info(`Registering payment plugin: ${metadata.id}`);
            // 验证许可证
            if (metadata.license !== 'free' && licenseKey) {
                const isValidLicense = await this.validatePluginLicense(metadata.id, licenseKey);
                if (!isValidLicense) {
                    throw new Error(`Invalid license for plugin ${metadata.id}`);
                }
            }
            // 创建提供商实例
            const provider = new providerClass();
            // 创建统一插件包装器
            const unifiedPlugin = {
                metadata: this.convertToUnifiedMetadata(metadata),
                async install(context) {
                    // 支付插件安装逻辑
                    if (provider.initialize) {
                        await provider.initialize();
                    }
                },
                async activate(context) {
                    if (provider.initialize) {
                        await provider.initialize();
                    }
                },
                async deactivate(context) {
                    if (provider.destroy) {
                        await provider.destroy();
                    }
                },
                async uninstall(context) {
                    // 支付插件卸载逻辑
                    if (provider.destroy) {
                        await provider.destroy();
                    }
                },
                getConfigSchema() {
                    return {
                        type: 'object',
                        properties: metadata.configuration || {}
                    };
                },
                async validateConfig(config) {
                    if (provider.validateConfig) {
                        return provider.validateConfig(config);
                    }
                    return true;
                },
                implementation: provider
            };
            // 存储插件
            const pluginKey = this.getPluginKey(metadata.id, tenantId);
            this.plugins.set(pluginKey, unifiedPlugin);
            // 保存到数据库
            await this.savePluginInstanceToDB(metadata.id, unifiedPlugin, tenantId, config, types_1.PluginStatus.INSTALLED);
            // 自动激活
            await this.activatePlugin(metadata.id, tenantId);
            this.app.log.info(`Payment plugin ${metadata.id} registered successfully`);
        }
        catch (error) {
            this.app.log.error(`Failed to register payment plugin ${metadata.id}`, error);
            throw error;
        }
    }
    /**
     * 转换旧的元数据格式到统一格式
     */
    convertToUnifiedMetadata(oldMetadata) {
        return {
            id: oldMetadata.id,
            name: oldMetadata.name,
            displayName: oldMetadata.name,
            version: oldMetadata.version || '1.0.0',
            description: oldMetadata.description || '',
            type: types_1.PluginType.PAYMENT,
            author: oldMetadata.author || 'Unknown',
            routes: [],
            permissions: {
                api: ['payment.create', 'payment.verify', 'payment.refund'],
                database: ['orders', 'payments'],
                network: []
            },
            resources: {
                memory: 128,
                cpu: 10,
                requests: 1000
            },
            license: {
                type: oldMetadata.license === 'free' ? 'MIT' : 'COMMERCIAL'
            },
            pricing: {
                type: oldMetadata.license || 'free',
                price: oldMetadata.price
            },
            minCoreVersion: oldMetadata.requirements?.minCoreVersion || '2.0.0',
            supportedPlatforms: ['web', 'mobile']
        };
    }
    // ==================== 配置管理 ====================
    /**
     * 更新插件配置
     */
    async updatePluginConfig(pluginId, config, tenantId) {
        try {
            // 1. 验证配置
            // 首先尝试从内存中获取活跃插件
            let plugin = await this.getPlugin(pluginId, tenantId);
            // 如果插件不在内存中（INSTALLED状态），从注册表获取
            if (!plugin) {
                const pluginClass = this.pluginRegistry.getPlugin(pluginId);
                if (pluginClass) {
                    // 创建临时实例用于配置验证，需要提供基本的context
                    const tempContext = {
                        app: this.app,
                        logger: this.app.log,
                        config: config,
                        tenantId: tenantId || 'global'
                    };
                    const tempInstance = new pluginClass(tempContext);
                    // 检查是否有validateConfig方法
                    if (typeof tempInstance.validateConfig === 'function') {
                        const isValidConfig = await tempInstance.validateConfig(config);
                        if (!isValidConfig) {
                            throw new Error(`Invalid configuration for plugin ${pluginId}`);
                        }
                    }
                }
            }
            else {
                // 插件在内存中，直接验证
                if (typeof plugin.validateConfig === 'function') {
                    const isValidConfig = await plugin.validateConfig(config);
                    if (!isValidConfig) {
                        throw new Error(`Invalid configuration for plugin ${pluginId}`);
                    }
                }
            }
            // 2. 更新数据库
            await this.updatePluginConfigInDB(pluginId, config, tenantId);
            this.emitPluginEvent('config_update', pluginId, tenantId, { config });
        }
        catch (error) {
            this.app.log.error(`Failed to update config for plugin ${pluginId}:`, error);
            throw error;
        }
    }
    /**
     * 获取插件配置
     */
    async getPluginConfig(pluginId, tenantId) {
        const instance = await this.getPluginInstanceFromDB(pluginId, tenantId);
        return instance ? JSON.parse(instance.config || '{}') : {};
    }
    // ==================== 许可证管理 ====================
    /**
     * 验证插件许可证
     */
    async validatePluginLicense(pluginId, licenseKey) {
        // 这里应该调用许可证验证服务
        // 暂时返回 true 用于开发
        return true;
    }
    // ==================== 健康检查 ====================
    /**
     * 检查单个插件健康状态
     */
    async healthCheckPlugin(pluginId, tenantId) {
        try {
            const plugin = await this.getPlugin(pluginId, tenantId);
            if (!plugin || !plugin.healthCheck) {
                return false;
            }
            return await plugin.healthCheck();
        }
        catch (error) {
            this.app.log.error(`Health check failed for plugin ${pluginId}:`, error);
            return false;
        }
    }
    /**
     * 检查所有插件健康状态
     */
    async healthCheckAll(tenantId) {
        const plugins = await this.getPlugins(tenantId);
        const results = {};
        for (const plugin of plugins) {
            results[plugin.metadata.id] = await this.healthCheckPlugin(plugin.metadata.id, tenantId);
        }
        return results;
    }
    // ==================== 私有辅助方法 ====================
    /**
     * 生成插件键
     */
    getPluginKey(pluginId, tenantId) {
        return tenantId ? `${pluginId}:${tenantId}` : pluginId;
    }
    /**
     * 创建插件上下文
     */
    createPluginContext(pluginId, version, config, tenantId, userId) {
        const context = {
            app: this.app,
            config: config || {},
            logger: this.app.log,
            database: this.prisma,
            cache: null, // TODO: 添加缓存实例
            events: this,
            tenantId,
            userId,
            pluginId,
            version,
            // 添加路由注册方法
            registerRouteHandler: (handlerName, handler) => {
                if (this.routeManager) {
                    this.routeManager.registerRouteHandler(pluginId, handlerName, handler);
                }
            }
        };
        return context;
    }
    /**
     * 加载插件模块
     */
    async loadPluginModule(pluginId) {
        try {
            // 1. 尝试从官方插件目录加载
            let pluginModule;
            try {
                pluginModule = await Promise.resolve(`${`./official/${pluginId}`}`).then(s => __importStar(require(s)));
            }
            catch (error) {
                // 2. 尝试从社区插件目录加载
                try {
                    pluginModule = await Promise.resolve(`${`./community/${pluginId}`}`).then(s => __importStar(require(s)));
                }
                catch (error) {
                    // 3. 尝试从商业插件目录加载
                    pluginModule = await Promise.resolve(`${`../../commercial/plugins/${pluginId}`}`).then(s => __importStar(require(s)));
                }
            }
            if (!pluginModule.default) {
                throw new Error(`Plugin ${pluginId} does not export a default plugin`);
            }
            return pluginModule.default;
        }
        catch (error) {
            this.app.log.error(`Failed to load plugin module ${pluginId}:`, error);
            throw new Error(`Plugin ${pluginId} not found or failed to load`);
        }
    }
    /**
     * 验证插件依赖关系
     */
    async validateDependencies(metadata) {
        if (!metadata.dependencies || metadata.dependencies.length === 0) {
            return;
        }
        for (const dependency of metadata.dependencies) {
            const dependencyPlugin = await this.getPlugin(dependency);
            if (!dependencyPlugin) {
                throw new Error(`Missing dependency: ${dependency}`);
            }
            const dependencyStatus = await this.getPluginStatus(dependency);
            if (dependencyStatus !== types_1.PluginStatus.ACTIVE) {
                throw new Error(`Dependency ${dependency} is not active`);
            }
        }
    }
    /**
     * 发送插件事件
     */
    emitPluginEvent(type, pluginId, tenantId, data, error) {
        const event = {
            type,
            pluginId,
            tenantId,
            timestamp: new Date(),
            data,
            error
        };
        this.emit('plugin.event', event);
        this.emit(`plugin.${type}`, event);
    }
    // ==================== 数据库操作方法 ====================
    /**
     * 从数据库获取插件实例
     */
    async getPluginInstanceFromDB(pluginId, tenantId) {
        const effectiveTenantId = tenantId || 'global'; // 使用 'global' 作为默认租户ID
        return await this.prisma.pluginInstance.findFirst({
            where: {
                pluginId,
                tenantId: effectiveTenantId
            }
        });
    }
    /**
     * 保存插件实例到数据库
     */
    async savePluginInstanceToDB(pluginId, plugin, tenantId, config, status = types_1.PluginStatus.INSTALLED, errorMessage) {
        const effectiveTenantId = tenantId || 'global'; // 使用 'global' 作为默认租户ID
        const data = {
            pluginId,
            tenantId: effectiveTenantId,
            status,
            version: plugin?.metadata?.version || '0.0.0',
            config: config ? JSON.stringify(config) : null,
            metadata: plugin ? JSON.stringify(plugin.metadata) : null,
            routes: plugin?.metadata?.routes ? JSON.stringify(plugin.metadata.routes) : null,
            dependencies: plugin?.metadata?.dependencies ? JSON.stringify(plugin.metadata.dependencies) : null
        };
        if (errorMessage) {
            data.errorMessage = errorMessage;
        }
        return await this.prisma.pluginInstance.upsert({
            where: {
                pluginId_tenantId: {
                    pluginId,
                    tenantId: effectiveTenantId
                }
            },
            update: data,
            create: data
        });
    }
    /**
     * 更新插件状态
     */
    async updatePluginStatus(pluginId, tenantId, status) {
        const effectiveTenantId = tenantId || 'global'; // 使用 'global' 作为默认租户ID
        const updateData = { status };
        if (status === types_1.PluginStatus.ACTIVE) {
            updateData.activatedAt = new Date();
        }
        else if (status === types_1.PluginStatus.INACTIVE) {
            updateData.deactivatedAt = new Date();
        }
        // 1. 更新数据库状态
        await this.prisma.pluginInstance.updateMany({
            where: {
                pluginId,
                tenantId: effectiveTenantId
            },
            data: updateData
        });
        // 2. 更新内存中插件对象的状态
        const pluginKey = this.getPluginKey(pluginId, tenantId);
        const plugin = this.plugins.get(pluginKey);
        if (plugin) {
            plugin.status = status;
        }
    }
    /**
     * 更新插件配置
     */
    async updatePluginConfigInDB(pluginId, config, tenantId) {
        const effectiveTenantId = tenantId || 'global'; // 使用 'global' 作为默认租户ID
        await this.prisma.pluginInstance.updateMany({
            where: {
                pluginId,
                tenantId: effectiveTenantId
            },
            data: {
                config: JSON.stringify(config)
            }
        });
    }
    /**
     * 从数据库删除插件实例
     */
    async removePluginInstanceFromDB(pluginId, tenantId) {
        const effectiveTenantId = tenantId || 'global'; // 使用 'global' 作为默认租户ID
        await this.prisma.pluginInstance.deleteMany({
            where: {
                pluginId,
                tenantId: effectiveTenantId
            }
        });
    }
    // ==================== 公共工具方法 ====================
    /**
     * 重新加载插件
     */
    async reloadPlugin(pluginId, tenantId) {
        this.app.log.info(`Reloading plugin ${pluginId}...`);
        // 1. 停用插件
        await this.deactivatePlugin(pluginId, tenantId);
        // 2. 重新加载插件模块
        const plugin = await this.loadPluginModule(pluginId);
        const pluginKey = this.getPluginKey(pluginId, tenantId);
        this.plugins.set(pluginKey, plugin);
        // 3. 重新激活插件
        await this.activatePlugin(pluginId, tenantId);
        this.app.log.info(`Plugin ${pluginId} reloaded successfully`);
    }
    /**
     * 获取插件实例（用于直接调用插件方法）
     */
    async getPluginImplementation(pluginId, tenantId) {
        const plugin = await this.getPlugin(pluginId, tenantId);
        return plugin ? plugin.implementation : null;
    }
    /**
     * 批量操作插件
     */
    async batchOperation(operation, pluginIds, tenantId) {
        const success = [];
        const failed = [];
        for (const pluginId of pluginIds) {
            try {
                switch (operation) {
                    case 'install':
                        await this.installPlugin(pluginId, { tenantId });
                        break;
                    case 'activate':
                        await this.activatePlugin(pluginId, tenantId);
                        break;
                    case 'deactivate':
                        await this.deactivatePlugin(pluginId, tenantId);
                        break;
                    case 'uninstall':
                        await this.uninstallPlugin(pluginId, tenantId);
                        break;
                }
                success.push(pluginId);
            }
            catch (error) {
                failed.push({
                    pluginId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return { success, failed };
    }
    /**
     * 发送插件事件
     */
    emitPluginEvent(eventType, pluginId, tenantId, data, error) {
        const event = {
            type: eventType,
            pluginId,
            tenantId,
            timestamp: new Date(),
            data,
            error: error?.message
        };
        this.emit(`plugin.${eventType}`, event);
        this.emit('plugin.event', event);
    }
    /**
     * 解析插件键
     */
    parsePluginKey(pluginKey) {
        const parts = pluginKey.split(':');
        return {
            pluginId: parts[0],
            tenantId: parts[1] || undefined
        };
    }
    /**
     * 获取插件状态统计
     */
    async getPluginStatusStats(pluginType, tenantId) {
        const where = {};
        if (tenantId) {
            where.tenantId = tenantId;
        }
        // 如果指定了插件类型，需要从插件元数据中过滤
        const instances = await this.prisma.pluginInstance.findMany({ where });
        let filteredInstances = instances;
        if (pluginType) {
            filteredInstances = instances.filter(instance => {
                // 将数据库中的 'global' 转换回 undefined 以匹配 getPluginKey 的逻辑
                const effectiveTenantId = instance.tenantId === 'global' ? undefined : instance.tenantId;
                const plugin = this.plugins.get(this.getPluginKey(instance.pluginId, effectiveTenantId));
                return plugin?.metadata.type === pluginType;
            });
        }
        return {
            active: filteredInstances.filter(i => i.status === types_1.PluginStatus.ACTIVE).length,
            inactive: filteredInstances.filter(i => i.status === types_1.PluginStatus.INACTIVE).length,
            error: filteredInstances.filter(i => i.status === types_1.PluginStatus.ERROR).length,
            installed: filteredInstances.filter(i => i.status === types_1.PluginStatus.INSTALLED).length,
            uninstalled: filteredInstances.filter(i => i.status === types_1.PluginStatus.UNINSTALLED).length
        };
    }
    /**
     * 健康检查所有插件
     * 整合 PaymentPluginManager 的健康检查功能
     */
    async healthCheck(tenantId) {
        const results = {};
        for (const [pluginKey, plugin] of this.plugins) {
            const { pluginId, tenantId: keyTenantId } = this.parsePluginKey(pluginKey);
            // 如果指定了租户ID，只检查该租户的插件
            if (tenantId && keyTenantId !== tenantId) {
                continue;
            }
            try {
                // 检查插件状态
                const status = await this.getPluginStatus(pluginId, keyTenantId);
                if (status !== types_1.PluginStatus.ACTIVE) {
                    results[pluginId] = false;
                    continue;
                }
                // 如果插件有健康检查方法，调用它
                if (plugin.implementation && typeof plugin.implementation.healthCheck === 'function') {
                    results[pluginId] = await plugin.implementation.healthCheck();
                }
                else {
                    results[pluginId] = true;
                }
            }
            catch (error) {
                this.app.log.error(`Health check failed for plugin ${pluginId}:`, error);
                results[pluginId] = false;
            }
        }
        return results;
    }
    /**
     * 清理模块缓存
     */
    clearModuleCache(pluginKey) {
        try {
            const { pluginId } = this.parsePluginKey(pluginKey);
            // 清理 Node.js 模块缓存
            const possiblePaths = [
                `./official/${pluginId}`,
                `./community/${pluginId}`,
                `../../commercial/plugins/${pluginId}`
            ];
            for (const path of possiblePaths) {
                try {
                    const moduleId = require.resolve(path);
                    if (moduleId && require.cache[moduleId]) {
                        delete require.cache[moduleId];
                    }
                }
                catch (error) {
                    // 模块不存在，忽略
                }
            }
        }
        catch (error) {
            this.app.log.debug(`Failed to clear module cache for ${pluginKey}:`, error);
        }
    }
    /**
     * 检查插件健康状态
     */
    async checkPluginHealth(pluginId, tenantId) {
        try {
            const plugin = await this.getPlugin(pluginId, tenantId);
            if (!plugin) {
                console.log(`[DEBUG] Plugin ${pluginId} not found`);
                return {
                    isHealthy: false,
                    status: 'NOT_FOUND',
                    lastCheck: new Date(),
                    errors: ['Plugin not found']
                };
            }
            // 检查插件是否正常运行
            const isActive = plugin.status === types_1.PluginStatus.ACTIVE;
            const hasImplementation = plugin.implementation !== undefined;
            console.log(`[DEBUG] Plugin ${pluginId} health check:`, {
                status: plugin.status,
                isActive,
                hasImplementation,
                implementationType: typeof plugin.implementation,
                implementationConstructor: plugin.implementation?.constructor?.name
            });
            return {
                isHealthy: isActive && hasImplementation,
                status: plugin.status,
                lastCheck: new Date(),
                errors: isActive && hasImplementation ? undefined : ['Plugin not properly initialized']
            };
        }
        catch (error) {
            console.log(`[DEBUG] Plugin ${pluginId} health check error:`, error);
            return {
                isHealthy: false,
                status: 'ERROR',
                lastCheck: new Date(),
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
}
exports.UnifiedPluginManagerImpl = UnifiedPluginManagerImpl;
// 延迟初始化的统一插件管理器实例
let _unifiedPluginManager = null;
function createUnifiedPluginManager(app, prisma) {
    if (!_unifiedPluginManager) {
        _unifiedPluginManager = new UnifiedPluginManagerImpl(app, prisma);
    }
    return _unifiedPluginManager;
}
function getUnifiedPluginManager() {
    if (!_unifiedPluginManager) {
        throw new Error('Unified plugin manager not initialized. Call createUnifiedPluginManager first.');
    }
    return _unifiedPluginManager;
}
// 为了向后兼容，提供一个 getter
exports.unifiedPluginManager = {
    get instance() {
        return getUnifiedPluginManager();
    },
    initialize: async function () {
        return this.instance.initialize();
    },
    getActivePlugins: function () {
        return this.instance.getActivePlugins();
    },
    on: function (event, listener) {
        return this.instance.on(event, listener);
    }
};
//# sourceMappingURL=unified-manager.js.map