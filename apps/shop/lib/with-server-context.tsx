/**
 * Higher-Order Component for Server-Side Mall Context
 * 
 * This HOC allows individual pages to opt-in to SSR optimization
 * by fetching mall context on the server.
 * 
 * Usage Example:
 * 
 * ```tsx
 * // app/products/page.tsx
 * import { withServerContext } from '@/lib/with-server-context';
 * 
 * async function ProductsPage({ 
 *   searchParams 
 * }: { 
 *   searchParams: Record<string, string | string[] | undefined> 
 * }) {
 *   return <div>Products Page</div>;
 * }
 * 
 * export default withServerContext(ProductsPage);
 * ```
 */

import { getServerMallContext, type ServerMallContext } from './server-mall-context';
import { MallContextProvider } from '@/components/mall-context-provider';
import type { MallContext } from './mall-context';

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
  [key: string]: any;
}

/**
 * Wrap a page component with server-side mall context fetching
 * 
 * @param PageComponent - The page component to wrap
 * @returns A new component that fetches context on the server
 */
export function withServerContext<P extends PageProps>(
  PageComponent: React.ComponentType<P & { initialContext?: MallContext | null }>
) {
  return async function ServerContextPage(props: P) {
    // Fetch mall context on the server
    const serverContext = await getServerMallContext(props.searchParams);

    // Convert ServerMallContext to MallContext
    const initialContext: MallContext | null = serverContext
      ? {
          tenantId: serverContext.tenantId,
          tenantName: serverContext.tenantName,
          subdomain: serverContext.subdomain,
          domain: serverContext.domain,
          logo: serverContext.logo,
          theme: serverContext.theme,
          settings: serverContext.settings,
          status: serverContext.status,
          defaultLocale: serverContext.defaultLocale ?? 'en',
          supportedLocales: serverContext.supportedLocales ?? ['en', 'zh-Hant'],
        }
      : null;

    // Render the page with initial context
    return (
      <MallContextProvider initialContext={initialContext}>
        <PageComponent {...props} initialContext={initialContext} />
      </MallContextProvider>
    );
  };
}

/**
 * Hook to access server-fetched context in page components
 * 
 * Note: This only works in pages wrapped with withServerContext
 */
export function useInitialContext() {
  // This is a placeholder - actual implementation would use React Context
  // For now, pages can access initialContext from props
  return null;
}
