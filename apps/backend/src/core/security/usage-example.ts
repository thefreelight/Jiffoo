/**
 * 安全服务器配置使用示例
 * 展示如何在各个模块中安全地使用加密的服务器地址
 */

import { getSecureServerUrl, SERVER_TYPES, validateServerConnectivity } from './server-config';

// 示例1：许可证验证服务
export class LicenseService {
  private licenseServerUrl: string;

  constructor() {
    // 安全获取许可证服务器地址
    this.licenseServerUrl = getSecureServerUrl(SERVER_TYPES.LICENSE);
  }

  async validateLicense(licenseKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.licenseServerUrl}validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo-Commercial/1.0.0',
          'X-Client-Type': 'commercial'
        },
        body: JSON.stringify({ 
          license: licenseKey,
          product: 'jiffoo-mall',
          version: process.env.APP_VERSION || '1.0.0'
        })
      });

      if (!response.ok) {
        throw new Error(`License validation failed: ${response.status}`);
      }

      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error('License validation error:', error);
      return false;
    }
  }

  async getLicenseInfo(licenseKey: string): Promise<any> {
    try {
      const response = await fetch(`${this.licenseServerUrl}info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${licenseKey}`
        },
        body: JSON.stringify({ license: licenseKey })
      });

      return await response.json();
    } catch (error) {
      console.error('Get license info error:', error);
      return null;
    }
  }
}

// 示例2：插件管理服务
export class PluginService {
  private pluginServerUrl: string;

  constructor() {
    this.pluginServerUrl = getSecureServerUrl(SERVER_TYPES.PLUGIN);
  }

  async getAvailablePlugins(): Promise<any[]> {
    try {
      const response = await fetch(`${this.pluginServerUrl}plugins`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo-Commercial/1.0.0',
          'X-Client-Type': 'commercial'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch plugins: ${response.status}`);
      }

      const data = await response.json();
      return data.plugins || [];
    } catch (error) {
      console.error('Get plugins error:', error);
      return [];
    }
  }

  async downloadPlugin(pluginId: string, version: string): Promise<Buffer | null> {
    try {
      const response = await fetch(`${this.pluginServerUrl}download/${pluginId}/${version}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo-Commercial/1.0.0',
          'X-Client-Type': 'commercial'
        }
      });

      if (!response.ok) {
        throw new Error(`Plugin download failed: ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Plugin download error:', error);
      return null;
    }
  }
}

// 示例3：系统更新服务
export class UpdateService {
  private updateServerUrl: string;

  constructor() {
    this.updateServerUrl = getSecureServerUrl(SERVER_TYPES.UPDATE);
  }

  async checkForUpdates(): Promise<any> {
    try {
      const currentVersion = process.env.APP_VERSION || '1.0.0';
      const response = await fetch(`${this.updateServerUrl}check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo-Commercial/1.0.0'
        },
        body: JSON.stringify({
          currentVersion,
          product: 'jiffoo-mall',
          edition: 'commercial'
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Update check error:', error);
      return { hasUpdate: false };
    }
  }

  async downloadUpdate(updateId: string): Promise<Buffer | null> {
    try {
      const response = await fetch(`${this.updateServerUrl}download/${updateId}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo-Commercial/1.0.0',
          'X-Client-Type': 'commercial'
        }
      });

      if (!response.ok) {
        throw new Error(`Update download failed: ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Update download error:', error);
      return null;
    }
  }
}

// 示例4：SaaS 服务集成
export class SaaSService {
  private saasServerUrl: string;

  constructor() {
    this.saasServerUrl = getSecureServerUrl(SERVER_TYPES.SAAS);
  }

  async authenticateUser(token: string): Promise<any> {
    try {
      const response = await fetch(`${this.saasServerUrl}auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error('SaaS auth error:', error);
      return { valid: false };
    }
  }

  async getSubscriptionInfo(userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.saasServerUrl}subscription/${userId}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo-Commercial/1.0.0'
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Get subscription error:', error);
      return null;
    }
  }
}

// 示例5：健康检查和监控
export class HealthCheckService {
  async checkAllServers(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // 并行检查所有服务器
    const checks = Object.values(SERVER_TYPES).map(async (serverType) => {
      const isHealthy = await validateServerConnectivity(serverType);
      results[serverType] = isHealthy;
      return { serverType, isHealthy };
    });

    await Promise.all(checks);
    return results;
  }

  async getServerStatus(): Promise<any> {
    const serverHealth = await this.checkAllServers();
    
    return {
      timestamp: new Date().toISOString(),
      servers: serverHealth,
      overallHealth: Object.values(serverHealth).every(Boolean)
    };
  }
}

// 导出服务实例
export const licenseService = new LicenseService();
export const pluginService = new PluginService();
export const updateService = new UpdateService();
export const saasService = new SaaSService();
export const healthCheckService = new HealthCheckService();
