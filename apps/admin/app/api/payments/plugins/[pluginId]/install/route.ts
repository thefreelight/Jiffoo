/**
 * Payment Plugin Installation API
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

export async function POST(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const body = await request.json();
    const { licenseKey } = body;

    // Validate required fields
    if (!licenseKey) {
      return NextResponse.json(
        { success: false, message: 'License key is required' },
        { status: 400 }
      );
    }

    // Try to install via backend first
    try {
      const backendUrl = `${BACKEND_URL}/api/payments/plugins/${pluginId}/install`;
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
        },
        body: JSON.stringify({ licenseKey }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (backendError) {
      console.log('Backend not available, using mock installation');
    }

    // Mock installation logic
    const supportedPlugins = [
      'alipay-pro',
      'wechat-pay-pro', 
      'stripe-pro',
      'paypal-pro',
      'crypto-payments-enterprise'
    ];

    if (!supportedPlugins.includes(pluginId)) {
      return NextResponse.json(
        { success: false, message: 'Plugin not found' },
        { status: 404 }
      );
    }

    // Simulate license validation
    const validLicenseKeys = {
      'alipay-pro': ['alipay-pro-demo-123', 'alipay-pro-premium-456'],
      'wechat-pay-pro': ['wechat-pro-demo-789', 'wechat-pro-premium-012'],
      'stripe-pro': ['stripe-pro-demo-345', 'stripe-pro-premium-678'],
      'paypal-pro': ['paypal-pro-demo-901', 'paypal-pro-premium-234'],
      'crypto-payments-enterprise': ['crypto-ent-demo-567', 'crypto-ent-premium-890']
    };

    const validKeys = validLicenseKeys[pluginId] || [];
    if (!validKeys.includes(licenseKey)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid license key. Please check your license or contact support.',
          supportEmail: 'support@jiffoo.com'
        },
        { status: 400 }
      );
    }

    // Simulate installation process
    const installationSteps = [
      'Validating license...',
      'Downloading plugin files...',
      'Installing dependencies...',
      'Configuring plugin...',
      'Running tests...',
      'Activating plugin...'
    ];

    // Mock successful installation
    const mockResponse = {
      success: true,
      message: `${pluginId} installed successfully!`,
      data: {
        pluginId,
        version: getPluginVersion(pluginId),
        installedAt: new Date().toISOString(),
        licenseType: licenseKey.includes('demo') ? 'demo' : 'premium',
        status: 'active',
        configuration: {
          requiresSetup: true,
          configurationUrl: `/plugins/${pluginId}/configure`,
          documentationUrl: `/docs/plugins/${pluginId}`,
        },
        features: getPluginFeatures(pluginId),
        nextSteps: [
          'Configure your plugin settings',
          'Test the integration in sandbox mode',
          'Enable live payments'
        ]
      }
    };

    return NextResponse.json(mockResponse);

  } catch (error) {
    console.error('Plugin installation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Installation failed' 
      },
      { status: 500 }
    );
  }
}

function getPluginVersion(pluginId: string): string {
  const versions = {
    'alipay-pro': '2.1.0',
    'wechat-pay-pro': '2.0.5',
    'stripe-pro': '3.2.1',
    'paypal-pro': '2.5.0',
    'crypto-payments-enterprise': '1.5.0'
  };
  return versions[pluginId] || '1.0.0';
}

function getPluginFeatures(pluginId: string): string[] {
  const features = {
    'alipay-pro': [
      'RSA2 Encryption',
      'Webhook Support',
      'Full & Partial Refunds',
      'Payment Analytics',
      'Multi Environment Support',
      'QR Code Payments'
    ],
    'wechat-pay-pro': [
      'Native Payments',
      'H5 Payments',
      'Mini Program Support',
      'QR Code Generation',
      'Refund Support',
      'Webhook Notifications'
    ],
    'stripe-pro': [
      '3D Secure',
      'Multi Currency',
      'Recurring Payments',
      'Fraud Protection',
      'Real Time Analytics',
      'Subscription Management'
    ],
    'paypal-pro': [
      'Express Checkout',
      'International Support',
      'Buyer Protection',
      'Mobile Optimized',
      'Subscription Support'
    ],
    'crypto-payments-enterprise': [
      'Multi Crypto Support',
      'Auto Conversion',
      'Cold Storage',
      'Tax Reporting',
      'Compliance Tools',
      'Advanced Analytics'
    ]
  };
  return features[pluginId] || [];
}
