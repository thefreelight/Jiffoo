import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { StoreContext } from '@/lib/catalog';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { ShopImage } from './shop-image';

export function CheckoutHeader({ context, locale }: { context: StoreContext; locale: ShopLocale }) {
  const t = storefrontMessages(locale);
  return <header className="border-b border-line bg-canvas">
    <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:gap-7 md:px-8">
      <Link href={`/${locale}`} aria-label={context.storeName} className="flex min-w-0 items-center gap-2 text-[17px] font-bold tracking-tight">
        {context.logo && <ShopImage src={context.logo} alt="" width={32} height={32} className="size-8 object-contain" />}<span className="truncate">{context.storeName}</span>
      </Link>
      <ol aria-label={t.checkout.checkout} className="hidden items-center gap-2.5 text-[13px] text-subtle md:flex">
        <li>{t.checkout.cart}</li><li aria-hidden="true"><ChevronRight size={15} /></li><li aria-current="step" className="font-medium text-ink">{t.checkout.checkout}</li><li aria-hidden="true"><ChevronRight size={15} /></li><li>{t.s4.finish}</li>
      </ol>
      <Link href={`/${locale}/cart`} className="ml-auto flex shrink-0 items-center gap-1 text-[13px] text-subtle"><ArrowLeft size={15} aria-hidden="true" />{t.s4.backCart}</Link>
    </div>
  </header>;
}
