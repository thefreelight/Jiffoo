/**
 * Jiffoo Mall License Validation System
 *
 * This system validates commercial plugin licenses and enforces usage limits.
 * Open source version includes the framework but requires commercial licenses for full functionality.
 */
export interface LicenseInfo {
    pluginId: string;
    licenseKey: string;
    domain: string;
    plan: 'demo' | 'starter' | 'professional' | 'enterprise';
    expiresAt: Date;
    features: string[];
    usageLimit?: number;
    currentUsage?: number;
}
export interface LicenseValidationResult {
    isValid: boolean;
    isDemo: boolean;
    plan: string;
    features: string[];
    usageLimit?: number;
    currentUsage?: number;
    message?: string;
    upgradeUrl?: string;
}
export declare class LicenseValidator {
    private static readonly LICENSE_SERVER_URL;
    private static readonly DEMO_FEATURES;
    /**
     * Validate a plugin license
     */
    static validateLicense(pluginId: string, licenseKey?: string, domain?: string): Promise<LicenseValidationResult>;
    /**
     * Get demo license for open source version
     */
    private static getDemoLicense;
    /**
     * Get usage limits for demo versions
     */
    private static getDemoUsageLimit;
    /**
     * Call license server for validation (production implementation)
     */
    private static callLicenseServer;
    /**
     * Get current domain for license validation
     */
    private static getCurrentDomain;
    /**
     * Check if a feature is available in the current license
     */
    static hasFeature(licenseResult: LicenseValidationResult, feature: string): boolean;
    /**
     * Check if usage limit is exceeded
     */
    static isUsageLimitExceeded(licenseResult: LicenseValidationResult): boolean;
    /**
     * Increment usage counter (for demo tracking)
     */
    static incrementUsage(pluginId: string, licenseKey?: string): Promise<void>;
    /**
     * Get upgrade URL for a plugin
     */
    static getUpgradeUrl(pluginId: string, currentPlan?: string): string;
    /**
     * Generate license validation middleware for Express/Fastify
     */
    static createValidationMiddleware(pluginId: string): (request: any, reply: any, next?: any) => Promise<any>;
}
/**
 * Decorator for protecting commercial plugin methods
 */
export declare function RequiresLicense(feature?: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => void;
export default LicenseValidator;
//# sourceMappingURL=validator.d.ts.map