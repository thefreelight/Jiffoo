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

export class LicenseValidator {
  private static readonly LICENSE_SERVER_URL = process.env.JIFFOO_LICENSE_SERVER || 'https://api.jiffoo.com';
  private static readonly DEMO_FEATURES = ['basic_auth', 'limited_usage'];
  
  /**
   * Validate a plugin license
   */
  static async validateLicense(
    pluginId: string, 
    licenseKey?: string, 
    domain?: string
  ): Promise<LicenseValidationResult> {
    // If no license key provided, return demo version
    if (!licenseKey) {
      return this.getDemoLicense(pluginId);
    }

    try {
      // In production, this would call the license server
      const response = await this.callLicenseServer(pluginId, licenseKey, domain);
      return response;
    } catch (error) {
      console.error('License validation failed:', error);
      
      // Fallback to demo version if license server is unreachable
      return this.getDemoLicense(pluginId);
    }
  }

  /**
   * Get demo license for open source version
   */
  private static getDemoLicense(pluginId: string): LicenseValidationResult {
    return {
      isValid: true,
      isDemo: true,
      plan: 'demo',
      features: this.DEMO_FEATURES,
      usageLimit: this.getDemoUsageLimit(pluginId),
      currentUsage: 0,
      message: 'Demo version with limited functionality',
      upgradeUrl: `https://jiffoo.com/plugins/${pluginId}`
    };
  }

  /**
   * Get usage limits for demo versions
   */
  private static getDemoUsageLimit(pluginId: string): number {
    const limits: Record<string, number> = {
      'wechat': 10,      // 10 authentications per month
      'google': 100,     // 100 authentications per month
      'alipay': 5,       // 5 transactions per month
      'stripe': 20,      // 20 transactions per month
      'email-marketing': 50, // 50 emails per month
    };
    
    return limits[pluginId] || 10;
  }

  /**
   * Call license server for validation (production implementation)
   */
  private static async callLicenseServer(
    pluginId: string, 
    licenseKey: string, 
    domain?: string
  ): Promise<LicenseValidationResult> {
    // This would be the actual implementation for production
    const requestBody = {
      pluginId,
      licenseKey,
      domain: domain || this.getCurrentDomain(),
      version: process.env.JIFFOO_VERSION || '1.0.0'
    };

    const response = await fetch(`${this.LICENSE_SERVER_URL}/license/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Jiffoo-Mall/${process.env.JIFFOO_VERSION || '1.0.0'}`
      },
      body: JSON.stringify(requestBody),
      timeout: 5000 // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`License server responded with ${response.status}`);
    }

    const data = await response.json();
    
    return {
      isValid: data.valid,
      isDemo: false,
      plan: data.plan,
      features: data.features || [],
      usageLimit: data.usageLimit,
      currentUsage: data.currentUsage,
      message: data.message
    };
  }

  /**
   * Get current domain for license validation
   */
  private static getCurrentDomain(): string {
    // In production, this would get the actual domain
    return process.env.DOMAIN || 'localhost';
  }

  /**
   * Check if a feature is available in the current license
   */
  static hasFeature(licenseResult: LicenseValidationResult, feature: string): boolean {
    return licenseResult.features.includes(feature);
  }

  /**
   * Check if usage limit is exceeded
   */
  static isUsageLimitExceeded(licenseResult: LicenseValidationResult): boolean {
    if (!licenseResult.usageLimit) {
      return false;
    }
    
    return (licenseResult.currentUsage || 0) >= licenseResult.usageLimit;
  }

  /**
   * Increment usage counter (for demo tracking)
   */
  static async incrementUsage(pluginId: string, licenseKey?: string): Promise<void> {
    if (!licenseKey) {
      // For demo version, we could track usage in local storage or database
      console.log(`📊 Demo usage incremented for ${pluginId}`);
      return;
    }

    try {
      // In production, report usage to license server
      await fetch(`${this.LICENSE_SERVER_URL}/license/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId,
          licenseKey,
          domain: this.getCurrentDomain(),
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to report usage:', error);
    }
  }

  /**
   * Get upgrade URL for a plugin
   */
  static getUpgradeUrl(pluginId: string, currentPlan: string = 'demo'): string {
    const baseUrl = 'https://jiffoo.com/plugins';
    return `${baseUrl}/${pluginId}?upgrade_from=${currentPlan}`;
  }

  /**
   * Generate license validation middleware for Express/Fastify
   */
  static createValidationMiddleware(pluginId: string) {
    return async (request: any, reply: any, next?: any) => {
      const licenseKey = request.headers['x-jiffoo-license'] || 
                        request.query.license ||
                        process.env[`JIFFOO_${pluginId.toUpperCase()}_LICENSE`];

      const domain = request.headers.host || request.hostname;
      
      const validation = await this.validateLicense(pluginId, licenseKey, domain);
      
      // Add license info to request
      request.jiffooLicense = validation;
      
      // Check usage limits for demo versions
      if (validation.isDemo && this.isUsageLimitExceeded(validation)) {
        return reply.status(429).send({
          error: 'Usage limit exceeded',
          message: `Demo version limited to ${validation.usageLimit} uses per month`,
          upgradeUrl: validation.upgradeUrl
        });
      }
      
      // Continue to next middleware
      if (next) next();
    };
  }
}

/**
 * Decorator for protecting commercial plugin methods
 */
export function RequiresLicense(feature?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const license = this.licenseInfo || await LicenseValidator.validateLicense(this.id);
      
      if (license.isDemo && feature && !LicenseValidator.hasFeature(license, feature)) {
        throw new Error(`Feature '${feature}' requires commercial license. Visit ${license.upgradeUrl}`);
      }
      
      if (LicenseValidator.isUsageLimitExceeded(license)) {
        throw new Error(`Usage limit exceeded. Visit ${license.upgradeUrl} to upgrade`);
      }
      
      // Increment usage for demo versions
      if (license.isDemo) {
        await LicenseValidator.incrementUsage(this.id);
      }
      
      return method.apply(this, args);
    };
  };
}

export default LicenseValidator;
