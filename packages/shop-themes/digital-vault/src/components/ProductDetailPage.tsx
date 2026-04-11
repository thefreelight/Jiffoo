import React from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingBag } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProductDetailPageProps } from '../types/theme';
import { getDigitalPreview } from '../lib/digital-fulfillment';

function getProductImages(product: any): string[] {
  if (!product?.images?.length) return ['/placeholder-product.svg'];
  return product.images
    .map((image: any) => (typeof image === 'string' ? image : image?.url))
    .filter(Boolean);
}

function getVariantLabel(variant: any): string {
  if (!variant) return '';
  return variant.name || variant.value || variant.skuCode || 'Default option';
}

export const ProductDetailPage = React.memo(function ProductDetailPage({
  product,
  isLoading,
  selectedVariant,
  quantity,
  onVariantChange,
  onQuantityChange,
  onAddToCart,
  onBack,
}: ProductDetailPageProps) {
  const preview = React.useMemo(() => getDigitalPreview(product), [product]);
  const images = React.useMemo(() => getProductImages(product), [product]);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);

  const currentVariant = React.useMemo(() => {
    if (!product?.variants?.length || !selectedVariant) return null;
    return product.variants.find((variant: any) => variant.id === selectedVariant) || null;
  }, [product, selectedVariant]);

  const variantRecord = currentVariant as Record<string, unknown> | null;
  const productRecord = product as Record<string, unknown> | null;
  const stockValue = Number(
    variantRecord?.inventory ??
      variantRecord?.baseStock ??
      product?.inventory?.available ??
      productRecord?.stock ??
      0
  );
  const priceValue = Number(variantRecord?.price ?? variantRecord?.salePrice ?? product?.price ?? 0);
  const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));
  const image = images[selectedImageIndex] || images[0] || '/placeholder-product.svg';
  const purchaseType = String(productRecord?.purchaseType ?? productRecord?.purchase_type ?? 'member').toLowerCase();
  const fulfillmentType = String(productRecord?.fulfillmentType ?? productRecord?.fulfillment_type ?? preview.kind).toLowerCase();
  const content = typeof productRecord?.content === 'string' ? productRecord.content : '';
  const specifications = Array.isArray(product?.specifications) ? product.specifications : [];

  React.useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--vault-bg)] px-4">
        <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow)]">
          <h1 className="text-3xl font-bold text-[var(--vault-ink)]">Product not found</h1>
          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2.5 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </button>

        <nav className="mt-6 flex flex-wrap items-center gap-2 text-sm text-[var(--vault-copy-soft)]">
          <button onClick={onBack} className="hover:text-[var(--vault-ink)]">
            Catalog
          </button>
          <span>/</span>
          <span className="hover:text-[var(--vault-ink)]">{product.category?.name || 'Digital goods'}</span>
          <span>/</span>
          <span className="truncate text-[var(--vault-ink)]">{product.name}</span>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.75fr)]">
          <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] shadow-[var(--vault-shadow-soft)]">
            <img
              src={image}
              alt={product.name}
              className="aspect-[4/3] w-full border-b border-[var(--vault-line)] object-cover"
            />

            {images.length > 1 ? (
              <div className="flex gap-3 overflow-x-auto border-b border-[var(--vault-line)] px-6 py-4 sm:px-8">
                {images.map((item, index) => (
                  <button
                    key={`${item}-${index}`}
                    onClick={() => setSelectedImageIndex(index)}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-[var(--vault-surface-alt)] transition-colors',
                      index === selectedImageIndex
                        ? 'border-[var(--vault-primary)] ring-2 ring-[var(--vault-primary-soft)]'
                        : 'border-[var(--vault-line)]'
                    )}
                  >
                    <img src={item} alt={`${product.name} preview ${index + 1}`} className="h-16 w-16 object-cover" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="p-6 sm:p-8">
              <p className="text-[12px] leading-6 text-[var(--vault-copy-soft)]">
                {product.category?.name || 'Digital goods'} · {preview.kindLabel} · {purchaseType === 'guest' ? 'Guest purchase' : 'Member purchase'}
              </p>

              <h1 className="mt-4 text-[clamp(2rem,4vw,3.5rem)] font-black leading-[1.02] tracking-[-0.045em] text-[var(--vault-ink)]">
                {product.name}
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--vault-copy)]">
                {product.description || 'Digital product with immediate post-payment delivery.'}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {preview.highlights.slice(0, 2).map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4 text-sm leading-6 text-[var(--vault-copy)]"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Included after payment</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {preview.artifactLabels.map((artifact) => (
                    <div
                      key={artifact}
                      className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-3 text-sm text-[var(--vault-copy)]"
                    >
                      {artifact}
                    </div>
                  ))}
                </div>
              </div>

              {(content || specifications.length > 0) ? (
                <div className="mt-8 rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Details</p>
                  {content ? (
                    <div
                      className="prose prose-sm mt-4 max-w-none text-[var(--vault-copy)]"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  ) : null}
                  {specifications.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {specifications.map((item: any, index: number) => (
                        <div key={`${item.name || index}-${item.value || ''}`} className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                            {item.name || 'Detail'}
                          </p>
                          <p className="mt-2 text-sm text-[var(--vault-ink)]">{item.value || '-'}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Purchase</p>

              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-4xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                  ${priceValue.toFixed(2)}
                </span>
                {product.originalPrice && Number(product.originalPrice) > priceValue ? (
                  <span className="text-lg text-[var(--vault-copy-soft)] line-through">
                    ${Number(product.originalPrice).toFixed(2)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3 text-sm text-[var(--vault-copy)]">
                Delivery: {preview.deliveryLabel} · {preview.etaLabel}
              </div>

              <div className="mt-4 space-y-2 text-sm text-[var(--vault-copy)]">
                <div className="flex items-center justify-between rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                  <span>Stock status</span>
                  <span className="font-medium text-[var(--vault-ink)]">
                    {stockValue > 0 ? `${stockValue} ready to deliver` : 'Currently unavailable'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                  <span>Purchase mode</span>
                  <span className="font-medium text-[var(--vault-ink)]">
                    {purchaseType === 'guest' ? 'Guest checkout allowed' : 'Account-first flow'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                  <span>Fulfillment type</span>
                  <span className="font-medium capitalize text-[var(--vault-ink)]">
                    {fulfillmentType.replace(/[-_]+/g, ' ')}
                  </span>
                </div>
              </div>

              {product.variants?.length ? (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Options / SKU</p>
                  <div className="mt-3 grid gap-2">
                    {product.variants.map((variant: any) => {
                      const isActive = selectedVariant === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => onVariantChange(variant.id)}
                          className={cn(
                            'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                            isActive
                              ? 'border-[var(--vault-primary)] bg-[var(--vault-primary-soft)] text-[var(--vault-primary-strong)]'
                              : 'border-[var(--vault-line)] bg-[var(--vault-surface-alt)] text-[var(--vault-copy)]'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">{getVariantLabel(variant)}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] opacity-70">
                                {String(variant?.sku || variant?.skuCode || variant?.id).slice(0, 18)}
                              </p>
                            </div>
                            {isActive ? <CheckCircle2 className="h-4 w-4" /> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Quantity</p>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-3 py-2">
                  <button
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--vault-copy)]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-black text-[var(--vault-ink)]">{quantity}</span>
                  <button
                    onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--vault-copy)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => onAddToCart()}
                disabled={stockValue <= 0}
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingBag className="h-4 w-4" />
                {stockValue > 0 ? 'Add to cart' : 'Out of stock'}
              </button>

            </div>

            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Order center reminder</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                    Delivery records should stay readable after checkout, with codes, accounts, and downloads kept on the order instead of being hidden behind support requests.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});
