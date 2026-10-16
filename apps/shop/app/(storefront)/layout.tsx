import DocumentRoot from '@/components/document-root';
import { StorefrontCodeLoader } from '@/components/storefront-code-loader';
import { shopBootstrap } from '@/lib/server-bootstrap';
import { resolveProviderLibraryOverrides } from '@/lib/provider-library-overrides.mjs';
import { PurchaseTrackingDisabled } from '@/components/order-purchase-tracking';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from '@/components/ui/sonner';

export default async function StorefrontRoot({ children }: { children: React.ReactNode }) {
  const { slots } = await shopBootstrap();
  const libraryOverrides = resolveProviderLibraryOverrides(
    process.env.STOREFRONT_PROVIDER_LIBRARY_OVERRIDES, process.env.STOREFRONT_URL,
  );
  return DocumentRoot({ children: <NuqsAdapter>{children}<Toaster />{slots ? <StorefrontCodeLoader slots={slots} libraryOverrides={libraryOverrides} /> : <PurchaseTrackingDisabled />}</NuqsAdapter> });
}
