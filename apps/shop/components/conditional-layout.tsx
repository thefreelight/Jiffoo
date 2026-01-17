'use client';

import { usePathname } from 'next/navigation';
import { StoreContextProvider } from '@/components/store-context-provider';

interface ConditionalLayoutProps {
  children: React.ReactNode;
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
export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

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

  // Render with store context provider
  return (
    <StoreContextProvider>
      {children}
    </StoreContextProvider>
  );
}
