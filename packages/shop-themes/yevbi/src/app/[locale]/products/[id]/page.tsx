'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Wifi,
  Calendar,
  ShieldCheck,
  ShoppingCart,
  Signal,
  Mail,
  RotateCcw,
  Star,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  Zap,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { productsApi, cartApi, authApi, type Product } from '../../../../lib/api';
import {
  formatVariantNameWithBillingPeriod,
  parseESimVariantAttributes,
  getVariantBillingPeriodDays,
  getDataDisplayText,
  getValidityDisplayText,
  getNetworkDisplayText,
} from '../../../../lib/esim';
import { cn } from '../../../../lib/utils';
import { FulfillmentPanel } from '../../../../components/FulfillmentPanel';
import {
  parseTypeData,
  getInitialFormState,
  validateFulfillmentForm,
  buildFulfillmentData,
  type FulfillmentFormState,
} from '../../../../lib/fulfillment';
import {
  getFirstImageUrl,
  YEVBI_PRODUCT_FALLBACK_VISUAL,
} from '../../../../lib/theme-assets';

const getProductImage = (product: Product): string => {
  return getFirstImageUrl(product.images, YEVBI_PRODUCT_FALLBACK_VISUAL);
};

const getESimAttributes = (variant: any, locale: 'en' | 'zh-Hant' = 'en') => {
  if (!variant?.attributes) return null;
  const attrs = parseESimVariantAttributes(variant.attributes);
  if (!attrs) return null;
  return {
    data: getDataDisplayText(attrs.esim.data, locale),
    validity: getValidityDisplayText(attrs.esim.validityDays, locale),
    network: getNetworkDisplayText(attrs.esim.networks),
  };
};

const sampleReviews = [
  {
    id: '1',
    name: 'James W.',
    rating: 5,
    date: '2 days ago',
    text: 'Setup was instant. Had internet access as soon as I landed. Works exactly as described.',
  },
  {
    id: '2',
    name: 'Emma T.',
    rating: 5,
    date: '1 week ago',
    text: 'Reliable connection throughout my trip. Data was sufficient for maps and communication.',
  },
];

const features = [
  'Instant QR code delivery',
  'Compatible with all eSIM devices',
  'Keep your existing number',
  '24/7 customer support',
  'Nationwide coverage',
  'No contract required',
];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const productId = params?.id as string;
  const returnPage = searchParams.get('page') || '1';

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Fulfillment form state
  const [fulfillmentForm, setFulfillmentForm] = useState<FulfillmentFormState>(getInitialFormState());
  const [fulfillmentErrors, setFulfillmentErrors] = useState<Record<string, string>>({});
  const [shouldScrollToFulfillment, setShouldScrollToFulfillment] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      if (!productId) return;
      setIsLoading(true);
      setError(null);
      try {
        const productData = await productsApi.getProduct(productId, locale);
        setProduct(productData);
        try {
          const related = await productsApi.getProducts(1, 4, {}, locale);
          setRelatedProducts(related.items.filter((p) => p.id !== productId).slice(0, 4));
        } catch { }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        setIsLoading(false);
      }
    }
    fetchProduct();
  }, [productId, locale]);

  const sortedVariants = useMemo(() => {
    if (!product?.variants) return [];
    return [...product.variants].sort((a, b) => {
      const daysA = getVariantBillingPeriodDays(a.attributes);
      const daysB = getVariantBillingPeriodDays(b.attributes);
      if (daysA === null && daysB === null) return 0;
      if (daysA === null) return 1;
      if (daysB === null) return -1;
      return daysA - daysB;
    });
  }, [product?.variants]);

  useEffect(() => {
    if (sortedVariants.length === 0) return;
    const currentStillValid = selectedVariant
      ? sortedVariants.some((variant) => variant.id === selectedVariant)
      : false;
    if (!currentStillValid) {
      setSelectedVariant(sortedVariants[0].id);
    }
  }, [sortedVariants, selectedVariant]);

  const currentPrice = useMemo(() => {
    if (!product) return 0;
    const variant = product.variants?.find((v) => v.id === selectedVariant);
    return variant ? variant.salePrice : product.price;
  }, [product, selectedVariant]);

  const currentStock = useMemo(() => {
    if (!product) return 0;
    const variant = product.variants?.find((v) => v.id === selectedVariant);
    return variant ? variant.baseStock : product.stock;
  }, [product, selectedVariant]);

  const currentVariantData = useMemo(() => {
    if (!product || !selectedVariant) return null;
    const variant = product.variants?.find((v) => v.id === selectedVariant);
    return variant ? getESimAttributes(variant, locale as 'en' | 'zh-Hant') : null;
  }, [product, selectedVariant, locale]);

  const isOutOfStock = currentStock <= 0;

  // Parse typeData for fulfillment requirements
  const typeData = useMemo(() => parseTypeData(product?.typeData), [product?.typeData]);

  // Check if CTA should be disabled based on fulfillment validation
  const fulfillmentValidation = useMemo(
    () => validateFulfillmentForm(fulfillmentForm, typeData),
    [fulfillmentForm, typeData]
  );

  const isCtaDisabled = isOutOfStock || isAddingToCart || !fulfillmentValidation.isValid;

  // Handle fulfillment form field change
  const handleFulfillmentChange = useCallback((field: string, value: string) => {
    setFulfillmentForm((prev) => {
      if (field.startsWith('shippingAddress.')) {
        const addressField = field.replace('shippingAddress.', '');
        return {
          ...prev,
          shippingAddress: {
            ...prev.shippingAddress,
            [addressField]: value,
          },
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });

    // Clear error for this field
    if (fulfillmentErrors[field]) {
      setFulfillmentErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [fulfillmentErrors]);

  // Handle fulfillment form field blur (validate on blur)
  const handleFulfillmentBlur = useCallback((field: string) => {
    const validation = validateFulfillmentForm(fulfillmentForm, typeData);
    if (validation.errors[field]) {
      setFulfillmentErrors((prev) => ({
        ...prev,
        [field]: validation.errors[field],
      }));
    }
  }, [fulfillmentForm, typeData]);

  const handleAction = async (target: 'checkout' | 'cart') => {
    if (!product) return;
    if (!authApi.isAuthenticated()) {
      router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Validate fulfillment form before submission
    const validation = validateFulfillmentForm(fulfillmentForm, typeData);
    if (!validation.isValid) {
      setFulfillmentErrors(validation.errors);
      setShouldScrollToFulfillment(true);
      return;
    }

    setIsAddingToCart(true);
    try {
      const fulfillmentData = buildFulfillmentData(typeData, fulfillmentForm);
      await cartApi.addToCart(product.id, quantity, selectedVariant, fulfillmentData);
      // Trigger cart update event
      window.dispatchEvent(new Event('cart-updated'));
      router.push(`/${locale}/${target}`);
    } catch (err) {
      console.error('Action failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-muted p-8 border border-border">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm mb-6">{error || 'Product not found'}</p>
          <button
            onClick={() => router.push(`/${locale}/products`)}
            className="px-6 py-2 border border-border bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:bg-transparent hover:text-foreground transition-all"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="network-grid-bg"></div>
      {/* Main purchase area — fits in first screen */}
      <div className="container mx-auto px-4 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

          {/* Left: Product Image */}
          <div className="flex flex-col gap-2">
            {/* Back Button */}
            <button
              onClick={() => router.push(`/${locale}/products?page=${returnPage}`)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="font-mono text-xs uppercase tracking-widest">Back to Products</span>
            </button>

            <div
              className="bg-muted border border-border overflow-hidden flex-shrink-0"
              style={{ maxHeight: '480px' }}
            >
              <img
                src={getProductImage(product)}
                alt={product.name}
                className="w-full object-cover"
                style={{ maxHeight: '480px' }}
              />
            </div>

            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(0, 4).map((image, index) => {
                  const imageUrl = typeof image === 'string' ? image : (image as any).url;
                  return (
                    <div
                      key={index}
                      className="aspect-square bg-muted border border-border overflow-hidden hover:border-foreground transition-colors cursor-pointer"
                    >
                      <img src={imageUrl} alt={`view ${index + 1}`} className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Purchase Panel */}
          <div className="flex flex-col gap-4">
            {/* Name + description */}
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                {(product as any).category || 'eSIM Plan'}
              </p>
              <h1 className="text-2xl font-bold text-foreground uppercase leading-tight mb-2">
                {product.name}
              </h1>
              {product.description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {product.description}
                </p>
              )}
            </div>

            {/* Star rating */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-foreground text-foreground" />
                ))}
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">4.9 · 128 reviews</span>
            </div>

            {/* Price */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold font-mono text-foreground">
                  ${currentPrice.toFixed(2)}
                </span>
                {product.originalPrice && product.originalPrice > currentPrice && (
                  <span className="text-lg font-mono text-muted-foreground line-through">
                    ${product.originalPrice.toFixed(2)}
                  </span>
                )}
                <span className={cn(
                  "ml-auto font-mono text-[10px] uppercase tracking-widest px-2 py-1 border",
                  isOutOfStock
                    ? "border-border text-muted-foreground"
                    : "border-border text-muted-foreground"
                )}>
                  {isOutOfStock ? 'Sold Out' : 'In Stock'}
                </span>
              </div>
            </div>

            {/* SKU Selection */}
            {sortedVariants.length > 0 && (
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Select Plan</p>
                <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {sortedVariants.map((v) => {
                    const skuLabel = formatVariantNameWithBillingPeriod(v.name, v.attributes) || v.name;
                    const unavailable = !v.isActive || v.baseStock <= 0;
                    return (
                      <button
                        key={v.id}
                        onClick={() => !unavailable && setSelectedVariant(v.id)}
                        disabled={unavailable}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-2.5 border text-left transition-all",
                          unavailable
                            ? "border-muted text-muted-foreground/40 cursor-not-allowed"
                            : selectedVariant === v.id
                              ? "border-foreground bg-muted"
                              : "border-border hover:border-foreground hover:bg-muted"
                        )}
                      >
                        <span className="font-mono text-sm">{skuLabel}</span>
                        <span className={cn(
                          "font-mono text-sm font-bold",
                          unavailable ? "text-muted-foreground/40" : "text-foreground"
                        )}>
                          {unavailable ? 'N/A' : `$${v.salePrice.toFixed(2)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Qty</span>
              <div className="flex items-center border border-border">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-border"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-10 text-center font-mono text-sm text-foreground">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                  disabled={quantity >= currentStock || isOutOfStock}
                  className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-border"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Fulfillment Panel - Dynamic based on product type */}
            <FulfillmentPanel
              typeData={typeData}
              formState={fulfillmentForm}
              errors={fulfillmentErrors}
              onChange={handleFulfillmentChange}
              onBlur={handleFulfillmentBlur}
              scrollIntoView={shouldScrollToFulfillment}
            />

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleAction('checkout')}
                disabled={isCtaDisabled}
                className={cn(
                  "w-full h-12 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2",
                  isCtaDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-muted hover:text-foreground"
                )}
              >
                {isAddingToCart ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Buy Now <Zap className="w-3.5 h-3.5 fill-current" /></>
                )}
              </button>
              <button
                onClick={() => handleAction('cart')}
                disabled={isCtaDisabled}
                className={cn(
                  "w-full h-12 border border-border text-muted-foreground font-mono text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                  isCtaDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:border-foreground hover:text-foreground"
                )}
              >
                <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest">Secure Payment</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest">Instant Delivery</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest">Money-back Guarantee</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Signal className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest">Global Coverage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Below fold: Specs · Features · Reviews */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-px bg-border">
          {/* Plan Specs */}
          <div className="bg-background p-5">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Specifications</p>
            {currentVariantData ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5" /> Data
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">{currentVariantData.data}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Validity
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">{currentVariantData.validity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <Signal className="w-3.5 h-3.5" /> Network
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">{currentVariantData.network}</span>
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">Select a plan to see specs.</p>
            )}
          </div>

          {/* Features */}
          <div className="bg-background p-5">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">What's Included</p>
            <div className="flex flex-col gap-2.5">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="bg-background p-5">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Reviews</p>
            <div className="flex flex-col gap-4">
              {sampleReviews.map((review) => (
                <div key={review.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-foreground">{review.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{review.date}</span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-foreground text-foreground" />
                    ))}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-10 border-t border-border pt-6">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Other Plans</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
              {relatedProducts.map((p) => {
                const esimData = p.variants?.[0]
                  ? getESimAttributes(p.variants[0], locale as 'en' | 'zh-Hant')
                  : null;
                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/${locale}/products/${p.id}`)}
                    className="bg-background p-4 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <p className="font-mono text-xs font-bold text-foreground uppercase mb-1 truncate">{p.name}</p>
                    {esimData && (
                      <p className="font-mono text-[10px] text-muted-foreground mb-2">
                        {esimData.data} · {esimData.validity}
                      </p>
                    )}
                    <p className="font-mono text-lg font-bold text-foreground">${p.price.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
