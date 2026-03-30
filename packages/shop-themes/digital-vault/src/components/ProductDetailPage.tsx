import React from 'react';
import { ArrowLeft, CheckCircle2, Copy, Download, Minus, Plus, ShieldCheck, ShoppingBag } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProductDetailPageProps } from 'shared/src/types/theme';
import { getDigitalPreview } from '../lib/digital-fulfillment';

function getProductImage(product: any): string {
  if (!product?.images?.length) return '/placeholder-product.svg';
  const first = product.images[0];
  return typeof first === 'string' ? first : first?.url || '/placeholder-product.svg';
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

  const currentVariant = React.useMemo(() => {
    if (!product?.variants?.length || !selectedVariant) return null;
    return product.variants.find((variant: any) => variant.id === selectedVariant) || null;
  }, [product, selectedVariant]);

  const variantRecord = currentVariant as unknown as Record<string, unknown> | null;
  const productRecord = product as unknown as Record<string, unknown> | null;
  const stockValue = Number(
    variantRecord?.baseStock ??
      variantRecord?.inventory ??
      product?.inventory?.available ??
      productRecord?.stock ??
      0
  );
  const priceValue = Number(variantRecord?.salePrice ?? variantRecord?.price ?? product?.price ?? 0);
  const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));
  const image = getProductImage(product);

  const attributeRows = variantRecord?.attributes && typeof variantRecord.attributes === 'object'
    ? Object.entries(variantRecord.attributes as Record<string, unknown>).slice(0, 4)
    : [];

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--vault-bg)] px-4">
        <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow)]">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">Product not found</h1>
          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.75fr)]">
          <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] shadow-[var(--vault-shadow)]">
            <img
              src={image}
              alt={product.name}
              className="aspect-[1.25/1] w-full border-b border-[var(--vault-line)] object-cover"
            />

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--vault-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-primary-strong)]">
                  {preview.kindLabel}
                </span>
                <span className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)]">
                  {preview.deliveryLabel}
                </span>
                <span className="rounded-full border border-[var(--vault-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)]">
                  {preview.etaLabel}
                </span>
              </div>

              <h1 className="mt-5 text-[clamp(2.4rem,4vw,4rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--vault-ink)]">
                {product.name}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--vault-copy)]">
                {product.description || 'Digital item with immediate post-payment fulfillment.'}
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {preview.highlights.slice(0, 3).map((item) => (
                  <div
                    key={item}
                    className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] p-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-[var(--vault-success)]" />
                    <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                <div className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    What the buyer receives
                  </p>
                  <div className="mt-4 grid gap-2">
                    {preview.artifactLabels.map((artifact) => (
                      <div
                        key={artifact}
                        className="flex items-center gap-3 rounded-[var(--vault-radius-sm)] border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-3 text-sm text-[var(--vault-ink)]"
                      >
                        {artifact.toLowerCase().includes('download') ? (
                          <Download className="h-4 w-4 text-[var(--vault-primary)]" />
                        ) : (
                          <Copy className="h-4 w-4 text-[var(--vault-primary)]" />
                        )}
                        {artifact}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Delivery sequence
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      'Payment is verified by the storefront.',
                      'Fulfillment artifacts are written to the order.',
                      'Buyer opens the locker and copies or downloads immediately.',
                    ].map((step, index) => (
                      <div key={step} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--vault-ink)] text-[11px] font-black text-white">
                          {index + 1}
                        </div>
                        <p className="pt-0.5 text-sm leading-6 text-[var(--vault-copy)]">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                Purchase panel
              </p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-4xl font-black tracking-[-0.05em] text-[var(--vault-ink)]">
                  ${priceValue.toFixed(2)}
                </span>
                {product.originalPrice && Number(product.originalPrice) > priceValue ? (
                  <span className="text-lg text-[var(--vault-copy-soft)] line-through">
                    ${Number(product.originalPrice).toFixed(2)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-sm text-[var(--vault-copy)]">
                Usually delivered {preview.etaLabel.toLowerCase()} through {preview.deliveryLabel.toLowerCase()}.
              </div>

              {product.variants?.length ? (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Choose an option
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.variants.map((variant: any) => {
                      const isActive = selectedVariant === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => onVariantChange(variant.id)}
                          className={cn(
                            'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                            isActive
                              ? 'border-[var(--vault-primary)] bg-[var(--vault-primary-soft)] text-[var(--vault-primary-strong)]'
                              : 'border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-copy)]'
                          )}
                        >
                          {getVariantLabel(variant)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {attributeRows.length ? (
                <div className="mt-6 grid gap-2">
                  {attributeRows.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-[var(--vault-radius-sm)] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-sm"
                    >
                      <span className="text-[var(--vault-copy)]">{key}</span>
                      <span className="font-semibold text-[var(--vault-ink)]">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Quantity
                </p>
                <div className="mt-3 flex items-center justify-between rounded-full border border-[var(--vault-line)] bg-[var(--vault-bg)] px-3 py-2">
                  <button
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--vault-copy)]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-black text-[var(--vault-ink)]">{quantity}</span>
                  <button
                    onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--vault-copy)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--vault-copy-soft)]">
                  {stockValue > 0 ? `${stockValue} available` : 'Currently unavailable'}
                </p>
              </div>

              <button
                onClick={() => onAddToCart()}
                disabled={stockValue <= 0}
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--vault-primary)] px-5 text-sm font-semibold uppercase tracking-[0.2em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingBag className="h-4 w-4" />
                {stockValue > 0 ? 'Add to cart' : 'Out of stock'}
              </button>
            </div>

            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Merchant note
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--vault-ink)]">
                    Digital goods work best when access is obvious before purchase and recoverable after purchase.
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
