'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { SafeImage } from '@/components/ui/safe-image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const { currentLanguage } = useTranslation();
  const router = useRouter();
  const { cart, updateQuantity, removeItem, isLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Shopping Cart',
      emptyCart: 'Your cart is empty',
      emptyCartDesc: 'Add some products to get started',
      continueShopping: 'Continue Shopping',
      quantity: 'Quantity',
      remove: 'Remove',
      subtotal: 'Subtotal',
      tax: 'Tax',
      shipping: 'Shipping',
      total: 'Total',
      proceedToCheckout: 'Proceed to Checkout',
      free: 'Free',
      items: 'items',
    },
    'zh-CN': {
      title: '购物车',
      emptyCart: '购物车为空',
      emptyCartDesc: '添加一些商品开始购物',
      continueShopping: '继续购物',
      quantity: '数量',
      remove: '移除',
      subtotal: '小计',
      tax: '税费',
      shipping: '运费',
      total: '总计',
      proceedToCheckout: '去结账',
      free: '免费',
      items: '件商品',
    },
    'ja-JP': {
      title: 'ショッピングカート',
      emptyCart: 'カートは空です',
      emptyCartDesc: '商品を追加してショッピングを始めましょう',
      continueShopping: 'ショッピングを続ける',
      quantity: '数量',
      remove: '削除',
      subtotal: '小計',
      tax: '税金',
      shipping: '送料',
      total: '合計',
      proceedToCheckout: 'チェックアウトへ',
      free: '無料',
      items: '個の商品',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    try {
      await updateQuantity(itemId, newQuantity);
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const handleCheckout = () => {
    // 检查用户是否已登录
    if (!isAuthenticated) {
      // 保存当前路径，登录后可以返回
      sessionStorage.setItem('redirectAfterLogin', '/checkout');
      router.push('/auth/login');
      return;
    }
    
    router.push('/checkout');
  };

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
            
            <div className="text-center py-16">
              <ShoppingBag className="h-24 w-24 mx-auto text-muted-foreground mb-6" />
              <h2 className="text-2xl font-semibold mb-4">{t('emptyCart')}</h2>
              <p className="text-muted-foreground mb-8">{t('emptyCartDesc')}</p>
              <Button onClick={() => router.push('/products')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('continueShopping')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <span className="text-muted-foreground">
              ({cart.itemCount} {t('items')})
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6"
                >
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                      <SafeImage
                        src={item.productImage}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        fallbackIcon={<ShoppingBag className="h-8 w-8 text-gray-400" />}
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.productName}</h3>
                      {item.variantName && (
                        <p className="text-sm text-muted-foreground mb-2">{item.variantName}</p>
                      )}
                      <p className="text-lg font-bold">${item.price}</p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex flex-col items-end gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isLoading || item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="px-4 py-2 min-w-[3rem] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isLoading || item.quantity >= item.maxQuantity}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 sticky top-8"
              >
                <h2 className="text-xl font-semibold mb-6">Order Summary</h2>
                
                <div className="space-y-4">
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

                <Button 
                  className="w-full mt-6" 
                  size="lg"
                  onClick={handleCheckout}
                  disabled={isLoading}
                >
                  {t('proceedToCheckout')}
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  onClick={() => router.push('/products')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('continueShopping')}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
