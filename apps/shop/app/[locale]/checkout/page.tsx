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
import { useAuthStore } from '@/store/auth';
import { useStoreContext } from '@/store/store';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { ordersApi, paymentApi } from '@/lib/api';
import { useT } from 'shared/src/i18n/react';
import { toast } from '@/components/ui/toaster';
import { LoadingState, ErrorState } from '@/components/ui/state-components';
import type { CheckoutFormData } from 'shared/src/types/theme';
import type { Cart } from 'shared/src/types/cart';
import {
  clearSelectedCartItemIds,
  persistSelectedCartItemIds,
  readSelectedCartItemIds,
} from '@/lib/checkout-selection';
import { StripeCheckoutModal } from '@/components/stripe-checkout-modal';

type PaymentMethodOption = {
  name: string;
  displayName: string;
  icon?: string;
  clientConfig?: {
    publishableKey?: string;
  } | null;
};

const readLegacyStripeIntentResponse = (
  response: unknown
): { clientSecret: string; paymentIntentId: string } | null => {
  const payload = response as { clientSecret?: unknown; paymentIntentId?: unknown } | null;
  if (typeof payload?.clientSecret !== 'string' || payload.clientSecret.length === 0) {
    return null;
  }

  return {
    clientSecret: payload.clientSecret,
    paymentIntentId: typeof payload.paymentIntentId === 'string' ? payload.paymentIntentId : '',
  };
};

export default function CheckoutPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { cart } = useCartStore();
  const { user } = useAuthStore();
  const storeContext = useStoreContext();
  const t = useT();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = React.useState<PaymentMethodOption[]>([]);
  const [selectedCartItemIds, setSelectedCartItemIds] = React.useState<string[] | null>(null);

  // Stripe Elements integration state
  const [stripeClientSecret, setStripeClientSecret] = React.useState<string | null>(null);
  const [stripeOrderId, setStripeOrderId] = React.useState<string | null>(null);
  const [stripePublishableKey, setStripePublishableKey] = React.useState<string | null>(null);
  const [isStripeModalOpen, setIsStripeModalOpen] = React.useState(false);
  const fallbackStripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  React.useEffect(() => {
    setSelectedCartItemIds(readSelectedCartItemIds());
  }, []);

  const checkoutItems = React.useMemo(() => {
    if (!selectedCartItemIds || selectedCartItemIds.length === 0) {
      return cart.items;
    }

    const selectedIdSet = new Set(selectedCartItemIds);
    return cart.items.filter((item) => selectedIdSet.has(item.id));
  }, [cart.items, selectedCartItemIds]);

  const requireShippingAddress = React.useMemo(
    () => checkoutItems.some((item) => item.requiresShipping !== false),
    [checkoutItems]
  );
  const countriesRequireStatePostal = React.useMemo(
    () => storeContext?.checkout?.countriesRequireStatePostal || ['US', 'CA', 'AU', 'CN', 'GB'],
    [storeContext?.checkout?.countriesRequireStatePostal]
  );

  const checkoutCart = React.useMemo<Cart>(() => {
    const subtotal = checkoutItems.reduce((sum, item) => sum + item.subtotal, 0);
    const ratio = cart.subtotal > 0 ? subtotal / cart.subtotal : 0;
    const tax = Number(((cart.tax || 0) * ratio).toFixed(2));
    const shipping = Number(((cart.shipping || 0) * ratio).toFixed(2));
    const discount = Number(((cart.discount || 0) * ratio).toFixed(2));
    const total = Number((subtotal + tax + shipping - discount).toFixed(2));
    const itemCount = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...cart,
      items: checkoutItems,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      itemCount,
    };
  }, [cart, checkoutItems]);

  // Redirect if cart is empty
  React.useEffect(() => {
    if (cart.items.length === 0) {
      clearSelectedCartItemIds();
      nav.push('/cart');
    }
  }, [cart.items.length, nav]);

  React.useEffect(() => {
    if (cart.items.length === 0) return;
    if (checkoutItems.length > 0) return;

    toast({
      title: 'Invalid Checkout Selection',
      description: 'Selected items are no longer available in cart',
      variant: 'destructive',
    });
    clearSelectedCartItemIds();
    nav.push('/cart');
  }, [cart.items.length, checkoutItems.length, nav]);

  React.useEffect(() => {
    let mounted = true;

    const loadPaymentMethods = async () => {
      try {
        const response = await paymentApi.getAvailableMethods();
        if (!mounted) return;
        if (response.success && Array.isArray(response.data)) {
          setAvailablePaymentMethods(
            response.data
              .map((method) => ({
                name: method?.name || '',
                displayName: method?.displayName || method?.name || '',
                icon: method?.icon,
                clientConfig: method?.clientConfig || null,
              }))
              .filter((method) => method.name.length > 0)
          );
        }
      } catch (error) {
        console.warn('Failed to load available payment methods:', error);
      }
    };

    loadPaymentMethods();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle form submit
  const handleSubmit = async (data: CheckoutFormData) => {
    setIsProcessing(true);

    try {
      if (checkoutItems.length === 0) {
        throw new Error(getText('shop.cart.selectAtLeastOne', 'Please select at least one item to checkout'));
      }

      persistSelectedCartItemIds(checkoutItems.map((item) => item.id));

      const hasShippingAddress = [
        data.firstName,
        data.lastName,
        data.phone,
        data.addressLine1,
        data.city,
        data.state,
        data.country,
        data.postalCode,
      ].some((value) => value.trim().length > 0);

      const normalizedEmail = data.email.trim();

      // 1. Create order
      const orderResponse = await ordersApi.createOrder({
        items: checkoutItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
        })),
        shippingAddress: hasShippingAddress
          ? {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            phone: data.phone.trim(),
            addressLine1: data.addressLine1.trim(),
            city: data.city.trim(),
            state: data.state.trim(),
            country: data.country.trim(),
            postalCode: data.postalCode.trim(),
          }
          : undefined,
        customerEmail: normalizedEmail.length > 0 ? normalizedEmail : undefined,
      });

      if (!orderResponse || !orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse?.message || getText('common.errors.general', 'Failed to create order'));
      }

      const order = orderResponse.data as { id: string };
      const orderId = order.id;

      if (
        availablePaymentMethods.length > 0 &&
        !availablePaymentMethods.some((method) => method.name === data.paymentMethod)
      ) {
        throw new Error(getText('common.errors.general', 'Selected payment method is not available'));
      }

      // Check for native Stripe direct-intent flow
      if (data.paymentMethod === 'stripe') {
        const stripeMethod = availablePaymentMethods.find((method) => method.name === 'stripe');
        const publishableKey =
          stripeMethod?.clientConfig?.publishableKey?.trim() ||
          fallbackStripePublishableKey;
        if (!publishableKey) {
          throw new Error(getText('common.errors.general', 'Stripe storefront key is not configured'));
        }

        const intentResponse = await paymentApi.createIntent({ orderId });
        const intentData = intentResponse?.data || readLegacyStripeIntentResponse(intentResponse);

        if (!intentResponse || !intentResponse.success || !intentData?.clientSecret) {
          throw new Error(intentResponse?.message || getText('common.errors.general', 'Failed to create payment intent'));
        }

        setStripePublishableKey(publishableKey);
        setStripeClientSecret(intentData.clientSecret);
        setStripeOrderId(orderId);
        setIsStripeModalOpen(true);
        setIsProcessing(false);
        return; // Modal now assumes control
      }

      // 2. Create payment session using legacy unified payment gateway
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

  // Theme loading state - use unified LoadingState component
  if (themeLoading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('common.actions.loading', 'Loading...')}
        fullPage
      />
    );
  }

  // Cart is empty, waiting for redirect
  if (cart.items.length === 0 || checkoutItems.length === 0) {
    return null;
  }

  // If theme component is unavailable, use ErrorState fallback
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
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.checkoutUnavailable', 'Unable to load checkout component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  // Render with theme component
  const CheckoutPageComponent = theme.components.CheckoutPage;

  return (
    <>
      <CheckoutPageComponent
        cart={checkoutCart}
        isLoading={false}
        isProcessing={isProcessing}
        config={config}
        requireShippingAddress={requireShippingAddress}
        countriesRequireStatePostal={countriesRequireStatePostal}
        currentUserEmail={user?.email}
        locale={nav.locale}
        t={t}
        availablePaymentMethods={availablePaymentMethods}
        onSubmit={handleSubmit}
        onBack={handleBack}
      />
      <StripeCheckoutModal
        isOpen={isStripeModalOpen}
        onOpenChange={setIsStripeModalOpen}
        publishableKey={stripePublishableKey || fallbackStripePublishableKey}
        clientSecret={stripeClientSecret || ''}
        orderId={stripeOrderId || ''}
      />
    </>
  );
}
