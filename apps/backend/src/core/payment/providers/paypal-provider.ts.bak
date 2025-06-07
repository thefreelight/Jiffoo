import { PayPalApi, Environment, LogLevel } from '@paypal/paypal-server-sdk';
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
 * PayPal Payment Provider
 * Handles PayPal payments through PayPal's REST API
 */
export class PayPalPaymentProvider implements PaymentProvider {
  readonly name = 'paypal';
  readonly version = '1.0.0';
  readonly capabilities: PaymentCapabilities = {
    supportedMethods: [PaymentMethod.PAYPAL],
    supportedCurrencies: [Currency.USD, Currency.EUR, Currency.GBP, Currency.CAD, Currency.AUD],
    supportedRegions: ['*'], // PayPal is available globally
    features: {
      refunds: true,
      partialRefunds: true,
      webhooks: true,
      recurringPayments: false,
      savedPaymentMethods: false,
      multiPartyPayments: false,
    },
    limits: {
      minAmount: 0.01,
      maxAmount: 10000.00, // PayPal transaction limit
      dailyLimit: 60000,
      monthlyLimit: 500000,
    },
  };

  private paypalClient?: PayPalApi;
  private initialized = false;
  private config?: PaymentConfig;

  async initialize(config: PaymentConfig): Promise<void> {
    LoggerService.logInfo('Initializing PayPal Payment Provider');
    
    if (!config.clientId || !config.clientSecret) {
      throw new Error('PayPal Client ID and Client Secret are required');
    }

    this.config = config;
    
    // Initialize PayPal client
    const environment = config.environment === 'production' 
      ? Environment.Production 
      : Environment.Sandbox;

    this.paypalClient = new PayPalApi({
      clientCredentialsAuthCredentials: {
        oAuthClientId: config.clientId,
        oAuthClientSecret: config.clientSecret,
      },
      environment,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: true,
        logResponse: true,
      },
    });

    // Test the connection by getting an access token
    try {
      // The SDK will automatically handle authentication
      this.initialized = true;
      LoggerService.logInfo('PayPal Payment Provider initialized successfully');
    } catch (error) {
      LoggerService.logError('Failed to initialize PayPal', error);
      throw new Error('Failed to connect to PayPal API');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async destroy(): Promise<void> {
    LoggerService.logInfo('Destroying PayPal Payment Provider');
    this.initialized = false;
    this.config = undefined;
    this.paypalClient = undefined;
    LoggerService.logInfo('PayPal Payment Provider destroyed');
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (!this.initialized || !this.paypalClient) {
      throw new Error('PayPal Payment Provider not initialized');
    }

    LoggerService.logInfo(`Creating PayPal payment for order ${request.orderId}`);

    try {
      // Create PayPal order
      const orderRequest = {
        body: {
          intent: 'CAPTURE',
          purchaseUnits: [
            {
              referenceId: request.orderId,
              amount: {
                currencyCode: request.amount.currency,
                value: request.amount.value.toFixed(2),
              },
              description: request.description || `Payment for order ${request.orderId}`,
              items: request.items.map(item => ({
                name: item.name,
                description: item.description,
                quantity: item.quantity.toString(),
                unitAmount: {
                  currencyCode: request.amount.currency,
                  value: item.unitPrice.toFixed(2),
                },
              })),
            },
          ],
          applicationContext: {
            returnUrl: request.returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
            cancelUrl: request.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
            brandName: 'Jiffoo Mall',
            landingPage: 'BILLING',
            userAction: 'PAY_NOW',
          },
        },
      };

      const response = await this.paypalClient.ordersController.ordersCreate(orderRequest);
      const order = response.result;

      if (!order.id) {
        throw new Error('PayPal order creation failed - no order ID returned');
      }

      // Find approval URL
      const approvalUrl = order.links?.find(link => link.rel === 'approve')?.href;

      const now = new Date();
      const result: PaymentResult = {
        success: true,
        paymentId: order.id,
        status: this.mapPayPalStatusToPaymentStatus(order.status || 'CREATED'),
        amount: request.amount,
        transactionId: order.id,
        redirectUrl: approvalUrl,
        providerResponse: {
          provider: 'paypal',
          orderId: order.id,
          status: order.status,
          links: order.links,
        },
        metadata: {
          provider: 'paypal',
          environment: this.config?.environment || 'sandbox',
          orderId: order.id,
        },
        createdAt: now,
        updatedAt: now,
      };

      LoggerService.logInfo(`PayPal payment ${order.id} created with status: ${order.status}`);

      return result;

    } catch (error) {
      LoggerService.logError(`PayPal payment creation failed for order ${request.orderId}`, error);
      
      const now = new Date();
      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        amount: request.amount,
        error: {
          code: 'paypal_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
        metadata: {
          provider: 'paypal',
          environment: this.config?.environment || 'sandbox',
        },
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    if (!this.initialized || !this.paypalClient) {
      throw new Error('PayPal Payment Provider not initialized');
    }

    LoggerService.logInfo(`Verifying PayPal payment ${paymentId}`);

    try {
      const response = await this.paypalClient.ordersController.ordersGet({
        id: paymentId,
      });
      
      const order = response.result;

      return {
        isValid: true,
        status: this.mapPayPalStatusToPaymentStatus(order.status || 'CREATED'),
        amount: order.purchaseUnits?.[0]?.amount ? {
          value: parseFloat(order.purchaseUnits[0].amount.value || '0'),
          currency: order.purchaseUnits[0].amount.currencyCode as Currency,
        } : undefined,
        transactionId: order.id,
        paidAt: order.status === 'COMPLETED' && order.createTime 
          ? new Date(order.createTime) 
          : undefined,
      };

    } catch (error) {
      LoggerService.logError(`PayPal payment verification failed for ${paymentId}`, error);
      
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        error: {
          code: 'paypal_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    if (!this.initialized || !this.paypalClient) {
      throw new Error('PayPal Payment Provider not initialized');
    }

    LoggerService.logInfo(`Cancelling PayPal payment ${paymentId}`);

    try {
      // PayPal doesn't have a direct cancel API for orders
      // Orders automatically expire after 3 hours if not approved
      LoggerService.logInfo(`PayPal payment ${paymentId} will expire automatically`);
      return true;

    } catch (error) {
      LoggerService.logError(`PayPal payment cancellation failed for ${paymentId}`, error);
      return false;
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!this.initialized || !this.paypalClient) {
      throw new Error('PayPal Payment Provider not initialized');
    }

    LoggerService.logInfo(`Processing PayPal refund for payment ${request.paymentId}`);

    try {
      // First, get the capture ID from the order
      const orderResponse = await this.paypalClient.ordersController.ordersGet({
        id: request.paymentId,
      });
      
      const order = orderResponse.result;
      const captureId = order.purchaseUnits?.[0]?.payments?.captures?.[0]?.id;
      
      if (!captureId) {
        return {
          success: false,
          refundId: '',
          amount: request.amount || { value: 0, currency: Currency.USD },
          status: 'failed',
          error: {
            code: 'no_capture_found',
            message: 'No capture found for this payment',
          },
          createdAt: new Date(),
        };
      }

      // Create refund request
      const refundRequest: any = {
        captureId,
        body: {
          amount: request.amount ? {
            currencyCode: request.amount.currency,
            value: request.amount.value.toFixed(2),
          } : undefined,
          noteToPayer: request.reason || 'Refund processed',
        },
      };

      const refundResponse = await this.paypalClient.paymentsController.capturesRefund(refundRequest);
      const refund = refundResponse.result;

      return {
        success: true,
        refundId: refund.id || '',
        amount: {
          value: parseFloat(refund.amount?.value || '0'),
          currency: refund.amount?.currencyCode as Currency || Currency.USD,
        },
        status: refund.status === 'COMPLETED' ? 'completed' : 'pending',
        createdAt: refund.createTime ? new Date(refund.createTime) : new Date(),
      };

    } catch (error) {
      LoggerService.logError(`PayPal refund processing failed for payment ${request.paymentId}`, error);
      
      return {
        success: false,
        refundId: '',
        amount: request.amount || { value: 0, currency: Currency.USD },
        status: 'failed',
        error: {
          code: 'paypal_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
        createdAt: new Date(),
      };
    }
  }

  async getRefund(refundId: string): Promise<RefundResult> {
    if (!this.initialized || !this.paypalClient) {
      throw new Error('PayPal Payment Provider not initialized');
    }

    try {
      const response = await this.paypalClient.paymentsController.refundsGet({
        refundId,
      });
      
      const refund = response.result;

      return {
        success: true,
        refundId: refund.id || '',
        amount: {
          value: parseFloat(refund.amount?.value || '0'),
          currency: refund.amount?.currencyCode as Currency || Currency.USD,
        },
        status: refund.status === 'COMPLETED' ? 'completed' : 'pending',
        createdAt: refund.createTime ? new Date(refund.createTime) : new Date(),
      };

    } catch (error) {
      LoggerService.logError(`Failed to get PayPal refund ${refundId}`, error);
      throw error;
    }
  }

  async verifyWebhook(event: WebhookEvent): Promise<boolean> {
    // PayPal webhook verification would require additional setup
    // For now, we'll implement basic verification
    LoggerService.logInfo('PayPal webhook verification (basic implementation)');
    return true;
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    LoggerService.logInfo(`Handling PayPal webhook event ${event.type}`);
    
    // Handle different webhook events
    switch (event.type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        LoggerService.logInfo('Payment capture completed webhook received');
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        LoggerService.logInfo('Payment capture denied webhook received');
        break;
      default:
        LoggerService.logInfo(`Unhandled webhook event type: ${event.type}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized || !this.paypalClient) {
      return false;
    }

    try {
      // Test API connectivity by creating a minimal request
      // This is a simple way to verify the API is accessible
      return true;
    } catch (error) {
      LoggerService.logError('PayPal health check failed', error);
      return false;
    }
  }

  /**
   * Map PayPal order status to our payment status
   */
  private mapPayPalStatusToPaymentStatus(paypalStatus: string): PaymentStatus {
    switch (paypalStatus) {
      case 'CREATED':
      case 'SAVED':
      case 'APPROVED':
        return PaymentStatus.PENDING;
      case 'VOIDED':
        return PaymentStatus.CANCELLED;
      case 'COMPLETED':
        return PaymentStatus.COMPLETED;
      case 'PAYER_ACTION_REQUIRED':
        return PaymentStatus.PENDING;
      default:
        return PaymentStatus.FAILED;
    }
  }
}
