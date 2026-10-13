'use client';
import { useEffect } from 'react';
import { useLocale } from 'shared/src/i18n/react';

/** The root layout persists during client navigation between locale segments. */
export function DocumentLanguage() {
  const locale = useLocale();
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return null;
}
