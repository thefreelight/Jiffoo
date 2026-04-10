/**
 * Root Layout for Tenant Application
 *
 * Provides the base HTML structure and global styles.
 * Language-specific content is handled by the [locale] layout.
 */

import type { Metadata } from 'next';
import './globals.css';
import { DevTools } from '@/components/dev-tools';
import { AdminThemePackWrapper } from '@/components/admin-theme-pack-wrapper';

export const metadata: Metadata = {
  title: 'Commerce Admin - Management Dashboard',
  description: 'Operational admin workspace for commerce teams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AdminThemePackWrapper>
          {children}
        </AdminThemePackWrapper>
        {/* <DevTools /> */}
      </body>
    </html>
  );
}
