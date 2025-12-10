/**
 * Orders Page for Shop Application
 *
 * Displays user's order history with pagination.
 * Supports i18n through the translation function.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { ordersApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useT } from 'shared/src/i18n';
import type { Order } from 'shared/src/types/order';

export default function OrdersPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const t = useT();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Helper function for translations with fallback
  const getText = useCallback((key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  }, [t]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersApi.getOrders({});

      if (response.success && response.data) {
        // Handle paginated response
        if ((response.data as unknown as { items?: Order[] }).items) {
          setOrders((response.data as unknown as { items: Order[] }).items);
          if ((response.data as unknown as { totalPages?: number }).totalPages) {
            setTotalPages((response.data as unknown as { totalPages: number }).totalPages);
          }
        } else {
          // Handle direct array response
          setOrders(response.data as unknown as Order[]);
        }
      } else {
        setError(response.message || getText('common.errors.general', 'Failed to fetch orders'));
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || getText('common.errors.general', 'Failed to fetch orders'));
    } finally {
      setLoading(false);
    }
  }, [getText]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, currentPage]);

  // Handle retry payment
  const handleRetryPayment = async (orderId: string) => {
    try {
      setLoading(true);
      const response = await ordersApi.retryPayment(orderId, 'stripe');

      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast({
          title: getText('shop.orders.paymentFailed', 'Payment failed'),
          description: response.message || getText('common.errors.general', 'Failed to create payment session'),
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error.message || getText('common.errors.general', 'Failed to retry payment'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel order
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm(getText('shop.orders.confirmCancel', 'Are you sure you want to cancel this order?'))) {
      return;
    }

    try {
      setLoading(true);
      const response = await ordersApi.cancelOrder(orderId, 'Cancelled by user');

      if (response.success) {
        toast({
          title: getText('shop.orders.orderCancelled', 'Order cancelled'),
          description: getText('shop.orders.cancelSuccess', 'Order cancelled successfully'),
        });
        fetchOrders();
      } else {
        toast({
          title: getText('shop.orders.cancelFailed', 'Cancel failed'),
          description: response.message || getText('common.errors.general', 'Failed to cancel order'),
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error.message || getText('common.errors.general', 'Failed to cancel order'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle order click
  const handleOrderClick = (orderId: string) => {
    nav.push(`/orders/${orderId}`);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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

  // If theme component is unavailable, use NotFound fallback
  if (!theme?.components?.OrdersPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/orders"
          message={getText('common.errors.componentUnavailable', 'Orders page component unavailable')}
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
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load orders page component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const OrdersPageComponent = theme.components.OrdersPage;

  return (
    <OrdersPageComponent
      orders={orders}
      isLoading={loading}
      error={error}
      currentPage={currentPage}
      totalPages={totalPages}
      config={config}
      locale={nav.locale}
      t={t}
      onOrderClick={handleOrderClick}
      onPageChange={handlePageChange}
      onRetryPayment={handleRetryPayment}
      onCancelOrder={handleCancelOrder}
    />
  );
}
