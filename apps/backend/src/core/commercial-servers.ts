/**
 * 商业服务器配置 - 预加密版本
 * 
 * 警告：此文件包含预先加密的商业服务器地址
 * 开源用户可以访问商业服务，但无法修改服务器地址
 * 请勿尝试修改此文件，否则可能导致商业功能无法正常工作
 */

import crypto from 'crypto';

// 真正加密的商业服务器地址（AES-256-CBC 加密，用户无法轻易修改）
const _license = 'cbb31934f3d535081e0c51f2ea71fe30ad5a85a87dc3caa8807248bcd1cbe7319be84be540bc0c820ae843f762edc619';
const _plugin = '8012b2828c9f98c8a49272bb821ead3e9409bb9d191a694a4878ab7d6c02e9a63cd72867a041dd2bbcc0347935f88bed';
const _update = '7d7507921b0f7ada9840ac06c50acaa6eea0f6449d906e66fdbd754b427952c24893e8552f225d6a50e5215c9fd57799';
const _saas = 'd0554ebfda55bd75b02895f8dbd40aac02684a688ccd4a01ad3bb9583b79697c';
const _analytics = 'f8a3a0c129db12761453cf31cdd0f923e2014bb0f62083269f3a7df25f0426a9846a330e512d32560b96d89c5df0ea0a';

// 解密函数（真正的 AES 解密）
const _decode = (encrypted: string, serverType: string): string => {
  try {
    const key = 'jiffoo-commercial-2024-secret-key' + serverType;
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return 'https://api.jiffoo.com/v1/';
  }
};

// 验证函数
const _verify = (url: string): boolean => {
  return url.startsWith('https://') && url.includes('.jiffoo.com') && url.includes('/api/v1/');
};

// 商业服务器类型
export enum CommercialServerType {
  LICENSE = 'license',
  PLUGIN = 'plugin', 
  UPDATE = 'update',
  SAAS = 'saas',
  ANALYTICS = 'analytics'
}

/**
 * 获取商业服务器地址
 * 开源用户可以调用此函数访问商业服务，但无法修改服务器地址
 */
export function getCommercialServerUrl(serverType: CommercialServerType): string {
  let encryptedUrl: string;
  let serverTypeName: string;

  switch (serverType) {
    case CommercialServerType.LICENSE:
      encryptedUrl = _license;
      serverTypeName = 'LICENSE';
      break;
    case CommercialServerType.PLUGIN:
      encryptedUrl = _plugin;
      serverTypeName = 'PLUGIN';
      break;
    case CommercialServerType.UPDATE:
      encryptedUrl = _update;
      serverTypeName = 'UPDATE';
      break;
    case CommercialServerType.SAAS:
      encryptedUrl = _saas;
      serverTypeName = 'SAAS';
      break;
    case CommercialServerType.ANALYTICS:
      encryptedUrl = _analytics;
      serverTypeName = 'ANALYTICS';
      break;
    default:
      return 'https://api.jiffoo.com/v1/';
  }

  const decodedUrl = _decode(encryptedUrl, serverTypeName);

  if (!_verify(decodedUrl)) {
    return 'https://api.jiffoo.com/v1/';
  }
  
  // 添加客户端标识
  const clientType = process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource';
  const separator = decodedUrl.includes('?') ? '&' : '?';
  
  return `${decodedUrl}${separator}client=${clientType}&v=${process.env.APP_VERSION || '1.0.0'}`;
}

/**
 * 插件商店服务
 * 开源用户可以浏览和购买商业插件
 */
export class PluginStoreService {
  private serverUrl: string;

  constructor() {
    this.serverUrl = getCommercialServerUrl(CommercialServerType.PLUGIN);
  }

  async browsePlugins(): Promise<any[]> {
    try {
      const response = await fetch(`${this.serverUrl}browse`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as { plugins?: any[] };
      return data.plugins || [];
    } catch (error) {
      console.error('Browse plugins error:', error);
      return [];
    }
  }

  async purchasePlugin(pluginId: string, userEmail: string, paymentToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        },
        body: JSON.stringify({
          pluginId,
          userEmail,
          paymentToken,
          clientType: process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Purchase plugin error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async downloadPlugin(pluginId: string, licenseKey: string): Promise<Buffer | null> {
    try {
      const response = await fetch(`${this.serverUrl}download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        },
        body: JSON.stringify({
          pluginId,
          licenseKey
        })
      });

      if (!response.ok) {
        return null;
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Download plugin error:', error);
      return null;
    }
  }
}

/**
 * SaaS 服务
 * 开源用户可以订阅 SaaS 服务
 */
export class SaaSService {
  private serverUrl: string;

  constructor() {
    this.serverUrl = getCommercialServerUrl(CommercialServerType.SAAS);
  }

  async browseServices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.serverUrl}services`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as { services?: any[] };
      return data.services || [];
    } catch (error) {
      console.error('Browse SaaS services error:', error);
      return [];
    }
  }

  async subscribe(serviceId: string, planId: string, userEmail: string, paymentToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        },
        body: JSON.stringify({
          serviceId,
          planId,
          userEmail,
          paymentToken,
          clientType: process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('SaaS subscription error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * 许可证验证服务
 */
export class LicenseService {
  private serverUrl: string;

  constructor() {
    this.serverUrl = getCommercialServerUrl(CommercialServerType.LICENSE);
  }

  async validateLicense(licenseKey: string, pluginId?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        },
        body: JSON.stringify({
          licenseKey,
          pluginId,
          clientType: process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        })
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json() as { valid?: boolean };
      return result.valid === true;
    } catch (error) {
      console.error('License validation error:', error);
      return false;
    }
  }
}

/**
 * 系统更新服务
 */
export class UpdateService {
  private serverUrl: string;

  constructor() {
    this.serverUrl = getCommercialServerUrl(CommercialServerType.UPDATE);
  }

  async checkForUpdates(): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        },
        body: JSON.stringify({
          currentVersion: process.env.APP_VERSION || '1.0.0',
          clientType: process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
        })
      });

      if (!response.ok) {
        return { hasUpdate: false };
      }

      return await response.json();
    } catch (error) {
      console.error('Check updates error:', error);
      return { hasUpdate: false };
    }
  }
}

// 导出服务实例
export const pluginStoreService = new PluginStoreService();
export const saasService = new SaaSService();
export const licenseService = new LicenseService();
export const updateService = new UpdateService();
