import { EventEmitter } from 'events';
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
import { paymentPluginManager } from './plugin-system/plugin-manager';

export class PaymentManager extends EventEmitter {
  private defaultProvider?: string;
  private isInitialized = false;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many listeners for events
  }

  /**
   * Initialize the payment manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    LoggerService.logInfo('Initializing Payment Manager');

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
      await paymentPluginManager.registerPlugin(metadata, providerClass, config, licenseKey);

      // Set as default if it's the first provider
      const providers = paymentPluginManager.getProviders();
      if (providers.length === 1) {
        this.defaultProvider = providers[0].name;
      }

      // Forward plugin events
      this.emit('provider.registered', {
        providerName: providers[providers.length - 1].name,
        capabilities: providers[providers.length - 1].capabilities,
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

    const provider = paymentPluginManager.getProvider(name);
    if (!provider) {
      throw new Error(`Payment provider ${name} not found`);
    }

    return provider;
  }

  /**
   * Get all registered providers (delegates to plugin manager)
   */
  getProviders(): PaymentProvider[] {
    return paymentPluginManager.getProviders();
  }

  /**
   * Get provider names (delegates to plugin manager)
   */
  getProviderNames(): string[] {
    return paymentPluginManager.getProviders().map(p => p.name);
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
    // Set up plugin manager event forwarding
    paymentPluginManager.on('plugin.registered', (event) => {
      this.emit('plugin.registered', event);
    });

    paymentPluginManager.on('plugin.unregistered', (event) => {
      this.emit('plugin.unregistered', event);
    });

    paymentPluginManager.on('plugin.activated', (event) => {
      this.emit('plugin.activated', event);
    });

    paymentPluginManager.on('plugin.deactivated', (event) => {
      this.emit('plugin.deactivated', event);
    });

    LoggerService.logInfo('Payment plugin system initialized');
  }

  /**
   * Load default plugins
   */
  private async loadDefaultPlugins(): Promise<void> {
    // Load the mock payment plugin (free plugin for testing)
    try {
      const { MockPaymentPlugin } = await import('./plugins/mock-payment-plugin');

      await this.registerPlugin(
        MockPaymentPlugin.metadata,
        MockPaymentPlugin.providerClass,
        {
          environment: 'sandbox',
          currency: 'USD' as any,
          region: 'global',
        }
      );

      LoggerService.logInfo('Default payment plugins loaded');
    } catch (error) {
      LoggerService.logError('Failed to load default payment plugins', error);
    }
  }

  /**
   * Get plugin manager instance
   */
  getPluginManager() {
    return paymentPluginManager;
  }

  /**
   * Install a payment plugin
   */
  async installPlugin(pluginId: string, licenseKey?: string): Promise<void> {
    return paymentPluginManager.installPlugin(pluginId, licenseKey);
  }

  /**
   * Uninstall a payment plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    return paymentPluginManager.uninstallPlugin(pluginId);
  }

  /**
   * Get available plugins from registry
   */
  getAvailablePlugins() {
    return paymentPluginManager.getAvailablePlugins();
  }

  /**
   * Get installed plugins
   */
  getInstalledPlugins() {
    return paymentPluginManager.getPlugins();
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
