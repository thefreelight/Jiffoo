import { FastifyInstance } from 'fastify';
export declare enum PluginLicenseType {
    MIT = "MIT",
    COMMERCIAL = "COMMERCIAL",
    PREMIUM = "PREMIUM",
    ENTERPRISE = "ENTERPRISE"
}
export interface PluginLicense {
    type: PluginLicenseType;
    key?: string;
    validUntil?: Date;
    features?: string[];
    maxUsers?: number;
    domain?: string;
}
export declare enum PluginStatus {
    INSTALLED = "INSTALLED",
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    UNINSTALLED = "UNINSTALLED",
    ERROR = "ERROR"
}
export declare enum PluginType {
    PAYMENT = "payment",
    AUTH = "auth",
    NOTIFICATION = "notification",
    ANALYTICS = "analytics",
    SHIPPING = "shipping",
    TAX = "tax",
    MARKETING = "marketing",
    INVENTORY = "inventory",
    CUSTOM = "custom"
}
export interface PluginConfigSchema {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}
export interface PluginPermissions {
    api?: string[];
    database?: string[];
    files?: string[];
    network?: string[];
    system?: string[];
}
export interface PluginResourceLimits {
    memory?: number;
    cpu?: number;
    storage?: number;
    requests?: number;
}
export interface RouteDefinition {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    handler: string;
    prefix?: string;
    schema?: any;
    middleware?: string[];
    auth?: boolean;
    roles?: string[];
}
export interface EventDefinition {
    name: string;
    description?: string;
    schema?: any;
}
export interface HookDefinition {
    name: string;
    priority?: number;
    handler: string;
}
export interface UnifiedPluginMetadata {
    id: string;
    name: string;
    displayName: string;
    version: string;
    description?: string;
    longDescription?: string;
    author?: string;
    homepage?: string;
    repository?: string;
    keywords?: string[];
    category?: string;
    type: PluginType;
    dependencies?: string[];
    peerDependencies?: string[];
    conflicts?: string[];
    routes?: RouteDefinition[];
    events?: EventDefinition[];
    hooks?: HookDefinition[];
    permissions?: PluginPermissions;
    resources?: PluginResourceLimits;
    configSchema?: PluginConfigSchema;
    icon?: string;
    screenshots?: string[];
    minCoreVersion?: string;
    maxCoreVersion?: string;
    supportedPlatforms?: string[];
    license: PluginLicense;
    pricing?: {
        type: 'free' | 'freemium' | 'paid';
        plans?: Array<{
            name: string;
            price: number;
            currency: string;
            interval: 'month' | 'year' | 'lifetime';
            features: string[];
        }>;
    };
}
export interface PluginContext {
    app: FastifyInstance;
    config: any;
    logger: any;
    database: any;
    cache: any;
    events: any;
    tenantId?: string;
    userId?: string;
    pluginId: string;
    version: string;
    registerRouteHandler?: (handlerName: string, handler: Function) => void;
}
export interface PluginImplementation {
    initialize?(context: PluginContext): Promise<void>;
    destroy?(): Promise<void>;
    healthCheck?(): Promise<boolean>;
    validateConfig?(config: any): Promise<boolean>;
}
export interface PaymentPluginImplementation extends PluginImplementation {
    createPayment(request: any): Promise<any>;
    verifyPayment(paymentId: string): Promise<any>;
    cancelPayment(paymentId: string): Promise<boolean>;
    refund?(request: any): Promise<any>;
    getRefund?(refundId: string): Promise<any>;
    handleWebhook?(event: any): Promise<void>;
    verifyWebhook?(event: any): Promise<boolean>;
}
export interface AuthPluginImplementation extends PluginImplementation {
    generateAuthUrl(state: string): string;
    exchangeCodeForUser(code: string, state: string): Promise<any>;
    refreshUserToken?(refreshToken: string): Promise<any>;
    validateToken?(token: string): Promise<boolean>;
}
export interface NotificationPluginImplementation extends PluginImplementation {
    sendNotification(recipient: string, message: any): Promise<boolean>;
    sendBulkNotification?(recipients: string[], message: any): Promise<any>;
    getDeliveryStatus?(notificationId: string): Promise<any>;
}
export interface UnifiedPlugin {
    metadata: UnifiedPluginMetadata;
    install(context: PluginContext): Promise<void>;
    activate(context: PluginContext): Promise<void>;
    deactivate(context: PluginContext): Promise<void>;
    uninstall(context: PluginContext): Promise<void>;
    getConfigSchema(): PluginConfigSchema;
    validateConfig(config: any): Promise<boolean>;
    getDefaultConfig(): any;
    validateLicense?(licenseKey?: string): Promise<boolean>;
    healthCheck?(): Promise<boolean>;
    implementation: PluginImplementation;
}
export interface UnifiedPluginManager {
    installPlugin(pluginId: string, options?: InstallOptions): Promise<void>;
    activatePlugin(pluginId: string, tenantId?: string): Promise<void>;
    deactivatePlugin(pluginId: string, tenantId?: string): Promise<void>;
    uninstallPlugin(pluginId: string, tenantId?: string): Promise<void>;
    getPlugin(pluginId: string, tenantId?: string): Promise<UnifiedPlugin | null>;
    getPlugins(tenantId?: string): Promise<UnifiedPlugin[]>;
    getPluginsByType(type: PluginType, tenantId?: string): Promise<UnifiedPlugin[]>;
    getPluginStatus(pluginId: string, tenantId?: string): Promise<PluginStatus>;
    updatePluginConfig(pluginId: string, config: any, tenantId?: string): Promise<void>;
    getPluginConfig(pluginId: string, tenantId?: string): Promise<any>;
    validatePluginLicense(pluginId: string, licenseKey?: string): Promise<boolean>;
    healthCheckPlugin(pluginId: string, tenantId?: string): Promise<boolean>;
    healthCheckAll(tenantId?: string): Promise<Record<string, boolean>>;
}
export interface InstallOptions {
    tenantId?: string;
    config?: any;
    licenseKey?: string;
    autoActivate?: boolean;
    force?: boolean;
}
export interface PluginEvent {
    type: 'install' | 'activate' | 'deactivate' | 'uninstall' | 'error' | 'config_update';
    pluginId: string;
    tenantId?: string;
    timestamp: Date;
    data?: any;
    error?: Error;
}
//# sourceMappingURL=index.d.ts.map