import Stripe from 'stripe';
import { 
  PaymentProvider, 
  PaymentConfig, 
  PaymentRequest, 
  PaymentResult, 
  PaymentVerification,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  PaymentCapabilities,
  PaymentStatus,
  PaymentMethod,
  Currency
} from '../types';
import { LoggerService } from '@/utils/logger';

/**
 * Stripe Payment Provider
 * Handles credit card payments through Stripe
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly version = '1.0.0';
  readonly capabilities: PaymentCapabilities = {
    supportedMethods: [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD],
    supportedCurrencies: [Currency.USD, Currency.EUR, Currency.GBP, Currency.CAD, Currency.AUD],
    supportedRegions: ['US', 'EU', 'CA', 'AU', 'GB'],
    features: {
      refunds: true,
      partialRefunds: true,
      webhooks: true,
      recurringPayments: true,
      savedPaymentMethods: true,
      multiPartyPayments: false,
    },
    limits: {
      minAmount: 0.50, // $0.50 minimum
      maxAmount: 999999.99,
      dailyLimit: 1000000,
      monthlyLimit: 10000000,
    },
  };

  private stripe?: Stripe;
  private initialized = false;
  private config?: PaymentConfig;

  async initialize(config: PaymentConfig): Promise<void> {
    LoggerService.logInfo('Initializing Stripe Payment Provider');

    if (!config.apiKey) {
      throw new Error('Stripe API key is required');
    }

    this.config = config;

    // Check if we're in demo mode
    const isDemoMode = process.env.STRIPE_DEMO_MODE === 'true' ||
                      config.apiKey.includes('demo') ||
                      config.apiKey.includes('test_demo');

    if (isDemoMode) {
      LoggerService.logInfo('Stripe Payment Provider running in DEMO mode - skipping API validation');
      this.initialized = true;
      return;
    }

    // Initialize Stripe with API key
    this.stripe = new Stripe(config.apiKey, {
      apiVersion: '2025-05-28.basil',
      typescript: true,
    });

    // Test the connection
    try {
      await this.stripe.balance.retrieve();
      this.initialized = true;
      LoggerService.logInfo('Stripe Payment Provider initialized successfully');
    } catch (error) {
      LoggerService.logError('Failed to initialize Stripe', error);
      throw new Error('Failed to connect to Stripe API');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async destroy(): Promise<void> {
    LoggerService.logInfo('Destroying Stripe Payment Provider');
    this.initialized = false;
    this.config = undefined;
    this.stripe = undefined;
    LoggerService.logInfo('Stripe Payment Provider destroyed');
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (!this.initialized) {
      throw new Error('Stripe Payment Provider not initialized');
    }

    LoggerService.logInfo(`Creating Stripe payment for order ${request.orderId}`);

    // Check if we're in demo mode
    const isDemoMode = process.env.STRIPE_DEMO_MODE === 'true' ||
                      this.config?.apiKey?.includes('demo') ||
                      this.config?.apiKey?.includes('test_demo');

    if (isDemoMode) {
      LoggerService.logInfo('Creating DEMO Stripe payment');

      // Return a mock successful payment for demo purposes
      const mockPaymentId = `pi_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      return {
        success: true,
        paymentId: mockPaymentId,
        status: PaymentStatus.COMPLETED,
        amount: request.amount,
        transactionId: mockPaymentId,
        clientSecret: `${mockPaymentId}_secret_demo`,
        providerResponse: {
          provider: 'stripe',
          paymentIntentId: mockPaymentId,
          status: 'succeeded',
          amount: Math.round(request.amount.value * 100),
          currency: request.amount.currency.toLowerCase(),
          demo: true,
        },
        metadata: {
          provider: 'stripe',
          environment: 'demo',
          paymentIntentId: mockPaymentId,
          demo: true,
        },
        createdAt: now,
        updatedAt: now,
      };
    }

    if (!this.stripe) {
      throw new Error('Stripe not initialized for real payments');
    }

    try {
      // Convert amount to cents (Stripe uses smallest currency unit)
      const amountInCents = Math.round(request.amount.value * 100);

      // Prepare PaymentIntent parameters
      const paymentIntentParams: any = {
        amount: amountInCents,
        currency: request.amount.currency.toLowerCase(),
        description: request.description || `Payment for order ${request.orderId}`,
        metadata: {
          orderId: request.orderId,
          customerId: request.customer.id || '',
          ...request.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      // Only add customer if it's a valid Stripe customer ID (starts with 'cus_')
      if (request.customer.id && request.customer.id.startsWith('cus_')) {
        paymentIntentParams.customer = request.customer.id;
      }

      // Add return URL if provided
      if (request.returnUrl) {
        paymentIntentParams.return_url = request.returnUrl;
      }

      // Create PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);

      const now = new Date();
      const result: PaymentResult = {
        success: true,
        paymentId: paymentIntent.id,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        amount: request.amount,
        transactionId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        providerResponse: {
          provider: 'stripe',
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
        metadata: {
          provider: 'stripe',
          environment: this.config?.environment || 'sandbox',
          paymentIntentId: paymentIntent.id,
        },
        createdAt: now,
        updatedAt: now,
      };

      LoggerService.logInfo(`Stripe payment ${paymentIntent.id} created with status: ${paymentIntent.status}`);

      return result;

    } catch (error) {
      LoggerService.logError(`Stripe payment creation failed for order ${request.orderId}`, error);
      
      const now = new Date();
      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        amount: request.amount,
        error: {
          code: error instanceof Stripe.errors.StripeError ? error.code || 'stripe_error' : 'unknown_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error instanceof Stripe.errors.StripeError ? error.type : undefined,
        },
        metadata: {
          provider: 'stripe',
          environment: this.config?.environment || 'sandbox',
        },
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    if (!this.initialized || !this.stripe) {
      throw new Error('Stripe Payment Provider not initialized');
    }

    LoggerService.logInfo(`Verifying Stripe payment ${paymentId}`);

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);

      return {
        isValid: true,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        amount: {
          value: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase() as Currency,
        },
        transactionId: paymentIntent.id,
        paidAt: paymentIntent.status === 'succeeded' && paymentIntent.created 
          ? new Date(paymentIntent.created * 1000) 
          : undefined,
      };

    } catch (error) {
      LoggerService.logError(`Stripe payment verification failed for ${paymentId}`, error);
      
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        error: {
          code: error instanceof Stripe.errors.StripeError ? error.code || 'stripe_error' : 'unknown_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    if (!this.initialized || !this.stripe) {
      throw new Error('Stripe Payment Provider not initialized');
    }

    LoggerService.logInfo(`Cancelling Stripe payment ${paymentId}`);

    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentId);
      
      const cancelled = paymentIntent.status === 'canceled';
      LoggerService.logInfo(`Stripe payment ${paymentId} cancellation result: ${cancelled}`);
      
      return cancelled;

    } catch (error) {
      LoggerService.logError(`Stripe payment cancellation failed for ${paymentId}`, error);
      return false;
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!this.initialized || !this.stripe) {
      throw new Error('Stripe Payment Provider not initialized');
    }

    LoggerService.logInfo(`Processing Stripe refund for payment ${request.paymentId}`);

    try {
      // Get the original payment intent to validate
      const paymentIntent = await this.stripe.paymentIntents.retrieve(request.paymentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return {
          success: false,
          refundId: '',
          amount: request.amount || { value: 0, currency: Currency.USD },
          status: 'failed',
          error: {
            code: 'payment_not_succeeded',
            message: 'Payment must be succeeded to process refund',
          },
          createdAt: new Date(),
        };
      }

      // Calculate refund amount
      const refundAmount = request.amount 
        ? Math.round(request.amount.value * 100) // Convert to cents
        : paymentIntent.amount; // Full refund

      // Create refund
      const refund = await this.stripe.refunds.create({
        payment_intent: request.paymentId,
        amount: refundAmount,
        reason: request.reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer',
        metadata: request.metadata || {},
      });

      return {
        success: true,
        refundId: refund.id,
        amount: {
          value: refund.amount / 100, // Convert from cents
          currency: refund.currency.toUpperCase() as Currency,
        },
        status: refund.status === 'succeeded' ? 'completed' : 'pending',
        createdAt: new Date(refund.created * 1000),
      };

    } catch (error) {
      LoggerService.logError(`Stripe refund processing failed for payment ${request.paymentId}`, error);
      
      return {
        success: false,
        refundId: '',
        amount: request.amount || { value: 0, currency: Currency.USD },
        status: 'failed',
        error: {
          code: error instanceof Stripe.errors.StripeError ? error.code || 'stripe_error' : 'unknown_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
        createdAt: new Date(),
      };
    }
  }

  async getRefund(refundId: string): Promise<RefundResult> {
    if (!this.initialized || !this.stripe) {
      throw new Error('Stripe Payment Provider not initialized');
    }

    try {
      const refund = await this.stripe.refunds.retrieve(refundId);

      return {
        success: true,
        refundId: refund.id,
        amount: {
          value: refund.amount / 100,
          currency: refund.currency.toUpperCase() as Currency,
        },
        status: refund.status === 'succeeded' ? 'completed' : 'pending',
        createdAt: new Date(refund.created * 1000),
      };

    } catch (error) {
      LoggerService.logError(`Failed to get Stripe refund ${refundId}`, error);
      throw error;
    }
  }

  async verifyWebhook(event: WebhookEvent): Promise<boolean> {
    if (!this.initialized || !this.stripe || !this.config?.webhookSecret) {
      return false;
    }

    try {
      // Verify webhook signature
      this.stripe.webhooks.constructEvent(
        JSON.stringify(event.data),
        event.signature || '',
        this.config.webhookSecret
      );

      return true;
    } catch (error) {
      LoggerService.logError('Stripe webhook verification failed', error);
      return false;
    }
  }

  async constructWebhookEvent(payload: string | Buffer, signature: string): Promise<any> {
    if (!this.initialized || !this.stripe || !this.config?.webhookSecret) {
      throw new Error('Stripe not initialized or webhook secret not configured');
    }

    try {
      // Use Stripe's constructEvent to verify and parse the webhook
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );

      return event;
    } catch (error) {
      LoggerService.logError('Failed to construct webhook event', error);
      throw error;
    }
  }

  async handleWebhook(event: any): Promise<void> {
    // Legacy method signature support
    if (typeof event === 'string' || Buffer.isBuffer(event)) {
      const payload = event;
      const signature = arguments[1] as string;
      const webhookEvent = await this.constructWebhookEvent(payload, signature);
      return this.processWebhookEvent(webhookEvent);
    }

    // Direct event object
    return this.processWebhookEvent(event);
  }

  async processWebhookEvent(event: any): Promise<void> {
    LoggerService.logInfo(`Handling Stripe webhook event ${event.type}`);
    
    // Handle different webhook events
    switch (event.type) {
      case 'payment_intent.succeeded':
        LoggerService.logInfo('Payment succeeded webhook received');
        break;
      case 'payment_intent.payment_failed':
        LoggerService.logInfo('Payment failed webhook received');
        break;
      case 'charge.dispute.created':
        LoggerService.logInfo('Dispute created webhook received');
        break;
      default:
        LoggerService.logInfo(`Unhandled webhook event type: ${event.type}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized || !this.stripe) {
      return false;
    }

    try {
      await this.stripe.balance.retrieve();
      return true;
    } catch (error) {
      LoggerService.logError('Stripe health check failed', error);
      return false;
    }
  }

  /**
   * Map Stripe payment intent status to our payment status
   */
  private mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return PaymentStatus.PENDING;
      case 'processing':
        return PaymentStatus.PROCESSING;
      case 'succeeded':
        return PaymentStatus.COMPLETED;
      case 'canceled':
        return PaymentStatus.CANCELLED;
      case 'requires_capture':
        return PaymentStatus.PENDING;
      default:
        return PaymentStatus.FAILED;
    }
  }
}
