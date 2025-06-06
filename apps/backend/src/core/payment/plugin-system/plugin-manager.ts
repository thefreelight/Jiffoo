import { EventEmitter } from 'events';
import { PaymentProvider, PaymentPluginMetadata, PaymentConfig } from '../types';
import { LoggerService } from '@/utils/logger';
import { LicenseService } from '@/core/licensing/license-service';
import { StripePaymentProvider } from '../providers/stripe-provider';
import { PayPalPaymentProvider } from '../providers/paypal-provider';
import { stripePaymentPluginMetadata } from '../plugins/stripe-payment-plugin';
import { paypalPaymentPluginMetadata } from '../plugins/paypal-payment-plugin';

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
        description: 'Accept credit card and debit card payments via Stripe. Supports major currencies and regions with advanced features like saved payment methods and recurring payments.',
        version: '1.0.0',
        author: 'Jiffoo Team',
        license: 'basic',
        price: 29,
        regions: ['US', 'EU', 'CA', 'AU', 'GB'],
        currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        methods: ['credit_card', 'debit_card'],
        features: [
          'credit_card_processing',
          'debit_card_processing',
          'webhooks',
          'refunds',
          'partial_refunds',
          'saved_payment_methods',
          'recurring_payments',
          'fraud_protection',
          'pci_compliance',
          'real_time_processing',
          'multi_currency',
          'dispute_management'
        ],
        requirements: {
          minCoreVersion: '1.0.0',
          dependencies: ['stripe'],
        },
        configuration: {
          required: ['apiKey', 'webhookSecret'],
          optional: ['environment', 'currency', 'region', 'captureMethod', 'statementDescriptor'],
        },
      },
      {
        id: 'paypal-payment-plugin',
        name: 'PayPal Payment Plugin',
        description: 'Accept payments via PayPal. Supports global payments with PayPal\'s trusted checkout experience and buyer protection.',
        version: '1.0.0',
        author: 'Jiffoo Team',
        license: 'basic',
        price: 29,
        regions: ['*'],
        currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        methods: ['paypal'],
        features: [
          'paypal_checkout',
          'buyer_protection',
          'global_payments',
          'webhooks',
          'refunds',
          'partial_refunds',
          'fraud_protection',
          'mobile_optimized',
          'one_touch_payments',
          'guest_checkout',
          'multi_currency',
          'dispute_resolution'
        ],
        requirements: {
          minCoreVersion: '1.0.0',
          dependencies: ['@paypal/paypal-server-sdk'],
        },
        configuration: {
          required: ['clientId', 'clientSecret'],
          optional: ['environment', 'currency', 'region', 'brandName', 'landingPage'],
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

    LoggerService.logInfo(`Installing plugin ${pluginId}...`);

    try {
      // Load and register the actual plugin
      await this.loadAndRegisterPlugin(pluginId, licenseKey);

      LoggerService.logInfo(`Plugin ${pluginId} installed successfully`);

      this.emit('plugin.installed', {
        pluginId,
        metadata: pluginMetadata,
      });
    } catch (error) {
      LoggerService.logError(`Failed to install plugin ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Load and register a real plugin
   */
  private async loadAndRegisterPlugin(pluginId: string, licenseKey?: string): Promise<void> {
    try {
      switch (pluginId) {
        case 'stripe-payment-plugin':
          await this.registerPlugin(
            stripePaymentPluginMetadata,
            StripePaymentProvider,
            {
              environment: 'sandbox',
              currency: 'USD' as any,
              region: 'US',
              // Note: In production, these would come from secure configuration
              apiKey: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
            },
            licenseKey
          );
          break;

        case 'paypal-payment-plugin':
          await this.registerPlugin(
            paypalPaymentPluginMetadata,
            PayPalPaymentProvider,
            {
              environment: 'sandbox',
              currency: 'USD' as any,
              region: 'global',
              // Note: In production, these would come from secure configuration
              clientId: process.env.PAYPAL_CLIENT_ID || 'paypal_client_id_placeholder',
              clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'paypal_client_secret_placeholder',
            },
            licenseKey
          );
          break;

        default:
          throw new Error(`Unknown plugin: ${pluginId}`);
      }
    } catch (error) {
      LoggerService.logError(`Failed to load plugin ${pluginId}`, error);
      throw new Error(`Plugin loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
