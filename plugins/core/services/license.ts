/**
 * License Service - Open Source Edition
 * Handles license validation for commercial plugins.
 */

import { LicenseInfo, LicenseValidationResult, PluginLicense } from '../types';

export interface LicenseServiceOptions {
  apiUrl?: string;
  cacheTimeout?: number;
}

export class LicenseService {
  private apiUrl: string;
  private cacheTimeout: number;
  private licenseCache: Map<string, { info: LicenseInfo; expires: Date }>;

  constructor(options: LicenseServiceOptions = {}) {
    this.apiUrl = options.apiUrl || 'https://api.jiffoo.com/licenses';
    this.cacheTimeout = options.cacheTimeout || 3600000;
    this.licenseCache = new Map();
  }

  async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
    const cached = this.licenseCache.get(licenseKey);
    if (cached && cached.expires > new Date()) {
      return { valid: cached.info.valid, license: cached.info };
    }

    try {
      if (!this.isValidLicenseFormat(licenseKey)) {
        return { valid: false, error: 'Invalid license key format' };
      }

      const licenseInfo: LicenseInfo = {
        key: licenseKey,
        type: 'opensource',
        valid: true,
        features: ['basic-plugins', 'community-support']
      };

      this.licenseCache.set(licenseKey, {
        info: licenseInfo,
        expires: new Date(Date.now() + this.cacheTimeout)
      });

      return { valid: true, license: licenseInfo };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'License validation failed'
      };
    }
  }

  async hasFeature(licenseKey: string, feature: string): Promise<boolean> {
    const result = await this.validateLicense(licenseKey);
    if (!result.valid || !result.license) return false;
    return result.license.features.includes(feature);
  }

  async getLicenseType(licenseKey: string): Promise<PluginLicense | null> {
    const result = await this.validateLicense(licenseKey);
    if (!result.valid || !result.license) return null;
    return result.license.type;
  }

  async isExpired(licenseKey: string): Promise<boolean> {
    const result = await this.validateLicense(licenseKey);
    if (!result.valid || !result.license) return true;
    if (!result.license.expiresAt) return false;
    return new Date() > result.license.expiresAt;
  }

  clearCache(): void {
    this.licenseCache.clear();
  }

  private isValidLicenseFormat(licenseKey: string): boolean {
    const pattern = /^JIFFOO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(licenseKey);
  }

  generateTrialLicense(): LicenseInfo {
    const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return {
      key: 'JIFFOO-TRIAL-' + seg() + '-' + seg() + '-' + seg(),
      type: 'opensource',
      valid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      features: ['basic-plugins', 'trial']
    };
  }
}

export default LicenseService;
