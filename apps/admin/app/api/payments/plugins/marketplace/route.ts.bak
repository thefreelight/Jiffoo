/**
 * Payment Plugins Marketplace API
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

export async function GET(request: NextRequest) {
  try {
    // Try to fetch from backend first
    try {
      const backendUrl = `${BACKEND_URL}/api/payments/plugins/marketplace`;
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (backendError) {
      console.log('Backend not available, using mock data');
    }

    // Fallback to mock data including our Alipay Pro plugin
    const mockData = {
      success: true,
      data: {
        totalAvailable: 8,
        totalInstalled: 2,
        byLicense: {
          free: 1,
          basic: 1,
          premium: 5,
          enterprise: 1,
        },
        plugins: [
          {
            id: 'alipay-pro',
            name: 'Alipay Professional',
            description: 'Complete Alipay integration with advanced features for production use. Supports web, WAP, and app payments with enterprise-grade security.',
            version: '2.1.0',
            author: 'Jiffoo Team',
            license: 'premium',
            price: 39.99,
            methods: ['alipay', 'alipay_wap', 'alipay_app'],
            features: [
              'RSA2_Encryption',
              'Webhook_Support', 
              'Full_Refunds',
              'Partial_Refunds',
              'Payment_Analytics',
              'Multi_Environment',
              'QR_Code_Payments',
              'Mobile_Optimized'
            ],
            isInstalled: false,
            isActive: false,
            supportedCurrencies: ['CNY'],
            supportedRegions: ['CN', 'HK', 'MO', 'TW'],
            category: 'payment',
            tags: ['china', 'mobile', 'qr-code', 'enterprise'],
            documentation: '/docs/plugins/alipay-pro',
            changelog: '/docs/plugins/alipay-pro/changelog',
            support: 'support@jiffoo.com',
            rating: 4.9,
            downloads: 1250,
            lastUpdated: '2024-01-15T10:30:00Z'
          },
          {
            id: 'wechat-pay-pro',
            name: 'WeChat Pay Professional',
            description: 'Advanced WeChat Pay integration with comprehensive features for Chinese market penetration.',
            version: '2.0.5',
            author: 'Jiffoo Team',
            license: 'premium',
            price: 39.99,
            methods: ['wechat_pay', 'wechat_pay_app', 'wechat_pay_h5'],
            features: [
              'Native_Payments',
              'H5_Payments',
              'Mini_Program_Support',
              'QR_Code_Generation',
              'Refund_Support',
              'Order_Query',
              'Webhook_Notifications'
            ],
            isInstalled: true,
            isActive: true,
            supportedCurrencies: ['CNY'],
            supportedRegions: ['CN'],
            category: 'payment',
            tags: ['china', 'mobile', 'mini-program'],
            rating: 4.8,
            downloads: 980
          },
          {
            id: 'stripe-pro',
            name: 'Stripe Professional',
            description: 'Enhanced Stripe integration with advanced features for global payments.',
            version: '3.2.1',
            author: 'Jiffoo Team',
            license: 'premium',
            price: 49.99,
            methods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
            features: [
              '3D_Secure',
              'Multi_Currency',
              'Recurring_Payments',
              'Fraud_Protection',
              'Real_Time_Analytics',
              'Subscription_Management'
            ],
            isInstalled: true,
            isActive: true,
            supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
            supportedRegions: ['US', 'EU', 'UK', 'CA', 'AU'],
            category: 'payment',
            tags: ['global', 'cards', 'subscriptions'],
            rating: 4.9,
            downloads: 2150
          },
          {
            id: 'paypal-pro',
            name: 'PayPal Professional',
            description: 'Complete PayPal integration with Express Checkout and advanced features.',
            version: '2.5.0',
            author: 'Jiffoo Team',
            license: 'premium',
            price: 29.99,
            methods: ['paypal', 'paypal_credit'],
            features: [
              'Express_Checkout',
              'International_Support',
              'Buyer_Protection',
              'Mobile_Optimized',
              'Subscription_Support'
            ],
            isInstalled: false,
            isActive: false,
            supportedCurrencies: ['USD', 'EUR', 'GBP'],
            supportedRegions: ['US', 'EU', 'UK'],
            category: 'payment',
            tags: ['global', 'wallet'],
            rating: 4.7,
            downloads: 1800
          },
          {
            id: 'crypto-payments-enterprise',
            name: 'Cryptocurrency Payments Enterprise',
            description: 'Accept Bitcoin, Ethereum, and other major cryptocurrencies with enterprise features.',
            version: '1.5.0',
            author: 'CryptoGate Ltd',
            license: 'enterprise',
            price: 199.99,
            methods: ['bitcoin', 'ethereum', 'litecoin', 'dogecoin'],
            features: [
              'Multi_Crypto_Support',
              'Auto_Conversion',
              'Cold_Storage',
              'Tax_Reporting',
              'Compliance_Tools',
              'Advanced_Analytics'
            ],
            isInstalled: false,
            isActive: false,
            supportedCurrencies: ['BTC', 'ETH', 'LTC', 'DOGE'],
            supportedRegions: ['GLOBAL'],
            category: 'payment',
            tags: ['crypto', 'enterprise', 'compliance'],
            rating: 4.6,
            downloads: 450
          }
        ]
      }
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Payment plugins marketplace API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch payment plugins' 
      },
      { status: 500 }
    );
  }
}
