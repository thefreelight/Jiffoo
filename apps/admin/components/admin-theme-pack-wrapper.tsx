'use client';

/**
 * Admin Theme Pack Wrapper
 *
 * Client component wrapper for AdminThemePackProvider.
 * This is needed because the root layout is a server component,
 * but the provider needs to be a client component.
 */

import { ReactNode } from 'react';
import { AdminThemePackProvider } from '@/lib/theme-pack';

interface AdminThemePackWrapperProps {
  children: ReactNode;
  /** Optional preview slug for theme preview mode */
  previewSlug?: string;
}

export function AdminThemePackWrapper({
  children,
  previewSlug,
}: AdminThemePackWrapperProps) {
  return (
    <AdminThemePackProvider previewSlug={previewSlug}>
      {children}
    </AdminThemePackProvider>
  );
}
