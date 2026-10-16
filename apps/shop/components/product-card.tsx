import { ShopImage as Image } from './shop-image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import type { Product } from '@/lib/catalog';
import { messages } from '@/lib/catalog';
import { localePath, type ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';

export function ProductCard({ product, locale, currency }: { product: Product; locale: ShopLocale; currency: string }) {
  const t = messages(locale);
  return (
    <article className="min-w-0">
      <Link href={localePath(locale, `/products/${product.slug}`)} className="group block">
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-highlight">
          {product.images[0]
            ? <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 720px) 50vw, 25vw" className="object-cover group-hover:brightness-95" />
            : <ImageOff aria-hidden="true" size={34} className="text-subtle" />}
          {product.stock < 1 && <span className="absolute left-2.5 top-2.5 rounded-md bg-canvas px-2 py-1 text-xs text-subtle">{t.shop.soldOut}</span>}
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-2 font-medium group-hover:text-action">{product.name}</h3>
          {product.categoryName && <p className="text-[13px] text-[var(--shop-core-faint)]">{product.categoryName}</p>}
          <p className="pt-1 tabular-nums">{formatPrice(product.price, locale, currency)}</p>
        </div>
      </Link>
    </article>
  );
}
