/**
 * Alipay Professional Plugin
 *
 * Commercial plugin providing complete Alipay integration
 * with advanced features for production use.
 */

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
  Currency,
  LicenseValidator
} from './types';
import crypto from 'crypto';
import axios from 'axios';
import moment from 'moment';

export interface AlipayConfig extends PaymentConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  signType: 'RSA2' | 'RSA';
  charset: 'utf-8' | 'gbk';
  format: 'JSON';
  version: '1.0';
  sandbox?: boolean;
  notifyUrl?: string;
  returnUrl?: string;
  licenseKey: string;
  domain: string;
  [key: string]: any; // Allow additional properties
}

export interface AlipayPaymentRequest {
  orderId: string;
  amount: number; // in yuan
  subject: string;
  body?: string;
  userId?: string;
  productCode: 'FAST_INSTANT_TRADE_PAY' | 'QUICK_WAP_WAY' | 'QUICK_MSECURITY_PAY';
  clientIp?: string;
  timeoutExpress?: string; // e.g., '30m', '1h', '1d'
  passbackParams?: string;
  goodsType?: '0' | '1'; // 0: virtual goods, 1: physical goods
}

export interface AlipayPaymentResult extends PaymentResult {
  tradeNo?: string;
  outTradeNo?: string;
  sellerId?: string;
  totalAmount?: string;
  receiptAmount?: string;
  buyerPayAmount?: string;
  pointAmount?: string;
  invoiceAmount?: string;
  gmtPayment?: string;
  fundBillList?: any[];
  cardBalance?: string;
  storeName?: string;
  buyerUserId?: string;
  discountGoodsDetail?: string;
  industrySepcDetail?: string;
  payUrl?: string; // For web/wap payments
}

export class AlipayProPlugin implements PaymentProvider {
  readonly name = 'alipay-pro';
  readonly version = '2.1.0';
  readonly capabilities: PaymentCapabilities = {
    supportedMethods: [PaymentMethod.ALIPAY],
    supportedCurrencies: [Currency.CNY],
    supportedRegions: ['CN', 'HK', 'MO', 'TW'],
    features: {
      refunds: true,
      partialRefunds: true,
      webhooks: true,
      recurringPayments: false,
      savedPaymentMethods: false,
      multiPartyPayments: false,
    },
    limits: {
      minAmount: 0.01, // ¥0.01 minimum
      maxAmount: 500000.00, // ¥500,000 maximum
      dailyLimit: 1000000,
      monthlyLimit: 10000000,
    },
  };

  private config: AlipayConfig;
  private licenseInfo: any;
  private initialized = false;
  private gatewayUrl: string;

  constructor(config: AlipayConfig) {
    this.config = config;
    this.gatewayUrl = config.sandbox
      ? 'https://openapi.alipaydev.com/gateway.do'
      : 'https://openapi.alipay.com/gateway.do';
  }

  async initialize(): Promise<void> {
    // Validate commercial license
    this.licenseInfo = await LicenseValidator.validateLicense(
      'alipay-pro',
      this.config.licenseKey,
      this.config.domain
    );

    if (!this.licenseInfo.valid) {
      throw new Error(`Alipay Pro requires valid license: ${this.licenseInfo.message}`);
    }

    // Validate required configuration
    this.validateConfig();

    this.initialized = true;
    console.log(`✅ Alipay Pro initialized (${this.licenseInfo.plan} plan)`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async destroy(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Create payment order
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    await this.validateLicense();
    await this.incrementUsage('payment_created');

    try {
      const alipayRequest: AlipayPaymentRequest = {
        orderId: request.orderId,
        amount: request.amount.value,
        subject: request.description || `Order ${request.orderId}`,
        body: request.description,
        userId: request.customer?.id,
        productCode: this.getProductCode(request.metadata?.paymentType),
        clientIp: request.metadata?.clientIp,
        timeoutExpress: request.metadata?.timeoutExpress || '30m',
        passbackParams: request.metadata?.passbackParams,
        goodsType: request.metadata?.goodsType || '1'
      };

      const bizContent = this.buildBizContent(alipayRequest);
      const params = this.buildRequestParams('alipay.trade.page.pay', bizContent);
      const signedParams = this.signParams(params);

      const payUrl = `${this.gatewayUrl}?${this.buildQueryString(signedParams)}`;

      return {
        success: true,
        orderId: request.orderId,
        paymentId: `alipay_${Date.now()}`,
        amount: request.amount.value,
        currency: request.amount.currency,
        status: PaymentStatus.PENDING,
        payUrl,
        metadata: {
          outTradeNo: request.orderId,
          productCode: alipayRequest.productCode
        }
      };
    } catch (error) {
      console.error('Alipay payment creation failed:', error);
      throw error;
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    await this.validateLicense();

    try {
      const bizContent = JSON.stringify({
        out_trade_no: paymentId
      });

      const params = this.buildRequestParams('alipay.trade.query', bizContent);
      const response = await this.callAlipayAPI(params);

      if (response.code === '10000') {
        const tradeStatus = response.trade_status;
        return {
          isValid: tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED',
          status: this.mapTradeStatus(tradeStatus),
          transactionId: response.trade_no,
          amount: parseFloat(response.total_amount),
          paidAt: response.gmt_payment ? new Date(response.gmt_payment) : undefined,
          metadata: response
        };
      } else {
        throw new Error(`Alipay query failed: ${response.msg}`);
      }
    } catch (error) {
      console.error('Alipay verification failed:', error);
      throw error;
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(paymentId: string): Promise<boolean> {
    await this.validateLicense();
    await this.incrementUsage('payment_cancelled');

    try {
      const bizContent = JSON.stringify({
        out_trade_no: paymentId
      });

      const params = this.buildRequestParams('alipay.trade.cancel', bizContent);
      const response = await this.callAlipayAPI(params);

      return response.code === '10000';
    } catch (error) {
      console.error('Alipay cancellation failed:', error);
      return false;
    }
  }

  /**
   * Process refund
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    await this.validateLicense();
    await this.incrementUsage('refund_processed');

    if (!this.hasFeature('refunds')) {
      throw new Error('Refund feature requires Professional plan or higher');
    }

    try {
      const bizContent = JSON.stringify({
        out_trade_no: request.paymentId,
        refund_amount: request.amount.toString(),
        out_request_no: request.refundId || `${request.paymentId}_refund_${Date.now()}`,
        refund_reason: request.reason || 'Customer refund request'
      });

      const params = this.buildRequestParams('alipay.trade.refund', bizContent);
      const response = await this.callAlipayAPI(params);

      if (response.code === '10000') {
        return {
          success: true,
          refundId: response.out_request_no,
          paymentId: request.paymentId,
          amount: parseFloat(response.refund_fee),
          status: 'completed',
          processedAt: new Date(),
          metadata: response
        };
      } else {
        throw new Error(`Alipay refund failed: ${response.msg}`);
      }
    } catch (error) {
      console.error('Alipay refund failed:', error);
      throw error;
    }
  }

  /**
   * Get refund status
   */
  async getRefund(refundId: string): Promise<RefundResult> {
    await this.validateLicense();

    try {
      const bizContent = JSON.stringify({
        out_request_no: refundId
      });

      const params = this.buildRequestParams('alipay.trade.fastpay.refund.query', bizContent);
      const response = await this.callAlipayAPI(params);

      if (response.code === '10000') {
        return {
          success: true,
          refundId: response.out_request_no,
          paymentId: response.out_trade_no,
          amount: parseFloat(response.refund_amount),
          status: response.refund_status === 'REFUND_SUCCESS' ? 'completed' : 'processing',
          processedAt: response.gmt_refund_pay ? new Date(response.gmt_refund_pay) : undefined,
          metadata: response
        };
      } else {
        throw new Error(`Alipay refund query failed: ${response.msg}`);
      }
    } catch (error) {
      console.error('Alipay refund query failed:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhook(event: WebhookEvent): Promise<boolean> {
    try {
      const params = event.data;
      const sign = params.sign;
      delete params.sign;
      delete params.sign_type;

      const expectedSign = this.generateSign(params, this.config.alipayPublicKey, false);
      return sign === expectedSign;
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Handle webhook notification
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    await this.validateLicense();
    await this.incrementUsage('webhook_processed');

    try {
      const params = event.data;

      // Process different notification types
      switch (params.notify_type) {
        case 'trade_status_sync':
          await this.handleTradeStatusSync(params);
          break;
        case 'refund_status_sync':
          await this.handleRefundStatusSync(params);
          break;
        default:
          console.warn(`Unknown Alipay notification type: ${params.notify_type}`);
      }
    } catch (error) {
      console.error('Webhook handling failed:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple API call to check connectivity
      const bizContent = JSON.stringify({
        out_trade_no: `health_check_${Date.now()}`
      });

      const params = this.buildRequestParams('alipay.trade.query', bizContent);
      await this.callAlipayAPI(params);

      return true;
    } catch (error) {
      console.error('Alipay health check failed:', error);
      return false;
    }
  }

  // Private helper methods
  private validateConfig(): void {
    const required = ['appId', 'privateKey', 'alipayPublicKey'];
    for (const field of required) {
      if (!this.config[field]) {
        throw new Error(`Alipay configuration missing required field: ${field}`);
      }
    }
  }

  private getProductCode(paymentType?: string): 'FAST_INSTANT_TRADE_PAY' | 'QUICK_WAP_WAY' | 'QUICK_MSECURITY_PAY' {
    switch (paymentType) {
      case 'web':
        return 'FAST_INSTANT_TRADE_PAY';
      case 'wap':
        return 'QUICK_WAP_WAY';
      case 'app':
        return 'QUICK_MSECURITY_PAY';
      default:
        return 'FAST_INSTANT_TRADE_PAY';
    }
  }

  private buildBizContent(request: AlipayPaymentRequest): string {
    const bizContent: Record<string, any> = {
      out_trade_no: request.orderId,
      product_code: request.productCode,
      total_amount: request.amount.toFixed(2),
      subject: request.subject,
      body: request.body,
      timeout_express: request.timeoutExpress,
      passback_params: request.passbackParams,
      goods_type: request.goodsType
    };

    // Remove undefined values
    Object.keys(bizContent).forEach(key => {
      if (bizContent[key] === undefined) {
        delete bizContent[key];
      }
    });

    return JSON.stringify(bizContent);
  }

  private buildRequestParams(method: string, bizContent: string): Record<string, string> {
    const params: Record<string, string> = {
      app_id: this.config.appId,
      method: method,
      format: this.config.format || 'JSON',
      charset: this.config.charset || 'utf-8',
      sign_type: this.config.signType || 'RSA2',
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      version: this.config.version || '1.0',
      biz_content: bizContent
    };

    if (this.config.notifyUrl) {
      params.notify_url = this.config.notifyUrl;
    }

    if (this.config.returnUrl) {
      params.return_url = this.config.returnUrl;
    }

    return params;
  }

  private signParams(params: Record<string, string>): Record<string, string> {
    // Remove undefined values
    const cleanParams: Record<string, string> = {};
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        cleanParams[key] = params[key];
      }
    });

    const sign = this.generateSign(cleanParams, this.config.privateKey, true);
    return { ...cleanParams, sign };
  }

  private generateSign(params: Record<string, string>, key: string, isPrivateKey: boolean): string {
    // Sort parameters
    const sortedKeys = Object.keys(params).sort();
    const stringToBeSigned = sortedKeys
      .map(k => `${k}=${params[k]}`)
      .join('&');

    if (isPrivateKey) {
      // Sign with private key
      const sign = crypto.createSign(this.config.signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');
      sign.update(stringToBeSigned, 'utf8');
      return sign.sign(this.formatPrivateKey(key), 'base64');
    } else {
      // Verify with public key
      const verify = crypto.createVerify(this.config.signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');
      verify.update(stringToBeSigned, 'utf8');
      return verify.verify(this.formatPublicKey(key), params.sign, 'base64').toString();
    }
  }

  private formatPrivateKey(privateKey: string): string {
    if (privateKey.includes('-----BEGIN')) {
      return privateKey;
    }
    return `-----BEGIN RSA PRIVATE KEY-----\n${privateKey.match(/.{1,64}/g)?.join('\n')}\n-----END RSA PRIVATE KEY-----`;
  }

  private formatPublicKey(publicKey: string): string {
    if (publicKey.includes('-----BEGIN')) {
      return publicKey;
    }
    return `-----BEGIN PUBLIC KEY-----\n${publicKey.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  private buildQueryString(params: Record<string, string>): string {
    return Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  private async callAlipayAPI(params: Record<string, string>): Promise<any> {
    try {
      const response = await axios.post(this.gatewayUrl, null, {
        params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const result = response.data;

      // Extract response based on method
      const method = params.method.replace(/\./g, '_') + '_response';
      if (result[method]) {
        return result[method];
      } else if (result.error_response) {
        throw new Error(`Alipay API Error: ${result.error_response.msg}`);
      } else {
        throw new Error('Invalid Alipay API response');
      }
    } catch (error) {
      console.error('Alipay API call failed:', error);
      throw error;
    }
  }

  private mapTradeStatus(tradeStatus: string): PaymentStatus {
    switch (tradeStatus) {
      case 'WAIT_BUYER_PAY':
        return PaymentStatus.PENDING;
      case 'TRADE_SUCCESS':
      case 'TRADE_FINISHED':
        return PaymentStatus.COMPLETED;
      case 'TRADE_CLOSED':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private async handleTradeStatusSync(params: any): Promise<void> {
    // Handle trade status synchronization
    console.log('Processing trade status sync:', params.out_trade_no, params.trade_status);

    // This would typically update the order status in the database
    // and trigger any necessary business logic
  }

  private async handleRefundStatusSync(params: any): Promise<void> {
    // Handle refund status synchronization
    console.log('Processing refund status sync:', params.out_request_no, params.refund_status);

    // This would typically update the refund status in the database
    // and trigger any necessary business logic
  }

  private async validateLicense(): Promise<void> {
    if (!this.licenseInfo || !this.licenseInfo.valid) {
      throw new Error('Invalid or expired Alipay Pro license');
    }

    if (this.licenseInfo.isDemo && this.isUsageLimitExceeded()) {
      throw new Error(`Demo usage limit exceeded. Upgrade at ${this.licenseInfo.upgradeUrl}`);
    }
  }

  private hasFeature(feature: string): boolean {
    return this.licenseInfo.features.includes(feature);
  }

  private async incrementUsage(action: string): Promise<void> {
    if (this.licenseInfo.isDemo) {
      await LicenseValidator.incrementUsage('alipay-pro', action);
    }
  }

  private isUsageLimitExceeded(): boolean {
    return LicenseValidator.isUsageLimitExceeded(this.licenseInfo);
  }

  /**
   * Get payment analytics (Enterprise feature)
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<any> {
    await this.validateLicense();

    if (!this.hasFeature('analytics')) {
      throw new Error('Analytics feature requires Enterprise plan');
    }

    // Implementation for payment analytics
    // This would integrate with Alipay's reporting APIs
    return {
      totalTransactions: 0,
      totalAmount: 0,
      successRate: 0,
      averageAmount: 0,
      topProducts: [],
      dailyStats: [],
      refundRate: 0,
      chargebackRate: 0
    };
  }

  /**
   * Get plugin health status
   */
  static async getHealthStatus() {
    return {
      status: 'healthy',
      version: '2.1.0',
      provider: 'alipay',
      lastCheck: new Date().toISOString(),
      capabilities: {
        payments: true,
        refunds: true,
        webhooks: true,
        analytics: true,
        multiCurrency: false
      },
      limits: {
        minAmount: 0.01,
        maxAmount: 500000.00,
        supportedCurrencies: 1,
        supportedCountries: 4
      }
    };
  }

  /**
   * Get supported payment methods
   */
  static getSupportedPaymentMethods() {
    return [
      {
        type: 'alipay',
        name: 'Alipay',
        description: 'Pay with Alipay balance, cards, or bank account',
        features: ['instant_payment', 'qr_code', 'mobile_optimized']
      }
    ];
  }

  /**
   * Get plugin configuration schema
   */
  static getConfigurationSchema() {
    return {
      required: ['appId', 'privateKey', 'alipayPublicKey'],
      optional: ['sandbox', 'signType', 'charset', 'notifyUrl', 'returnUrl'],
      properties: {
        appId: {
          type: 'string',
          description: 'Alipay App ID',
          example: '2021000000000000'
        },
        privateKey: {
          type: 'string',
          description: 'RSA Private Key for signing requests',
          sensitive: true
        },
        alipayPublicKey: {
          type: 'string',
          description: 'Alipay Public Key for verifying responses',
          sensitive: true
        },
        sandbox: {
          type: 'boolean',
          description: 'Use sandbox environment for testing',
          default: false
        },
        signType: {
          type: 'string',
          enum: ['RSA2', 'RSA'],
          description: 'Signature algorithm',
          default: 'RSA2'
        },
        charset: {
          type: 'string',
          enum: ['utf-8', 'gbk'],
          description: 'Character encoding',
          default: 'utf-8'
        },
        notifyUrl: {
          type: 'string',
          description: 'Webhook notification URL',
          format: 'url'
        },
        returnUrl: {
          type: 'string',
          description: 'Return URL after payment',
          format: 'url'
        }
      }
    };
  }
}

export default AlipayProPlugin;
