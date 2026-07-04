import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Return a Stripe SDK client.
 * If a secretKey is provided it always creates a fresh instance;
 * otherwise it reuses the cached singleton keyed on STRIPE_SECRET_KEY.
 */
export function getStripeClient(secretKey?: string): Stripe {
  const key = secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Stripe secret key is not configured');
  }

  // When an explicit key is supplied, always build a new client so
  // per-installation keys work correctly.
  if (secretKey) {
    return new Stripe(key, {
      apiVersion: '2025-04-30.basil' as any,
      typescript: true,
    });
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: '2025-04-30.basil' as any,
      typescript: true,
    });
  }
  return stripeInstance;
}

export function resetStripeClient(): void {
  stripeInstance = null;
}
