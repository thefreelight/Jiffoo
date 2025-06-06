import { EventEmitter } from 'events';
import { PaymentProvider, PaymentPluginMetadata, PaymentConfig } from '../types';
import { LoggerService } from '@/utils/logger';
import { LicenseService } from '@/core/licensing/license-service';

export interface PaymentPlugin {
  metadata: PaymentPluginMetadata;
  provider: PaymentProvider;
  config?: PaymentConfig;
  isActive: boolean;
  licenseKey?: string;
}

export class PaymentPluginManager extends EventEmitter {
  private plugins: Map<string, PaymentPlugin> = new Map();
  private loadedProviders: Map<string, PaymentProvider> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Register a payment plugin
   */
  async registerPlugin(
    metadata: PaymentPluginMetadata,
    providerClass: new () => PaymentProvider,
    config: PaymentConfig,
    licenseKey?: string
  ): Promise<void> {
    try {
      LoggerService.logInfo(`Registering payment plugin: ${metadata.id}`);

      // Validate license for paid plugins
      if (metadata.license !== 'free' && licenseKey) {
        const isValidLicense = await this.validatePluginLicense(metadata.id, licenseKey);
        if (!isValidLicense) {
          throw new Error(`Invalid license for plugin ${metadata.id}`);
        }
      }

      // Create provider instance
      const provider = new providerClass();
      
      // Initialize provider
      await provider.initialize(config);

      // Create plugin entry
      const plugin: PaymentPlugin = {
        metadata,
        provider,
        config,
        isActive: true,
        licenseKey,
      };

      // Store plugin
      this.plugins.set(metadata.id, plugin);
      this.loadedProviders.set(provider.name, provider);

      LoggerService.logInfo(`Payment plugin ${metadata.id} registered successfully`);

      // Emit registration event
      this.emit('plugin.registered', {
        pluginId: metadata.id,
        providerName: provider.name,
        metadata,
      });

    } catch (error) {
      LoggerService.logError(`Failed to register payment plugin ${metadata.id}`, error);
      throw error;
    }
  }

  /**
   * Unregister a payment plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Payment plugin ${pluginId} not found`);
    }

    try {
      // Destroy provider
      await plugin.provider.destroy();

      // Remove from maps
      this.plugins.delete(pluginId);
      this.loadedProviders.delete(plugin.provider.name);

      LoggerService.logInfo(`Payment plugin ${pluginId} unregistered successfully`);

      // Emit unregistration event
      this.emit('plugin.unregistered', {
        pluginId,
        providerName: plugin.provider.name,
      });

    } catch (error) {
      LoggerService.logError(`Failed to unregister payment plugin ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Get a payment provider by name
   */
  getProvider(providerName: string): PaymentProvider | undefined {
    return this.loadedProviders.get(providerName);
  }

  /**
   * Get all loaded providers
   */
  getProviders(): PaymentProvider[] {
    return Array.from(this.loadedProviders.values());
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): PaymentPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by license type
   */
  getPluginsByLicense(license: 'free' | 'basic' | 'premium' | 'enterprise'): PaymentPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.metadata.license === license);
  }

  /**
   * Get available plugins (not yet installed)
   */
  getAvailablePlugins(): PaymentPluginMetadata[] {
    // This would typically fetch from a plugin registry
    return [
      {
        id: 'stripe-payment-plugin',
        name: 'Stripe Payment Plugin',
        description: 'Accept credit card payments via Stripe',
        version: '1.0.0',
        author: 'Jiffoo Team',
        license: 'basic',
        price: 29,
        regions: ['US', 'EU', 'CA', 'AU'],
        currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        methods: ['credit_card', 'debit_card'],
        features: ['webhooks', 'refunds', 'saved_payment_methods'],
        requirements: {
          minCoreVersion: '1.0.0',
        },
        configuration: {
          required: ['apiKey', 'webhookSecret'],
          optional: ['environment'],
        },
      },
      {
        id: 'paypal-payment-plugin',
        name: 'PayPal Payment Plugin',
        description: 'Accept payments via PayPal',
        version: '1.0.0',
        author: 'Jiffoo Team',
        license: 'basic',
        price: 29,
        regions: ['*'],
        currencies: ['USD', 'EUR', 'GBP'],
        methods: ['paypal'],
        features: ['webhooks', 'refunds'],
        requirements: {
          minCoreVersion: '1.0.0',
        },
        configuration: {
          required: ['clientId', 'clientSecret'],
          optional: ['environment'],
        },
      },
      {
        id: 'wechat-payment-plugin',
        name: 'WeChat Pay Plugin',
        description: 'Accept payments via WeChat Pay',
        version: '1.0.0',
        author: 'Jiffoo Team',
        license: 'premium',
        price: 49,
        regions: ['CN'],
        currencies: ['CNY'],
        methods: ['wechat_pay'],
        features: ['webhooks', 'refunds'],
        requirements: {
          minCoreVersion: '1.0.0',
        },
        configuration: {
          required: ['appId', 'mchId', 'apiKey'],
          optional: ['environment'],
        },
      },
      {
        id: 'alipay-payment-plugin',
        name: 'Alipay Plugin',
        description: 'Accept payments via Alipay',
        version: '1.0.0',
        author: 'Jiffoo Team',
        license: 'premium',
        price: 49,
        regions: ['CN'],
        currencies: ['CNY'],
        methods: ['alipay'],
        features: ['webhooks', 'refunds'],
        requirements: {
          minCoreVersion: '1.0.0',
        },
        configuration: {
          required: ['appId', 'privateKey', 'publicKey'],
          optional: ['environment'],
        },
      },
    ];
  }

  /**
   * Install a plugin from the registry
   */
  async installPlugin(pluginId: string, licenseKey?: string): Promise<void> {
    const availablePlugins = this.getAvailablePlugins();
    const pluginMetadata = availablePlugins.find(p => p.id === pluginId);
    
    if (!pluginMetadata) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    // Validate license for paid plugins
    if (pluginMetadata.license !== 'free') {
      if (!licenseKey) {
        throw new Error(`License key required for plugin ${pluginId}`);
      }

      const isValidLicense = await this.validatePluginLicense(pluginId, licenseKey);
      if (!isValidLicense) {
        throw new Error(`Invalid license key for plugin ${pluginId}`);
      }
    }

    // For now, we'll simulate plugin installation
    // In a real implementation, this would download and load the plugin
    LoggerService.logInfo(`Installing plugin ${pluginId}...`);
    
    // Simulate installation delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    LoggerService.logInfo(`Plugin ${pluginId} installed successfully`);

    this.emit('plugin.installed', {
      pluginId,
      metadata: pluginMetadata,
    });
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await this.unregisterPlugin(pluginId);
    }

    // Remove plugin files (simulated)
    LoggerService.logInfo(`Uninstalling plugin ${pluginId}...`);
    
    this.emit('plugin.uninstalled', { pluginId });
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.isActive = true;
    LoggerService.logInfo(`Plugin ${pluginId} activated`);

    this.emit('plugin.activated', { pluginId });
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.isActive = false;
    LoggerService.logInfo(`Plugin ${pluginId} deactivated`);

    this.emit('plugin.deactivated', { pluginId });
  }

  /**
   * Validate plugin license
   */
  private async validatePluginLicense(pluginId: string, licenseKey: string): Promise<boolean> {
    try {
      // Use the existing license service to validate
      const validation = await LicenseService.validateLicense(licenseKey);
      return validation.isValid && validation.pluginId === pluginId;
    } catch (error) {
      LoggerService.logError(`License validation failed for plugin ${pluginId}`, error);
      return false;
    }
  }

  /**
   * Get plugin statistics
   */
  getPluginStats() {
    const plugins = Array.from(this.plugins.values());
    
    return {
      total: plugins.length,
      active: plugins.filter(p => p.isActive).length,
      inactive: plugins.filter(p => !p.isActive).length,
      byLicense: {
        free: plugins.filter(p => p.metadata.license === 'free').length,
        basic: plugins.filter(p => p.metadata.license === 'basic').length,
        premium: plugins.filter(p => p.metadata.license === 'premium').length,
        enterprise: plugins.filter(p => p.metadata.license === 'enterprise').length,
      },
    };
  }

  /**
   * Health check for all plugins
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.isActive) {
        try {
          results[pluginId] = await plugin.provider.healthCheck();
        } catch (error) {
          LoggerService.logError(`Health check failed for plugin ${pluginId}`, error);
          results[pluginId] = false;
        }
      } else {
        results[pluginId] = false; // Inactive plugins are considered unhealthy
      }
    }
    
    return results;
  }
}

// Singleton instance
export const paymentPluginManager = new PaymentPluginManager();
