import DocumentRoot from '@/components/document-root';
import { StorefrontCodeLoader } from '@/components/storefront-code-loader';
import { getStorefrontCode } from '@/lib/storefront-code';

export default async function StorefrontRoot({ children }: { children: React.ReactNode }) {
  const slots = await getStorefrontCode();
  return <DocumentRoot>{children}{slots && <StorefrontCodeLoader slots={slots} />}</DocumentRoot>;
}
