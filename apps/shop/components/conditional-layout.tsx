'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { StoreContextProvider } from '@/components/store-context-provider';
import type { StoreContext } from '@/lib/store-context';
import type { ActiveTheme } from '@/lib/theme-pack/types';
import { ThemePackProvider } from '@/lib/theme-pack';

interface ConditionalLayoutProps {
  children: React.ReactNode;
  /** Server-fetched store context so the subtree SSRs instead of gating on client fetch. */
  initialContext?: StoreContext | null;
  /** Server-pinned active theme (deployment `THEME_SLUG_PIN`), passed straight to ThemePackProvider. */
  initialActiveTheme?: ActiveTheme | null;
}

/**
 * Conditional Layout Component
 *
 * This component conditionally renders the store context provider
 * based on the current pathname. For error pages like store-not-found, it renders
 * only the children without the standard layout components.
 *
 * The actual theme-based layout is handled by ThemedLayout component inside StoreContextProvider.
 */
export function ConditionalLayout({ children, initialContext, initialActiveTheme }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read ?theme= param for Theme Pack preview
  const previewSlug = searchParams.get('theme') ?? undefined;

  // Pages that do not require store context or standard layout
  const isErrorPage = pathname?.includes('/store-not-found');
  const isPreviewPage = pathname?.includes('/design-preview');

  if (isErrorPage || isPreviewPage) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

  // Render with ThemePackProvider wrapping StoreContextProvider
  // ThemePackProvider handles tokens CSS injection and template loading
  // StoreContextProvider handles store context and the default theme renderer
  return (
    <ThemePackProvider previewSlug={previewSlug} initialActiveTheme={initialActiveTheme}>
      <StoreContextProvider initialContext={initialContext}>
        {children}
      </StoreContextProvider>
    </ThemePackProvider>
  );
}
