import crypto from 'crypto';
import { Plugin, PluginLicenseType } from './types';

/**
 * 插件生态控制系统
 * 确保只有官方认证的插件才能在系统中运行
 */

export class PluginEcosystemController {
  private readonly officialPublicKey: string;
  private readonly trustedDevelopers: Set<string>;
  private readonly pluginRegistry: Map<string, PluginMetadata>;

  constructor() {
    // 官方公钥，用于验证插件签名
    this.officialPublicKey = process.env.JIFFOO_OFFICIAL_PUBLIC_KEY || '';
    
    // 受信任的开发者列表（如果将来需要）
    this.trustedDevelopers = new Set([
      'jiffoo-official',
      // 'trusted-partner-1', // 未来可能的合作伙伴
    ]);

    this.pluginRegistry = new Map();
  }

  /**
   * 验证插件是否为官方认证
   */
  async validatePluginAuthenticity(plugin: Plugin): Promise<ValidationResult> {
    try {
      // 1. 检查插件是否有官方签名
      if (!plugin.signature) {
        return {
          valid: false,
          reason: 'Plugin missing official signature',
          action: 'BLOCK'
        };
      }

      // 2. 验证签名
      const signatureValid = await this.verifyOfficialSignature(plugin);
      if (!signatureValid) {
        return {
          valid: false,
          reason: 'Invalid official signature',
          action: 'BLOCK'
        };
      }

      // 3. 检查插件是否在官方注册表中
      const registryCheck = await this.checkOfficialRegistry(plugin);
      if (!registryCheck.valid) {
        return {
          valid: false,
          reason: 'Plugin not found in official registry',
          action: 'BLOCK'
        };
      }

      // 4. 检查插件版本和兼容性
      const compatibilityCheck = await this.checkCompatibility(plugin);
      if (!compatibilityCheck.valid) {
        return {
          valid: false,
          reason: 'Plugin version incompatible',
          action: 'WARN'
        };
      }

      return {
        valid: true,
        reason: 'Plugin authenticated successfully',
        action: 'ALLOW'
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
        action: 'BLOCK'
      };
    }
  }

  /**
   * 验证官方签名
   */
  private async verifyOfficialSignature(plugin: Plugin): Promise<boolean> {
    if (!this.officialPublicKey || !plugin.signature) {
      return false;
    }

    try {
      // 创建插件内容的哈希
      const pluginContent = JSON.stringify({
        name: plugin.name,
        version: plugin.version,
        author: plugin.author,
        checksum: plugin.checksum
      });

      // 验证签名
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(pluginContent);
      
      return verifier.verify(this.officialPublicKey, plugin.signature, 'base64');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * 检查官方注册表
   */
  private async checkOfficialRegistry(plugin: Plugin): Promise<ValidationResult> {
    try {
      // 从官方服务器获取插件信息
      const response = await fetch(`${process.env.JIFFOO_REGISTRY_URL}/plugins/${plugin.name}`, {
        headers: {
          'Authorization': `Bearer ${process.env.JIFFOO_REGISTRY_TOKEN}`,
          'User-Agent': 'Jiffoo-Core/1.0'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return {
          valid: false,
          reason: 'Plugin not found in official registry'
        };
      }

      const registryData = await response.json();
      
      // 验证插件信息是否匹配
      if (registryData.name !== plugin.name || 
          registryData.version !== plugin.version ||
          registryData.checksum !== plugin.checksum) {
        return {
          valid: false,
          reason: 'Plugin metadata mismatch with registry'
        };
      }

      // 检查插件状态
      if (registryData.status !== 'active') {
        return {
          valid: false,
          reason: `Plugin status: ${registryData.status}`
        };
      }

      return { valid: true };
    } catch (error) {
      // 网络错误时的降级策略
      console.warn('Registry check failed, using local cache:', error);
      return this.checkLocalCache(plugin);
    }
  }

  /**
   * 检查本地缓存
   */
  private checkLocalCache(plugin: Plugin): ValidationResult {
    const cached = this.pluginRegistry.get(plugin.name);
    
    if (!cached) {
      return {
        valid: false,
        reason: 'Plugin not found in local cache'
      };
    }

    if (cached.version !== plugin.version) {
      return {
        valid: false,
        reason: 'Plugin version mismatch with cache'
      };
    }

    return { valid: true };
  }

  /**
   * 检查兼容性
   */
  private async checkCompatibility(plugin: Plugin): Promise<ValidationResult> {
    const currentVersion = process.env.JIFFOO_VERSION || '1.0.0';
    
    if (!plugin.compatibility || !plugin.compatibility.includes(currentVersion)) {
      return {
        valid: false,
        reason: `Plugin not compatible with Jiffoo ${currentVersion}`
      };
    }

    return { valid: true };
  }

  /**
   * 生成插件签名（仅供官方使用）
   */
  async generateOfficialSignature(plugin: Plugin, privateKey: string): Promise<string> {
    const pluginContent = JSON.stringify({
      name: plugin.name,
      version: plugin.version,
      author: plugin.author,
      checksum: plugin.checksum
    });

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(pluginContent);
    
    return signer.sign(privateKey, 'base64');
  }

  /**
   * 注册官方插件
   */
  async registerOfficialPlugin(plugin: Plugin): Promise<void> {
    const metadata: PluginMetadata = {
      name: plugin.name,
      version: plugin.version,
      author: plugin.author || 'jiffoo-official',
      checksum: plugin.checksum,
      registeredAt: new Date(),
      status: 'active'
    };

    this.pluginRegistry.set(plugin.name, metadata);
    
    // 同步到官方注册表
    await this.syncToOfficialRegistry(metadata);
  }

  /**
   * 同步到官方注册表
   */
  private async syncToOfficialRegistry(metadata: PluginMetadata): Promise<void> {
    try {
      await fetch(`${process.env.JIFFOO_REGISTRY_URL}/plugins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.JIFFOO_REGISTRY_TOKEN}`
        },
        body: JSON.stringify(metadata)
      });
    } catch (error) {
      console.error('Failed to sync to official registry:', error);
    }
  }
}

// 类型定义
interface ValidationResult {
  valid: boolean;
  reason?: string;
  action?: 'ALLOW' | 'WARN' | 'BLOCK';
}

interface PluginMetadata {
  name: string;
  version: string;
  author: string;
  checksum: string;
  registeredAt: Date;
  status: 'active' | 'deprecated' | 'blocked';
}

// 扩展插件接口以支持签名验证
declare module './types' {
  interface Plugin {
    signature?: string;
    checksum?: string;
    compatibility?: string[];
  }
}

// 单例实例
export const ecosystemController = new PluginEcosystemController();
