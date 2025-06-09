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
 * Mock Payment Provider for testing and development
 * This provider simulates payment processing without actual transactions
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly version = '1.0.0';
  readonly capabilities: PaymentCapabilities = {
    supportedMethods: [PaymentMethod.MOCK, PaymentMethod.CREDIT_CARD, PaymentMethod.PAYPAL],
    supportedCurrencies: [Currency.USD, Currency.EUR, Currency.GBP, Currency.CNY],
    supportedRegions: ['*'], // Supports all regions
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
      maxAmount: 999999.99,
      dailyLimit: 1000000,
      monthlyLimit: 10000000,
    },
  };

  private initialized = false;
  private config?: PaymentConfig;
  private payments: Map<string, any> = new Map();
  private refunds: Map<string, any> = new Map();

  async initialize(config: PaymentConfig): Promise<void> {
    LoggerService.logInfo('Initializing Mock Payment Provider');
    
    this.config = config;
    this.initialized = true;
    
    LoggerService.logInfo('Mock Payment Provider initialized successfully');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async destroy(): Promise<void> {
    LoggerService.logInfo('Destroying Mock Payment Provider');
    
    this.initialized = false;
    this.config = undefined;
    this.payments.clear();
    this.refunds.clear();
    
    LoggerService.logInfo('Mock Payment Provider destroyed');
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (!this.initialized) {
      throw new Error('Mock Payment Provider not initialized');
    }

    LoggerService.logInfo(`Creating mock payment for order ${request.orderId}`);

    // Generate mock payment ID
    const paymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transactionId = `mock_txn_${Date.now()}`;

    // Simulate different payment scenarios based on amount
    let status: PaymentStatus;
    let success = true;
    let error: any = undefined;

    if (request.amount.value === 0) {
      // Free orders
      status = PaymentStatus.COMPLETED;
    } else if (request.amount.value < 1) {
      // Very small amounts fail
      status = PaymentStatus.FAILED;
      success = false;
      error = {
        code: 'AMOUNT_TOO_SMALL',
        message: 'Payment amount is too small',
      };
    } else if (request.amount.value > 999999) {
      // Very large amounts fail
      status = PaymentStatus.FAILED;
      success = false;
      error = {
        code: 'AMOUNT_TOO_LARGE',
        message: 'Payment amount exceeds limit',
      };
    } else if (request.customer.email.includes('fail')) {
      // Emails containing 'fail' will fail
      status = PaymentStatus.FAILED;
      success = false;
      error = {
        code: 'PAYMENT_DECLINED',
        message: 'Payment was declined by the bank',
      };
    } else if (request.customer.email.includes('pending')) {
      // Emails containing 'pending' will be pending
      status = PaymentStatus.PENDING;
    } else {
      // Default to completed
      status = PaymentStatus.COMPLETED;
    }

    const now = new Date();
    const paymentData = {
      id: paymentId,
      orderId: request.orderId,
      amount: request.amount,
      customer: request.customer,
      items: request.items,
      status,
      transactionId: success ? transactionId : undefined,
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata,
    };

    // Store payment data
    this.payments.set(paymentId, paymentData);

    const result: PaymentResult = {
      success,
      paymentId,
      status,
      amount: request.amount,
      transactionId: success ? transactionId : undefined,
      providerResponse: {
        provider: 'mock',
        simulatedScenario: this.getScenarioDescription(request),
      },
      error,
      metadata: {
        provider: 'mock',
        environment: this.config?.environment || 'sandbox',
      },
      createdAt: now,
      updatedAt: now,
    };

    LoggerService.logInfo(`Mock payment ${paymentId} created with status: ${status}`);

    return result;
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    LoggerService.logInfo(`Verifying mock payment ${paymentId}`);

    const payment = this.payments.get(paymentId);
    if (!payment) {
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found',
        },
      };
    }

    return {
      isValid: true,
      status: payment.status,
      amount: payment.amount,
      transactionId: payment.transactionId,
      paidAt: payment.status === PaymentStatus.COMPLETED ? payment.createdAt : undefined,
    };
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    LoggerService.logInfo(`Cancelling mock payment ${paymentId}`);

    const payment = this.payments.get(paymentId);
    if (!payment) {
      return false;
    }

    // Can only cancel pending payments
    if (payment.status !== PaymentStatus.PENDING) {
      return false;
    }

    payment.status = PaymentStatus.CANCELLED;
    payment.updatedAt = new Date();
    this.payments.set(paymentId, payment);

    return true;
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    LoggerService.logInfo(`Processing mock refund for payment ${request.paymentId}`);

    const payment = this.payments.get(request.paymentId);
    if (!payment) {
      return {
        success: false,
        refundId: '',
        amount: request.amount || { value: 0, currency: Currency.USD },
        status: 'failed',
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found',
        },
        createdAt: new Date(),
      };
    }

    // Can only refund completed payments
    if (payment.status !== PaymentStatus.COMPLETED) {
      return {
        success: false,
        refundId: '',
        amount: request.amount || payment.amount,
        status: 'failed',
        error: {
          code: 'PAYMENT_NOT_REFUNDABLE',
          message: 'Payment is not in a refundable state',
        },
        createdAt: new Date(),
      };
    }

    const refundAmount = request.amount || payment.amount;
    const refundId = `mock_ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store refund data
    const refundData = {
      id: refundId,
      paymentId: request.paymentId,
      amount: refundAmount,
      reason: request.reason,
      status: 'completed',
      createdAt: new Date(),
      metadata: request.metadata,
    };

    this.refunds.set(refundId, refundData);

    // Update payment status
    const isFullRefund = refundAmount.value >= payment.amount.value;
    payment.status = isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    payment.updatedAt = new Date();
    this.payments.set(request.paymentId, payment);

    return {
      success: true,
      refundId,
      amount: refundAmount,
      status: 'completed',
      createdAt: new Date(),
    };
  }

  async getRefund(refundId: string): Promise<RefundResult> {
    const refund = this.refunds.get(refundId);
    if (!refund) {
      throw new Error('Refund not found');
    }

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      createdAt: refund.createdAt,
    };
  }

  async verifyWebhook(event: WebhookEvent): Promise<boolean> {
    // Mock webhook verification always succeeds
    LoggerService.logInfo(`Verifying mock webhook event ${event.type}`);
    return true;
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    LoggerService.logInfo(`Handling mock webhook event ${event.type}`);
    // Mock webhook handling - just log the event
  }

  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  private getScenarioDescription(request: PaymentRequest): string {
    if (request.amount.value === 0) return 'free_order';
    if (request.amount.value < 1) return 'amount_too_small';
    if (request.amount.value > 999999) return 'amount_too_large';
    if (request.customer.email.includes('fail')) return 'payment_declined';
    if (request.customer.email.includes('pending')) return 'payment_pending';
    return 'payment_success';
  }

  // Additional methods for testing
  getStoredPayment(paymentId: string): any {
    return this.payments.get(paymentId);
  }

  getStoredRefund(refundId: string): any {
    return this.refunds.get(refundId);
  }

  getAllPayments(): any[] {
    return Array.from(this.payments.values());
  }

  getAllRefunds(): any[] {
    return Array.from(this.refunds.values());
  }

  clearTestData(): void {
    this.payments.clear();
    this.refunds.clear();
  }
}
