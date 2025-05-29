import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import '@/styles/globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">
              {children}
            </div>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
