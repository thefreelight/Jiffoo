'use client';
import Link from 'next/link';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useProduct } from '@/lib/hooks/use-api';
import { ProductForm } from './ProductForm';
import { Button } from '@/components/ui/button';
export function ProductEditorPage({ id, duplicateId, categoryId, storefrontUrl }: { id?: string; duplicateId?: string; categoryId?: string; storefrontUrl: string }) {
  const t = useT(), locale = useLocale(), source = useProduct(id ?? duplicateId ?? '');
  if ((id || duplicateId) && source.isLoading) return <p role="status">{t('merchant.catalog.loadProduct')}</p>;
  if ((id || duplicateId) && (source.error || !source.data)) return <div role="alert"><p>{t('merchant.catalog.productError')}</p><Button variant="outline" onClick={() => source.refetch()}>{t('merchant.catalog.retry')}</Button><Link href={'/' + locale + '/products'}>{t('merchant.catalog.back')}</Link></div>;
  return <ProductForm key={id ?? duplicateId ?? 'create:' + (categoryId ?? '')} product={id ? source.data : undefined} source={duplicateId ? source.data : undefined} categoryId={categoryId} storefrontUrl={storefrontUrl} />;
}
