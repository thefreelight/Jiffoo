'use client';

import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingBag, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import type { ProductDetailPageProps } from 'shared/src/types/theme';

import { StudioBadge, StudioMain, StudioPage, StudioPanel } from './StudioShell';

type ProductLike = NonNullable<ProductDetailPageProps['product']>;

type VariantLike = ProductLike['variants'][number];

function getProductImage(product: ProductDetailPageProps['product']): string | null {
  if (!product?.images?.length) {
    return null;
  }
  const primary = product.images.find((image) => image.isMain) || product.images[0];
  return primary?.url || null;
}

function getVariantLabel(variant: VariantLike): string {
  return variant.name || variant.value || variant.sku || 'Default option';
}

export function ProductDetailPage({
  product,
  isLoading,
  selectedVariant,
  quantity,
  onVariantChange,
  onQuantityChange,
  onAddToCart,
  onBack,
}: ProductDetailPageProps) {
  const image = getProductImage(product);

  const currentVariant = useMemo(() => {
    if (!product?.variants?.length || !selectedVariant) {
      return null;
    }
    return product.variants.find((variant) => variant.id === selectedVariant) || null;
  }, [product, selectedVariant]);

  const priceValue = Number(currentVariant?.price ?? product?.price ?? 0);
  const stockValue = Number(currentVariant?.inventory ?? product?.inventory?.available ?? 0);
  const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));

  if (isLoading) {
    return (
      <StudioPage activeNav="explore">
        <StudioMain className="space-y-6">
          <div className="h-12 w-40 animate-pulse rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="h-[520px] animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
            <div className="h-[520px] animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          </div>
        </StudioMain>
      </StudioPage>
    );
  }

  if (!product) {
    return (
      <StudioPage activeNav="explore">
        <StudioMain>
          <StudioPanel className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Product not found</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--imagic-ink-soft)]">
              This pack may have been unpublished, renamed, or moved out of the current creator catalog.
            </p>
            <button type="button" onClick={onBack} className="imagic-button-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </button>
          </StudioPanel>
        </StudioMain>
      </StudioPage>
    );
  }

  return (
    <StudioPage activeNav="explore">
      <StudioMain className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-2 text-sm text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-6">
            <StudioPanel className="overflow-hidden p-0">
              <div className="aspect-[1.2/1] overflow-hidden border-b border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)]">
                {image ? (
                  <img src={image} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--imagic-primary)_20%,transparent),transparent_58%)] p-8">
                    <StudioBadge>Creator pack</StudioBadge>
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--imagic-muted)]">imagic.art</p>
                      <p className="mt-4 text-[clamp(2.5rem,4vw,4.4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-[color:var(--imagic-ink)]">
                        {product.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <StudioBadge>{product.category?.name || 'Creator pack'}</StudioBadge>
                  {(product.tags || []).slice(0, 3).map((tag) => (
                    <StudioBadge key={tag}>{tag}</StudioBadge>
                  ))}
                </div>
                <h1 className="mt-5 text-[clamp(2.4rem,4vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-[color:var(--imagic-ink)]">
                  {product.name}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-[color:var(--imagic-ink-soft)]">
                  {product.description || 'A polished creator-facing product designed for image remixing, visual campaigns, and studio-friendly experimentation.'}
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {[
                    ['High-res exports', 'Built to move quickly from concept to launch-ready asset packs.'],
                    ['Prompt friendly', 'Pairs clean presets with product pages that still feel like part of the studio.'],
                    ['Creator workflow', 'Designed for teams iterating on images, motion, and branded visual systems.'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-[1.4rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] p-4">
                      <CheckCircle2 className="h-5 w-5 text-[color:var(--imagic-primary)]" />
                      <p className="mt-4 text-sm font-semibold text-[color:var(--imagic-ink)]">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--imagic-ink-soft)]">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </StudioPanel>

            <div className="grid gap-4 lg:grid-cols-2">
              <StudioPanel>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--imagic-muted)]">Specifications</p>
                <div className="mt-4 grid gap-3">
                  {(product.specifications?.length ? product.specifications : [{ name: 'Format', value: 'Creator-grade digital pack' }, { name: 'Delivery', value: 'Instant' }, { name: 'Usage', value: 'Campaigns, ads, and visual experiments' }]).map((spec) => (
                    <div key={`${spec.name}-${spec.value}`} className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-3 text-sm">
                      <span className="text-[color:var(--imagic-muted)]">{spec.name}</span>
                      <span className="text-right font-medium text-[color:var(--imagic-ink)]">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </StudioPanel>

              <StudioPanel>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--imagic-muted)]">What you get</p>
                <div className="mt-4 grid gap-3">
                  {[
                    'Cohesive prompt-ready product framing',
                    'A darker premium shell that matches the generation workspace',
                    'Fast transition from browsing to add-to-cart',
                  ].map((item) => (
                    <div key={item} className="rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-3 text-sm text-[color:var(--imagic-ink-soft)]">
                      {item}
                    </div>
                  ))}
                </div>
              </StudioPanel>
            </div>
          </div>

          <StudioPanel className="h-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--imagic-muted)]">Purchase panel</p>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">${priceValue.toFixed(2)}</span>
              {product.originalPrice && Number(product.originalPrice) > priceValue ? (
                <span className="pb-1 text-lg text-[color:var(--imagic-muted)] line-through">${Number(product.originalPrice).toFixed(2)}</span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">
              Instant delivery for creator-facing digital packs and studio-aligned product assets.
            </p>

            {product.variants?.length ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">Choose a variant</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => onVariantChange(variant.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${selectedVariant === variant.id ? 'border-[color:var(--imagic-primary-border)] bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-ink)]' : 'border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] text-[color:var(--imagic-ink-soft)]'}`}
                    >
                      {getVariantLabel(variant)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">Quantity</p>
              <div className="mt-3 flex items-center justify-between rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-3 py-2">
                <button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--imagic-ink)]">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-lg font-semibold text-[color:var(--imagic-ink)]">{quantity}</span>
                <button type="button" onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--imagic-ink)]">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-[color:var(--imagic-muted)]">{stockValue > 0 ? `${stockValue} available` : 'Currently unavailable'}</p>
            </div>

            <button
              type="button"
              onClick={() => void onAddToCart()}
              disabled={stockValue <= 0}
              className="imagic-button-primary mt-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              {stockValue > 0 ? 'Add to cart' : 'Out of stock'}
            </button>
          </StudioPanel>
        </div>
      </StudioMain>
    </StudioPage>
  );
}
