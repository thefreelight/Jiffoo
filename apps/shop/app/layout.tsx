/**
 * Root Layout for Shop Application
 *
 * Provides the base HTML structure and global providers.
 * Language-specific content is handled by the [locale] layout.
 */

import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { Providers } from './providers';
import { DevTools } from '@/components/dev-tools';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { getServerStoreContext } from '@/lib/server-store-context';
import { AppEmbedInjector } from '@/lib/theme-pack/app-embed-injector';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { generateThemeStyles } from '@/lib/theme-runtime';

/**
 * Viewport configuration for PWA support
 * Separated from metadata as per Next.js 14 best practices
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#3b82f6', // Matches manifest.json theme_color
};

export async function generateMetadata(): Promise<Metadata> {
  const publicOrigin = await resolvePublicOrigin();
  const metadataBase = new URL(publicOrigin);
  const socialImageUrl = new URL('/icon-512x512.png', metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: 'Jiffoo Mall - Modern E-commerce System',
      template: '%s | Jiffoo Mall',
    },
    description: 'A modern, fast, and beautiful e-commerce system built with Next.js and TypeScript.',
    keywords: ['e-commerce', 'shopping', 'online store', 'modern', 'fast', 'beautiful'],
    authors: [{ name: 'Jiffoo Team' }],
    creator: 'Jiffoo Team',
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: publicOrigin,
      title: 'Jiffoo Mall - Modern E-commerce System',
      description: 'A modern, fast, and beautiful e-commerce system built with Next.js and TypeScript.',
      siteName: 'Jiffoo Mall',
      images: [
        {
          url: socialImageUrl,
          width: 512,
          height: 512,
          alt: 'Jiffoo Mall',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Jiffoo Mall - Modern E-commerce System',
      description: 'A modern, fast, and beautiful e-commerce system built with Next.js and TypeScript.',
      images: [socialImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    manifest: '/manifest.json',
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon-16x16.png',
      apple: '/apple-touch-icon.png',
    },
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': 'Jiffoo Mall',
    },
  };
}

/**
 * Runtime assertion to verify CSS doesn't contain dangerous patterns
 * This is a defense-in-depth measure - styles should already be sanitized
 * by generateThemeStyles, but this provides an additional safety check.
 */
function assertSafeCSS(css: string): boolean {
  if (!css) return true;

  // Check for patterns that should never appear in sanitized CSS
  const dangerousPatterns = [
    /<\/style/i,
    /<script/i,
    /javascript:/i,
    /expression\s*\(/i,
    /@import/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  const hasDanger = dangerousPatterns.some(pattern => pattern.test(css));

  if (hasDanger) {
    console.error('[Security] Dangerous pattern detected in theme CSS - styles will not be rendered');
    return false;
  }

  return true;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch store context (theme, settings)
  const context = await getServerStoreContext();

  // Generate dynamic theme styles ONLY for builtin themes
  // For installed Theme Packs, the client-side ThemePackProvider will handle CSS injection
  // This avoids style conflicts and hydration mismatches
  const isInstalledTheme = context?.theme?.pluginSlug ||
    (context?.theme?.slug && context.theme.slug !== 'default');

  /**
   * SECURITY: Theme styles are sanitized via generateThemeStyles() to prevent XSS
   *
   * The generateThemeStyles function applies the following sanitization:
   * 1. validateThemeConfig() - First-level validation for dangerous patterns
   * 2. sanitizeColorValue() - Validates hex, rgb/rgba, hsl/hsla, named colors
   * 3. sanitizeFontFamily() - Validates font family names, blocks special chars
   * 4. sanitizeCSSLength() - Validates length values with safe units
   *
   * All values use an allowlist approach - only safe patterns are permitted.
   * Values containing XSS vectors (</style>, <script>, javascript:, etc.) are rejected.
   *
   * Defense in depth: assertSafeCSS() provides an additional runtime check below.
   */
  const themeStyles = (!isInstalledTheme && context?.theme)
    ? generateThemeStyles(context.theme)
    : '';

  // Defense in depth: Runtime assertion to verify CSS is safe
  // This should never fail if generateThemeStyles is working correctly
  const isSafeCSS = assertSafeCSS(themeStyles);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/*
          SECURITY: Only inject theme styles if they pass safety checks
          - themeStyles are already sanitized by generateThemeStyles()
          - isSafeCSS provides defense-in-depth runtime validation
          - dangerouslySetInnerHTML is safe here due to multi-layer sanitization
        */}
        {themeStyles && isSafeCSS && (
          <style id="theme-styles" dangerouslySetInnerHTML={{ __html: themeStyles }} />
        )}
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
        <PwaInstallBanner />
        <AppEmbedInjector position="body-end" />
        <DevTools />
      </body>
    </html>
  );
}
