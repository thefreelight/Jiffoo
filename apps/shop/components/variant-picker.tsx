'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/catalog';
import { formatPrice } from '@/lib/price';
import type { ShopLocale } from '@/lib/locale';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';

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
  const [selected, setSelected] = useState(variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const availability = useShopAvailability(locale);
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
      if (response.ok) router.push(`/${locale}/cart`);
      else if (body.error?.code === 'INSUFFICIENT_STOCK') setError(`${labels.stockAvailable} ${body.error.details?.availableQuantity}`);
      else setError(body.error?.message || labels.outOfStock);
    } catch (error) {
      if (availability.capture(error)) return;
      setError(labels.outOfStock);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
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
                onChange={() => { setSelected(variant.id); setQuantity(1); setError(''); }}
                className="peer sr-only"
              />
              <span className="inline-block rounded-shop border border-line px-3 py-2 text-sm peer-checked:border-action peer-checked:bg-highlight">
                {variant.name}
                {variant.attributes && Object.entries(variant.attributes).length > 0 &&
                  ` · ${Object.entries(variant.attributes).map(([key, value]) => `${key}: ${String(value)}`).join(', ')}`}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-2xl font-semibold">{formatPrice(current.salePrice, locale, currency)}</p>
      <p className="text-sm text-subtle">{current.stock > 0 ? labels.stock : labels.outOfStock}</p>
      <label className="block text-sm">{labels.quantity}
        <input type="number" min={1} max={current.stock} value={quantity}
          onChange={(event) => setQuantity(Math.min(current.stock, Math.max(1, Number(event.target.value) || 1)))}
          className="ml-2 w-20 rounded-shop border border-line bg-surface px-2 py-2" />
      </label>
      <button type="button" onClick={() => void add()} disabled={busy || availability.blocked || current.stock < 1}
        className="rounded-shop bg-action px-5 py-3 text-action-ink disabled:opacity-50">{labels.addToCart}</button>
      {(availability.message || error) && <p role="alert" className="text-sm text-action">{availability.message || error}</p>}
      {current.skuCode && <p className="text-xs text-subtle">{labels.sku}: {current.skuCode}</p>}
    </section>
  );
}
