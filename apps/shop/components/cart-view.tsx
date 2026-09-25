'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import type { Cart } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';
import { storefrontMessages } from '@/lib/storefront-messages';

export function CartView({ initial, locale, currency }: { initial: Cart; locale: ShopLocale; currency: string }) {
  const [cart, setCart] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const t = storefrontMessages(locale).checkout;

  async function change(path: string, method: string, quantity?: number) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/bff/cart${path}`, {
        method,
        ...(quantity !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) } : {}),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.code === 'INSUFFICIENT_STOCK'
          ? `${t.stockAvailable} ${body.error.details?.availableQuantity}` : t.genericError);
      } else {
        setCart(body.data as Cart);
        window.dispatchEvent(new Event('cart-updated'));
      }
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
    <h1 className="text-2xl font-semibold">{t.cart}</h1>
    {error && <p role="alert" className="mt-4 text-action">{error}</p>}
    {cart.items.length === 0 ? <p className="mt-8 text-subtle">{t.empty}</p> : <>
      <div className="mt-6 divide-y divide-line border-y border-line">
        {cart.items.map((line) => <div key={line.id} className="flex flex-wrap items-center gap-4 py-5">
          <div className="min-w-0 flex-1">
            <Link href={`/${locale}/products`} className="font-medium text-action">{line.productName}</Link>
            {line.variantName && <p className="text-sm text-subtle">{line.variantName}</p>}
            <p className="text-sm">{formatPrice(line.price, locale, currency)}</p>
          </div>
          <label className="text-sm">{t.quantity}
            <input type="number" min={1} max={line.maxQuantity} value={line.quantity}
              disabled={busy} onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next >= 1) void change(`/items/${line.id}`, 'PUT', next);
              }}
              className="ml-2 w-20 rounded-shop border border-line bg-surface px-2 py-2" />
          </label>
          <span className="w-28 text-right font-medium">{formatPrice(line.subtotal, locale, currency)}</span>
          <button type="button" disabled={busy} onClick={() => void change(`/items/${line.id}`, 'DELETE')}
            aria-label={`${t.remove} ${line.productName}`} title={t.remove} className="p-2 text-action"><Trash2 size={18} /></button>
        </div>)}
      </div>
      <div className="mt-6 flex items-center justify-end gap-6">
        <span>{t.subtotal}</span><strong>{formatPrice(cart.subtotal, locale, currency)}</strong>
      </div>
      <div className="mt-6 flex justify-end">
        <Link href={`/${locale}/checkout`} className="rounded-shop bg-action px-5 py-3 text-action-ink">{t.checkout}</Link>
      </div>
    </>}
  </main>;
}
