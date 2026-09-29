import DocumentRoot from '@/components/document-root';
import { StorefrontCodeLoader } from '@/components/storefront-code-loader';
import { getStorefrontCode } from '@/lib/storefront-code';
import { resolveProviderLibraryOverrides } from '@/lib/provider-library-overrides.mjs';

export default async function StorefrontRoot({ children }: { children: React.ReactNode }) {
  const slots = await getStorefrontCode();
  const libraryOverrides = resolveProviderLibraryOverrides(
    process.env.STOREFRONT_PROVIDER_LIBRARY_OVERRIDES, process.env.STOREFRONT_URL,
  );
  return <DocumentRoot>{children}{slots && <StorefrontCodeLoader slots={slots} libraryOverrides={libraryOverrides} />}</DocumentRoot>;
}
