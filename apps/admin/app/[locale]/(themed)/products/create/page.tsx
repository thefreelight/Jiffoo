import { ProductEditorPage } from '@/components/products/ProductEditorPage';
import { getAdminStoreUrl } from '@/lib/server-theme';
export default async function CreateProductPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ duplicate?: string; categoryId?: string }> }) {
  const { locale } = await params, query = await searchParams;
  return <ProductEditorPage duplicateId={query.duplicate} categoryId={query.categoryId} storefrontUrl={getAdminStoreUrl(locale)} />;
}
