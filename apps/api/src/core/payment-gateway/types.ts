/**
 * Payment Gateway Types
 * 
 * 统一支付网关的类型定义
 */

/**
 * 支付方式信息 (面向终端用户)
 * 
 * 注意: 不包含任何额度信息,终端用户不需要知道租户的使用量
 */
export interface PaymentMethod {
  pluginSlug: string;           // 插件slug (e.g., 'stripe')
  name: string;                 // 插件名称 (e.g., 'Stripe Payment')
  displayName: string;          // 显示名称 (e.g., 'Credit Card (Stripe)')
  icon: string;                 // 图标URL
  supportedCurrencies: string[]; // 支持的货币 (e.g., ['USD', 'EUR', 'GBP'])
}

/**
 * 创建支付会话请求
 */
export interface CreatePaymentSessionRequest {
  paymentMethod: string;        // 插件slug (e.g., 'stripe')
  orderId: string;              // 订单ID
  successUrl?: string;          // 支付成功回调URL
  cancelUrl?: string;           // 支付取消回调URL
}

/**
 * 支付会话响应
 */
export interface PaymentSessionResponse {
  success: boolean;
  data?: {
    sessionId: string;          // 支付会话ID
    url: string;                // 重定向URL
    expiresAt?: Date;           // 过期时间
  };
  error?: string;
  message?: string;
}

/**
 * 插件元数据
 */
export interface PluginInfo {
  displayName: string;
  icon: string;
  supportedCurrencies: string[];
  redirectType?: 'external' | 'popup' | 'embedded';
}

/**
 * 插件元数据映射
 */
export const PLUGIN_INFO_MAP: Record<string, PluginInfo> = {
  'stripe': {
    displayName: 'Credit Card (Stripe)',
    icon: '/icons/stripe.svg',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    redirectType: 'external'
  },
  'paypal-payment': {
    displayName: 'PayPal',
    icon: '/icons/paypal.svg',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    redirectType: 'external'
  },
  'alipay-payment': {
    displayName: 'Alipay',
    icon: '/icons/alipay.svg',
    supportedCurrencies: ['CNY', 'USD', 'EUR'],
    redirectType: 'external'
  },
  'wechat-payment': {
    displayName: 'WeChat Pay',
    icon: '/icons/wechat.svg',
    supportedCurrencies: ['CNY'],
    redirectType: 'external'
  }
};

/**
 * 获取插件元数据
 */
export function getPluginInfo(pluginSlug: string): PluginInfo {
  return PLUGIN_INFO_MAP[pluginSlug] || {
    displayName: pluginSlug,
    icon: '/icons/default.svg',
    supportedCurrencies: ['USD'],
    redirectType: 'external'
  };
}

