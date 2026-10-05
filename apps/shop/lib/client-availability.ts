'use client';

import { useEffect, useState } from 'react';
import type { ShopLocale } from './locale';
import { availabilityMessage, classifyAvailability, ShopAvailability } from './availability';

export async function availabilityFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  const unavailable = await classifyAvailability(response);
  if (unavailable) throw unavailable;
  return response;
}

export function useShopAvailability(locale: ShopLocale) {
  const [error, setError] = useState<ShopAvailability | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!error) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const current = Date.now(); setNow(current);
      if (current < error.retryAt) timer = setTimeout(update, Math.min(1000, error.retryAt - current));
    };
    update();
    return () => { if (timer) clearTimeout(timer); };
  }, [error]);
  return {
    blocked: !!error && now < error.retryAt,
    message: error ? availabilityMessage(error, locale, now) : '',
    clear: () => setError(null),
    capture: (value: unknown): boolean => {
      if (!(value instanceof ShopAvailability)) return false;
      setNow(Date.now()); setError(value); return true;
    },
  };
}
