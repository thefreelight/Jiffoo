'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useProduct } from '@/lib/hooks/use-api';
import { ProductForm } from '@/components/products/ProductForm';
import { Button } from '@/components/ui/button';
export default function EditProductPage() {
  const params = useParams(), locale = useLocale(), t = useT(), product = useProduct(params.id as string);
  if (product.isLoading) return <p role="status">{t('merchant.catalog.loadProduct')}</p>;
  if (product.error || !product.data) return <div role="alert" className="space-y-3"><p>{t('merchant.catalog.productError')}</p><Button variant="outline" onClick={() => product.refetch()}>{t('merchant.catalog.retry')}</Button><Link href={'/' + locale + '/products'}>{t('merchant.catalog.back')}</Link></div>;
  return <ProductForm key={product.data.id} product={product.data} />;
}
