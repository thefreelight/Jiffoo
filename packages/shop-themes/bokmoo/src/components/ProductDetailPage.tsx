import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
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
import { getBokmooProduct, getProductIdFromLocation, mapBokmooApiProductToThemeProduct, normalizeProductForTheme, resolveBokmooMediaUrl } from '../lib/api';
import { pickCopy } from '../site';
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
  onNavigateToCheckout,
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
  const isGoodsProduct = normalizedProduct?.productKind === 'goods';
  // Only claim Bluetooth/app-profile management when the catalog copy itself
  // describes it; the basic card ships with generic physical-card copy.
  const isBluetoothCard = isGoodsProduct && /bluetooth|蓝牙/i.test(normalizedProduct?.description || '');
  const goodsSubtitle = isBluetoothCard
    ? { en: 'Physical Bluetooth card — manage multiple eSIM profiles with the BOKMOO app', hans: '实体蓝牙卡，搭配 BOKMOO App 管理多个 eSIM 套餐', hant: '實體藍牙卡，搭配 BOKMOO App 管理多個 eSIM 設定檔' }
    : { en: 'Physical card — works with the BOKMOO app', hans: '实体卡，搭配 BOKMOO App 使用', hant: '實體卡，搭配 BOKMOO App 使用' };
  const goodsSpecCards = isBluetoothCard
    ? [
        { label: pickCopy(locale, { en: 'Type', hans: '类型', hant: '類型' }), value: pickCopy(locale, { en: 'Physical eSIM card', hans: 'eSIM 实体卡', hant: 'eSIM 實體卡' }) },
        { label: pickCopy(locale, { en: 'Connection', hans: '连接', hant: '連線' }), value: pickCopy(locale, { en: 'Bluetooth', hans: '蓝牙', hant: '藍牙' }) },
        { label: pickCopy(locale, { en: 'Management', hans: '管理', hant: '管理' }), value: 'BOKMOO App' },
      ]
    : [
        { label: pickCopy(locale, { en: 'Type', hans: '类型', hant: '類型' }), value: pickCopy(locale, { en: 'Physical card', hans: '实体卡', hant: '實體卡' }) },
        { label: pickCopy(locale, { en: 'Compatibility', hans: '兼容', hant: '相容' }), value: 'iPhone / Android' },
        { label: pickCopy(locale, { en: 'Management', hans: '管理', hant: '管理' }), value: 'BOKMOO App' },
      ];
  const goodsBullets = isBluetoothCard
    ? [
        { en: 'Manage multiple eSIM profiles over Bluetooth', hans: '通过蓝牙管理多个 eSIM 套餐', hant: '透過藍牙管理多個 eSIM 設定檔' },
        { en: 'Set up and switch profiles in the BOKMOO app', hans: '在 BOKMOO App 内启用与切换套餐', hant: '在 BOKMOO App 內啟用與切換設定檔' },
      ]
    : [
        { en: 'Works with the BOKMOO app', hans: '搭配 BOKMOO App 使用', hant: '搭配 BOKMOO App 使用' },
      ];
  const goodsSetupLabel = pickCopy(locale, { en: 'Setup', hans: '使用方式', hant: '使用方式' });
  const goodsSetupValue = isBluetoothCard
    ? pickCopy(locale, { en: 'Connects to the BOKMOO app over Bluetooth', hans: '蓝牙连接 BOKMOO App 管理', hant: '藍牙連線 BOKMOO App 管理' })
    : pickCopy(locale, { en: 'Works with the BOKMOO app', hans: '搭配 BOKMOO App 使用', hant: '搭配 BOKMOO App 使用' });

  // SSR metadata still carries the raw catalog name until the next worker
  // deploy; keep the visible tab title on the cleaned storefront name.
  React.useEffect(() => {
    if (!normalizedProduct?.name) return;
    document.title = `${normalizedProduct.name} | ${site.brandName}`;
  }, [normalizedProduct?.name, site.brandName]);
  const effectiveSelectedVariant = selectedVariant || normalizedProduct?.variants?.[0]?.id || null;
  const currentVariant = React.useMemo(() => {
    if (!normalizedProduct?.variants?.length || !effectiveSelectedVariant) return null;
    return normalizedProduct.variants.find((variant) => variant.id === effectiveSelectedVariant) || null;
  }, [effectiveSelectedVariant, normalizedProduct]);

  const stockValue = Number(currentVariant?.inventory ?? normalizedProduct?.inventory?.available ?? 0);
  const priceValue = Number(currentVariant?.price ?? normalizedProduct?.price ?? 0);
  const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));
  const image = resolveBokmooMediaUrl(getProductImage(normalizedProduct), site.apiBaseUrl);
  const [adding, setAdding] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);
  const addedTimer = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
  }, []);

  const handleAddToCart = React.useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      await onAddToCart();
      setJustAdded(true);
      if (addedTimer.current) window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(() => setJustAdded(false), 2200);
    } finally {
      setAdding(false);
    }
  }, [adding, onAddToCart]);

  const handleBuyNow = React.useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      await onAddToCart();
      onNavigateToCheckout?.();
    } finally {
      setAdding(false);
    }
  }, [adding, onAddToCart, onNavigateToCheckout]);

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
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Plan not found', hans: '未找到套餐', hant: '未找到套餐' })}</h1>
          <button
            onClick={onBack}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            {pickCopy(locale, { en: 'Back to store', hans: '返回商店', hant: '返回商店' })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-ink)]"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          {pickCopy(locale, { en: 'Back to Store', hans: '返回商店', hant: '返回商店' })}
        </button>

        <div className="mt-5 rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-3 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.55rem] sm:p-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_22rem]">
            <div>
              <div className="overflow-hidden rounded-[1.05rem] border border-[var(--bokmoo-line)] sm:rounded-[1.2rem]">
                {image ? (
                  <img src={image} alt={normalizedProduct.name} className="aspect-[1.28/1] h-full w-full object-cover sm:aspect-[1.6/1]" />
                ) : (
                  <div className="aspect-[1.28/1] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)] sm:aspect-[1.6/1]" />
                )}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <h1 className="bokmoo-pdp-title font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                    {normalizedProduct.name}
                  </h1>
                  {normalizedProduct.description ? (
                    <p className="bokmoo-pdp-description">{normalizedProduct.description}</p>
                  ) : (
                    <p className="mt-2 text-lg text-[var(--bokmoo-copy)]">
                      {isGoodsProduct ? pickCopy(locale, goodsSubtitle) : profile.networkLabel}
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-[2.3rem] font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]">
                    ${priceValue.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(isGoodsProduct
                  ? goodsSpecCards
                  : [
                      { label: pickCopy(locale, { en: 'Data', hans: '数据', hant: '數據' }), value: profile.planLabel },
                      { label: pickCopy(locale, { en: 'Validity', hans: '有效期', hant: '有效期' }), value: profile.durationLabel },
                      { label: pickCopy(locale, { en: 'Network', hans: '网络', hant: '網路' }), value: profile.networkLabel },
                    ]
                ).map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">{item.label}</p>
                    <p className="mt-2 text-sm font-medium text-[var(--bokmoo-ink)]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                {(isGoodsProduct
                  ? goodsBullets
                  : [
                      { en: 'High-speed 4G/5G data', hans: '高速 4G/5G 数据', hant: '高速 4G/5G 數據' },
                      { en: 'Stay connected in major cities and more', hans: '主要城市及更多地区保持连接', hant: '主要城市及更多地區保持連線' },
                      { en: 'No roaming charges', hans: '无漫游费用', hant: '無漫遊費用' },
                    ]
                ).map((item) => (
                  <div key={item.en} className="flex items-center gap-3 text-sm text-[var(--bokmoo-copy)]">
                    <Check className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                    <span>{pickCopy(locale, item)}</span>
                  </div>
                ))}
              </div>

              {!isGoodsProduct ? (
                <div className="mt-6 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Coverage', hans: '覆盖范围', hant: '覆蓋範圍' })}</p>
                      <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{profile.coverageLabel}</p>
                    </div>
                    <button className="text-sm text-[var(--bokmoo-gold)]" type="button">
                      {pickCopy(locale, { en: 'View Details', hans: '查看详情', hant: '查看詳情' })}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Quick Facts', hans: '快速信息', hant: '快速資訊' })}</p>
                <div className="mt-4 grid gap-3">
                  {[
                    {
                      icon: Signal,
                      label: isGoodsProduct ? goodsSetupLabel : pickCopy(locale, { en: 'Activation', hans: '激活方式', hant: '啟用方式' }),
                      value: isGoodsProduct
                        ? goodsSetupValue
                        : pickCopy(locale, { en: 'Instant via QR', hans: '扫码即时激活', hant: '掃碼即時啟用' }),
                    },
                    { icon: Smartphone, label: pickCopy(locale, { en: 'Compatibility', hans: '设备兼容', hant: '裝置相容' }), value: profile.compatibilityLabel },
                    { icon: ShieldCheck, label: pickCopy(locale, { en: 'Support', hans: '支持', hant: '支援' }), value: pickCopy(locale, { en: '24/7 Global Team', hans: '24/7 全球团队', hant: '24/7 全球團隊' }) },
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
                <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                  <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Choose an option', hans: '选择选项', hant: '選擇選項' })}</p>
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

              <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Quantity', hans: '数量', hant: '數量' })}</p>
                <div className="mt-4 flex items-center justify-between rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-3 py-2">
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
                onClick={handleAddToCart}
                disabled={stockValue <= 0 || adding}
                className={`btn-shimmer flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] px-5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  justAdded
                    ? 'scale-[1.02] bg-[#1f7a3d] text-white'
                    : 'bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-[var(--bokmoo-bg)]'
                }`}
                type="button"
              >
                {justAdded ? (
                  <>
                    <Check className="h-4 w-4" />
                    {pickCopy(locale, { en: `Added to cart — $${priceValue.toFixed(2)}`, hans: `已加入购物车 — $${priceValue.toFixed(2)}`, hant: `已加入購物車 — $${priceValue.toFixed(2)}` })}
                  </>
                ) : adding ? (
                  <>
                    <ShoppingBag className="h-4 w-4 animate-pulse" />
                    {pickCopy(locale, { en: 'Adding…', hans: '添加中…', hant: '添加中…' })}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    {pickCopy(locale, { en: `Add to Cart — $${priceValue.toFixed(2)}`, hans: `加入购物车 — $${priceValue.toFixed(2)}`, hant: `加入購物車 — $${priceValue.toFixed(2)}` })}
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={stockValue <= 0 || adding}
                className="btn-shimmer flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_32%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-5 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_52%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                {pickCopy(locale, { en: 'Buy Now', hans: '立即购买', hant: '立即購買' })}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                <div className="flex items-center gap-2 text-sm text-[var(--bokmoo-copy)]">
                  <Star className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                  {isGoodsProduct
                    ? pickCopy(locale, { en: 'Official BOKMOO product', hans: 'BOKMOO 官方出品', hant: 'BOKMOO 官方出品' })
                    : pickCopy(locale, { en: '4.9 average traveler satisfaction', hans: '4.9 旅行者平均满意度', hant: '4.9 旅人平均滿意度' })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
});
