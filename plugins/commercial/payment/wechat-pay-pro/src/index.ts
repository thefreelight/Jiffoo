/**
 * WeChat Pay Professional Plugin
 * 
 * Commercial plugin providing complete WeChat Pay integration
 * with advanced features for production use.
 */

import { BasePaymentPlugin, PaymentConfig, PaymentResult } from '@jiffoo/plugin-core';
import { LicenseValidator } from '@jiffoo/license-core';
import crypto from 'crypto';
import axios from 'axios';
import xml2js from 'xml2js';

export interface WeChatPayConfig extends PaymentConfig {
  appId: string;
  appSecret: string;
  mchId: string;
  apiKey: string;
  certPath?: string;
  keyPath?: string;
  sandbox?: boolean;
}

export interface WeChatPaymentRequest {
  orderId: string;
  amount: number; // in cents
  description: string;
  userId: string;
  paymentType: 'JSAPI' | 'NATIVE' | 'APP' | 'H5' | 'MWEB';
  openId?: string; // Required for JSAPI
  clientIp: string;
  notifyUrl: string;
  redirectUrl?: string;
}

export interface WeChatPaymentResult extends PaymentResult {
  prepayId?: string;
  codeUrl?: string; // For NATIVE payments
  h5Url?: string; // For H5 payments
  paySign?: string; // For JSAPI payments
  timeStamp?: string;
  nonceStr?: string;
  signType?: string;
}

export class WeChatPayProPlugin extends BasePaymentPlugin {
  private config: WeChatPayConfig;
  private licenseInfo: any;

  constructor(config: WeChatPayConfig) {
    super('wechat-pay-pro', 'WeChat Pay Professional', '2.1.0', config);
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Validate commercial license
    this.licenseInfo = await LicenseValidator.validateLicense(
      'wechat-pay-pro',
      this.config.licenseKey,
      this.config.domain
    );

    if (!this.licenseInfo.valid) {
      throw new Error(`WeChat Pay Pro requires valid license: ${this.licenseInfo.message}`);
    }

    console.log(`✅ WeChat Pay Pro initialized (${this.licenseInfo.plan} plan)`);
  }

  /**
   * Create payment order
   */
  async createPayment(request: WeChatPaymentRequest): Promise<WeChatPaymentResult> {
    await this.validateLicense();
    await this.incrementUsage('payment_created');

    try {
      const unifiedOrderData = this.buildUnifiedOrderData(request);
      const response = await this.callWeChatAPI('/pay/unifiedorder', unifiedOrderData);

      if (response.return_code !== 'SUCCESS') {
        throw new Error(`WeChat API Error: ${response.return_msg}`);
      }

      if (response.result_code !== 'SUCCESS') {
        throw new Error(`WeChat Payment Error: ${response.err_code_des}`);
      }

      return this.buildPaymentResult(request, response);
    } catch (error) {
      console.error('WeChat Pay creation failed:', error);
      throw error;
    }
  }

  /**
   * Process payment notification
   */
  async processNotification(xmlData: string): Promise<any> {
    await this.validateLicense();
    await this.incrementUsage('notification_processed');

    try {
      const data = await this.parseXML(xmlData);
      
      // Verify signature
      if (!this.verifySignature(data)) {
        throw new Error('Invalid signature in WeChat notification');
      }

      // Process payment result
      if (data.result_code === 'SUCCESS') {
        return {
          success: true,
          orderId: data.out_trade_no,
          transactionId: data.transaction_id,
          amount: parseInt(data.total_fee),
          paidAt: new Date(),
          rawData: data
        };
      } else {
        return {
          success: false,
          orderId: data.out_trade_no,
          error: data.err_code_des,
          rawData: data
        };
      }
    } catch (error) {
      console.error('WeChat notification processing failed:', error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(orderId: string, refundAmount: number, reason?: string): Promise<any> {
    await this.validateLicense();
    await this.incrementUsage('refund_processed');

    if (!this.hasFeature('refunds')) {
      throw new Error('Refund feature requires Professional plan or higher');
    }

    try {
      const refundData = {
        appid: this.config.appId,
        mch_id: this.config.mchId,
        nonce_str: this.generateNonceStr(),
        out_trade_no: orderId,
        out_refund_no: `${orderId}_refund_${Date.now()}`,
        total_fee: refundAmount,
        refund_fee: refundAmount,
        refund_desc: reason || 'Customer refund request'
      };

      const response = await this.callWeChatAPI('/secapi/pay/refund', refundData, true);

      if (response.return_code !== 'SUCCESS' || response.result_code !== 'SUCCESS') {
        throw new Error(`Refund failed: ${response.err_code_des || response.return_msg}`);
      }

      return {
        success: true,
        refundId: response.refund_id,
        orderId: orderId,
        amount: refundAmount,
        status: 'processing'
      };
    } catch (error) {
      console.error('WeChat refund failed:', error);
      throw error;
    }
  }

  /**
   * Query payment status
   */
  async queryPayment(orderId: string): Promise<any> {
    await this.validateLicense();

    try {
      const queryData = {
        appid: this.config.appId,
        mch_id: this.config.mchId,
        nonce_str: this.generateNonceStr(),
        out_trade_no: orderId
      };

      const response = await this.callWeChatAPI('/pay/orderquery', queryData);

      return {
        orderId: response.out_trade_no,
        transactionId: response.transaction_id,
        status: response.trade_state,
        amount: parseInt(response.total_fee),
        paidAt: response.time_end ? new Date(response.time_end) : null
      };
    } catch (error) {
      console.error('WeChat query failed:', error);
      throw error;
    }
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
    // This would integrate with WeChat's reporting APIs
    return {
      totalTransactions: 0,
      totalAmount: 0,
      successRate: 0,
      averageAmount: 0,
      topProducts: [],
      dailyStats: []
    };
  }

  // Private helper methods
  private buildUnifiedOrderData(request: WeChatPaymentRequest): any {
    const data = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      nonce_str: this.generateNonceStr(),
      body: request.description,
      out_trade_no: request.orderId,
      total_fee: request.amount,
      spbill_create_ip: request.clientIp,
      notify_url: request.notifyUrl,
      trade_type: request.paymentType
    };

    if (request.paymentType === 'JSAPI' && request.openId) {
      data.openid = request.openId;
    }

    return data;
  }

  private buildPaymentResult(request: WeChatPaymentRequest, response: any): WeChatPaymentResult {
    const result: WeChatPaymentResult = {
      success: true,
      orderId: request.orderId,
      amount: request.amount,
      currency: 'CNY',
      status: 'pending'
    };

    switch (request.paymentType) {
      case 'JSAPI':
        // Build payment parameters for JSAPI
        const timeStamp = Math.floor(Date.now() / 1000).toString();
        const nonceStr = this.generateNonceStr();
        const paySign = this.generateJSAPISign(response.prepay_id, timeStamp, nonceStr);
        
        result.prepayId = response.prepay_id;
        result.timeStamp = timeStamp;
        result.nonceStr = nonceStr;
        result.paySign = paySign;
        result.signType = 'MD5';
        break;

      case 'NATIVE':
        result.codeUrl = response.code_url;
        break;

      case 'H5':
      case 'MWEB':
        result.h5Url = response.mweb_url;
        break;
    }

    return result;
  }

  private async callWeChatAPI(endpoint: string, data: any, useSSL = false): Promise<any> {
    const signedData = this.signData(data);
    const xml = this.buildXML(signedData);
    
    const baseUrl = this.config.sandbox 
      ? 'https://api.mch.weixin.qq.com/sandboxnew'
      : 'https://api.mch.weixin.qq.com';

    const config: any = {
      method: 'POST',
      url: `${baseUrl}${endpoint}`,
      data: xml,
      headers: {
        'Content-Type': 'application/xml'
      }
    };

    if (useSSL && this.config.certPath && this.config.keyPath) {
      const fs = require('fs');
      config.httpsAgent = new (require('https').Agent)({
        cert: fs.readFileSync(this.config.certPath),
        key: fs.readFileSync(this.config.keyPath)
      });
    }

    const response = await axios(config);
    return await this.parseXML(response.data);
  }

  private signData(data: any): any {
    const sortedKeys = Object.keys(data).sort();
    const stringA = sortedKeys
      .filter(key => data[key] !== undefined && data[key] !== '')
      .map(key => `${key}=${data[key]}`)
      .join('&');
    
    const stringSignTemp = `${stringA}&key=${this.config.apiKey}`;
    const sign = crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
    
    return { ...data, sign };
  }

  private verifySignature(data: any): boolean {
    const sign = data.sign;
    delete data.sign;
    const expectedSign = this.signData(data).sign;
    return sign === expectedSign;
  }

  private generateNonceStr(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateJSAPISign(prepayId: string, timeStamp: string, nonceStr: string): string {
    const data = {
      appId: this.config.appId,
      timeStamp,
      nonceStr,
      package: `prepay_id=${prepayId}`,
      signType: 'MD5'
    };
    
    return this.signData(data).sign;
  }

  private buildXML(data: any): string {
    const builder = new xml2js.Builder({ rootName: 'xml', headless: true });
    return builder.buildObject(data);
  }

  private async parseXML(xml: string): Promise<any> {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);
    return result.xml;
  }

  private async validateLicense(): Promise<void> {
    if (!this.licenseInfo || !this.licenseInfo.valid) {
      throw new Error('Invalid or expired license');
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
      await LicenseValidator.incrementUsage('wechat-pay-pro', action);
    }
  }

  private isUsageLimitExceeded(): boolean {
    return LicenseValidator.isUsageLimitExceeded(this.licenseInfo);
  }
}

export default WeChatPayProPlugin;
