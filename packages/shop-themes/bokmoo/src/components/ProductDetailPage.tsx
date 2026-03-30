import React from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, QrCode, ShieldCheck, ShoppingBag, Smartphone } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import type { ProductDetailPageProps } from 'shared/src/types/theme';
import { getBokmooTravelProfile } from '../lib/digital-fulfillment';

function getProductImage(product: Product | null): string | null {
  if (!product?.images?.length) return null;
  const primary = product.images.find((image) => image.isMain) || product.images[0];
  return primary?.url || null;
}

function getVariantLabel(variant: Product['variants'][number]): string {
  return variant.name || variant.value || variant.sku || 'Default option';
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
  const profile = React.useMemo(() => getBokmooTravelProfile(product), [product]);
  const currentVariant = React.useMemo(() => {
    if (!product?.variants?.length || !selectedVariant) return null;
    return product.variants.find((variant) => variant.id === selectedVariant) || null;
  }, [product, selectedVariant]);

  const stockValue = Number(currentVariant?.inventory ?? product?.inventory?.available ?? 0);
  const priceValue = Number(currentVariant?.price ?? product?.price ?? 0);
  const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));
  const image = getProductImage(product);

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4">
        <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
          <h1 className="text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">Plan not found</h1>
          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(22rem,0.72fr)]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] shadow-[var(--bokmoo-shadow)]">
              <div className="aspect-[1.28/1] border-b border-[var(--bokmoo-line)]">
                {image ? (
                  <img src={image} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(155deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_58%),linear-gradient(180deg,var(--bokmoo-bg-soft),var(--bokmoo-bg))] p-8">
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--bokmoo-gold)]">
                        {profile.cardEyebrow}
                      </span>
                      <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy)]">
                        {profile.deliveryLabel}
                      </span>
                    </div>
                    <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[color:oklch(0.18_0.008_90_/_0.94)] p-6">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]">Bokmoo</p>
                      <p className="mt-4 text-[clamp(2.2rem,4vw,4.4rem)] leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                        {profile.coverageLabel}
                      </p>
                      <p className="mt-3 text-base text-[var(--bokmoo-copy)]">{profile.planLabel}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                    {profile.cardEyebrow}
                  </span>
                  <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]">
                    {profile.planBadge}
                  </span>
                </div>

                <h1 className="mt-5 text-[clamp(2.5rem,4vw,4.6rem)] leading-[0.94] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                  {product.name}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--bokmoo-copy)]">
                  {product.description || profile.summary}
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {profile.highlights.map((item) => (
                    <div
                      key={item}
                      className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4"
                    >
                      <CheckCircle2 className="h-5 w-5 text-[var(--bokmoo-gold)]" />
                      <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
              <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Activation ritual
                </p>
                <div className="mt-4 grid gap-3">
                  {[
                    'Purchase the plan and receive your QR code immediately.',
                    'Scan on an unlocked eSIM-compatible device before takeoff.',
                    'Switch on data roaming for the new line when you land.',
                  ].map((step, index) => (
                    <div key={step} className="grid grid-cols-[1.8rem_minmax(0,1fr)] gap-3 rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bokmoo-gold)] text-[11px] font-bold text-[var(--bokmoo-bg)]">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-[var(--bokmoo-copy)]">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Plan facts
                </p>
                <div className="mt-4 grid gap-3">
                  {profile.specRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-4 rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-4"
                    >
                      <span className="text-sm text-[var(--bokmoo-copy)]">{row.label}</span>
                      <span className="text-right text-sm font-medium text-[var(--bokmoo-ink)]">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                Secure checkout
              </p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-4xl font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                  ${priceValue.toFixed(2)}
                </span>
                {product.originalPrice && Number(product.originalPrice) > priceValue ? (
                  <span className="text-lg text-[var(--bokmoo-copy-soft)] line-through">
                    ${Number(product.originalPrice).toFixed(2)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4 text-sm leading-6 text-[var(--bokmoo-copy)]">
                {profile.deliveryLabel}. {profile.activationLabel}.
              </div>

              {product.variants?.length ? (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                    Choose an option
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.variants.map((variant) => {
                      const isActive = selectedVariant === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => onVariantChange(variant.id)}
                          className={cn(
                            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] text-[var(--bokmoo-ink)]'
                              : 'border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-copy)]'
                          )}
                          type="button"
                        >
                          {getVariantLabel(variant)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Quantity
                </p>
                <div className="mt-3 flex items-center justify-between rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-3 py-2">
                  <button
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--bokmoo-copy)]"
                    type="button"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-semibold text-[var(--bokmoo-ink)]">{quantity}</span>
                  <button
                    onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--bokmoo-copy)]"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--bokmoo-copy-soft)]">
                  {stockValue > 0 ? `${stockValue} available` : 'Currently unavailable'}
                </p>
              </div>

              <button
                onClick={() => onAddToCart()}
                disabled={stockValue <= 0}
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                <ShoppingBag className="h-4 w-4" />
                {stockValue > 0 ? 'Add to cart' : 'Out of stock'}
              </button>
            </div>

            <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--bokmoo-ink)]">QR delivered instantly</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--bokmoo-copy)]">Get the install flow immediately after payment confirmation.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--bokmoo-ink)]">Compatibility first</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--bokmoo-copy)]">{profile.compatibilityLabel}.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--bokmoo-ink)]">Support on standby</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--bokmoo-copy)]">Ideal when you want setup confidence before your trip begins.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});
