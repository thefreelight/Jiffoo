'use client';

import { Minus, Plus } from 'lucide-react';
import { storefrontMessages } from '@/lib/storefront-messages';
import type { ShopLocale } from '@/lib/locale';

export function QuantityStepper({ value, max, onChange, disabled, locale, name, compact = false }: {
  value: number; max: number; onChange: (quantity: number) => void; disabled?: boolean;
  locale: ShopLocale; name?: string; compact?: boolean;
}) {
  const t = storefrontMessages(locale);
  return <div className={`inline-flex w-max items-center rounded-md border border-line ${compact ? 'h-8' : 'h-10'}`}>
    <button type="button" aria-label={`${t.shop.decrease}${name ? ` ${name}` : ''}`} disabled={disabled || value <= 1}
      onClick={() => onChange(value - 1)} className={`flex h-full items-center justify-center disabled:opacity-40 ${compact ? 'w-7.5' : 'w-9'}`}><Minus size={15} aria-hidden="true" /></button>
    <input aria-label={`${t.product.quantity}${name ? ` ${name}` : ''}`} type="number" min={1} max={max} value={value}
      disabled={disabled || max < 1} onChange={(event) => onChange(Math.min(max, Math.max(1, Math.trunc(Number(event.target.value)) || 1)))}
      className={`${compact ? 'w-8' : 'w-10'} bg-transparent text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
    <button type="button" aria-label={`${t.shop.increase}${name ? ` ${name}` : ''}`} disabled={disabled || value >= max}
      onClick={() => onChange(value + 1)} className={`flex h-full items-center justify-center disabled:opacity-40 ${compact ? 'w-7.5' : 'w-9'}`}><Plus size={15} aria-hidden="true" /></button>
  </div>;
}
