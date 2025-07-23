'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import Link from 'next/link';

export default function OrderSuccessPage() {
  const { currentLanguage } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCartStore();
  const [orderNumber, setOrderNumber] = React.useState<string>('');
  const [isVerifying, setIsVerifying] = React.useState(true);

  // Handle Stripe checkout session verification
  React.useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (sessionId) {
      // Verify the Stripe session and get order details
      verifyStripeSession(sessionId);
    } else {
      // Fallback to mock order number if no session_id
      setOrderNumber(`JF${Date.now().toString().slice(-6)}`);
      setIsVerifying(false);
      clearCart();
    }
  }, [searchParams, clearCart]);

  const verifyStripeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/plugins/stripe/verify-session?session_id=${sessionId}`);

      if (response.ok) {
        const data = await response.json();
        setOrderNumber(data.orderId || `JF${Date.now().toString().slice(-6)}`);
        // Clear cart after successful payment verification
        await clearCart();
      } else {
        // Fallback if verification fails
        setOrderNumber(`JF${Date.now().toString().slice(-6)}`);
      }
    } catch (error) {
      console.error('Failed to verify Stripe session:', error);
      setOrderNumber(`JF${Date.now().toString().slice(-6)}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Order Confirmed!',
      subtitle: 'Thank you for your purchase',
      orderNumber: 'Order Number',
      description: 'Your order has been successfully placed and is being processed.',
      emailSent: 'A confirmation email has been sent to your email address.',
      trackingInfo: 'You will receive tracking information once your order ships.',
      continueShopping: 'Continue Shopping',
      viewOrders: 'View My Orders',
      estimatedDelivery: 'Estimated Delivery',
      businessDays: '3-5 business days',
      whatNext: 'What happens next?',
      step1: 'Order Processing',
      step1Desc: 'We\'ll prepare your items for shipment',
      step2: 'Shipping',
      step2Desc: 'Your order will be shipped and you\'ll receive tracking info',
      step3: 'Delivery',
      step3Desc: 'Your package will arrive at your doorstep',
    },
    'zh-CN': {
      title: '订单确认！',
      subtitle: '感谢您的购买',
      orderNumber: '订单号',
      description: '您的订单已成功下单并正在处理中。',
      emailSent: '确认邮件已发送到您的邮箱。',
      trackingInfo: '订单发货后您将收到物流跟踪信息。',
      continueShopping: '继续购物',
      viewOrders: '查看我的订单',
      estimatedDelivery: '预计送达',
      businessDays: '3-5个工作日',
      whatNext: '接下来会发生什么？',
      step1: '订单处理',
      step1Desc: '我们将为您准备商品并打包',
      step2: '发货',
      step2Desc: '您的订单将被发货，您会收到物流信息',
      step3: '送达',
      step3Desc: '包裹将送达您的门口',
    },
    'ja-JP': {
      title: '注文確認！',
      subtitle: 'ご購入ありがとうございます',
      orderNumber: '注文番号',
      description: 'ご注文が正常に処理され、現在処理中です。',
      emailSent: '確認メールがお客様のメールアドレスに送信されました。',
      trackingInfo: '商品が発送されると追跡情報をお送りします。',
      continueShopping: 'ショッピングを続ける',
      viewOrders: '注文履歴を見る',
      estimatedDelivery: '配送予定',
      businessDays: '3-5営業日',
      whatNext: '次に何が起こりますか？',
      step1: '注文処理',
      step1Desc: '商品の準備と梱包を行います',
      step2: '発送',
      step2Desc: 'ご注文が発送され、追跡情報をお送りします',
      step3: '配達',
      step3Desc: 'パッケージがお客様の玄関先に届きます',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="mb-8"
          >
            <CheckCircle className="h-24 w-24 text-green-500 mx-auto" />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-green-600 mb-4">{t('title')}</h1>
            <p className="text-xl text-muted-foreground">{t('subtitle')}</p>
          </motion.div>

          {/* Order Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 mb-8"
          >
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-2">{t('orderNumber')}</p>
              <p className="text-2xl font-bold font-mono">{orderNumber}</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <p>{t('description')}</p>
              </div>
              
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
                <p>{t('emailSent')}</p>
              </div>
              
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-orange-500 mt-0.5" />
                <p>{t('trackingInfo')}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">{t('estimatedDelivery')}</span>
                <span className="text-primary font-semibold">{t('businessDays')}</span>
              </div>
            </div>
          </motion.div>

          {/* What's Next */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-6">{t('whatNext')}</h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">1</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium mb-1">{t('step1')}</h3>
                  <p className="text-sm text-muted-foreground">{t('step1Desc')}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 dark:text-orange-400 font-semibold text-sm">2</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium mb-1">{t('step2')}</h3>
                  <p className="text-sm text-muted-foreground">{t('step2Desc')}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 font-semibold text-sm">3</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium mb-1">{t('step3')}</h3>
                  <p className="text-sm text-muted-foreground">{t('step3Desc')}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button 
              size="lg"
              onClick={() => router.push('/products')}
            >
              {t('continueShopping')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => router.push('/orders')}
            >
              {t('viewOrders')}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
