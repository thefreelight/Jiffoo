/**
 * Root Layout for the Admin Application
 *
 * Provides the base HTML structure and global styles.
 * Language-specific content is handled by the [locale] layout.
 */

import type { Metadata } from 'next';
import localFont from 'next/font/local';
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
});

export const metadata: Metadata = {
  title: 'Jiffoo Admin',
  description: 'Operational admin workspace for commerce teams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
