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
import { getServerStoreContext } from '@/lib/server-store-context';
import { buildPinnedActiveTheme } from '@/lib/theme-pin';
import type { StoreContext } from '@/lib/store-context';
import { PageTracker } from '@/components/page-tracker';
import { Toaster } from '@/components/ui/toaster';
import { OfflineDetector } from '@/components/offline-detector';
import { SkipToMain } from '@/components/skip-to-main';
import { ThemeMessagesRegistrar } from '@/components/theme-messages-registrar';
import { getThemeMessages } from '@/lib/theme-i18n-server';

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

  // Server-fetched store context: lets StoreContextProvider render the
  // subtree during SSR (crawlable content) instead of gating on the
  // client-side fetch. The client still refreshes after hydration.
  let initialContext: StoreContext | null = null;
  try {
    initialContext = (await getServerStoreContext({ cache: 'no-store' })) as unknown as StoreContext | null;
  } catch {
    initialContext = null;
  }

  // Deployment theme pin (THEME_SLUG_PIN / THEME_VERSION_PIN): when set,
  // this worker serves the pinned theme regardless of the API-reported
  // active theme. Null on unpinned workers — no behavior change there.
  const initialActiveTheme = buildPinnedActiveTheme();

  // Store Localization (i18n) plugin overrides for the active theme. Null
  // when the plugin is disabled or unreachable — the theme's built-in copy
  // then renders exactly as before.
  const themeMessages = await getThemeMessages(locale);

  return (
    <I18nProvider locale={locale as Locale} messages={messages}>
      <ThemeMessagesRegistrar locale={locale} messages={themeMessages}>
        <Suspense fallback={<div className="min-h-screen" />}>
          <SkipToMain />
          <OfflineDetector position="top" />
          <PageTracker />
          <ConditionalLayout initialContext={initialContext} initialActiveTheme={initialActiveTheme}>{children}</ConditionalLayout>
          <Toaster />
        </Suspense>
      </ThemeMessagesRegistrar>
    </I18nProvider>
  );
}

/**
 * Generate static params for all supported locales
 */
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh-Hant' }];
}

