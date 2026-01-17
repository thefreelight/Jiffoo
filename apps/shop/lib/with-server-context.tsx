/**
 * Higher-Order Component for Server-Side Store Context (Single Store)
 */

import { getServerStoreContext } from './server-store-context';
import { StoreContextProvider } from '@/components/store-context-provider';
import type { StoreContext } from './store-context';

interface PageProps {
  [key: string]: any;
}

/**
 * Wrap a page component with server-side store context fetching
 */
export function withServerContext<P extends PageProps>(
  PageComponent: React.ComponentType<P & { initialContext?: StoreContext | null }>
) {
  return async function ServerContextPage(props: P) {
    // Fetch store context on the server
    const serverContext = await getServerStoreContext();

    // Convert ServerStoreContext to StoreContext
    const initialContext: StoreContext | null = serverContext
      ? {
        storeId: serverContext.storeId,
        storeName: serverContext.storeName,
        logo: serverContext.logo,
        theme: serverContext.theme as any,
        settings: serverContext.settings,
        status: serverContext.status,
        defaultLocale: serverContext.defaultLocale ?? 'en',
        supportedLocales: serverContext.supportedLocales ?? ['en', 'zh-Hant'],
      }
      : null;

    // Render the page with store context provider
    return (
      <StoreContextProvider initialContext={initialContext}>
        <PageComponent {...props} initialContext={initialContext} />
      </StoreContextProvider>
    );
  };
}
