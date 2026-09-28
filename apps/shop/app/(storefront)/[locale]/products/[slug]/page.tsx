import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { notFound } from 'next/navigation';
import { messages, productBySlug, requireLocale } from '@/lib/catalog';
import { localePath } from '@/lib/locale';
import { VariantPicker } from '@/components/variant-picker';
import { formatPrice } from '@/lib/price';
import { accountProfile } from '@/lib/server-account';
import { categories, products } from '@/lib/catalog';
import { getShopTheme } from '@/lib/theme';
import { sectionsForPage } from '@/lib/page-classes';
import { ThemeSections } from '@/components/theme-sections';
import { ProductGrid } from '@/components/product-grid';

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: segment, slug } = await params;
  const { locale, context } = await requireLocale(segment);
  const product = await productBySlug(locale, slug);
  if (!product) notFound();
  const t = messages(locale);
  const [profile, theme] = await Promise.all([accountProfile(), getShopTheme(locale)]);
  const loggedIn = !!profile;
  const galleryRight = theme?.layout.pages.product.gallery === 'right';
  const relatedCategoryId = theme?.layout.pages.product.showRelatedProducts && product.categorySlug
    ? (await categories(locale)).find((group) => group.slug === product.categorySlug)?.id : undefined;
  const related = relatedCategoryId
    ? (await products(locale, 1, relatedCategoryId, 5))
      ?.items.filter((item) => item.id !== product.id).slice(0, 4) ?? []
    : [];
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
    <div className="grid gap-10 md:grid-cols-2">
      <section aria-label={product.name} className={galleryRight ? 'md:order-2' : ''}>
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
            ? <VariantPicker variants={product.variants} locale={locale} currency={context.currency} labels={t.product}
                productId={product.id} slug={slug} loggedIn={loggedIn} />
            : <><p className="text-2xl font-semibold">{formatPrice(product.price, locale, context.currency)}</p><p>{product.stock > 0 ? t.product.stock : t.product.outOfStock}</p></>}
        </div>
        {product.description && <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-semibold">{t.product.description}</h2>
          <p className="mt-3 whitespace-pre-wrap text-subtle">{product.description}</p>
        </section>}
      </div>
    </div>
    {related.length > 0 && <section className="mt-12"><h2 className="mb-5 text-2xl font-semibold">{t.home.products}</h2>
      <ProductGrid items={related} locale={locale} currency={context.currency} /></section>}
    <ThemeSections sections={theme ? sectionsForPage('product', theme.layout) : []}
      locale={locale} currency={context.currency} />
    </main>
  );
}
