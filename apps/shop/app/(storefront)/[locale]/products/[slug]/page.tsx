import Link from 'next/link';
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
import { ProductGallery } from '@/components/product-gallery';

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
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-7 md:px-8">
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-subtle">
      <Link href={localePath(locale)}>{t.navigation.home}</Link><span aria-hidden="true">/</span>
      {product.categoryName && product.categorySlug && <><Link href={localePath(locale, `/categories/${product.categorySlug}`)}>{product.categoryName}</Link><span aria-hidden="true">/</span></>}
      <span>{product.name}</span>
    </div>
    <div className="grid gap-7 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-14">
      <div className={galleryRight ? 'md:order-2' : ''}><ProductGallery key={product.id} images={product.images} name={product.name} locale={locale} /></div>
      <div>
        {product.categoryName && <p className="mb-2 text-[13px] text-subtle">{product.categoryName}</p>}
        <h1 className="text-[26px] font-semibold tracking-tight md:text-[32px]">{product.name}</h1>
        <div className="mt-7">
          {product.variants?.length
            ? <VariantPicker key={product.id} variants={product.variants} locale={locale} currency={context.currency} labels={t.product}
                productId={product.id} slug={slug} loggedIn={loggedIn} />
            : <><p className="text-2xl font-semibold">{formatPrice(product.price, locale, context.currency)}</p><p>{product.stock > 5 ? t.product.stock : product.stock > 0 ? t.shop.lowStock.replace('{count}', String(product.stock)) : t.shop.soldOut}</p><button disabled className="mt-4 h-12 w-full rounded-md bg-action text-action-ink opacity-45">{t.shop.soldOut}</button></>}
        </div>
        {product.description && <details open className="mt-8 border-y border-line py-4">
          <summary className="cursor-pointer font-medium">{t.product.description}</summary>
          <p className="mt-3 whitespace-pre-wrap text-subtle">{product.description}</p>
        </details>}
      </div>
    </div>
    {related.length > 0 && <section className="mt-14"><h2 className="mb-6 text-[22px] font-semibold">{t.shop.related}</h2>
      <ProductGrid items={related} locale={locale} currency={context.currency} /></section>}
    <ThemeSections sections={theme ? sectionsForPage('product', theme.layout) : []}
      locale={locale} currency={context.currency} />
    </main>
  );
}
