/**
 * Locale Layout for Shop Application
 * 
 * Provides i18n context for all pages within the [locale] route segment.
 * Wraps children with I18nProvider containing locale-specific messages.
 */

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  isSupportedLocale,
  getMessages,
  type Locale,
  type LocaleLayoutProps,
} from 'shared/src/i18n';
import { I18nProvider } from 'shared/src/i18n/react';
import { ConditionalLayout } from '@/components/conditional-layout';
import { PageTracker } from '@/components/page-tracker';
import { Toaster } from '@/components/ui/toaster';
import { OfflineDetector } from '@/components/offline-detector';
import { SkipToMain } from '@/components/skip-to-main';
import { getServerStoreContext } from '@/lib/server-store-context';
import type { StoreContext } from '@/lib/store-context';

interface Props extends Omit<LocaleLayoutProps, 'params'> {
  params: Promise<{ locale: string }>;
}

// This layout depends on store context resolved from the live API at request time.
// Static generation bakes an empty loading shell into the page when the API is not
// reachable during build, which causes storefronts to render blank until hydration.
export const dynamic = 'force-dynamic';

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  // Get messages for this locale
  const messages = getMessages(locale as Locale, 'shop');
  const serverContext = await getServerStoreContext();
  const initialContext: StoreContext | null = serverContext
    ? {
        storeId: serverContext.storeId,
        storeName: serverContext.storeName,
        logo: serverContext.logo,
        theme: serverContext.theme as StoreContext['theme'],
        settings: serverContext.settings,
        status: serverContext.status,
        defaultLocale: serverContext.defaultLocale ?? 'en',
        supportedLocales: serverContext.supportedLocales ?? ['en', 'zh-Hant'],
        checkout: serverContext.checkout,
      }
    : null;

  return (
    <I18nProvider locale={locale as Locale} messages={messages}>
      <SkipToMain />
      <OfflineDetector position="top" />
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>
      <ConditionalLayout initialContext={initialContext}>{children}</ConditionalLayout>
      <Toaster />
    </I18nProvider>
  );
}

/**
 * Generate static params for all supported locales
 */
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh-Hant' }];
}
