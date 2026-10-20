export type PaymentResultSearchParams = Record<string, string | string[] | undefined>;

export function buildPaymentResultRedirect(
  locale: string,
  target: 'order-success' | 'order-cancelled',
  searchParams: PaymentResultSearchParams,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const suffix = query.toString();
  const destination = `/${encodeURIComponent(locale)}/${target}`;
  return suffix ? `${destination}?${suffix}` : destination;
}
