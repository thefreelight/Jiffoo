'use client';

import { useState } from 'react';
import type { Product } from '@/lib/catalog';
import { formatPrice } from '@/lib/price';
import type { ShopLocale } from '@/lib/locale';

export function VariantPicker({ variants, locale, currency, labels }: {
  variants: NonNullable<Product['variants']>;
  locale: ShopLocale;
  currency: string;
  labels: { variants: string; stock: string; outOfStock: string; sku: string };
}) {
  const [selected, setSelected] = useState(variants[0]?.id);
  const current = variants.find((variant) => variant.id === selected) ?? variants[0];
  if (!current) return null;
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
                onChange={() => setSelected(variant.id)}
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
      {current.skuCode && <p className="text-xs text-subtle">{labels.sku}: {current.skuCode}</p>}
    </section>
  );
}
