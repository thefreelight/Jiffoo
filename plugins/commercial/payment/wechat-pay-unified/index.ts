/**
 * 微信支付统一插件
 * 
 * 基于统一插件架构的微信支付集成
 * 保持商业许可证功能
 */

import crypto from 'crypto';
import axios from 'axios';
import xml2js from 'xml2js';
import {
  UnifiedPlugin,
  UnifiedPluginMetadata,
  PluginContext,
  PluginConfigSchema,
  PaymentPluginImplementation,
  PluginType
} from '../../../core/types';

// ==================== 插件元数据 ====================

const metadata: UnifiedPluginMetadata = {
  id: 'wechat-pay-pro',
  name: 'wechat-pay-pro',
  displayName: '微信支付 (专业版)',
  version: '2.1.0',
  description: '微信支付专业版插件，支持多种支付方式和高级功能',
  longDescription: `
    微信支付专业版插件提供以下功能：
    - JSAPI 支付 (公众号/小程序)
    - Native 支付 (扫码支付)
    - APP 支付
    - H5 支付 (手机网站)
    - 小程序支付
    - 统一下单接口
    - 支付结果查询
    - 退款处理
    - 异步通知处理
    - 商业许可证验证
    
    这是商业版插件，需要有效的许可证才能使用。
  `,
  author: 'Jiffoo Team',
  homepage: 'https://jiffoo.com/plugins/wechat-pay-pro',
  repository: 'https://github.com/jiffoo/plugins/wechat-pay-pro',
  keywords: ['payment', 'wechat', 'weixin', 'commercial', 'pro'],
  category: 'payment',
  type: PluginType.PAYMENT,
  
  // 路由定义
  routes: [
    {
      method: 'POST',
      path: '/unified-order',
      handler: 'createUnifiedOrder',
      auth: true,
      schema: {
        body: {
          type: 'object',
          required: ['amount', 'orderId', 'paymentType'],
          properties: {
            amount: { type: 'number', minimum: 0.01 },
            orderId: { type: 'string' },
            paymentType: { 
              type: 'string', 
              enum: ['JSAPI', 'NATIVE', 'APP', 'H5', 'MWEB'] 
            },
            description: { type: 'string' },
            openId: { type: 'string' },
            clientIp: { type: 'string' },
            notifyUrl: { type: 'string' },
            redirectUrl: { type: 'string' }
          }
        }
      }
    },
    {
      method: 'POST',
      path: '/query-order',
      handler: 'queryOrder',
      auth: true,
      schema: {
        body: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string' },
            transactionId: { type: 'string' }
          }
        }
      }
    },
    {
      method: 'POST',
      path: '/refund',
      handler: 'processRefund',
      auth: true,
      schema: {
        body: {
          type: 'object',
          required: ['orderId', 'refundAmount'],
          properties: {
            orderId: { type: 'string' },
            refundAmount: { type: 'number', minimum: 0.01 },
            refundReason: { type: 'string' },
            refundId: { type: 'string' }
          }
        }
      }
    },
    {
      method: 'POST',
      path: '/notify',
      handler: 'handleNotify',
      auth: false
    }
  ],
  
  // 权限要求
  permissions: {
    api: ['payment.create', 'payment.verify', 'payment.refund', 'payment.notify'],
    database: ['orders', 'payments', 'refunds'],
    network: ['api.mch.weixin.qq.com']
  },
  
  // 资源限制
  resources: {
    memory: 512, // 512MB
    cpu: 20,     // 20%
    requests: 3000 // 每分钟3000次请求
  },
  
  // 许可证信息
  license: {
    type: 'commercial',
    required: true
  },
  
  // 定价信息
  pricing: {
    type: 'premium',
    price: 199,
    currency: 'USD',
    billing: 'monthly'
  },
  
  // 依赖关系
  dependencies: [],
  
  // 最小核心版本
  minCoreVersion: '2.0.0',
  
  // 支持的平台
  supportedPlatforms: ['web', 'mobile', 'wechat']
};

// ==================== 配置模式 ====================

const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['appId', 'mchId', 'apiKey', 'licenseKey'],
  properties: {
    appId: {
      type: 'string',
      title: '微信应用ID',
      description: '微信公众号或小程序的 AppID'
    },
    appSecret: {
      type: 'string',
      title: '微信应用密钥',
      description: '微信公众号或小程序的 AppSecret',
      format: 'password'
    },
    mchId: {
      type: 'string',
      title: '商户号',
      description: '微信支付商户号'
    },
    apiKey: {
      type: 'string',
      title: 'API密钥',
      description: '微信支付API密钥',
      format: 'password'
    },
    certPath: {
      type: 'string',
      title: '证书路径',
      description: '微信支付证书文件路径（用于退款等操作）'
    },
    keyPath: {
      type: 'string',
      title: '私钥路径',
      description: '微信支付私钥文件路径'
    },
    sandbox: {
      type: 'boolean',
      title: '沙箱模式',
      description: '是否使用沙箱环境',
      default: false
    },
    licenseKey: {
      type: 'string',
      title: '许可证密钥',
      description: '商业版许可证密钥',
      format: 'password'
    },
    domain: {
      type: 'string',
      title: '授权域名',
      description: '许可证授权的域名'
    }
  }
};

// ==================== 接口定义 ====================

interface WeChatPayConfig {
  appId: string;
  appSecret?: string;
  mchId: string;
  apiKey: string;
  certPath?: string;
  keyPath?: string;
  sandbox?: boolean;
  licenseKey: string;
  domain: string;
}

interface WeChatPaymentRequest {
  orderId: string;
  amount: number; // in cents
  description: string;
  userId?: string;
  paymentType: 'JSAPI' | 'NATIVE' | 'APP' | 'H5' | 'MWEB';
  openId?: string; // Required for JSAPI
  clientIp: string;
  notifyUrl: string;
  redirectUrl?: string;
}

interface WeChatPaymentResult {
  success: boolean;
  orderId: string;
  prepayId?: string;
  codeUrl?: string; // For NATIVE payments
  h5Url?: string; // For H5 payments
  paySign?: string; // For JSAPI payments
  timeStamp?: string;
  nonceStr?: string;
  signType?: string;
  package?: string;
}

// ==================== 微信支付实现 ====================

class WeChatPayImplementation implements PaymentPluginImplementation {
  private config: WeChatPayConfig;
  private context: PluginContext;
  private initialized = false;
  private licenseInfo: any;

  constructor(context: PluginContext) {
    this.context = context;
    this.config = context.config as WeChatPayConfig;
  }

  async initialize(): Promise<void> {
    try {
      // 验证商业许可证
      await this.validateLicense();
      
      // 验证配置
      this.validateConfig();
      
      this.initialized = true;
      this.context.logger.info(`WeChat Pay Pro initialized (${this.licenseInfo?.plan || 'unknown'} plan)`);
    } catch (error) {
      this.context.logger.error('Failed to initialize WeChat Pay implementation:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    this.initialized = false;
    this.context.logger.info('WeChat Pay implementation destroyed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.initialized && this.licenseInfo?.valid === true;
    } catch (error) {
      this.context.logger.error('WeChat Pay health check failed:', error);
      return false;
    }
  }

  async validateConfig(config?: any): Promise<boolean> {
    const cfg = config || this.config;
    
    if (!cfg.appId || !cfg.mchId || !cfg.apiKey || !cfg.licenseKey) {
      return false;
    }
    
    return true;
  }

  // ==================== 许可证验证 ====================

  private async validateLicense(): Promise<void> {
    try {
      // 这里应该调用实际的许可证验证服务
      // 为了演示，我们模拟许可证验证
      this.licenseInfo = {
        valid: true,
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        features: ['unlimited_transactions', 'priority_support', 'advanced_analytics']
      };
      
      if (!this.licenseInfo.valid) {
        throw new Error(`WeChat Pay Pro requires valid license: ${this.licenseInfo.message}`);
      }
    } catch (error) {
      this.context.logger.error('License validation failed:', error);
      throw error;
    }
  }

  private validateConfig(): void {
    const required = ['appId', 'mchId', 'apiKey'];
    for (const field of required) {
      if (!this.config[field as keyof WeChatPayConfig]) {
        throw new Error(`Missing required configuration: ${field}`);
      }
    }
  }

  // ==================== 支付处理方法 ====================

  async createUnifiedOrder(request: any): Promise<WeChatPaymentResult> {
    if (!this.initialized) {
      throw new Error('WeChat Pay plugin not initialized');
    }

    try {
      await this.validateLicense();

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
      this.context.logger.error('Failed to create unified order:', error);
      throw error;
    }
  }

  async queryOrder(request: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('WeChat Pay plugin not initialized');
    }

    try {
      await this.validateLicense();

      const queryData = {
        appid: this.config.appId,
        mch_id: this.config.mchId,
        out_trade_no: request.orderId,
        nonce_str: this.generateNonceStr()
      };

      if (request.transactionId) {
        queryData['transaction_id'] = request.transactionId;
        delete queryData.out_trade_no;
      }

      const response = await this.callWeChatAPI('/pay/orderquery', queryData);

      if (response.return_code !== 'SUCCESS') {
        throw new Error(`WeChat API Error: ${response.return_msg}`);
      }

      return {
        success: response.result_code === 'SUCCESS',
        tradeState: response.trade_state,
        transactionId: response.transaction_id,
        orderId: response.out_trade_no,
        totalFee: response.total_fee,
        timeEnd: response.time_end
      };
    } catch (error) {
      this.context.logger.error('Failed to query order:', error);
      throw error;
    }
  }

  async processRefund(request: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('WeChat Pay plugin not initialized');
    }

    try {
      await this.validateLicense();

      const refundData = {
        appid: this.config.appId,
        mch_id: this.config.mchId,
        out_trade_no: request.orderId,
        out_refund_no: request.refundId || `refund_${Date.now()}`,
        total_fee: Math.round(request.totalAmount * 100), // 转换为分
        refund_fee: Math.round(request.refundAmount * 100),
        refund_desc: request.refundReason || '商家退款',
        nonce_str: this.generateNonceStr()
      };

      const response = await this.callWeChatAPI('/secapi/pay/refund', refundData, true);

      if (response.return_code !== 'SUCCESS') {
        throw new Error(`WeChat API Error: ${response.return_msg}`);
      }

      if (response.result_code !== 'SUCCESS') {
        throw new Error(`WeChat Refund Error: ${response.err_code_des}`);
      }

      return {
        success: true,
        refundId: response.out_refund_no,
        refundFee: response.refund_fee,
        transactionId: response.transaction_id
      };
    } catch (error) {
      this.context.logger.error('Failed to process refund:', error);
      throw error;
    }
  }

  async handleNotify(request: any): Promise<any> {
    try {
      const xmlData = request.body;
      const result = await this.parseXML(xmlData);

      // 验证签名
      if (!this.verifySign(result)) {
        throw new Error('Invalid signature');
      }

      // 处理支付结果
      if (result.result_code === 'SUCCESS') {
        // 支付成功，更新订单状态
        this.context.logger.info(`Payment success for order: ${result.out_trade_no}`);

        // 这里可以触发事件或调用回调
        this.context.emit('payment.success', {
          orderId: result.out_trade_no,
          transactionId: result.transaction_id,
          totalFee: result.total_fee,
          timeEnd: result.time_end
        });
      }

      return { return_code: 'SUCCESS', return_msg: 'OK' };
    } catch (error) {
      this.context.logger.error('Failed to handle notify:', error);
      return { return_code: 'FAIL', return_msg: error.message };
    }
  }

  // ==================== 辅助方法 ====================

  private buildUnifiedOrderData(request: WeChatPaymentRequest): any {
    const data = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      nonce_str: this.generateNonceStr(),
      body: request.description,
      out_trade_no: request.orderId,
      total_fee: Math.round(request.amount * 100), // 转换为分
      spbill_create_ip: request.clientIp,
      notify_url: request.notifyUrl,
      trade_type: request.paymentType
    };

    // 根据支付类型添加特定参数
    if (request.paymentType === 'JSAPI' && request.openId) {
      data['openid'] = request.openId;
    }

    if (request.paymentType === 'H5') {
      data['scene_info'] = JSON.stringify({
        h5_info: {
          type: 'Wap',
          wap_url: request.redirectUrl,
          wap_name: '商城支付'
        }
      });
    }

    return data;
  }

  private buildPaymentResult(request: WeChatPaymentRequest, response: any): WeChatPaymentResult {
    const result: WeChatPaymentResult = {
      success: true,
      orderId: request.orderId,
      prepayId: response.prepay_id
    };

    // 根据支付类型构建不同的返回数据
    switch (request.paymentType) {
      case 'NATIVE':
        result.codeUrl = response.code_url;
        break;

      case 'H5':
      case 'MWEB':
        result.h5Url = response.mweb_url;
        break;

      case 'JSAPI':
        // 构建 JSAPI 支付参数
        const timeStamp = Math.floor(Date.now() / 1000).toString();
        const nonceStr = this.generateNonceStr();
        const packageStr = `prepay_id=${response.prepay_id}`;

        const paySign = this.generateSign({
          appId: this.config.appId,
          timeStamp,
          nonceStr,
          package: packageStr,
          signType: 'MD5'
        });

        result.timeStamp = timeStamp;
        result.nonceStr = nonceStr;
        result.package = packageStr;
        result.signType = 'MD5';
        result.paySign = paySign;
        break;
    }

    return result;
  }

  private generateNonceStr(): string {
    return Math.random().toString(36).substr(2, 15);
  }

  private generateSign(params: any): string {
    // 排序参数
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '' && params[key] !== null && params[key] !== undefined)
      .sort()
      .reduce((result: any, key: string) => {
        result[key] = params[key];
        return result;
      }, {});

    // 构建签名字符串
    const signString = Object.keys(sortedParams)
      .map(key => `${key}=${sortedParams[key]}`)
      .join('&') + `&key=${this.config.apiKey}`;

    // MD5 签名
    return crypto.createHash('md5').update(signString, 'utf8').digest('hex').toUpperCase();
  }

  private verifySign(params: any): boolean {
    const { sign, ...otherParams } = params;
    const calculatedSign = this.generateSign(otherParams);
    return sign === calculatedSign;
  }

  private async callWeChatAPI(endpoint: string, data: any, useCert = false): Promise<any> {
    try {
      // 添加签名
      data.sign = this.generateSign(data);

      // 转换为 XML
      const xmlData = this.buildXML(data);

      const url = this.config.sandbox
        ? `https://api.mch.weixin.qq.com/sandboxnew${endpoint}`
        : `https://api.mch.weixin.qq.com${endpoint}`;

      const options: any = {
        method: 'POST',
        url,
        data: xmlData,
        headers: {
          'Content-Type': 'application/xml'
        },
        timeout: 30000
      };

      // 如果需要证书（如退款接口）
      if (useCert && this.config.certPath && this.config.keyPath) {
        const fs = require('fs');
        options.httpsAgent = new (require('https').Agent)({
          cert: fs.readFileSync(this.config.certPath),
          key: fs.readFileSync(this.config.keyPath)
        });
      }

      const response = await axios(options);
      return await this.parseXML(response.data);
    } catch (error) {
      this.context.logger.error('WeChat API call failed:', error);
      throw error;
    }
  }

  private buildXML(data: any): string {
    const builder = new xml2js.Builder({
      rootName: 'xml',
      headless: true,
      renderOpts: { pretty: false }
    });
    return builder.buildObject(data);
  }

  private async parseXML(xmlData: string): Promise<any> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true
    });

    return new Promise((resolve, reject) => {
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.xml);
        }
      });
    });
  }
}

// ==================== 插件主类 ====================

class WeChatPayProPlugin implements UnifiedPlugin {
  metadata = metadata;
  configSchema = configSchema;
  private implementation?: WeChatPayImplementation;

  async onInstall(context: PluginContext): Promise<void> {
    context.logger.info('Installing WeChat Pay Pro Plugin...');

    // 验证许可证
    if (!context.config.licenseKey) {
      throw new Error('WeChat Pay Pro requires a valid license key');
    }

    context.logger.info('WeChat Pay Pro Plugin installed successfully');
  }

  async onUninstall(context: PluginContext): Promise<void> {
    context.logger.info('Uninstalling WeChat Pay Pro Plugin...');

    if (this.implementation) {
      await this.implementation.destroy();
    }

    context.logger.info('WeChat Pay Pro Plugin uninstalled successfully');
  }

  async onActivate(context: PluginContext): Promise<void> {
    context.logger.info('Activating WeChat Pay Pro Plugin...');

    this.implementation = new WeChatPayImplementation(context);
    await this.implementation.initialize();

    // 注册路由处理器
    context.registerRouteHandler('createUnifiedOrder', this.implementation.createUnifiedOrder.bind(this.implementation));
    context.registerRouteHandler('queryOrder', this.implementation.queryOrder.bind(this.implementation));
    context.registerRouteHandler('processRefund', this.implementation.processRefund.bind(this.implementation));
    context.registerRouteHandler('handleNotify', this.implementation.handleNotify.bind(this.implementation));

    context.logger.info('WeChat Pay Pro Plugin activated successfully');
  }

  async onDeactivate(context: PluginContext): Promise<void> {
    context.logger.info('Deactivating WeChat Pay Pro Plugin...');

    if (this.implementation) {
      await this.implementation.destroy();
      this.implementation = undefined;
    }

    context.logger.info('WeChat Pay Pro Plugin deactivated successfully');
  }

  async onConfigUpdate(context: PluginContext, newConfig: any): Promise<void> {
    context.logger.info('Updating WeChat Pay Pro Plugin configuration...');

    if (this.implementation) {
      // 重新初始化以应用新配置
      await this.implementation.destroy();
      await this.implementation.initialize();
    }

    context.logger.info('WeChat Pay Pro Plugin configuration updated successfully');
  }

  async healthCheck(context: PluginContext): Promise<{ healthy: boolean; details?: any }> {
    if (!this.implementation) {
      return { healthy: false, details: { error: 'Plugin not activated' } };
    }

    try {
      const healthy = await this.implementation.healthCheck();
      return {
        healthy,
        details: {
          provider: 'wechat-pay',
          version: metadata.version,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// ==================== 导出 ====================

export default WeChatPayProPlugin;
export { metadata, configSchema };

// 兼容性导出
export const wechatPayProPlugin = {
  metadata,
  configSchema,
  plugin: WeChatPayProPlugin
};
