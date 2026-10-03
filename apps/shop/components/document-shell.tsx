'use client';

import { usePathname } from 'next/navigation';
import { startTransition, useEffect, useRef, useState } from 'react';
import { isShopLocale, type ShopLocale } from '@/lib/locale';

export function DocumentShell({ locale, children }: { locale: ShopLocale; children?: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [language, setLanguage] = useState(locale);
  useEffect(() => {
    if (pathname === previousPathname.current) return;
    previousPathname.current = pathname;
    const segment = pathname?.split('/')[1];
    startTransition(() => setLanguage(segment && isShopLocale(segment) ? segment : locale));
  }, [pathname, locale]);
  return <html lang={language}><body>{children}</body></html>;
}
