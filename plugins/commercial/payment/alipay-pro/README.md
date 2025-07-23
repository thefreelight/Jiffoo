# Alipay Professional Plugin

A comprehensive Alipay payment integration plugin for Jiffoo Mall with advanced features for production use.

## 🌟 Features

### Core Payment Features
- ✅ **Web Payments** - Desktop browser payments
- ✅ **WAP Payments** - Mobile browser payments  
- ✅ **App Payments** - Native mobile app integration
- ✅ **QR Code Payments** - Generate QR codes for payments
- ✅ **Instant Notifications** - Real-time payment status updates

### Advanced Features
- ✅ **Full Refunds** - Complete transaction refunds
- ✅ **Partial Refunds** - Refund specific amounts
- ✅ **Webhook Support** - Secure payment notifications
- ✅ **Payment Analytics** - Detailed transaction reporting
- ✅ **Multi-environment** - Sandbox and production support

### Security & Compliance
- ✅ **RSA2 Encryption** - Industry-standard security
- ✅ **Signature Verification** - Prevent tampering
- ✅ **License Validation** - Commercial license protection
- ✅ **Usage Tracking** - Monitor API usage

## 💰 Pricing

- **Professional Plan**: $39.99/month
- **Enterprise Plan**: $99.99/month (includes analytics)
- **Demo Version**: 100 free transactions

## 🚀 Quick Start

### 1. Installation

```bash
# Install the plugin
npm install @jiffoo/alipay-pro

# Or add to your package.json
{
  "dependencies": {
    "@jiffoo/alipay-pro": "^2.1.0"
  }
}
```

### 2. Configuration

```typescript
import { AlipayProPlugin } from '@jiffoo/alipay-pro';

const alipayConfig = {
  appId: 'your_alipay_app_id',
  privateKey: 'your_rsa_private_key',
  alipayPublicKey: 'alipay_public_key',
  signType: 'RSA2',
  charset: 'utf-8',
  sandbox: false, // Set to true for testing
  notifyUrl: 'https://your-domain.com/webhooks/alipay',
  returnUrl: 'https://your-domain.com/payment/success',
  licenseKey: 'your_commercial_license_key',
  domain: 'your-domain.com'
};

const alipayPlugin = new AlipayProPlugin(alipayConfig);
await alipayPlugin.initialize();
```

### 3. Create Payment

```typescript
const paymentRequest = {
  orderId: 'order_123456',
  amount: { value: 99.99, currency: 'CNY' },
  description: 'Premium Product Purchase',
  customer: {
    email: 'customer@example.com',
    id: 'user_123'
  },
  metadata: {
    paymentType: 'web', // 'web', 'wap', or 'app'
    timeoutExpress: '30m'
  }
};

const result = await alipayPlugin.createPayment(paymentRequest);

if (result.success) {
  // Redirect user to payment URL
  window.location.href = result.payUrl;
}
```

### 4. Handle Webhooks

```typescript
app.post('/webhooks/alipay', async (req, res) => {
  const webhookEvent = {
    data: req.body,
    headers: req.headers
  };

  // Verify webhook signature
  const isValid = await alipayPlugin.verifyWebhook(webhookEvent);
  
  if (isValid) {
    // Process the webhook
    await alipayPlugin.handleWebhook(webhookEvent);
    res.status(200).send('success');
  } else {
    res.status(400).send('invalid signature');
  }
});
```

## 📋 Configuration Options

### Required Fields
- `appId` - Your Alipay App ID
- `privateKey` - RSA private key for signing
- `alipayPublicKey` - Alipay public key for verification

### Optional Fields
- `sandbox` - Use sandbox environment (default: false)
- `signType` - Signature algorithm: 'RSA2' or 'RSA' (default: 'RSA2')
- `charset` - Character encoding: 'utf-8' or 'gbk' (default: 'utf-8')
- `notifyUrl` - Webhook notification URL
- `returnUrl` - Return URL after payment

## 🔧 API Reference

### Payment Methods

```typescript
// Create payment
await alipayPlugin.createPayment(request);

// Verify payment status
await alipayPlugin.verifyPayment(paymentId);

// Cancel payment
await alipayPlugin.cancelPayment(paymentId);

// Process refund
await alipayPlugin.refund(refundRequest);

// Get refund status
await alipayPlugin.getRefund(refundId);

// Health check
await alipayPlugin.healthCheck();
```

### Analytics (Enterprise Only)

```typescript
const analytics = await alipayPlugin.getAnalytics(
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

console.log(analytics.totalTransactions);
console.log(analytics.successRate);
```

## 🛡️ Security Best Practices

1. **Keep Keys Secure**: Store private keys in environment variables
2. **Use HTTPS**: Always use HTTPS for webhook URLs
3. **Verify Signatures**: Always verify webhook signatures
4. **Monitor Usage**: Track API usage and set alerts
5. **Regular Updates**: Keep the plugin updated

## 🐛 Troubleshooting

### Common Issues

**Invalid Signature Error**
```
Error: Invalid signature in Alipay notification
```
- Check your private key format
- Ensure correct sign_type configuration
- Verify webhook URL is accessible

**License Validation Failed**
```
Error: Alipay Pro requires valid license
```
- Check your license key
- Verify domain configuration
- Contact support for license issues

**Payment Creation Failed**
```
Error: Alipay API Error: Invalid app_id
```
- Verify your App ID
- Check sandbox/production environment
- Ensure app is properly configured in Alipay dashboard

## 📞 Support

- **Documentation**: [https://docs.jiffoo.com/plugins/alipay-pro](https://docs.jiffoo.com/plugins/alipay-pro)
- **Support Email**: support@jiffoo.com
- **GitHub Issues**: [https://github.com/jiffoo/jiffoo-mall-core/issues](https://github.com/jiffoo/jiffoo-mall-core/issues)

## 📄 License

This is a commercial plugin. See LICENSE-COMMERCIAL.md for details.

---

Made with ❤️ by the Jiffoo Team
