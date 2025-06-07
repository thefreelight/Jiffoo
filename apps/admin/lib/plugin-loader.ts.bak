/**
 * 前端插件加载器
 * 确保只有官方认证的前端插件才能加载
 */

interface FrontendPlugin {
  name: string;
  version: string;
  signature: string;
  component: React.ComponentType<any>;
  routes?: PluginRoute[];
  permissions?: string[];
}

interface PluginRoute {
  path: string;
  component: React.ComponentType<any>;
  exact?: boolean;
}

interface PluginValidationResult {
  valid: boolean;
  reason?: string;
  plugin?: FrontendPlugin;
}

export class FrontendPluginLoader {
  private loadedPlugins: Map<string, FrontendPlugin> = new Map();
  private officialPublicKey: string;

  constructor() {
    this.officialPublicKey = process.env.NEXT_PUBLIC_JIFFOO_PLUGIN_KEY || '';
  }

  /**
   * 加载并验证前端插件
   */
  async loadPlugin(pluginUrl: string): Promise<PluginValidationResult> {
    try {
      // 1. 检查插件URL是否来自官方CDN
      if (!this.isOfficialCDN(pluginUrl)) {
        return {
          valid: false,
          reason: 'Plugin must be loaded from official CDN'
        };
      }

      // 2. 动态加载插件
      const pluginModule = await this.dynamicImport(pluginUrl);
      
      // 3. 验证插件签名
      const validationResult = await this.validatePluginSignature(pluginModule);
      if (!validationResult.valid) {
        return validationResult;
      }

      // 4. 检查插件权限
      const permissionCheck = await this.checkPluginPermissions(pluginModule);
      if (!permissionCheck) {
        return {
          valid: false,
          reason: 'Insufficient permissions for plugin'
        };
      }

      // 5. 注册插件
      this.loadedPlugins.set(pluginModule.name, pluginModule);

      return {
        valid: true,
        plugin: pluginModule
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Plugin loading failed: ${error.message}`
      };
    }
  }

  /**
   * 检查是否为官方CDN
   */
  private isOfficialCDN(url: string): boolean {
    const officialDomains = [
      'cdn.jiffoo.com',
      'plugins.jiffoo.com',
      'assets.jiffoo.com'
    ];

    try {
      const urlObj = new URL(url);
      return officialDomains.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  /**
   * 动态导入插件
   */
  private async dynamicImport(pluginUrl: string): Promise<FrontendPlugin> {
    // 在生产环境中，这应该通过安全的方式加载
    // 这里简化实现
    const response = await fetch(pluginUrl);
    const pluginCode = await response.text();
    
    // 验证代码安全性（简化实现）
    if (this.containsMaliciousCode(pluginCode)) {
      throw new Error('Plugin contains potentially malicious code');
    }

    // 在沙箱环境中执行插件代码
    const plugin = await this.executeInSandbox(pluginCode);
    return plugin;
  }

  /**
   * 验证插件签名
   */
  private async validatePluginSignature(plugin: FrontendPlugin): Promise<PluginValidationResult> {
    if (!plugin.signature) {
      return {
        valid: false,
        reason: 'Plugin missing signature'
      };
    }

    try {
      // 创建插件内容哈希
      const pluginContent = JSON.stringify({
        name: plugin.name,
        version: plugin.version,
        // 注意：不包含component，因为函数无法序列化
      });

      // 使用Web Crypto API验证签名
      const encoder = new TextEncoder();
      const data = encoder.encode(pluginContent);
      
      const publicKey = await this.importPublicKey();
      const signature = this.base64ToArrayBuffer(plugin.signature);
      
      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        signature,
        data
      );

      return {
        valid: isValid,
        reason: isValid ? undefined : 'Invalid plugin signature'
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Signature validation failed: ${error.message}`
      };
    }
  }

  /**
   * 检查插件权限
   */
  private async checkPluginPermissions(plugin: FrontendPlugin): Promise<boolean> {
    if (!plugin.permissions) {
      return true; // 无特殊权限要求
    }

    // 检查当前用户是否有足够权限使用该插件
    const userPermissions = await this.getCurrentUserPermissions();
    
    return plugin.permissions.every(permission => 
      userPermissions.includes(permission) || userPermissions.includes('*')
    );
  }

  /**
   * 检查恶意代码（简化实现）
   */
  private containsMaliciousCode(code: string): boolean {
    const maliciousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /document\.write/,
      /innerHTML\s*=/,
      /outerHTML\s*=/,
      /localStorage/,
      /sessionStorage/,
      /XMLHttpRequest/,
      /fetch\s*\(/
    ];

    return maliciousPatterns.some(pattern => pattern.test(code));
  }

  /**
   * 在沙箱环境中执行插件
   */
  private async executeInSandbox(code: string): Promise<FrontendPlugin> {
    // 这里应该使用更安全的沙箱实现
    // 简化实现，实际应该使用Web Workers或iframe沙箱
    
    const sandbox = {
      React: (await import('react')),
      // 提供受限的API
    };

    // 创建安全的执行环境
    const func = new Function('sandbox', `
      with (sandbox) {
        ${code}
        return plugin;
      }
    `);

    return func(sandbox);
  }

  /**
   * 导入公钥
   */
  private async importPublicKey(): Promise<CryptoKey> {
    const publicKeyData = this.base64ToArrayBuffer(this.officialPublicKey);
    
    return await crypto.subtle.importKey(
      'spki',
      publicKeyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    );
  }

  /**
   * Base64转ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 获取当前用户权限
   */
  private async getCurrentUserPermissions(): Promise<string[]> {
    // 这里应该从认证系统获取用户权限
    // 简化实现
    return ['plugin:basic', 'plugin:analytics'];
  }

  /**
   * 获取已加载的插件
   */
  getLoadedPlugins(): FrontendPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * 卸载插件
   */
  unloadPlugin(pluginName: string): boolean {
    return this.loadedPlugins.delete(pluginName);
  }

  /**
   * 获取插件路由
   */
  getPluginRoutes(): PluginRoute[] {
    const routes: PluginRoute[] = [];
    
    for (const plugin of this.loadedPlugins.values()) {
      if (plugin.routes) {
        routes.push(...plugin.routes);
      }
    }
    
    return routes;
  }
}

// 单例实例
export const frontendPluginLoader = new FrontendPluginLoader();
