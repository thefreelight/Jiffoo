import { PluginLicense } from '../types';
export interface LicenseValidationResult {
    valid: boolean;
    reason?: string;
    features?: string[];
    expiresAt?: Date;
}
export declare class PluginLicenseService {
    private readonly publicKey;
    private readonly licenseServerUrl;
    constructor();
    /**
     * 验证插件许可证
     */
    validateLicense(pluginName: string, license: PluginLicense): Promise<LicenseValidationResult>;
    /**
     * 验证许可证签名
     */
    private verifyLicenseSignature;
    /**
     * 在线验证许可证
     */
    private validateOnline;
    /**
     * 获取当前域名
     */
    private getCurrentDomain;
    /**
     * 生成试用许可证
     */
    generateTrialLicense(pluginName: string, durationDays?: number): PluginLicense;
    /**
     * 检查功能权限
     */
    hasFeature(license: PluginLicense, feature: string): boolean;
}
export declare const licenseService: PluginLicenseService;
//# sourceMappingURL=license.d.ts.map