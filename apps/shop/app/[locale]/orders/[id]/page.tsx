/**
 * Order Detail Page for Shop Application
 *
 * Displays detailed information about a specific order.
 * Supports i18n through the translation function.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useToast } from '@/hooks/use-toast';
import { ordersApi } from '@/lib/api';
import { type Order, PaymentStatus } from 'shared/src';
import { useT } from 'shared/src/i18n/react';

export default function OrderDetailPage() {
  const params = useParams();
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const t = useT();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersApi.getOrder(orderId);

      if (response.success && response.data) {
        setOrder(response.data);
      } else {
        setError(response.message || getText('shop.orders.fetchFailed', 'Failed to fetch order details'));
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || getText('shop.orders.fetchFailed', 'Failed to fetch order details'));
    } finally {
      setLoading(false);
    }
  }, [orderId, getText]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  // Handle cancel order
  const handleCancelOrder = async () => {
    if (!order) return;
    if (!confirm(getText('shop.orders.confirmCancel', 'Are you sure you want to cancel this order?'))) return;

    try {
      setLoading(true);
      const response = await ordersApi.cancelOrder(order.id, 'Cancelled by user');

      if (response.success) {
        toast({
          title: getText('shop.orders.orderCancelled', 'Order cancelled'),
          description: getText('shop.orders.cancelSuccess', 'Order cancelled successfully'),
        });
        fetchOrder();
      } else {
        toast({
          title: getText('shop.orders.cancelFailed', 'Cancel failed'),
          description: response.message || getText('shop.orders.cancelFailed', 'Failed to cancel order'),
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error.message || getText('shop.orders.cancelFailed', 'Failed to cancel order'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

  // If theme component is not available, use NotFound fallback
  if (!theme?.components?.OrderDetailPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route={`/orders/${orderId}`}
          message={getText('common.errors.componentUnavailable', 'Order detail page component is not available')}
          config={config}
          locale={nav.locale}
          t={t}
          onGoHome={() => nav.push('/')}
        />
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load order detail page component')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-gray-600">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route={`/orders/${orderId}`}
          message={error || getText('shop.orders.notFound', 'The order you are looking for does not exist.')}
          config={config}
          locale={nav.locale}
          t={t}
          onGoHome={() => nav.push('/orders')}
        />
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{getText('shop.orders.notFound', 'Order Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{error || getText('shop.orders.notFoundDescription', 'The order you are looking for does not exist.')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const OrderDetailPageComponent = theme.components.OrderDetailPage;

  return (
    <OrderDetailPageComponent
      order={order}
      isLoading={loading}
      config={config}
      locale={nav.locale}
      t={t}
      onCancelOrder={handleCancelOrder}
      onBackToOrders={() => nav.push('/orders')}
    />
  );
}
