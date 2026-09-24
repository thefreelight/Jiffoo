import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import type { Product } from '@/lib/catalog';
import { messages } from '@/lib/catalog';
import { localePath, type ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';

export function ProductCard({ product, locale, currency }: { product: Product; locale: ShopLocale; currency: string }) {
  const t = messages(locale);
  return (
    <article className="min-w-0 rounded-shop border border-line bg-surface">
      <Link href={localePath(locale, `/products/${product.slug}`)} className="group block">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-highlight">
          {product.images[0]
            ? <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform group-hover:scale-105" />
            : <ImageOff aria-hidden="true" size={34} className="text-subtle" />}
        </div>
        <div className="space-y-1 p-4">
          {product.categoryName && <p className="text-xs text-subtle">{product.categoryName}</p>}
          <h3 className="line-clamp-2 font-medium group-hover:text-action">{product.name}</h3>
          <p className="font-semibold">{formatPrice(product.price, locale, currency)}</p>
          <p className="text-xs text-subtle">{product.stock > 0 ? t.product.stock : t.product.outOfStock}</p>
        </div>
      </Link>
    </article>
  );
}
