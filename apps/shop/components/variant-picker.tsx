'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/catalog';
import { formatPrice } from '@/lib/price';
import type { ShopLocale } from '@/lib/locale';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';
import { storefrontMessages } from '@/lib/storefront-messages';
import { useCartUI } from '@/lib/cart-ui';
import { QuantityStepper } from './quantity-stepper';

export function VariantPicker({ variants, locale, currency, labels, productId, slug, loggedIn }: {
  variants: NonNullable<Product['variants']>;
  locale: ShopLocale;
  currency: string;
  labels: { variants: string; stock: string; outOfStock: string; sku: string; quantity: string; addToCart: string; stockAvailable: string };
  productId: string;
  slug: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(variants.find((variant) => variant.stock > 0)?.id ?? variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const availability = useShopAvailability(locale);
  const t = storefrontMessages(locale);
  const added = useCartUI((state) => state.added);
  const current = variants.find((variant) => variant.id === selected) ?? variants[0];
  if (!current) return null;
  async function add() {
    if (availability.blocked) return;
    availability.clear();
    if (!loggedIn) {
      router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}/products/${slug}`)}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await availabilityFetch('/bff/cart/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variantId: current.id, quantity }),
      });
      const body = await response.json();
      if (response.ok) {
        const refreshed = await availabilityFetch('/bff/cart', { cache: 'no-store' });
        if (!refreshed.ok) { setError(t.shop.error); return; }
        const cart = (await refreshed.json()).data;
        added(current.name, cart.itemCount);
      }
      else if (body.error?.code === 'ADMIN_ACCOUNT_NOT_FOR_SHOP') setError(storefrontMessages(locale).account.adminAccountNotForShop);
      else if (body.error?.code === 'INSUFFICIENT_STOCK') setError(`${labels.stockAvailable} ${body.error.details?.availableQuantity}`);
      else setError(t.shop.error);
    } catch (error) {
      if (availability.capture(error)) return;
      setError(t.shop.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <p className="text-2xl font-semibold">{formatPrice(current.salePrice, locale, currency)}</p>
      {current.skuCode && <p className="text-xs text-subtle">{labels.sku}: <code className="font-mono">{current.skuCode}</code></p>}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{labels.variants}</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <label key={variant.id} className="cursor-pointer">
              <input
                type="radio"
                name="variant"
                value={variant.id}
                checked={current.id === variant.id}
                disabled={variant.stock < 1 || busy}
                onChange={() => { setSelected(variant.id); setQuantity(1); setError(''); }}
                className="peer sr-only"
              />
              <span className="inline-block rounded-md border border-line px-3 py-2 text-sm peer-checked:border-action peer-checked:ring-1 peer-checked:ring-action peer-disabled:cursor-not-allowed peer-disabled:text-subtle peer-disabled:line-through">
                {variant.attributes && Object.keys(variant.attributes).length
                  ? Object.entries(variant.attributes).map(([key, value]) => `${key}: ${String(value)}`).join(' / ')
                  : variant.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className={`text-sm ${current.stock > 5 ? 'text-[var(--shop-extras-success)]' : current.stock > 0 ? 'text-[var(--shop-core-attention)]' : 'text-subtle'}`}>{current.stock > 5 ? labels.stock : current.stock > 0 ? t.shop.lowStock.replace('{count}', String(current.stock)) : t.shop.soldOut}</p>
      {current.stock < 1 && <p role="alert" className="rounded-md border border-[var(--shop-core-destructive-line)] bg-[var(--shop-core-destructive-soft)] p-3 text-sm">{t.shop.variantSoldOut}</p>}
      <div className="flex items-center gap-2.5">
      <QuantityStepper value={quantity} max={current.stock} disabled={busy || availability.blocked} locale={locale} onChange={setQuantity} />
      <button type="button" onClick={() => void add()} aria-busy={busy} disabled={busy || availability.blocked || current.stock < 1}
        className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-md bg-action px-5 text-action-ink disabled:opacity-45">{current.stock < 1 ? t.shop.soldOut : labels.addToCart}</button>
      </div>
      {(availability.message || error) && <p role="alert" className="text-sm text-destructive">{availability.message || error}</p>}
    </section>
  );
}
