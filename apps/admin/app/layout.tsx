/**
 * Root Layout for the Admin Application
 *
 * Provides the base HTML structure and global styles.
 * Language-specific content is handled by the [locale] layout.
 */

import { cookies, headers } from 'next/headers';
import { isSupportedLocale } from 'shared/src/i18n';
import { PreferencesProvider } from '@/lib/preferences-provider';
import { COLOR_MODE_COOKIE, SIDEBAR_COOKIE, parseColorMode, parseSidebarCollapsed, effectiveColorMode } from '@/lib/preferences';
import { getAdminTheme } from '@/lib/server-theme';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './default-tokens.css';
import './globals.css';

const outfit = localFont({
  src: [
    { path: './fonts/outfit-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/outfit-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/outfit-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/outfit-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/outfit-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-outfit',
  display: 'swap',
  preload: false,
});

const geistSans = localFont({ src: './fonts/geist-sans-variable.woff2', weight: '100 900', variable: '--font-geist-sans', display: 'swap' });
const geistMono = localFont({ src: './fonts/geist-mono-variable.woff2', weight: '100 900', variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Jiffoo Admin',
  description: 'Operational admin workspace for commerce teams',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const requestedLocale = (await headers()).get('x-admin-locale');
  const locale = requestedLocale && isSupportedLocale(requestedLocale) ? requestedLocale : 'en';
  const theme = await getAdminTheme(locale);
  const darkAvailable = theme?.darkAvailable ?? true;
  const mode = effectiveColorMode(parseColorMode(cookieStore.get(COLOR_MODE_COOKIE)?.value), darkAvailable);
  const collapsed = parseSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value);
  return (
    <html lang={locale} data-color-mode={mode} data-admin-dark-available={String(darkAvailable)} className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable}`}>
      <body className="font-sans antialiased">
        <PreferencesProvider initialMode={mode} initialCollapsed={collapsed} darkAvailable={darkAvailable}>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
