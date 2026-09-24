import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { notFound } from 'next/navigation';
import { messages, productBySlug, requireLocale } from '@/lib/catalog';
import { localePath } from '@/lib/locale';
import { VariantPicker } from '@/components/variant-picker';
import { formatPrice } from '@/lib/price';

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: segment, slug } = await params;
  const { locale, context } = await requireLocale(segment);
  const product = await productBySlug(locale, slug);
  if (!product) notFound();
  const t = messages(locale);
  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:grid-cols-2 md:px-8">
      <section aria-label={product.name}>
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-shop bg-highlight">
          {product.images[0]
            ? <Image src={product.images[0]} alt={product.name} fill className="object-contain" priority />
            : <ImageOff aria-hidden="true" size={50} className="text-subtle" />}
        </div>
        {product.images.length > 1 && <div className="mt-3 grid grid-cols-4 gap-3">
          {product.images.slice(1).map((image, index) =>
            <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-shop bg-highlight">
              <Image src={image} alt={product.name} fill className="object-cover" />
            </div>)}
        </div>}
      </section>
      <div>
        {product.categoryName && product.categorySlug &&
          <Link href={localePath(locale, `/categories/${product.categorySlug}`)} className="text-sm text-action underline">{product.categoryName}</Link>}
        <h1 className="mt-3 text-3xl font-semibold">{product.name}</h1>
        <div className="mt-7">
          {product.variants?.length
            ? <VariantPicker variants={product.variants} locale={locale} currency={context.currency} labels={t.product} />
            : <><p className="text-2xl font-semibold">{formatPrice(product.price, locale, context.currency)}</p><p>{product.stock > 0 ? t.product.stock : t.product.outOfStock}</p></>}
        </div>
        {product.description && <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-semibold">{t.product.description}</h2>
          <p className="mt-3 whitespace-pre-wrap text-subtle">{product.description}</p>
        </section>}
      </div>
    </main>
  );
}
