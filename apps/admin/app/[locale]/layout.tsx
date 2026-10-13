/**
 * Locale Layout for the Admin Application
 * 
 * Provides i18n context for all pages within the [locale] route segment.
 * Wraps children with I18nProvider containing locale-specific messages.
 */

import { notFound } from 'next/navigation';
import {
  isSupportedLocale,
  getMessages,
  type Locale,
} from 'shared/src/i18n';
import { I18nProvider } from 'shared/src/i18n/react';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AdminToaster } from '@/components/ui/sonner';
import { LoggerProvider } from '@/components/logger-provider';
import { SkipToMain } from '@/components/skip-to-main';
import { StoreTimeProvider } from '@/lib/store-time';
import { getStoreTimezone } from '@/lib/server-theme';

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  // Get messages for this locale
  const messages = getMessages(locale as Locale, 'merchant');
  const timezone = await getStoreTimezone();

  return (
    <I18nProvider locale={locale as Locale} messages={messages}>
      <StoreTimeProvider timezone={timezone} now={new Date().toISOString()}>
      <LoggerProvider>
          <QueryProvider>
            <SkipToMain />
            {children}
            <AdminToaster />
          </QueryProvider>
      </LoggerProvider>
      </StoreTimeProvider>
    </I18nProvider>
  );
}

/**
 * Generate static params for all supported locales
 */
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh-Hans' }, { locale: 'zh-Hant' }];
}
