/**
 * Order Success Page for Shop Application
 *
 * Displays order confirmation after successful payment.
 * Supports i18n through the translation function.
 */

'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n';

function OrderSuccessContent() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const searchParams = useSearchParams();
  const nav = useLocalizedNavigation();
  const { clearCart } = useCartStore();
  const t = useT();
  const [orderNumber, setOrderNumber] = React.useState<string>('');
  const [isVerifying, setIsVerifying] = React.useState(true);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const verifyStripeSession = React.useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/plugins/stripe/api/verify-session?session_id=${sessionId}`);

      if (response.ok) {
        const data = await response.json();
        setOrderNumber(data.orderId || `JF${Date.now().toString().slice(-6)}`);
        await clearCart();
      } else {
        setOrderNumber(`JF${Date.now().toString().slice(-6)}`);
      }
    } catch (error) {
      console.error('Failed to verify Stripe session:', error);
      setOrderNumber(`JF${Date.now().toString().slice(-6)}`);
    } finally {
      setIsVerifying(false);
    }
  }, [clearCart]);

  React.useEffect(() => {
    const sessionId = searchParams?.get('session_id');

    if (sessionId) {
      verifyStripeSession(sessionId);
    } else {
      setOrderNumber(`JF${Date.now().toString().slice(-6)}`);
      setIsVerifying(false);
      clearCart();
    }
  }, [searchParams, clearCart, verifyStripeSession]);

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

  // If theme component is unavailable, use NotFound fallback
  if (!theme?.components?.OrderSuccessPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/order-success"
          message={getText('common.errors.componentUnavailable', 'Order success page component unavailable')}
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
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load order success page component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const OrderSuccessPageComponent = theme.components.OrderSuccessPage;

  return (
    <OrderSuccessPageComponent
      orderNumber={orderNumber}
      isVerifying={isVerifying}
      config={config}
      locale={nav.locale}
      t={t}
      onContinueShopping={() => nav.push('/products')}
      onViewOrders={() => nav.push('/orders')}
    />
  );
}

export default function OrderSuccessPage() {
  const t = useT();
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  return (
    <Suspense fallback={<div>{getText('common.actions.loading', 'Loading...')}</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
