import { StoreContextProvider } from '@/components/store-context-provider';
import { ThemePackProvider } from '@/lib/theme-pack';
import type { StoreContext } from '@/lib/store-context';

interface ConditionalLayoutProps {
  children: React.ReactNode;
  initialContext?: StoreContext | null;
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
export function ConditionalLayout({ children, initialContext }: ConditionalLayoutProps) {
  // Render with ThemePackProvider wrapping StoreContextProvider
  // ThemePackProvider handles tokens CSS injection and template loading.
  // Keep this component server-renderable so storefront HTML does not get
  // stuck behind the outer Suspense fallback as a blank loading shell.
  return (
    <ThemePackProvider>
      <StoreContextProvider initialContext={initialContext}>
        {children}
      </StoreContextProvider>
    </ThemePackProvider>
  );
}
