import React from 'react';
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Signal,
  Smartphone,
  Star,
} from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import type { ProductDetailPageProps } from 'shared/src/types/theme';
import { getBokmooProduct, getProductIdFromLocation, mapBokmooApiProductToThemeProduct, normalizeProductForTheme } from '../lib/api';
import { getBokmooTravelProfile } from '../lib/digital-fulfillment';
import { resolveBokmooSiteConfig } from '../site';

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
  config,
  locale,
}: ProductDetailPageProps) {
  const site = resolveBokmooSiteConfig(config);
  const [remoteProduct, setRemoteProduct] = React.useState<Product | null>(null);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const normalizedProduct = React.useMemo(
    () => (product ? normalizeProductForTheme(product as unknown as Product) : remoteProduct),
    [product, remoteProduct]
  );
  const profile = React.useMemo(() => getBokmooTravelProfile(normalizedProduct), [normalizedProduct]);
  const effectiveSelectedVariant = selectedVariant || normalizedProduct?.variants?.[0]?.id || null;
  const currentVariant = React.useMemo(() => {
    if (!normalizedProduct?.variants?.length || !effectiveSelectedVariant) return null;
    return normalizedProduct.variants.find((variant) => variant.id === effectiveSelectedVariant) || null;
  }, [effectiveSelectedVariant, normalizedProduct]);

  const stockValue = Number(currentVariant?.inventory ?? normalizedProduct?.inventory?.available ?? 0);
  const priceValue = Number(currentVariant?.price ?? normalizedProduct?.price ?? 0);
  const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));
  const image = getProductImage(normalizedProduct);

  React.useEffect(() => {
    if (product) return;

    const productId = getProductIdFromLocation();
    if (!productId) return;

    let cancelled = false;
    setRemoteLoading(true);

    void getBokmooProduct(
      {
        baseUrl: site.apiBaseUrl,
      },
      productId,
      locale || 'en'
    )
      .then((response) => {
        if (!cancelled) {
          setRemoteProduct(mapBokmooApiProductToThemeProduct(response));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale, product, site.apiBaseUrl]);

  React.useEffect(() => {
    if (selectedVariant || !normalizedProduct?.variants?.length) return;
    onVariantChange(normalizedProduct.variants[0].id);
  }, [normalizedProduct?.variants, onVariantChange, selectedVariant]);

  if (isLoading || (remoteLoading && !normalizedProduct)) {
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  if (!normalizedProduct) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4">
        <div className="rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]">Plan not found</h1>
          <button
            onClick={onBack}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-ink)]"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Store
        </button>

        <div className="mt-5 rounded-[1.55rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-4 shadow-[var(--bokmoo-shadow)] sm:p-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_22rem]">
            <div>
              <div className="overflow-hidden rounded-[1.2rem] border border-[var(--bokmoo-line)]">
                {image ? (
                  <img src={image} alt={normalizedProduct.name} className="aspect-[1.6/1] h-full w-full object-cover" />
                ) : (
                  <div className="aspect-[1.6/1] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" />
                )}
              </div>

              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[clamp(2.2rem,4vw,3.4rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                    {normalizedProduct.name}
                  </h1>
                  <p className="mt-2 text-lg text-[var(--bokmoo-copy)]">{profile.networkLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-[2.3rem] font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]">
                    ${priceValue.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Data', value: profile.planLabel },
                  { label: 'Validity', value: profile.durationLabel },
                  { label: 'Network', value: profile.networkLabel },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">{item.label}</p>
                    <p className="mt-2 text-sm font-medium text-[var(--bokmoo-ink)]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                {[
                  'High-speed 4G/5G data',
                  'Stay connected in major cities and more',
                  'No roaming charges',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-[var(--bokmoo-copy)]">
                    <Check className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--bokmoo-ink)]">Coverage</p>
                    <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{profile.coverageLabel}</p>
                  </div>
                  <button className="text-sm text-[var(--bokmoo-gold)]" type="button">
                    View Details
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[1.2rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                <p className="text-sm font-medium text-[var(--bokmoo-ink)]">Quick Facts</p>
                <div className="mt-4 grid gap-3">
                  {[
                    { icon: Signal, label: 'Activation', value: 'Instant via QR' },
                    { icon: Smartphone, label: 'Compatibility', value: profile.compatibilityLabel },
                    { icon: ShieldCheck, label: 'Support', value: '24/7 Global Team' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]">{label}</p>
                        <p className="mt-1 text-sm text-[var(--bokmoo-ink)]">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {normalizedProduct.variants?.length ? (
                <div className="rounded-[1.2rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                  <p className="text-sm font-medium text-[var(--bokmoo-ink)]">Choose an option</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {normalizedProduct.variants.map((variant) => {
                      const isActive = effectiveSelectedVariant === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => onVariantChange(variant.id)}
                          className={cn(
                            'rounded-full border px-4 py-2 text-sm transition-colors',
                            isActive
                              ? 'border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-ink)]'
                              : 'border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]'
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

              <div className="rounded-[1.2rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                <p className="text-sm font-medium text-[var(--bokmoo-ink)]">Quantity</p>
                <div className="mt-4 flex items-center justify-between rounded-[0.95rem] border border-[var(--bokmoo-line)] px-3 py-2">
                  <button
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--bokmoo-copy)]"
                    type="button"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-semibold text-[var(--bokmoo-ink)]">{quantity}</span>
                  <button
                    onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--bokmoo-copy)]"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => onAddToCart()}
                disabled={stockValue <= 0}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                <ShoppingBag className="h-4 w-4" />
                Add to Cart — ${priceValue.toFixed(2)}
              </button>

              <div className="rounded-[1.2rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4">
                <div className="flex items-center gap-2 text-sm text-[var(--bokmoo-copy)]">
                  <Star className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                  4.9 average traveler satisfaction
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
});
