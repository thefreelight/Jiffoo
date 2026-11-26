/**
 * The shopper's email for a hosted Stripe page. Stripe asks every shopper for an email address when a
 * Checkout Session is created without one, even for a signed-in shopper who just gave it with the order.
 * An address that Stripe would refuse is left out, so the page asks instead of the payment failing.
 */
export function stripeCustomerEmail(value: unknown): { customer_email: string } | Record<string, never> {
  const email = typeof value === 'string' ? value.trim() : '';
  return /^\S+@\S+\.\S+$/.test(email) && email.length <= 800 ? { customer_email: email } : {};
}
