/**
 * SaaS Application Marketplace Manager
 * Allows integration and selling of external SaaS applications
 */

import { prisma } from '@/config/database';
import { JwtUtils } from '@/utils/jwt';

export interface SaaSApplication {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  authorId: string; // Your user ID for your apps
  category: string;
  price: number; // Monthly price in cents
  currency: string;
  billingType: 'monthly' | 'yearly' | 'one-time' | 'usage-based';
  
  // Integration details
  apiEndpoint: string;
  webhookUrl?: string;
  ssoEnabled: boolean;
  dataSync: boolean;
  
  // App metadata
  logo: string;
  screenshots: string[];
  features: string[];
  requirements: string[];
  documentation: string;
  support: string;
  
  // Business info
  isActive: boolean;
  isApproved: boolean;
  totalInstalls: number;
  rating: number;
  reviewCount: number;
  
  // Revenue sharing
  revenueShare: number; // Percentage that goes to Jiffoo (e.g., 30)
  
  createdAt: Date;
  updatedAt: Date;
}

export interface SaaSInstallation {
  id: string;
  userId: string;
  appId: string;
  subscriptionId: string;
  status: 'active' | 'suspended' | 'cancelled';
  installedAt: Date;
  lastAccessedAt: Date;
  
  // SSO configuration
  ssoConfig?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  
  // Data sync configuration
  syncConfig?: {
    enabled: boolean;
    lastSyncAt: Date;
    syncFrequency: 'realtime' | 'hourly' | 'daily';
  };
}

export class SaaSAppManager {
  // Register a new SaaS application
  static async registerApp(appData: Partial<SaaSApplication>, authorId: string): Promise<SaaSApplication> {
    const app = await prisma.saaSApplication.create({
      data: {
        ...appData,
        authorId,
        isActive: false, // Requires approval
        isApproved: false,
        totalInstalls: 0,
        rating: 0,
        reviewCount: 0,
        revenueShare: 30, // Default 30% to Jiffoo
      } as any
    });

    return app as SaaSApplication;
  }

  // Install SaaS app for a user
  static async installApp(userId: string, appId: string): Promise<SaaSInstallation> {
    const app = await prisma.saaSApplication.findUnique({
      where: { id: appId }
    });

    if (!app || !app.isActive || !app.isApproved) {
      throw new Error('Application not available for installation');
    }

    // Check if already installed
    const existing = await prisma.saaSInstallation.findFirst({
      where: { userId, appId }
    });

    if (existing) {
      throw new Error('Application already installed');
    }

    // Create subscription (this would integrate with payment system)
    const subscription = await this.createSubscription(userId, app);

    // Generate SSO credentials if needed
    const ssoConfig = app.ssoEnabled ? await this.generateSSOConfig(appId, userId) : undefined;

    const installation = await prisma.saaSInstallation.create({
      data: {
        userId,
        appId,
        subscriptionId: subscription.id,
        status: 'active',
        installedAt: new Date(),
        lastAccessedAt: new Date(),
        ssoConfig,
        syncConfig: app.dataSync ? {
          enabled: true,
          lastSyncAt: new Date(),
          syncFrequency: 'daily',
        } : undefined,
      }
    });

    // Update install count
    await prisma.saaSApplication.update({
      where: { id: appId },
      data: { totalInstalls: { increment: 1 } }
    });

    // Notify the SaaS app about new installation
    await this.notifyAppInstallation(app, installation);

    return installation as SaaSInstallation;
  }

  // Generate SSO token for accessing SaaS app
  static async generateSSOToken(userId: string, appId: string): Promise<string> {
    const installation = await prisma.saaSInstallation.findFirst({
      where: { userId, appId, status: 'active' },
      include: { app: true, user: true }
    });

    if (!installation) {
      throw new Error('Application not installed or not active');
    }

    // Update last accessed
    await prisma.saaSInstallation.update({
      where: { id: installation.id },
      data: { lastAccessedAt: new Date() }
    });

    // Generate SSO token with app-specific claims
    const ssoToken = JwtUtils.sign({
      userId: installation.user.id,
      email: installation.user.email,
      role: installation.user.role,
      appId: installation.app.id,
      installationId: installation.id,
      type: 'sso_token',
      iss: 'jiffoo-mall',
      aud: installation.app.apiEndpoint,
    });

    return ssoToken;
  }

  // Handle data sync between Jiffoo and SaaS app
  static async syncData(installationId: string, direction: 'to_app' | 'from_app', data: any): Promise<void> {
    const installation = await prisma.saaSInstallation.findUnique({
      where: { id: installationId },
      include: { app: true, user: true }
    });

    if (!installation || !installation.syncConfig?.enabled) {
      throw new Error('Data sync not enabled for this installation');
    }

    try {
      if (direction === 'to_app') {
        // Send data to SaaS app
        await this.sendDataToApp(installation.app, data);
      } else {
        // Receive data from SaaS app
        await this.receiveDataFromApp(installation.app, data);
      }

      // Update sync timestamp
      await prisma.saaSInstallation.update({
        where: { id: installationId },
        data: {
          syncConfig: {
            ...installation.syncConfig,
            lastSyncAt: new Date(),
          }
        }
      });
    } catch (error) {
      console.error('Data sync failed:', error);
      throw error;
    }
  }

  // Get user's installed apps
  static async getUserApps(userId: string): Promise<SaaSInstallation[]> {
    return prisma.saaSInstallation.findMany({
      where: { userId },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            description: true,
            logo: true,
            category: true,
            version: true,
          }
        }
      }
    }) as Promise<SaaSInstallation[]>;
  }

  // Get marketplace apps
  static async getMarketplaceApps(category?: string, search?: string): Promise<SaaSApplication[]> {
    const where: any = {
      isActive: true,
      isApproved: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.saaSApplication.findMany({
      where,
      orderBy: [
        { rating: 'desc' },
        { totalInstalls: 'desc' },
      ]
    }) as Promise<SaaSApplication[]>;
  }

  // Calculate revenue for app owner
  static async calculateRevenue(appId: string, period: 'month' | 'year'): Promise<{
    totalRevenue: number;
    jiffooShare: number;
    authorShare: number;
    subscriptions: number;
  }> {
    const app = await prisma.saaSApplication.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error('App not found');
    }

    // This would integrate with the payment system
    // For now, return mock data
    const totalRevenue = app.totalInstalls * app.price;
    const jiffooShare = totalRevenue * (app.revenueShare / 100);
    const authorShare = totalRevenue - jiffooShare;

    return {
      totalRevenue,
      jiffooShare,
      authorShare,
      subscriptions: app.totalInstalls,
    };
  }

  // Private helper methods
  private static async createSubscription(userId: string, app: SaaSApplication) {
    // This would integrate with the payment system
    // For now, return mock subscription
    return {
      id: `sub_${Date.now()}`,
      userId,
      appId: app.id,
      status: 'active',
      amount: app.price,
      currency: app.currency,
      billingType: app.billingType,
    };
  }

  private static async generateSSOConfig(appId: string, userId: string) {
    return {
      clientId: `jiffoo_${appId}_${userId}`,
      clientSecret: `secret_${Date.now()}`,
      redirectUri: `/apps/${appId}/callback`,
    };
  }

  private static async notifyAppInstallation(app: SaaSApplication, installation: SaaSInstallation) {
    if (app.webhookUrl) {
      try {
        await fetch(app.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Jiffoo-Event': 'app.installed',
          },
          body: JSON.stringify({
            event: 'app.installed',
            app_id: app.id,
            installation_id: installation.id,
            user_id: installation.userId,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error('Failed to notify app installation:', error);
      }
    }
  }

  private static async sendDataToApp(app: SaaSApplication, data: any) {
    // Send data to external SaaS app
    await fetch(`${app.apiEndpoint}/sync/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAppApiKey(app.id)}`,
      },
      body: JSON.stringify(data),
    });
  }

  private static async receiveDataFromApp(app: SaaSApplication, data: any) {
    // Process data received from external SaaS app
    // This would update Jiffoo's database with synced data
    console.log('Received data from app:', app.name, data);
  }

  private static async getAppApiKey(appId: string): Promise<string> {
    // Generate or retrieve API key for app communication
    return `api_key_${appId}`;
  }
}
