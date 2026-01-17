/**
 * Locale Layout for Tenant Application
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
import { BlueMinimalLayout } from '@/components/layout/blue-minimal-layout';
import { QueryProvider } from '@/lib/providers/query-provider';
import { Toaster } from 'sonner';
import { ToastProvider } from '@/components/ui/toast';
import { LoggerProvider } from '@/components/logger-provider';

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
  const messages = getMessages(locale as Locale, 'tenant');

  return (
    <I18nProvider locale={locale as Locale} messages={messages}>
      <LoggerProvider>
        <ToastProvider>
          <QueryProvider>
            <BlueMinimalLayout>{children}</BlueMinimalLayout>
            <Toaster position="top-right" richColors />
          </QueryProvider>
        </ToastProvider>
      </LoggerProvider>
    </I18nProvider>
  );
}

/**
 * Generate static params for all supported locales
 */
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh-Hant' }];
}

