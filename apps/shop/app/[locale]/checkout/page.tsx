/**
 * Checkout Page for Shop Application
 *
 * Handles the checkout process with payment integration.
 * Supports i18n through the translation function.
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { ordersApi, paymentApi } from '@/lib/api';
import { useT } from 'shared/src/i18n/react';
import { toast } from '@/components/ui/toaster';
import type { CheckoutFormData } from 'shared/src/types/theme';

export default function CheckoutPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { cart } = useCartStore();
  const t = useT();
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Redirect if cart is empty
  React.useEffect(() => {
    if (cart.items.length === 0) {
      nav.push('/cart');
    }
  }, [cart.items.length, nav]);

  // Handle form submit
  const handleSubmit = async (data: CheckoutFormData) => {
    setIsProcessing(true);

    try {
      // 1. Create order
      const orderResponse = await ordersApi.createOrder({
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
        })),
        shippingAddress: {
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country
        },
        customerEmail: data.email,
      });

      if (!orderResponse || !orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse?.message || getText('common.errors.general', 'Failed to create order'));
      }

      const order = orderResponse.data as { id: string };
      const orderId = order.id;

      // 2. Create payment session using unified payment gateway
      const paymentResponse = await paymentApi.createSession({
        paymentMethod: data.paymentMethod,
        orderId: orderId,
        successUrl: `${window.location.origin}${nav.getHref('/order-success')}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}${nav.getHref('/checkout')}`
      });

      console.log('Payment response:', JSON.stringify(paymentResponse, null, 2));

      if (!paymentResponse || !paymentResponse.success || !paymentResponse.data) {
        throw new Error(paymentResponse?.message || getText('common.errors.general', 'Failed to create payment session'));
      }

      // 3. Redirect to payment page
      const sessionData = paymentResponse.data as any;
      const paymentUrl = sessionData.url || sessionData.data?.url;

      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        console.error('paymentResponse.data does not have url:', paymentResponse.data);
        throw new Error('Invalid payment session response');
      }
    } catch (error: any) {
      console.error('Order failed:', error);
      const errorMessage = error.response?.data?.message || error.message || getText('common.errors.general', 'Failed to process order. Please try again.');
      toast({
        title: getText('common.errors.orderFailed', 'Order Failed'),
        description: errorMessage,
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    nav.push('/cart');
  };

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-gray-600">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // Cart is empty, waiting for redirect
  if (cart.items.length === 0) {
    return null;
  }

  // If theme component is unavailable, use NotFound fallback
  if (!theme?.components?.CheckoutPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/checkout"
          message={getText('common.errors.checkoutUnavailable', 'Checkout component unavailable')}
          config={config}
          onGoHome={() => nav.push('/')}
          t={t}
        />
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.checkoutUnavailable', 'Unable to load checkout component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const CheckoutPageComponent = theme.components.CheckoutPage;

  return (
    <CheckoutPageComponent
      cart={cart}
      isLoading={false}
      isProcessing={isProcessing}
      config={config}
      locale={nav.locale}
      t={t}
      onSubmit={handleSubmit}
      onBack={handleBack}
    />
  );
}
