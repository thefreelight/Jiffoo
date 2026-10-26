import type { Cart, Quote } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { formatPrice } from '@/lib/price';
import { variantText } from '@/lib/checkout-types';
import { ShopImage } from './shop-image';

export function CheckoutSummary({ cart, quote, shippingOptionId, locale, currency }: {
  cart: Cart; quote: Quote | null; shippingOptionId: string; locale: ShopLocale; currency: string;
}) {
  const t = storefrontMessages(locale);
  const money = (value: string | number) => formatPrice(value, locale, quote?.currency ?? currency);
  const shipping = quote?.shippingOptions.find((option) => option.id === shippingOptionId);
  return <div className="space-y-4">
    {cart.items.map((line) => <div key={line.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3">
      <div className="relative"><div className="relative aspect-square overflow-hidden rounded-lg bg-highlight">{line.productImage && <ShopImage src={line.productImage} alt={line.productName} fill sizes="56px" className="object-cover" />}</div>
        <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-action px-1 text-[10px] font-semibold text-action-ink">{line.quantity}</span></div>
      <div className="min-w-0 text-[13px]"><p className="font-medium">{line.productName}</p><p className="text-subtle">{variantText(line)}</p></div>
      <span className="text-[13px] tabular-nums">{money(line.subtotal)}</span>
    </div>)}
    <dl className="space-y-2.5 border-t border-line pt-4">
      <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.subtotal}</dt><dd>{money(quote?.subtotal ?? cart.subtotal)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.shipping}</dt><dd>{shipping ? money(shipping.amount) : t.s4.afterAddress}</dd></div>
      {quote?.tax !== undefined && <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.tax} ({quote.taxInclusive ? t.checkout.taxInclusive : t.checkout.taxExclusive})</dt><dd>{money(quote.tax)}</dd></div>}
      <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{t.checkout.total}</dt><dd>{quote?.total ? money(quote.total) : '—'}</dd></div>
    </dl>
  </div>;
}
