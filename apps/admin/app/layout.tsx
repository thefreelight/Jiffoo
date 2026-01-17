/**
 * Root Layout for Tenant Application
 *
 * Provides the base HTML structure and global styles.
 * Language-specific content is handled by the [locale] layout.
 */

import type { Metadata } from 'next';
import './globals.css';
import { DevTools } from '@/components/dev-tools';

export const metadata: Metadata = {
  title: 'Jiffoo Admin - Management Dashboard',
  description: 'Modern admin dashboard for Jiffoo e-commerce platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <DevTools />
      </body>
    </html>
  );
}
