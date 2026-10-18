'use client';

import { useEffect, useEffectEvent } from 'react';
import Link from 'next/link';
import { ShoppingBag, Trash2 } from 'lucide-react';
import type { Cart } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { formatPrice } from '@/lib/price';
import { useCartUI } from '@/lib/cart-ui';
import { useCart } from '@/lib/use-cart';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet';
import { QuantityStepper } from './quantity-stepper';
import { ShopImage } from './shop-image';

export function CartButton({ initialCount, locale, loggedIn }: { initialCount: number; locale: ShopLocale; loggedIn: boolean }) {
  const count = useCartUI((state) => state.count) ?? initialCount;
  const setOpen = useCartUI((state) => state.setOpen);
  const t = storefrontMessages(locale);
  const label = t.shop.cartLabel.replace('{count}', String(loggedIn ? count : 0));
  return loggedIn ? <button type="button" aria-label={label} onClick={() => setOpen(true)} className="relative flex size-9 items-center justify-center rounded-md hover:bg-highlight">
    <ShoppingBag size={18} aria-hidden="true" />{count > 0 && <span className="absolute right-0 top-0 rounded-full bg-action px-1 text-[10px] text-action-ink">{count}</span>}
  </button> : <Link href={`/${locale}/cart`} aria-label={label} className="flex size-9 items-center justify-center"><ShoppingBag size={18} aria-hidden="true" /></Link>;
}

export function CartSheet({ locale, currency, loggedIn, initial }: { locale: ShopLocale; currency: string; loggedIn: boolean; initial?: Cart | null }) {
  const { open, setOpen, lastAdded } = useCartUI();
  const { cart, busy, error, setError, availability, refresh, change, blocked } = useCart(initial ?? null, locale);
  const t = storefrontMessages(locale);
  const capture = useEffectEvent((error: unknown) => { if (!availability.capture(error)) setError(t.shop.error); });
  useEffect(() => {
    const read = () => { if (loggedIn) void refresh().then(() => setError('')).catch(capture); };
    if (open) read();
    window.addEventListener('cart-updated', read);
    return () => window.removeEventListener('cart-updated', read);
  }, [open, loggedIn, refresh, setError]);

  async function retry() {
    if (busy || availability.blocked) return;
    availability.clear(); setError('');
    try { await refresh(); }
    catch (error) { if (!availability.capture(error)) setError(t.shop.error); }
  }
  return <Sheet open={open && loggedIn} onOpenChange={setOpen}>
    {open && loggedIn && <SheetContent closeLabel={t.shop.close} className="w-full gap-0 sm:max-w-[420px]">
      <div className="border-b border-line px-5 py-4"><SheetTitle className="text-base font-semibold">{t.shop.cartTitle.replace('{count}', String(cart?.itemCount ?? 0))}</SheetTitle>
        <SheetDescription className="sr-only">{t.shop.viewCart}</SheetDescription></div>
      <div className="flex-1 overflow-y-auto px-5">
        {lastAdded && <p role="status" className="mt-4 rounded-md bg-highlight p-3 text-[var(--shop-extras-success)]">{t.shop.added} · {lastAdded}</p>}
        {(error || availability.message) && <p role="alert" className="my-4 text-destructive">{availability.message || error}</p>}
        {(error || availability.message) && <button type="button" disabled={busy || availability.blocked} onClick={() => void retry()} className="rounded-md border border-line px-4 py-2">{t.shop.retry}</button>}
        {!cart ? !error && <p role="status" className="py-8">{t.shop.loading}</p> : !cart.items.length ? <p className="py-8 text-subtle">{t.checkout.empty}</p>
          : cart.items.map((line) => <div key={line.id} className="flex gap-3 border-b border-line py-4">
            {line.productImage && <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-highlight"><ShopImage src={line.productImage} alt={line.productName} fill sizes="64px" className="object-cover" /></div>}
            <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{line.productName}</p>
              {(line.variantName || line.variantAttributes) && <p className="mb-2 text-xs text-subtle">{line.variantAttributes && Object.keys(line.variantAttributes).length
                ? Object.entries(line.variantAttributes).map(([key, value]) => `${key}: ${String(value)}`).join(' / ') : line.variantName}</p>}
              <QuantityStepper compact value={line.quantity} max={line.maxQuantity} disabled={busy || availability.blocked} locale={locale} name={line.productName} onChange={(quantity) => void change(line.id, quantity)} />
              {line.quantity > line.maxQuantity && <p role="alert" className="mt-2 text-destructive">{t.checkout.stockAvailable} {line.maxQuantity}</p>}
            </div><div className="flex flex-col items-end gap-3"><span className="tabular-nums">{formatPrice(line.subtotal, locale, currency)}</span>
              <button type="button" aria-label={`${t.checkout.remove} ${line.productName}`} disabled={busy || availability.blocked} onClick={() => void change(line.id)}><Trash2 size={16} /></button></div>
          </div>)}
      </div>
      <div className="space-y-3 border-t border-line p-5">
        <p className="flex justify-between"><span className="text-subtle">{t.checkout.subtotal}</span><strong>{formatPrice(cart?.subtotal ?? 0, locale, currency)}</strong></p>
        <p className="text-xs text-[var(--shop-core-faint)]">{t.shop.shippingAtCheckout}</p>
        {blocked ? <button disabled className="h-12 w-full rounded-md bg-action text-action-ink opacity-45">{t.checkout.checkout}</button>
          : <Link href={`/${locale}/checkout`} onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-md bg-action text-action-ink">{t.checkout.checkout}</Link>}
        <Link href={`/${locale}/cart`} onClick={() => setOpen(false)} className="flex h-10 items-center justify-center rounded-md border border-line">{t.shop.viewCart}</Link>
      </div>
    </SheetContent>}
  </Sheet>;
}
