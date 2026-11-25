'use client';

import { useEffect } from 'react';

/**
 * Keeps `<html lang>` on the page's language across client-side navigation:
 * the root layout sets it when the document loads and is not rendered again
 * when a visitor switches language in place.
 */
export function DocumentLanguage({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
