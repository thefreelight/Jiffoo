/**
 * OneClick Installer - Open Source Edition
 * 
 * Provides one-click installation for plugins from the Jiffoo Plugin Registry.
 * Commercial plugins available at https://plugins.jiffoo.com
 */

import { Plugin, PluginManifest, PluginType, LicenseInfo } from '../types';

export interface InstallOptions {
  force?: boolean;
  skipDependencies?: boolean;
  config?: Record<string, any>;
}

export interface InstallResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
  warnings?: string[];
}

export class OneClickInstaller {
  private registryUrl: string;
  private installedPlugins: Map<string, Plugin>;
  private licenseKey?: string;

  constructor(registryUrl: string = 'https://plugins.jiffoo.com') {
    this.registryUrl = registryUrl;
    this.installedPlugins = new Map();
  }

  /**
   * Set license key for commercial plugins
   */
  setLicenseKey(key: string): void {
    this.licenseKey = key;
  }

  /**
   * Install a plugin by ID
   */
  async install(pluginId: string, options: InstallOptions = {}): Promise<InstallResult> {
    try {
      // Check if already installed
      if (this.installedPlugins.has(pluginId) && !options.force) {
        return {
          success: false,
          error: `Plugin ${pluginId} is already installed. Use force option to reinstall.`
        };
      }

      // Get plugin manifest from registry
      const manifest = await this.getPluginManifest(pluginId);
      if (!manifest) {
        return {
          success: false,
          error: `Plugin ${pluginId} not found in registry`
        };
      }

      // Check license for commercial plugins
      if (manifest.license === 'commercial' || manifest.license === 'enterprise') {
        if (!this.licenseKey) {
          return {
            success: false,
            error: `Plugin ${pluginId} requires a commercial license. Visit https://plugins.jiffoo.com to purchase.`
          };
        }
      }

      // Create plugin instance
      const plugin: Plugin = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        license: manifest.license,
        type: manifest.type,
        status: 'installed',
        enabled: false,
        config: options.config || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.installedPlugins.set(pluginId, plugin);

      return {
        success: true,
        plugin
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during installation'
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginId: string): Promise<InstallResult> {
    if (!this.installedPlugins.has(pluginId)) {
      return {
        success: false,
        error: `Plugin ${pluginId} is not installed`
      };
    }

    this.installedPlugins.delete(pluginId);
    return { success: true };
  }

  /**
   * Get available plugins from registry
   */
  async getAvailablePlugins(type?: PluginType): Promise<PluginManifest[]> {
    // In open source version, return stub data
    const openSourcePlugins: PluginManifest[] = [
      {
        id: 'stripe-basic',
        name: 'Stripe Basic',
        version: '1.0.0',
        description: 'Basic Stripe payment integration',
        author: 'Jiffoo Team',
        license: 'opensource',
        type: 'payment',
        downloadUrl: `${this.registryUrl}/plugins/stripe-basic`,
        checksum: '',
        size: 0
      },
      {
        id: 'paypal-basic',
        name: 'PayPal Basic',
        version: '1.0.0',
        description: 'Basic PayPal payment integration',
        author: 'Jiffoo Team',
        license: 'opensource',
        type: 'payment',
        downloadUrl: `${this.registryUrl}/plugins/paypal-basic`,
        checksum: '',
        size: 0
      },
      {
        id: 'analytics-basic',
        name: 'Analytics Basic',
        version: '1.0.0',
        description: 'Basic analytics and reporting',
        author: 'Jiffoo Team',
        license: 'opensource',
        type: 'analytics',
        downloadUrl: `${this.registryUrl}/plugins/analytics-basic`,
        checksum: '',
        size: 0
      }
    ];

    if (type) {
      return openSourcePlugins.filter(p => p.type === type);
    }
    return openSourcePlugins;
  }

  /**
   * Get plugin manifest from registry
   */
  private async getPluginManifest(pluginId: string): Promise<PluginManifest | null> {
    const plugins = await this.getAvailablePlugins();
    return plugins.find(p => p.id === pluginId) || null;
  }

  /**
   * Get installed plugins
   */
  getInstalledPlugins(): Plugin[] {
    return Array.from(this.installedPlugins.values());
  }

  /**
   * Check if plugin is installed
   */
  isInstalled(pluginId: string): boolean {
    return this.installedPlugins.has(pluginId);
  }
}

export default OneClickInstaller;
