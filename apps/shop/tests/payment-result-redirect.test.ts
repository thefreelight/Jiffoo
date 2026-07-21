import { describe, expect, it } from 'vitest';
import { buildPaymentResultRedirect } from '@/lib/payment-result-redirect';

describe('payment result compatibility redirects', () => {
  it('preserves the Stripe session ID on the localized success route', () => {
    expect(buildPaymentResultRedirect('en', 'order-success', {
      session_id: 'cs_test_123',
    })).toBe('/en/order-success?session_id=cs_test_123');
  });

  it('preserves repeated query values on the localized cancellation route', () => {
    expect(buildPaymentResultRedirect('zh-Hant', 'order-cancelled', {
      reason: ['user_cancelled', 'checkout_closed'],
      ignored: undefined,
    })).toBe(
      '/zh-Hant/order-cancelled?reason=user_cancelled&reason=checkout_closed',
    );
  });
});
