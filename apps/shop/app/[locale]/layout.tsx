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

interface Props extends Omit<LocaleLayoutProps, 'params'> {
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  // Get messages for this locale
  const messages = getMessages(locale as Locale, 'shop');

  return (
    <I18nProvider locale={locale as Locale} messages={messages}>
      <Suspense fallback={<div>Loading...</div>}>
        <OfflineDetector position="top" />
        <PageTracker />
        <ConditionalLayout>{children}</ConditionalLayout>
        <Toaster />
      </Suspense>
    </I18nProvider>
  );
}

/**
 * Generate static params for all supported locales
 */
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh-Hant' }];
}

