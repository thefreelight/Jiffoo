'use client';

import Link from 'next/link';
import { ArrowLeft, LockKeyhole, ShoppingBag, Trash2 } from 'lucide-react';
import type { Cart } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';
import { storefrontMessages } from '@/lib/storefront-messages';
import { useCart } from '@/lib/use-cart';
import { variantText } from '@/lib/checkout-types';
import { QuantityStepper } from './quantity-stepper';
import { ShopImage } from './shop-image';

export function CartView({ initial, locale, currency, productLinks }: { initial: Cart; locale: ShopLocale; currency: string; productLinks: Record<string, string> }) {
  const { cart, busy, error, quantities, availability, change, blocked } = useCart(initial, locale);
  const t = storefrontMessages(locale);
  const money = (amount: number) => formatPrice(amount, locale, currency);
  if (!cart?.items.length) return <main className="mx-auto flex min-h-[560px] max-w-7xl items-center justify-center px-4 md:px-8">
    <div className="flex flex-col items-center gap-3 py-20 text-center"><ShoppingBag size={24} aria-hidden="true" />
      <h1 className="text-[22px] font-semibold tracking-tight">{t.s4.emptyTitle}</h1>
      <p className="text-subtle">{t.s4.emptyBody}</p>
      <Link href={`/${locale}/products`} className="mt-2 inline-flex h-10 items-center rounded-md bg-action px-[18px] text-action-ink">{t.s4.browse}</Link>
    </div>
  </main>;
  return <main className="mx-auto max-w-7xl px-4 pb-10 pt-9 md:px-8">
    <h1 className="mb-6 text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">{t.checkout.cart}</h1>
    <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_380px] md:gap-12">
      <div>
        {(availability.message || error) && <p role="alert" className="mb-3 rounded-lg border border-[var(--shop-core-attention-line)] bg-[var(--shop-core-attention-soft)] p-3">{availability.message || error}</p>}
        {cart.items.filter((line) => line.quantity > line.maxQuantity).map((line) => <p key={line.id} role="alert" className="mb-2 rounded-lg border border-[var(--shop-core-attention-line)] bg-[var(--shop-core-attention-soft)] px-3.5 py-3 text-[13px]">
          {t.s4.cartStockIssue.replace('{product}', line.productName).replace('{count}', String(line.maxQuantity))}
        </p>)}
        <div className="border-t border-line">{cart.items.map((line) => <div key={line.id} className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 border-b border-line py-5 md:grid-cols-[96px_minmax(0,1fr)_auto]">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-highlight">{line.productImage && <ShopImage src={line.productImage} alt={line.productName} fill sizes="96px" className="object-cover" />}</div>
          <div className="min-w-0 space-y-1.5">
            {productLinks[line.productId] ? <Link href={productLinks[line.productId]} className="font-medium">{line.productName}</Link> : <p className="font-medium">{line.productName}</p>}
            {variantText(line) && <p className="text-[13px] text-subtle">{variantText(line)}</p>}
            <p className="text-[13px] text-subtle">{t.s4.unitPrice} {money(line.price)}</p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <QuantityStepper compact value={quantities[line.id] ?? line.quantity} max={line.maxQuantity} disabled={busy || availability.blocked}
                locale={locale} name={line.productName} onChange={(quantity) => void change(line.id, quantity)} />
              <button type="button" disabled={busy || availability.blocked} onClick={() => void change(line.id)} aria-label={`${t.checkout.remove} ${line.productName}`}
                className="flex h-8 items-center gap-1 rounded-md px-3 text-[13px] hover:bg-highlight"><Trash2 size={15} aria-hidden="true" />{t.checkout.remove}</button>
            </div>
            {line.quantity > line.maxQuantity && <p className="text-[13px] text-[var(--shop-core-attention)]">{t.checkout.stockAvailable} {line.maxQuantity}</p>}
          </div>
          <span className="col-start-2 font-medium tabular-nums md:col-start-auto">{money(line.subtotal)}</span>
        </div>)}</div>
        <Link href={`/${locale}/products`} className="mt-5 inline-flex items-center gap-2 text-subtle"><ArrowLeft size={15} aria-hidden="true" />{t.s4.continueShopping}</Link>
      </div>
      <aside className="space-y-4 rounded-lg border border-line p-6 md:sticky md:top-[88px]">
        <h2 className="text-base font-semibold">{t.s4.summary}</h2>
        <dl className="space-y-2.5">
          <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.subtotal}</dt><dd>{money(cart.subtotal)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.shipping}</dt><dd className="text-subtle">{t.s4.calculatedCheckout}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{t.checkout.total}</dt><dd><strong>{money(cart.subtotal)}</strong></dd></div>
        </dl>
        {blocked ? <button disabled className="h-12 w-full rounded-md bg-action text-action-ink opacity-45">{t.s4.goCheckout}</button>
          : <Link href={`/${locale}/checkout`} className="flex h-12 items-center justify-center rounded-md bg-action text-[15px] font-medium text-action-ink">{t.s4.goCheckout}</Link>}
        <p className="flex items-start gap-1.5 text-xs text-subtle"><LockKeyhole size={15} className="shrink-0" aria-hidden="true" />{t.s4.paymentPlugins}</p>
      </aside>
    </div>
  </main>;
}
