import DocumentRoot from '@/components/document-root';
import { StorefrontCodeLoader } from '@/components/storefront-code-loader';
import { shopBootstrap } from '@/lib/server-bootstrap';
import { resolveProviderLibraryOverrides } from '@/lib/provider-library-overrides.mjs';
import { PurchaseTrackingDisabled } from '@/components/order-purchase-tracking';

export default async function StorefrontRoot({ children }: { children: React.ReactNode }) {
  const { slots } = await shopBootstrap();
  const libraryOverrides = resolveProviderLibraryOverrides(
    process.env.STOREFRONT_PROVIDER_LIBRARY_OVERRIDES, process.env.STOREFRONT_URL,
  );
  return DocumentRoot({ children: <>{children}{slots ? <StorefrontCodeLoader slots={slots} libraryOverrides={libraryOverrides} /> : <PurchaseTrackingDisabled />}</> });
}
