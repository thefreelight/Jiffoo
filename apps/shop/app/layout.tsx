/**
 * Root Layout for Shop Application
 *
 * Provides the base HTML structure and global providers.
 * Language-specific content is handled by the [locale] layout.
 */

import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'),
  title: {
    default: 'Jiffoo Mall - Modern E-commerce Platform',
    template: '%s | Jiffoo Mall',
  },
  description: 'A modern, fast, and beautiful e-commerce platform built with Next.js and TypeScript.',
  keywords: ['e-commerce', 'shopping', 'online store', 'modern', 'fast', 'beautiful'],
  authors: [{ name: 'Jiffoo Team' }],
  creator: 'Jiffoo Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://jiffoo-mall.com',
    title: 'Jiffoo Mall - Modern E-commerce Platform',
    description: 'A modern, fast, and beautiful e-commerce platform built with Next.js and TypeScript.',
    siteName: 'Jiffoo Mall',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Jiffoo Mall',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jiffoo Mall - Modern E-commerce Platform',
    description: 'A modern, fast, and beautiful e-commerce platform built with Next.js and TypeScript.',
    images: ['/og-image.jpg'],
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
