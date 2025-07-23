/**
 * Stripe 官方支付插件
 *
 * 基于统一插件架构的 Stripe 支付集成
 * 整合了原有的 StripePaymentProvider 功能
 */
import { UnifiedPlugin, UnifiedPluginMetadata, PluginContext, PluginConfigSchema, PaymentPluginImplementation } from '../../../core/types';
declare const metadata: UnifiedPluginMetadata;
declare const configSchema: PluginConfigSchema;
declare class StripePaymentImplementation implements PaymentPluginImplementation {
    private provider;
    private context;
    private initialized;
    constructor(context: PluginContext);
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    healthCheck(): Promise<boolean>;
    validateConfig(config: any): Promise<boolean>;
    createPaymentIntent(request: any): Promise<any>;
    confirmPayment(request: any): Promise<any>;
    verifyPayment(request: any): Promise<any>;
    processRefund(request: any): Promise<any>;
    handleWebhook(request: any): Promise<any>;
}
declare class StripeOfficialPlugin implements UnifiedPlugin {
    metadata: UnifiedPluginMetadata;
    configSchema: PluginConfigSchema;
    implementation?: StripePaymentImplementation;
    install(context: PluginContext): Promise<void>;
    onInstall(context: PluginContext): Promise<void>;
    uninstall(context: PluginContext): Promise<void>;
    onUninstall(context: PluginContext): Promise<void>;
    activate(context: PluginContext): Promise<void>;
    onActivate(context: PluginContext): Promise<void>;
    deactivate(context: PluginContext): Promise<void>;
    onDeactivate(context: PluginContext): Promise<void>;
    getConfigSchema(): PluginConfigSchema;
    onConfigUpdate(context: PluginContext, newConfig: any): Promise<void>;
    healthCheck(context: PluginContext): Promise<{
        healthy: boolean;
        details?: any;
    }>;
}
declare const stripePlugin: StripeOfficialPlugin;
export default stripePlugin;
export { metadata, configSchema };
export declare const stripePaymentPlugin: {
    metadata: UnifiedPluginMetadata;
    configSchema: PluginConfigSchema;
    plugin: StripeOfficialPlugin;
};
//# sourceMappingURL=index.d.ts.map