import { EventEmitter } from 'events';
import { FastifyInstance } from 'fastify';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  PaymentVerification,
  RefundRequest,
  RefundResult,
  PaymentConfig,
  PaymentEventType,
  PaymentEvent,
  PaymentMethod,
  Currency,
  WebhookEvent
} from './types';
import { LoggerService } from '@/utils/logger';
import { createUnifiedPluginManager, getUnifiedPluginManager } from '@/../../plugins/core/managers/unified-manager';
import { PrismaClient } from '@prisma/client';

export class PaymentManager extends EventEmitter {
  private providers = new Map<string, PaymentProvider>();
  private defaultProvider?: string;
  private isInitialized = false;
  private fastifyInstance?: FastifyInstance;
  private unifiedManager?: any;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many listeners for events
  }

  /**
   * Check if payment manager is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize the payment manager
   */
  async initialize(fastifyInstance?: FastifyInstance): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    LoggerService.logInfo('Initializing Payment Manager');

    // Store Fastify instance if provided
    if (fastifyInstance) {
      this.fastifyInstance = fastifyInstance;
    }

    // Initialize plugin manager
    await this.initializePluginSystem();

    // Load default plugins (mock plugin for testing)
    await this.loadDefaultPlugins();

    this.isInitialized = true;
    LoggerService.logInfo('Payment Manager initialized successfully');
  }

  /**
   * Register a payment plugin (delegates to plugin manager)
   */
  async registerPlugin(
    metadata: any,
    providerClass: new () => PaymentProvider,
    config: PaymentConfig,
    licenseKey?: string
  ): Promise<void> {
    try {
      // Legacy method - now delegates to unified plugin manager
      LoggerService.logInfo(`Legacy registerPlugin called for ${metadata.name || 'unknown'}, consider using unified plugin system`);

      // Forward plugin events
      this.emit('provider.registered', {
        providerName: metadata.name || 'unknown',
        capabilities: [],
      });

    } catch (error) {
      LoggerService.logError(`Failed to register payment plugin`, error);
      throw error;
    }
  }

  /**
   * Unregister a payment provider
   */
  async unregisterProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Payment provider ${providerName} not found`);
    }

    try {
      // Destroy the provider
      await provider.destroy();

      // Remove from registry
      this.providers.delete(providerName);

      // Update default provider if necessary
      if (this.defaultProvider === providerName) {
        this.defaultProvider = this.providers.size > 0 ? this.providers.keys().next().value : undefined;
      }

      LoggerService.logInfo(`Payment provider ${providerName} unregistered successfully`);

      // Emit unregistration event
      this.emit('provider.unregistered', { providerName });

    } catch (error) {
      LoggerService.logError(`Failed to unregister payment provider ${providerName}`, error);
      throw new Error(`Failed to unregister payment provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a payment provider by name (delegates to plugin manager)
   */
  getProvider(providerName?: string): PaymentProvider {
    const name = providerName || this.defaultProvider;
    if (!name) {
      throw new Error('No payment provider specified and no default provider set');
    }

    // Try to get from unified plugin manager first - temporarily disabled
    // try {
    //   const unifiedManager = getUnifiedPluginManager();
    //   const unifiedPlugins = unifiedManager.getActivePlugins();
    //   const unifiedPlugin = unifiedPlugins.find(p => p.id === name || p.metadata.name === name);

    //   if (unifiedPlugin && unifiedPlugin.instance && typeof unifiedPlugin.instance.getProvider === 'function') {
    //     return unifiedPlugin.instance.getProvider();
    //   }
    // } catch (error) {
    //   // Unified plugin manager not initialized yet, continue with error
    // }

    // Check traditional providers
    const provider = this.providers.get(name);
    if (provider) {
      return provider;
    }

    throw new Error(`Payment provider ${name} not found`);
  }

  /**
   * Get all registered providers (delegates to plugin manager)
   */
  getProviders(): PaymentProvider[] {
    // Return traditional providers for now
    return Array.from(this.providers.values());

    // Unified plugin system temporarily disabled
    // try {
    //   const unifiedManager = getUnifiedPluginManager();
    //   const unifiedPlugins = unifiedManager.getActivePlugins();
    //   const providers: PaymentProvider[] = [];

    //   for (const plugin of unifiedPlugins) {
    //     if (plugin.instance && typeof plugin.instance.getProvider === 'function') {
    //       providers.push(plugin.instance.getProvider());
    //     }
    //   }

    //   return providers;
    // } catch (error) {
    //   // Unified plugin manager not initialized yet
    //   return [];
    // }
  }

  /**
   * Get provider names (delegates to plugin manager)
   */
  getProviderNames(): string[] {
    return this.getProviders().map(p => p.name);
  }

  /**
   * Set default payment provider
   */
  setDefaultProvider(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Payment provider ${providerName} not found`);
    }
    this.defaultProvider = providerName;
  }

  /**
   * Process a payment
   */
  async processPayment(
    request: PaymentRequest,
    providerName?: string
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerName);

    try {
      LoggerService.logInfo(`Processing payment for order ${request.orderId} with provider ${provider.name}`);

      // Emit payment creation event
      this.emitPaymentEvent(PaymentEventType.PAYMENT_CREATED, {
        paymentId: '', // Will be set after creation
        orderId: request.orderId,
        data: { amount: request.amount, provider: provider.name },
        timestamp: new Date(),
      });

      // Create payment with provider
      const result = await provider.createPayment(request);

      // Update event with actual payment ID
      this.emitPaymentEvent(PaymentEventType.PAYMENT_PROCESSING, {
        paymentId: result.paymentId,
        orderId: request.orderId,
        data: { status: result.status, provider: provider.name },
        timestamp: new Date(),
      });

      LoggerService.logInfo(`Payment ${result.paymentId} created with status: ${result.status}`);

      return result;

    } catch (error) {
      LoggerService.logError(`Payment processing failed for order ${request.orderId}`, error);

      // Emit failure event
      this.emitPaymentEvent(PaymentEventType.PAYMENT_FAILED, {
        paymentId: '',
        orderId: request.orderId,
        data: { error: error instanceof Error ? error.message : 'Unknown error', provider: provider.name },
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Verify a payment
   */
  async verifyPayment(
    paymentId: string,
    providerName?: string
  ): Promise<PaymentVerification> {
    const provider = this.getProvider(providerName);

    try {
      LoggerService.logInfo(`Verifying payment ${paymentId} with provider ${provider.name}`);

      const verification = await provider.verifyPayment(paymentId);

      LoggerService.logInfo(`Payment ${paymentId} verification result: ${verification.status}`);

      return verification;

    } catch (error) {
      LoggerService.logError(`Payment verification failed for ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(
    paymentId: string,
    providerName?: string
  ): Promise<boolean> {
    const provider = this.getProvider(providerName);

    try {
      LoggerService.logInfo(`Cancelling payment ${paymentId} with provider ${provider.name}`);

      const result = await provider.cancelPayment(paymentId);

      if (result) {
        this.emitPaymentEvent(PaymentEventType.PAYMENT_CANCELLED, {
          paymentId,
          orderId: '', // Would need to be tracked separately
          data: { provider: provider.name },
          timestamp: new Date(),
        });
      }

      LoggerService.logInfo(`Payment ${paymentId} cancellation result: ${result}`);

      return result;

    } catch (error) {
      LoggerService.logError(`Payment cancellation failed for ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Process a refund
   */
  async processRefund(
    request: RefundRequest,
    providerName?: string
  ): Promise<RefundResult> {
    const provider = this.getProvider(providerName);

    try {
      LoggerService.logInfo(`Processing refund for payment ${request.paymentId} with provider ${provider.name}`);

      // Emit refund creation event
      this.emitPaymentEvent(PaymentEventType.REFUND_CREATED, {
        paymentId: request.paymentId,
        orderId: '', // Would need to be tracked separately
        data: { amount: request.amount, reason: request.reason, provider: provider.name },
        timestamp: new Date(),
      });

      const result = await provider.refund(request);

      // Emit completion or failure event
      if (result.success) {
        this.emitPaymentEvent(PaymentEventType.REFUND_COMPLETED, {
          paymentId: request.paymentId,
          orderId: '',
          data: { refundId: result.refundId, amount: result.amount, provider: provider.name },
          timestamp: new Date(),
        });
      } else {
        this.emitPaymentEvent(PaymentEventType.REFUND_FAILED, {
          paymentId: request.paymentId,
          orderId: '',
          data: { error: result.error, provider: provider.name },
          timestamp: new Date(),
        });
      }

      LoggerService.logInfo(`Refund ${result.refundId} processed with status: ${result.status}`);

      return result;

    } catch (error) {
      LoggerService.logError(`Refund processing failed for payment ${request.paymentId}`, error);
      throw error;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(
    event: WebhookEvent,
    providerName?: string
  ): Promise<void> {
    const provider = this.getProvider(providerName);

    try {
      LoggerService.logInfo(`Handling webhook event ${event.type} for provider ${provider.name}`);

      // Verify webhook signature
      const isValid = await provider.verifyWebhook(event);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Handle the webhook
      await provider.handleWebhook(event);

      LoggerService.logInfo(`Webhook event ${event.type} handled successfully`);

    } catch (error) {
      LoggerService.logError(`Webhook handling failed for event ${event.type}`, error);
      throw error;
    }
  }

  /**
   * Check health of all providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        LoggerService.logError(`Health check failed for provider ${name}`, error);
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Initialize plugin system
   */
  private async initializePluginSystem(): Promise<void> {
    try {
      LoggerService.logInfo('Initializing unified plugin system...');

      if (!this.fastifyInstance) {
        throw new Error('Fastify instance is required for plugin system initialization');
      }

      // Get Prisma client from the Fastify instance
      const prisma = (this.fastifyInstance as any).prisma;
      if (!prisma) {
        throw new Error('Prisma client not found in Fastify instance');
      }

      // Create and initialize unified plugin manager
      this.unifiedManager = createUnifiedPluginManager(this.fastifyInstance, prisma);
      await this.unifiedManager.initialize();

      LoggerService.logInfo('Unified plugin system initialized successfully');
    } catch (error) {
      LoggerService.logError('Failed to initialize plugin system:', error);
      // Don't throw error to allow system to continue without plugins
      LoggerService.logInfo('Continuing without plugin system...');
    }
  }

  /**
   * Load default plugins
   */
  private async loadDefaultPlugins(): Promise<void> {
    // No legacy mock plugins needed - only load real payment plugins
    LoggerService.logInfo('Skipping legacy mock payment plugins - using only real payment providers');

    // Unified payment plugins are now automatically loaded by the unified manager
    LoggerService.logInfo('Unified payment plugins loaded');
  }



  /**
   * Get plugin manager instance (legacy)
   */
  getPluginManager() {
    // Return a mock object for backward compatibility
    return {
      activatePlugin: (id: string) => this.activateUnifiedPlugin(id),
      deactivatePlugin: (id: string) => this.deactivateUnifiedPlugin(id),
      getPluginStats: () => ({ total: 0, active: 0, inactive: 0 }),
      healthCheck: () => Promise.resolve({})
    };
  }

  /**
   * Get unified plugin manager instance
   */
  getUnifiedPluginManager() {
    return this.unifiedManager;
  }

  /**
   * Install a payment plugin
   */
  async installPlugin(pluginId: string, licenseKey?: string): Promise<void> {
    // Legacy method - log warning
    LoggerService.logInfo(`Legacy installPlugin called for ${pluginId}, consider using unified plugin system`);
    throw new Error('Legacy plugin installation not supported. Use unified plugin system.');
  }

  /**
   * Uninstall a payment plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    // Legacy method - log warning
    LoggerService.logInfo(`Legacy uninstallPlugin called for ${pluginId}, consider using unified plugin system`);
    throw new Error('Legacy plugin uninstallation not supported. Use unified plugin system.');
  }

  /**
   * Get available plugins from registry
   */
  async getAvailablePlugins() {
    // Plugin system temporarily disabled
    return [];
  }

  /**
   * Get installed plugins (legacy)
   */
  getInstalledPlugins() {
    // Plugin system temporarily disabled
    return [];
  }

  /**
   * Install a unified plugin - temporarily disabled
   */
  async installUnifiedPlugin(pluginId: string, pluginClass: any, config: any): Promise<void> {
    throw new Error('Plugin system temporarily disabled');
  }

  /**
   * Uninstall a unified plugin - temporarily disabled
   */
  async uninstallUnifiedPlugin(pluginId: string): Promise<void> {
    throw new Error('Plugin system temporarily disabled');
  }

  /**
   * Activate a unified plugin - temporarily disabled
   */
  async activateUnifiedPlugin(pluginId: string): Promise<void> {
    throw new Error('Plugin system temporarily disabled');
  }

  /**
   * Deactivate a unified plugin - temporarily disabled
   */
  async deactivateUnifiedPlugin(pluginId: string): Promise<void> {
    throw new Error('Plugin system temporarily disabled');
  }

  /**
   * Get all unified plugins - temporarily disabled
   */
  getUnifiedPlugins() {
    return [];
  }

  /**
   * Get active unified plugins - temporarily disabled
   */
  getActiveUnifiedPlugins() {
    return [];
  }

  /**
   * Emit payment events
   */
  private emitPaymentEvent(type: PaymentEventType, event: Omit<PaymentEvent, 'type'>): void {
    const paymentEvent: PaymentEvent = {
      type,
      ...event,
    };

    this.emit('payment.event', paymentEvent);
    this.emit(type, paymentEvent);
  }

  /**
   * Get the unified plugin manager
   */
  getUnifiedManager() {
    return this.unifiedManager;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    LoggerService.logInfo('Destroying Payment Manager');

    // Destroy all providers
    for (const [name, provider] of this.providers) {
      try {
        await provider.destroy();
      } catch (error) {
        LoggerService.logError(`Failed to destroy provider ${name}`, error);
      }
    }

    this.providers.clear();
    this.defaultProvider = undefined;
    this.isInitialized = false;
    this.removeAllListeners();

    LoggerService.logInfo('Payment Manager destroyed');
  }
}

// Singleton instance
export const paymentManager = new PaymentManager();
