'use client';

import { usePathname } from 'next/navigation';
import { MallContextProvider } from '@/components/mall-context-provider';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

/**
 * Conditional Layout Component
 *
 * This component conditionally renders the mall context provider
 * based on the current pathname. For error pages like store-not-found, it renders
 * only the children without the standard layout components.
 *
 * The actual theme-based layout is now handled by ThemedLayout component inside MallContextProvider.
 */
export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Pages that should not have header/footer
  const isErrorPage = pathname === '/store-not-found';

  if (isErrorPage) {
    // Render only children for error pages
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

  // Render with mall context provider which will handle theme loading and layout
  return (
    <MallContextProvider>
      {children}
    </MallContextProvider>
  );
}
