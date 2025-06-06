import { LoggerService } from '@/utils/logger';

export interface LicenseValidation {
  isValid: boolean;
  pluginId?: string;
  expiresAt?: Date;
  features?: string[];
  error?: string;
}

export interface LicenseInfo {
  id: string;
  pluginId: string;
  userId: string;
  type: 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'expired' | 'suspended';
  issuedAt: Date;
  expiresAt?: Date;
  features: string[];
  metadata?: Record<string, any>;
}

/**
 * License Service for managing plugin licenses
 * This is a simplified implementation for demonstration
 */
export class LicenseService {
  private static licenses: Map<string, LicenseInfo> = new Map();

  /**
   * Initialize license service with some test licenses
   */
  static initialize() {
    // Add some test licenses for demonstration
    const testLicenses: LicenseInfo[] = [
      {
        id: 'stripe-license-123',
        pluginId: 'stripe-payment-plugin',
        userId: 'test-user',
        type: 'basic',
        status: 'active',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        features: ['payments', 'refunds', 'webhooks'],
      },
      {
        id: 'paypal-license-456',
        pluginId: 'paypal-payment-plugin',
        userId: 'test-user',
        type: 'basic',
        status: 'active',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        features: ['payments', 'refunds'],
      },
      {
        id: 'wechat-license-789',
        pluginId: 'wechat-payment-plugin',
        userId: 'test-user',
        type: 'premium',
        status: 'active',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        features: ['payments', 'refunds', 'webhooks', 'analytics'],
      },
    ];

    testLicenses.forEach(license => {
      this.licenses.set(license.id, license);
    });

    LoggerService.logInfo('License service initialized with test licenses');
  }

  /**
   * Validate a license key
   */
  static async validateLicense(licenseKey: string): Promise<LicenseValidation> {
    try {
      const license = this.licenses.get(licenseKey);
      
      if (!license) {
        return {
          isValid: false,
          error: 'License not found'
        };
      }

      // Check if license is active
      if (license.status !== 'active') {
        return {
          isValid: false,
          error: `License is ${license.status}`
        };
      }

      // Check if license is expired
      if (license.expiresAt && license.expiresAt < new Date()) {
        return {
          isValid: false,
          error: 'License has expired'
        };
      }

      return {
        isValid: true,
        pluginId: license.pluginId,
        expiresAt: license.expiresAt,
        features: license.features
      };

    } catch (error) {
      LoggerService.logError('License validation failed', error);
      return {
        isValid: false,
        error: 'License validation error'
      };
    }
  }

  /**
   * Generate a new license (simplified implementation)
   */
  static async generateLicense(
    pluginId: string,
    userId: string,
    type: 'basic' | 'premium' | 'enterprise',
    durationDays: number = 365
  ): Promise<string> {
    const licenseId = `${pluginId}-${userId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const features = this.getFeaturesForLicenseType(type);

    const license: LicenseInfo = {
      id: licenseId,
      pluginId,
      userId,
      type,
      status: 'active',
      issuedAt: new Date(),
      expiresAt,
      features,
    };

    this.licenses.set(licenseId, license);

    LoggerService.logInfo(`Generated license ${licenseId} for plugin ${pluginId}`);

    return licenseId;
  }

  /**
   * Revoke a license
   */
  static async revokeLicense(licenseKey: string): Promise<boolean> {
    const license = this.licenses.get(licenseKey);
    
    if (!license) {
      return false;
    }

    license.status = 'suspended';
    this.licenses.set(licenseKey, license);

    LoggerService.logInfo(`License ${licenseKey} revoked`);

    return true;
  }

  /**
   * Get license information
   */
  static async getLicenseInfo(licenseKey: string): Promise<LicenseInfo | null> {
    return this.licenses.get(licenseKey) || null;
  }

  /**
   * Get all licenses for a user
   */
  static async getUserLicenses(userId: string): Promise<LicenseInfo[]> {
    return Array.from(this.licenses.values()).filter(license => license.userId === userId);
  }

  /**
   * Get all licenses for a plugin
   */
  static async getPluginLicenses(pluginId: string): Promise<LicenseInfo[]> {
    return Array.from(this.licenses.values()).filter(license => license.pluginId === pluginId);
  }

  /**
   * Check if user has valid license for plugin
   */
  static async hasValidLicense(userId: string, pluginId: string): Promise<boolean> {
    const userLicenses = await this.getUserLicenses(userId);
    const pluginLicense = userLicenses.find(license => 
      license.pluginId === pluginId && 
      license.status === 'active' &&
      (!license.expiresAt || license.expiresAt > new Date())
    );

    return !!pluginLicense;
  }

  /**
   * Get features for license type
   */
  private static getFeaturesForLicenseType(type: 'basic' | 'premium' | 'enterprise'): string[] {
    const featureMap = {
      basic: ['payments', 'refunds'],
      premium: ['payments', 'refunds', 'webhooks', 'analytics'],
      enterprise: ['payments', 'refunds', 'webhooks', 'analytics', 'custom_integration', 'priority_support']
    };

    return featureMap[type] || [];
  }

  /**
   * Validate license for specific feature
   */
  static async validateFeature(licenseKey: string, feature: string): Promise<boolean> {
    const validation = await this.validateLicense(licenseKey);
    
    if (!validation.isValid || !validation.features) {
      return false;
    }

    return validation.features.includes(feature);
  }

  /**
   * Get license statistics
   */
  static getLicenseStats() {
    const licenses = Array.from(this.licenses.values());
    
    return {
      total: licenses.length,
      active: licenses.filter(l => l.status === 'active').length,
      expired: licenses.filter(l => l.expiresAt && l.expiresAt < new Date()).length,
      suspended: licenses.filter(l => l.status === 'suspended').length,
      byType: {
        basic: licenses.filter(l => l.type === 'basic').length,
        premium: licenses.filter(l => l.type === 'premium').length,
        enterprise: licenses.filter(l => l.type === 'enterprise').length,
      },
      byPlugin: licenses.reduce((acc, license) => {
        acc[license.pluginId] = (acc[license.pluginId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Cleanup expired licenses
   */
  static async cleanupExpiredLicenses(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, license] of this.licenses.entries()) {
      if (license.expiresAt && license.expiresAt < now && license.status === 'active') {
        license.status = 'expired';
        this.licenses.set(key, license);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      LoggerService.logInfo(`Cleaned up ${cleanedCount} expired licenses`);
    }

    return cleanedCount;
  }
}

// Initialize the license service
LicenseService.initialize();
