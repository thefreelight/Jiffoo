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
    
    // Initialize Stripe with API key
    this.stripe = new Stripe(config.apiKey, {
      apiVersion: '2024-12-18.acacia',
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
    if (!this.initialized || !this.stripe) {
      throw new Error('Stripe Payment Provider not initialized');
    }

    LoggerService.logInfo(`Creating Stripe payment for order ${request.orderId}`);

    try {
      // Convert amount to cents (Stripe uses smallest currency unit)
      const amountInCents = Math.round(request.amount.value * 100);

      // Create PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: request.amount.currency.toLowerCase(),
        customer: request.customer.id,
        description: request.description || `Payment for order ${request.orderId}`,
        metadata: {
          orderId: request.orderId,
          customerId: request.customer.id || '',
          ...request.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
        return_url: request.returnUrl,
      });

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

  async handleWebhook(event: WebhookEvent): Promise<void> {
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
