'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Truck, Shield, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import { useCartStore } from '@/store/cart';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { SafeImage } from '@/components/ui/safe-image';

export default function CheckoutPage() {
  const { currentLanguage } = useTranslation();
  const router = useRouter();
  const { cart, clearCart } = useCartStore();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [formData, setFormData] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'US'
  });

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Checkout',
      backToCart: 'Back to Cart',
      contactInfo: 'Contact Information',
      email: 'Email',
      shippingAddress: 'Shipping Address',
      firstName: 'First Name',
      lastName: 'Last Name',
      address: 'Address',
      city: 'City',
      postalCode: 'Postal Code',
      country: 'Country',

      orderSummary: 'Order Summary',
      subtotal: 'Subtotal',
      tax: 'Tax',
      shipping: 'Shipping',
      total: 'Total',
      placeOrder: 'Continue to Payment',
      processing: 'Processing...',
      free: 'Free',
      secureCheckout: 'Secure Checkout',
      items: 'items',
    },
    'zh-CN': {
      title: '结账',
      backToCart: '返回购物车',
      contactInfo: '联系信息',
      email: '邮箱',
      shippingAddress: '收货地址',
      firstName: '名',
      lastName: '姓',
      address: '地址',
      city: '城市',
      postalCode: '邮政编码',
      country: '国家',

      orderSummary: '订单摘要',
      subtotal: '小计',
      tax: '税费',
      shipping: '运费',
      total: '总计',
      placeOrder: '继续支付',
      processing: '处理中...',
      free: '免费',
      secureCheckout: '安全结账',
      items: '件商品',
    },
    'ja-JP': {
      title: 'チェックアウト',
      backToCart: 'カートに戻る',
      contactInfo: '連絡先情報',
      email: 'メールアドレス',
      shippingAddress: '配送先住所',
      firstName: '名',
      lastName: '姓',
      address: '住所',
      city: '市区町村',
      postalCode: '郵便番号',
      country: '国',
      paymentMethod: '支払い方法',
      cardNumber: 'カード番号',
      expiryDate: '月/年',
      cvv: 'セキュリティコード',
      cardName: 'カード名義',
      orderSummary: '注文概要',
      subtotal: '小計',
      tax: '税金',
      shipping: '送料',
      total: '合計',
      placeOrder: '支払いに進む',
      processing: '処理中...',
      free: '無料',
      secureCheckout: 'セキュアチェックアウト',
      items: '個の商品',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Create order first
      const orderResponse = await apiClient.post('/api/orders', {
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        shippingAddress: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          address: formData.address,
          city: formData.city,
          postalCode: formData.postalCode,
          country: formData.country
        },
        customerEmail: formData.email,
        total: cart.total
      });

      if (!orderResponse || !orderResponse.order) {
        throw new Error('Failed to create order');
      }

      const order = orderResponse.order;
      const orderId = order.id;

      // Create Stripe checkout session
      const checkoutResponse = await apiClient.post('/plugins/stripe-official/api/create-checkout-session', {
        amount: cart.total,
        currency: 'USD',
        orderId: orderId,
        customerEmail: formData.email,
        successUrl: `${window.location.origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/checkout`,
        items: cart.items.map(item => ({
          name: item.productName,
          description: item.productName, // Use productName as description since we don't have a separate description field
          quantity: item.quantity,
          price: item.price,
          images: item.productImage ? [item.productImage] : []
        })),
        metadata: {
          orderId: orderId,
          customerEmail: formData.email
        }
      });

      if (!checkoutResponse || !checkoutResponse.success) {
        throw new Error('Failed to create checkout session');
      }

      const checkoutSession = checkoutResponse;

      if (checkoutSession && checkoutSession.url) {
        // Redirect to Stripe Checkout
        window.location.href = checkoutSession.url;
      } else {
        throw new Error('Invalid checkout session response');
      }
    } catch (error) {
      console.error('Order failed:', error);
      alert('Failed to process order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Redirect if cart is empty
  React.useEffect(() => {
    if (cart.items.length === 0) {
      router.push('/cart');
    }
  }, [cart.items.length, router]);

  if (cart.items.length === 0) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/cart')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              {t('secureCheckout')}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Checkout Form */}
            <div className="space-y-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Contact Information */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6"
                >
                  <h2 className="text-xl font-semibold mb-4">{t('contactInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">{t('email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Shipping Address */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6"
                >
                  <h2 className="text-xl font-semibold mb-4">{t('shippingAddress')}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">{t('firstName')}</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">{t('lastName')}</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="address">{t('address')}</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">{t('city')}</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">{t('postalCode')}</Label>
                      <Input
                        id="postalCode"
                        value={formData.postalCode}
                        onChange={(e) => handleInputChange('postalCode', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </motion.div>



                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={isProcessing}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isProcessing ? t('processing') : t('placeOrder')}
                </Button>
              </form>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 sticky top-8"
              >
                <h2 className="text-xl font-semibold mb-6">{t('orderSummary')}</h2>
                
                {/* Cart Items */}
                <div className="space-y-4 mb-6">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden">
                        <SafeImage
                          src={item.productImage}
                          alt={item.productName}
                          fill
                          className="object-cover"
                          fallbackIcon={<ShoppingBag className="h-4 w-4 text-gray-400" />}
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.productName}</h4>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        <p className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <hr className="mb-4" />
                
                {/* Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>{t('subtotal')}</span>
                    <span>${cart.subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{t('tax')}</span>
                    <span>${cart.tax.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{t('shipping')}</span>
                    <span>{cart.shipping === 0 ? t('free') : `$${cart.shipping.toFixed(2)}`}</span>
                  </div>
                  
                  <hr />
                  
                  <div className="flex justify-between text-lg font-semibold">
                    <span>{t('total')}</span>
                    <span>${cart.total.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
