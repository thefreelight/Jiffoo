import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { Skeleton } from './ui/skeleton';

export function CatalogLoading({ locale }: { locale: ShopLocale }) {
  return <span role="status" aria-busy="true" aria-label={storefrontMessages(locale).shop.loading} className="inline-flex items-center gap-2 text-sm text-subtle">
    <Skeleton className="size-4 rounded-full" />{storefrontMessages(locale).shop.loading}
  </span>;
}
