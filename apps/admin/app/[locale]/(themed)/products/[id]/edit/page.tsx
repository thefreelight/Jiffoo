import { ProductEditorPage } from '@/components/products/ProductEditorPage';
import { getAdminStoreUrl } from '@/lib/server-theme';
export default async function EditProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  return <ProductEditorPage id={id} storefrontUrl={getAdminStoreUrl(locale)} />;
}
