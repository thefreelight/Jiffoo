/**
 * Jiffoo Mall License Server
 * 
 * This service handles license validation, usage tracking, and subscription management
 * for commercial plugins and SaaS services.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface License {
  id: string;
  pluginId: string;
  customerId: string;
  licenseKey: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'expired' | 'cancelled';
  domains: string[];
  features: string[];
  usageLimit?: number;
  currentUsage: number;
  createdAt: Date;
  expiresAt: Date;
  lastValidated?: Date;
  metadata?: Record<string, any>;
}

export interface LicenseValidationRequest {
  pluginId: string;
  licenseKey: string;
  domain: string;
  version: string;
  instanceId?: string;
}

export interface LicenseValidationResponse {
  valid: boolean;
  license?: License;
  features: string[];
  usageLimit?: number;
  currentUsage: number;
  message?: string;
  nextValidation?: Date;
}

export interface UsageReport {
  pluginId: string;
  licenseKey: string;
  domain: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class LicenseServer {
  private static readonly JWT_SECRET = process.env.LICENSE_JWT_SECRET || 'license-secret';
  private static readonly VALIDATION_CACHE_TTL = 3600; // 1 hour
  
  // In production, this would be a database
  private static licenses: Map<string, License> = new Map();
  private static usageReports: UsageReport[] = [];

  /**
   * Generate a new license for a plugin
   */
  static async generateLicense(
    pluginId: string,
    customerId: string,
    plan: License['plan'],
    domains: string[],
    features: string[],
    expiresAt: Date,
    usageLimit?: number
  ): Promise<License> {
    const licenseKey = this.generateLicenseKey(pluginId, customerId);
    
    const license: License = {
      id: crypto.randomUUID(),
      pluginId,
      customerId,
      licenseKey,
      plan,
      status: 'active',
      domains,
      features,
      usageLimit,
      currentUsage: 0,
      createdAt: new Date(),
      expiresAt,
      metadata: {}
    };

    this.licenses.set(licenseKey, license);
    
    console.log(`✅ Generated license for ${pluginId}: ${licenseKey}`);
    return license;
  }

  /**
   * Validate a license
   */
  static async validateLicense(
    request: LicenseValidationRequest
  ): Promise<LicenseValidationResponse> {
    const { pluginId, licenseKey, domain, version } = request;

    try {
      // Get license from storage
      const license = this.licenses.get(licenseKey);
      
      if (!license) {
        return {
          valid: false,
          features: [],
          currentUsage: 0,
          message: 'License not found'
        };
      }

      // Check if license is for the correct plugin
      if (license.pluginId !== pluginId) {
        return {
          valid: false,
          features: [],
          currentUsage: 0,
          message: 'License not valid for this plugin'
        };
      }

      // Check license status
      if (license.status !== 'active') {
        return {
          valid: false,
          features: [],
          currentUsage: 0,
          message: `License is ${license.status}`
        };
      }

      // Check expiration
      if (license.expiresAt < new Date()) {
        license.status = 'expired';
        return {
          valid: false,
          features: [],
          currentUsage: 0,
          message: 'License has expired'
        };
      }

      // Check domain restrictions
      if (license.domains.length > 0 && !this.isDomainAllowed(domain, license.domains)) {
        return {
          valid: false,
          features: [],
          currentUsage: 0,
          message: 'Domain not authorized for this license'
        };
      }

      // Check usage limits
      if (license.usageLimit && license.currentUsage >= license.usageLimit) {
        return {
          valid: false,
          features: license.features,
          currentUsage: license.currentUsage,
          usageLimit: license.usageLimit,
          message: 'Usage limit exceeded'
        };
      }

      // Update last validated timestamp
      license.lastValidated = new Date();

      // Calculate next validation time
      const nextValidation = new Date();
      nextValidation.setSeconds(nextValidation.getSeconds() + this.VALIDATION_CACHE_TTL);

      return {
        valid: true,
        license,
        features: license.features,
        usageLimit: license.usageLimit,
        currentUsage: license.currentUsage,
        nextValidation
      };

    } catch (error) {
      console.error('License validation error:', error);
      return {
        valid: false,
        features: [],
        currentUsage: 0,
        message: 'License validation failed'
      };
    }
  }

  /**
   * Report usage for a license
   */
  static async reportUsage(
    pluginId: string,
    licenseKey: string,
    domain: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const license = this.licenses.get(licenseKey);
    
    if (!license) {
      throw new Error('License not found');
    }

    // Increment usage counter
    license.currentUsage += 1;

    // Record usage report
    const report: UsageReport = {
      pluginId,
      licenseKey,
      domain,
      action,
      timestamp: new Date(),
      metadata
    };

    this.usageReports.push(report);

    console.log(`📊 Usage reported for ${pluginId}: ${action} (${license.currentUsage}/${license.usageLimit || '∞'})`);
  }

  /**
   * Get usage statistics for a license
   */
  static async getUsageStats(licenseKey: string): Promise<{
    totalUsage: number;
    dailyUsage: number;
    monthlyUsage: number;
    recentActions: UsageReport[];
  }> {
    const license = this.licenses.get(licenseKey);
    
    if (!license) {
      throw new Error('License not found');
    }

    const reports = this.usageReports.filter(r => r.licenseKey === licenseKey);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyUsage = reports.filter(r => r.timestamp >= today).length;
    const monthlyUsage = reports.filter(r => r.timestamp >= thisMonth).length;
    const recentActions = reports.slice(-10); // Last 10 actions

    return {
      totalUsage: license.currentUsage,
      dailyUsage,
      monthlyUsage,
      recentActions
    };
  }

  /**
   * Generate a license key
   */
  private static generateLicenseKey(pluginId: string, customerId: string): string {
    const payload = {
      pluginId,
      customerId,
      timestamp: Date.now(),
      random: crypto.randomBytes(8).toString('hex')
    };

    // Create a JWT token as license key
    const token = jwt.sign(payload, this.JWT_SECRET, { 
      algorithm: 'HS256',
      noTimestamp: true 
    });

    // Format as a more readable license key
    const parts = token.split('.');
    const formatted = `${pluginId.toUpperCase()}-${parts[1].substring(0, 8)}-${parts[2].substring(0, 8)}`;
    
    return formatted;
  }

  /**
   * Check if domain is allowed for license
   */
  private static isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
    // Remove port from domain
    const cleanDomain = domain.split(':')[0];
    
    return allowedDomains.some(allowed => {
      // Exact match
      if (allowed === cleanDomain) return true;
      
      // Wildcard subdomain match
      if (allowed.startsWith('*.')) {
        const baseDomain = allowed.substring(2);
        return cleanDomain.endsWith(baseDomain);
      }
      
      // Localhost variations
      if (allowed === 'localhost' && ['localhost', '127.0.0.1', '::1'].includes(cleanDomain)) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Initialize demo licenses for development
   */
  static async initializeDemoLicenses(): Promise<void> {
    console.log('🚀 Initializing demo licenses...');

    // Demo WeChat Pay Pro license
    await this.generateLicense(
      'wechat-pay-pro',
      'demo-customer-1',
      'professional',
      ['localhost', '*.example.com'],
      ['unlimited_transactions', 'auto_reconciliation', 'refund_processing', 'webhooks'],
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      undefined // unlimited usage
    );

    // Demo Enterprise Auth license
    await this.generateLicense(
      'enterprise-auth',
      'demo-customer-2',
      'enterprise',
      ['localhost', '*.company.com'],
      ['saml', 'ldap', 'sso', 'mfa', 'audit_logs'],
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      undefined // unlimited usage
    );

    // Demo Email Marketing license (with usage limit)
    await this.generateLicense(
      'email-marketing-pro',
      'demo-customer-3',
      'starter',
      ['localhost'],
      ['campaigns', 'templates', 'basic_analytics'],
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      1000 // 1000 emails per month
    );

    console.log('✅ Demo licenses initialized');
    console.log('📋 Available licenses:');
    this.licenses.forEach((license, key) => {
      console.log(`  - ${license.pluginId}: ${key} (${license.plan})`);
    });
  }

  /**
   * Get all licenses (for admin purposes)
   */
  static async getAllLicenses(): Promise<License[]> {
    return Array.from(this.licenses.values());
  }

  /**
   * Revoke a license
   */
  static async revokeLicense(licenseKey: string): Promise<void> {
    const license = this.licenses.get(licenseKey);
    
    if (license) {
      license.status = 'cancelled';
      console.log(`🚫 License revoked: ${licenseKey}`);
    }
  }

  /**
   * Extend license expiration
   */
  static async extendLicense(licenseKey: string, additionalDays: number): Promise<void> {
    const license = this.licenses.get(licenseKey);
    
    if (license) {
      license.expiresAt = new Date(license.expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);
      console.log(`📅 License extended: ${licenseKey} until ${license.expiresAt.toISOString()}`);
    }
  }
}

// Initialize demo licenses on module load
LicenseServer.initializeDemoLicenses().catch(console.error);
