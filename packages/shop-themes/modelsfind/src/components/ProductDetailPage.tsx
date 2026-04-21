import React from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Heart,
  MapPin,
  Minus,
  Plus,
  Shield,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { Product } from 'shared/src/types/product';
import type { ProductDetailPageProps } from 'shared/src/types/theme';
import { previewPortraits, resolvePreviewPortraitForProduct } from '../site';

interface TelegramVerifiedSession {
  valid: true;
  authDate: number;
  queryId?: string;
  user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  } | null;
  raw: string;
}

interface EditorialProfileFallback {
  essence: string;
  story: string;
  eyes: string;
  nationality: string;
  languages: string;
  serviceLabel: string;
  logisticsNote: string;
}

const PROFILE_COPY: Record<string, EditorialProfileFallback> = {
  ximena: {
    essence:
      'A fusion of classical grace and contemporary edge. Ximena defines the new era of high-fashion minimalism with a silhouette that stays poised and memorable under discreet lighting.',
    story:
      "Ximena possesses a rare, chameleonic ability to transform. She doesn't just wear the collection; she embodies the narrative, shifting from couture restraint to after-dark editorial intensity without losing presence.",
    eyes: 'Hazel Glow',
    nationality: 'Spanish',
    languages: 'Spanish, English, French',
    serviceLabel: 'Editorial',
    logisticsNote: 'Discrete arrival routing, private venue logistics, and concierge check-ins remain coordinated from the same request.',
  },
  elena: {
    essence:
      'Elena moves between alpine polish and dark-luxe glamour with an ease that reads private, expensive, and camera-ready at every angle.',
    story:
      'Her booking profile is designed for discreet getaways, premium hospitality partnerships, and event-led experiences where composure matters as much as appearance.',
    eyes: 'Amber',
    nationality: 'Swiss',
    languages: 'English, Italian, German',
    serviceLabel: 'Full weekend concierge',
    logisticsNote: 'Preference and schedule details stay condensed into a single brief so the host team and concierge stay aligned.',
  },
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function findSpecValue(
  specifications: Product['specifications'] | undefined,
  candidates: string[],
  fallback: string
): string {
  const match = specifications?.find((spec) =>
    candidates.some((candidate) => spec.name.toLowerCase().includes(candidate.toLowerCase()))
  );

  return match?.value || fallback;
}

function parseMeasurements(value?: string): [string, string, string] {
  if (!value) {
    return ['34B', '24"', '35"'];
  }

  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  return [
    parts[0] || '34B',
    parts[1] ? `${parts[1].replace(/"/g, '')}"` : '24"',
    parts[2] ? `${parts[2].replace(/"/g, '')}"` : '35"',
  ];
}

function resolveEditorialFallback(product: Product | null, currentVariantName: string): EditorialProfileFallback {
  const key = product?.name?.trim().toLowerCase() || '';
  return (
    PROFILE_COPY[key] || {
      essence:
        product?.description ||
        `${product?.name || 'This profile'} is shaped for discreet editorial bookings, balancing statement imagery with concierge-grade coordination.`,
      story:
        'Precision, privacy, and booking readiness stay foregrounded throughout the profile so the creative brief and the logistics brief never feel disconnected.',
      eyes: findSpecValue(product?.specifications, ['eyes', 'eye color'], 'Hazel Glow'),
      nationality: findSpecValue(product?.specifications, ['nationality', 'origin'], product?.category?.name || 'International'),
      languages: findSpecValue(product?.specifications, ['language'], 'English'),
      serviceLabel: currentVariantName || 'Editorial',
      logisticsNote: 'Location, arrival, and deposit details stay consolidated in one elevated booking flow.',
    }
  );
}

function getProductImages(product: Product | null): string[] {
  const fallbackPortrait = resolvePreviewPortraitForProduct(product, 0);
  const baseImages = product?.images?.length
    ? product.images.map((image) => image.url || fallbackPortrait.image)
    : [fallbackPortrait.image];

  while (baseImages.length < 4) {
    const nextPortrait = previewPortraits[baseImages.length % previewPortraits.length];
    baseImages.push(nextPortrait.image);
  }

  return baseImages;
}

function getLocalizedShopPath(path: string): string {
  if (typeof window === 'undefined') {
    return path;
  }

  const segments = window.location.pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;

  if (firstSegment && localePattern.test(firstSegment)) {
    return `/${firstSegment}${path}`;
  }

  return path;
}

function readPersistedCartSignature(productId?: string | null, variantId?: string | null): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem('cart-storage');
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? parsed;
    const localCart = Array.isArray(state?.localCart) ? state.localCart : [];
    const cartItems = Array.isArray(state?.cart?.items) ? state.cart.items : [];

    const localMatch = localCart.find((item: any) => item?.productId === productId && (variantId ? item?.variantId === variantId : true));
    const cartMatch = cartItems.find((item: any) => item?.productId === productId && (variantId ? item?.variantId === variantId : true));

    return JSON.stringify({
      localQuantity: localMatch?.quantity ?? null,
      cartQuantity: cartMatch?.quantity ?? null,
      itemCount: state?.cart?.itemCount ?? cartItems.length ?? null,
    });
  } catch {
    return null;
  }
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
  const images = React.useMemo(() => getProductImages(product), [product]);
  const [activeImage, setActiveImage] = React.useState(images[0]);
  const [telegramSession, setTelegramSession] = React.useState<TelegramVerifiedSession | null>(null);
  const [bookingForm, setBookingForm] = React.useState({
    scheduledAt: '',
    location: '',
    roomOrUnit: '',
    contactName: '',
    contactPhone: '',
    notes: '',
  });
  const [bookingState, setBookingState] = React.useState({
    submitting: false,
    successMessage: '',
    errorMessage: '',
  });

  React.useEffect(() => {
    setActiveImage(images[0]);
  }, [images]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const applyVerifiedSession = () => {
      try {
        const raw = sessionStorage.getItem('telegram.webapp.verified');
        if (!raw) {
          setTelegramSession(null);
          return;
        }

        setTelegramSession(JSON.parse(raw) as TelegramVerifiedSession);
      } catch {
        setTelegramSession(null);
      }
    };

    applyVerifiedSession();

    const onVerified = (event: Event) => {
      const customEvent = event as CustomEvent<TelegramVerifiedSession>;
      if (customEvent.detail) {
        setTelegramSession(customEvent.detail);
      } else {
        applyVerifiedSession();
      }
    };

    window.addEventListener('telegram:webapp-verified', onVerified as EventListener);
    return () => {
      window.removeEventListener('telegram:webapp-verified', onVerified as EventListener);
    };
  }, []);

  const currentVariant = React.useMemo(
    () => product?.variants?.find((variant) => variant.id === selectedVariant) || product?.variants?.[0],
    [product, selectedVariant]
  );

  const stockValue = currentVariant?.inventory ?? product?.inventory?.available ?? 0;
  const maxQuantity = Math.max(1, Math.min(stockValue || 1, 12));
  const previewPortrait = resolvePreviewPortraitForProduct(product, 0);
  const displayName = previewPortrait.name;

  if (isLoading) {
    return (
      <div className="modelsfind-shell flex min-h-screen items-center justify-center [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="text-center">
          <Sparkles className="mx-auto h-12 w-12 animate-pulse text-[var(--modelsfind-primary)]" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]">Opening profile</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Missing profile</p>
          <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white">
            Profile not found
          </h1>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-copy)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to collection
          </button>
        </div>
      </div>
    );
  }

  const serviceLabel = currentVariant?.name || currentVariant?.value || previewPortrait.mood;
  const editorialFallback = resolveEditorialFallback(product, serviceLabel);
  const [bust, waist, hips] = parseMeasurements(previewPortrait.measurements);
  const estimatedTotal = (currentVariant?.price || product.price || 0) * quantity;
  const depositValue = estimatedTotal * 0.2;
  const portfolioImages = images.slice(0, 4);
  const attributeRows = [
    { label: 'Height', value: findSpecValue(product.specifications, ['height'], previewPortrait.height || '5′11″') },
    { label: 'Measurements', value: previewPortrait.measurements || '34B / 24 / 35' },
    { label: 'Region', value: previewPortrait.cities || previewPortrait.region },
    { label: 'Access', value: serviceLabel },
  ];
  const personalDetails = [
    { label: 'Age', value: previewPortrait.age || findSpecValue(product.specifications, ['age'], '27') },
    { label: 'Eyes', value: findSpecValue(product.specifications, ['eyes', 'eye color'], editorialFallback.eyes) },
    {
      label: 'Nationality',
      value: findSpecValue(product.specifications, ['nationality', 'origin'], editorialFallback.nationality),
    },
    { label: 'Languages', value: findSpecValue(product.specifications, ['language'], editorialFallback.languages) },
  ];
  const mobileStats = [
    { label: 'Height', value: attributeRows[0].value },
    { label: 'Bust', value: bust },
    { label: 'Waist', value: waist },
    { label: 'Hips', value: hips },
  ];

  const telegramUserLabel = telegramSession?.user
    ? [telegramSession.user.first_name, telegramSession.user.last_name]
        .filter(Boolean)
        .join(' ') || telegramSession.user.username || `User #${telegramSession.user.id}`
    : null;

  const handleBookingField = (key: keyof typeof bookingForm, value: string) => {
    setBookingForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitBooking = async () => {
    if (!telegramSession?.raw) {
      setBookingState({
        submitting: false,
        successMessage: '',
        errorMessage: 'Open this page from the Telegram bot to submit an appointment request.',
      });
      return;
    }

    if (!bookingForm.scheduledAt || !bookingForm.location) {
      setBookingState({
        submitting: false,
        successMessage: '',
        errorMessage: 'Please provide the appointment time and location before sending the request.',
      });
      return;
    }

    setBookingState({
      submitting: true,
      successMessage: '',
      errorMessage: '',
    });

    try {
      const response = await fetch('/api/telegram/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData: telegramSession.raw,
          productId: product.id,
          productVariantId: currentVariant?.id,
          productName: displayName,
          packageName: serviceLabel,
          scheduledAt: bookingForm.scheduledAt,
          location: bookingForm.location,
          roomOrUnit: bookingForm.roomOrUnit,
          contactName: bookingForm.contactName,
          contactPhone: bookingForm.contactPhone,
          notes: bookingForm.notes,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Failed to submit appointment request');
      }

      setBookingState({
        submitting: false,
        successMessage: 'Appointment request sent to Telegram. A confirmation message should arrive in your Telegram chat shortly.',
        errorMessage: '',
      });
    } catch (error) {
      setBookingState({
        submitting: false,
        successMessage: '',
        errorMessage: error instanceof Error ? error.message : 'Failed to submit appointment request',
      });
    }
  };

  const scrollToBookingForm = () => {
    if (typeof document === 'undefined') {
      return;
    }

    document.getElementById('modelsfind-booking-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleMobileReserve = async () => {
    if (!onAddToCart) {
      scrollToBookingForm();
      return;
    }

    try {
      const before = readPersistedCartSignature(product.id, selectedVariant);
      await onAddToCart();
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const after = readPersistedCartSignature(product.id, selectedVariant);

      if (before !== after) {
        window.location.assign(getLocalizedShopPath('/cart'));
      }
    } catch {
      // The upstream client shows the toast. Stay on the profile screen.
    }
  };

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1320px] md:hidden">
        <div className="overflow-hidden bg-[rgba(10,8,12,0.98)]">
          <header className="modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[78] flex h-16 items-center justify-between px-6">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-3 text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="[font-family:var(--modelsfind-display)] text-[1rem] italic tracking-[0.18em] uppercase">
                {previewPortrait.region}
              </span>
            </button>
            <div className="flex items-center gap-3">
              <Heart className="h-4 w-4 text-[var(--modelsfind-primary)]" />
              <div className="h-8 w-8 overflow-hidden rounded-full border border-[var(--modelsfind-line-strong)]">
                <img src={portfolioImages[1]} alt={`${displayName} avatar`} className="h-full w-full object-cover" />
              </div>
            </div>
          </header>

          <main className="pb-32 pt-0">
            <section className="relative h-[46rem] overflow-hidden">
              <img src={activeImage} alt={displayName} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,0.38),transparent_26%,rgba(10,8,12,0.94)_100%)]" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--modelsfind-primary)]" />
                  <span className="text-[10px] uppercase tracking-[0.2rem] text-[var(--modelsfind-primary)]">Available tonight</span>
                </div>
                <h1 className="mt-3 [font-family:var(--modelsfind-display)] text-[3.9rem] font-bold italic leading-[0.88] tracking-[-0.06em] text-white">
                  {displayName}
                </h1>
                <p className="mt-2 max-w-[17rem] text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                  Haute Couture & Editorial Specialist | {previewPortrait.cities || previewPortrait.region}
                </p>
              </div>
            </section>

            <section className="relative z-10 -mt-12 grid grid-cols-2 gap-3 px-6">
              {mobileStats.map((metric, index) => (
                <div
                  key={`${metric.label}-${index}`}
                  className="modelsfind-mobile-surface rounded-[1rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] p-5"
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]">{metric.label}</p>
                  <p className={index === 0 ? 'mt-5 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-[var(--modelsfind-primary)]' : 'mt-5 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-white'}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </section>

            <section className="space-y-8 px-6 py-12">
              <div className="space-y-5">
                <div className="flex items-baseline gap-4">
                  <span className="[font-family:var(--modelsfind-display)] text-[3.2rem] text-[var(--modelsfind-primary)]/24">01</span>
                  <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] italic tracking-[-0.04em] text-white">
                    The Essence
                  </h2>
                </div>
                <p className="text-[1rem] leading-8 text-[var(--modelsfind-copy)]">
                  {editorialFallback.story}
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">Gallery</p>
                    <h2 className="[font-family:var(--modelsfind-display)] text-[2.4rem] tracking-[-0.05em] text-white">
                      Portfolio
                    </h2>
                  </div>
                  <span className="border-b border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] pb-1 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]">
                    View all sets
                  </span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {portfolioImages.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(image)}
                      className="group relative h-[23rem] w-[16rem] flex-none overflow-hidden rounded-[1rem]"
                    >
                      <img src={image} alt={`${displayName} set ${index + 1}`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))]" />
                      <div className="absolute bottom-5 left-5">
                        <p className="[font-family:var(--modelsfind-display)] text-[1.2rem] italic text-white">
                          {index === 0 ? 'Silk & Stone' : index === 1 ? 'Shadow Work' : index === 2 ? 'The Archive' : 'After Dark'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="modelsfind-mobile-surface rounded-[1.4rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] p-6">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">Personal details</p>
                <div className="mt-5 grid gap-4">
                  {personalDetails.map((detail) => (
                    <div key={detail.label} className="flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--modelsfind-line)_65%,transparent)] pb-3">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{detail.label}</span>
                      <span className="max-w-[52%] text-right text-sm text-white">{detail.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-[90] bg-[linear-gradient(180deg,rgba(8,8,12,0),rgba(8,8,12,0.92)_42%,rgba(8,8,12,1)_100%)] px-6 pb-10 pt-6">
          <button
            type="button"
            onClick={() => {
              void handleMobileReserve();
            }}
            className="modelsfind-mobile-cta flex h-16 w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] text-[11px] font-bold uppercase tracking-[0.24em] text-[#210025]"
          >
            <span>Reserve for Booking</span>
            <CalendarDays className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto hidden max-w-[1320px] md:block">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to collection
        </button>

        <section className="modelsfind-frame modelsfind-noise mt-4 overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)] p-4 md:p-6 xl:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
            <div className="grid gap-6">
              <section className="relative overflow-hidden rounded-[1.9rem] border border-[var(--modelsfind-line)] bg-[rgba(8,8,12,0.95)]">
                <img
                  src={activeImage}
                  alt={displayName}
                  className="absolute inset-0 h-full w-full object-cover grayscale opacity-90"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,10,0.88),rgba(7,7,10,0.38)_48%,rgba(7,7,10,0.8)),linear-gradient(180deg,rgba(7,7,10,0.08),rgba(7,7,10,0.78))]" />
                <div className="relative z-10 flex min-h-[32rem] flex-col justify-between px-6 py-6 md:min-h-[40rem] md:px-8 md:py-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--modelsfind-primary)]">ModelsFind</p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]">
                        {previewPortrait.region}
                      </p>
                    </div>
                    <div className="hidden rounded-full border border-[var(--modelsfind-line)] bg-[rgba(10,8,12,0.5)] px-3 py-1 text-[9px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)] md:block">
                      {stockValue > 0 ? `${stockValue} open slots` : 'Request only'}
                    </div>
                  </div>

                  <div className="max-w-[38rem]">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-copy-soft)]">
                      Haute couture & editorial
                    </p>
                    <h1 className="mt-5 [font-family:var(--modelsfind-display)] text-[clamp(3.4rem,9vw,8rem)] italic leading-[0.84] tracking-[-0.06em] text-white drop-shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                      {displayName}
                    </h1>
                    <p className="mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]">{editorialFallback.essence}</p>
                    <button
                      type="button"
                      onClick={scrollToBookingForm}
                      className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white"
                    >
                      Reserve for booking
                    </button>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[var(--modelsfind-line)] md:hidden">
                {mobileStats.map((metric, index) => (
                  <div key={`${metric.label}-${index}`} className="bg-[rgba(17,14,20,0.95)] p-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]">{metric.label}</p>
                    <p className="mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-white">{metric.value}</p>
                  </div>
                ))}
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6">
                  <div className="flex items-baseline gap-4">
                    <span className="[font-family:var(--modelsfind-display)] text-5xl text-[var(--modelsfind-primary)]/26">01</span>
                    <h2 className="[font-family:var(--modelsfind-display)] text-[2.2rem] italic leading-none tracking-[-0.04em] text-white">
                      The <span className="text-[var(--modelsfind-primary)]">Attributes</span>
                    </h2>
                  </div>

                  <div className="mt-6 grid gap-5">
                    {attributeRows.map((attribute) => (
                      <div
                        key={attribute.label}
                        className="flex items-start justify-between gap-4 border-b border-[var(--modelsfind-line)]/70 pb-4"
                      >
                        <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]">
                          {attribute.label}
                        </span>
                        <span className="max-w-[60%] text-right text-sm text-[var(--modelsfind-ink)]">{attribute.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)]">
                  <img src={portfolioImages[1]} alt={`${displayName} portrait`} className="h-full min-h-[18rem] w-full object-cover grayscale" />
                </div>
              </section>

              <section className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Portfolio</p>
                    <h2 className="[font-family:var(--modelsfind-display)] text-[2.4rem] italic leading-none tracking-[-0.04em] text-white">
                      Highlights
                    </h2>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">View all sets</span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
                  <div className="overflow-hidden rounded-[1.25rem] border border-[var(--modelsfind-line)]">
                    <img
                      src={portfolioImages[0]}
                      alt={`${displayName} portfolio lead`}
                      className="h-full min-h-[18rem] w-full object-cover"
                    />
                  </div>
                  <div className="grid gap-3">
                    {portfolioImages.slice(1, 4).map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => setActiveImage(image)}
                        className={[
                          'group overflow-hidden rounded-[1.1rem] border bg-[rgba(255,255,255,0.02)] text-left transition-colors',
                          activeImage === image ? 'border-[var(--modelsfind-line-strong)]' : 'border-[var(--modelsfind-line)]',
                        ].join(' ')}
                      >
                        <div className="relative">
                          <img
                            src={image}
                            alt={`${displayName} detail ${index + 2}`}
                            className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.02),rgba(8,7,10,0.7))]" />
                          <div className="absolute bottom-3 left-3">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                              Volume {String(index + 2).padStart(2, '0')}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6">
                  <div className="flex items-baseline gap-4">
                    <span className="[font-family:var(--modelsfind-display)] text-5xl text-[var(--modelsfind-primary)]/26">02</span>
                    <h2 className="[font-family:var(--modelsfind-display)] text-[2.1rem] italic leading-none tracking-[-0.04em] text-white">
                      The Essence
                    </h2>
                  </div>
                  <div className="mt-6 grid gap-5 text-sm leading-8 text-[var(--modelsfind-copy)]">
                    <p>{editorialFallback.story}</p>
                    <p>{product.description || editorialFallback.logisticsNote}</p>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Personal details</p>
                  <div className="mt-5 grid gap-4">
                    {personalDetails.map((detail) => (
                      <div key={detail.label}>
                        <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{detail.label}</p>
                        <p className="mt-1 text-sm text-white">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[linear-gradient(180deg,rgba(14,11,18,0.97),rgba(10,8,12,0.98))] px-6 py-10 md:px-8">
                <div className="absolute right-3 top-0 [font-family:var(--modelsfind-display)] text-[10rem] leading-none text-[var(--modelsfind-primary)]/12 md:text-[13rem]">
                  X
                </div>
                <div className="relative z-10 max-w-[28rem]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Private reservation</p>
                  <h2 className="mt-5 [font-family:var(--modelsfind-display)] text-[clamp(2.4rem,7vw,4.6rem)] italic leading-[0.92] tracking-[-0.05em] text-white">
                    Secure her <span className="text-[var(--modelsfind-primary)]">presence.</span>
                  </h2>
                  <button
                    type="button"
                    onClick={scrollToBookingForm}
                    className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white"
                  >
                    Reserve for booking
                  </button>
                </div>
              </section>

              <section
                id="modelsfind-booking-form"
                className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[var(--modelsfind-line)] pb-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">ModelsFind</p>
                    <h2 className="[font-family:var(--modelsfind-display)] text-[clamp(2.1rem,6vw,3.3rem)] leading-[0.94] tracking-[-0.05em] text-white">
                      Booking Request for <span className="italic text-[var(--modelsfind-primary)]">{displayName}</span>
                    </h2>
                  </div>
                  <div className="hidden rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] md:block">
                    {telegramUserLabel ? `Connected as ${telegramUserLabel}` : 'Telegram session required'}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="grid gap-6">
                    <section className="rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-5">
                      <h3 className="[font-family:var(--modelsfind-display)] text-[1.8rem] text-white">Service Preference</h3>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {(product.variants?.length ? product.variants : [currentVariant].filter(Boolean)).map((variant, index) => (
                          <button
                            key={variant?.id || `variant-${index}`}
                            type="button"
                            onClick={() => {
                              if (variant?.id) {
                                onVariantChange(variant.id);
                              }
                            }}
                            className={[
                              'rounded-[1.1rem] border px-4 py-4 text-left transition-colors',
                              currentVariant?.id === variant?.id
                                ? 'border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.08)]'
                                : 'border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)]',
                            ].join(' ')}
                          >
                            <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                              Tier {String(index + 1).padStart(2, '0')}
                            </p>
                            <p className="mt-3 [font-family:var(--modelsfind-display)] text-[1.45rem] leading-none text-white">
                              {variant?.name || variant?.value || editorialFallback.serviceLabel}
                            </p>
                            <p className="mt-2 text-xs text-[var(--modelsfind-copy)]">
                              {currentVariant?.id === variant?.id ? 'Selected service' : 'Tap to select'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-5">
                      <h3 className="[font-family:var(--modelsfind-display)] text-[1.8rem] text-white">Scheduling Details</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Preferred date & time</span>
                          <input
                            type="datetime-local"
                            value={bookingForm.scheduledAt}
                            onChange={(event) => handleBookingField('scheduledAt', event.target.value)}
                            className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                          />
                        </label>

                        <div className="grid gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Quantity</span>
                          <div className="inline-flex h-12 items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-1">
                            <button
                              type="button"
                              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--modelsfind-copy)]"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[3rem] text-center text-base font-semibold text-white">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--modelsfind-copy)]"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-5">
                      <h3 className="[font-family:var(--modelsfind-display)] text-[1.8rem] text-white">Location &amp; Logistics</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2 md:col-span-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Location</span>
                          <input
                            type="text"
                            value={bookingForm.location}
                            onChange={(event) => handleBookingField('location', event.target.value)}
                            placeholder="Hotel, studio, apartment, or private venue"
                            className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Room / Unit</span>
                          <input
                            type="text"
                            value={bookingForm.roomOrUnit}
                            onChange={(event) => handleBookingField('roomOrUnit', event.target.value)}
                            placeholder="Optional"
                            className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Contact name</span>
                          <input
                            type="text"
                            value={bookingForm.contactName}
                            onChange={(event) => handleBookingField('contactName', event.target.value)}
                            placeholder="Your name"
                            className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Contact phone</span>
                          <input
                            type="text"
                            value={bookingForm.contactPhone}
                            onChange={(event) => handleBookingField('contactPhone', event.target.value)}
                            placeholder="Optional"
                            className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                          />
                        </label>
                        <label className="grid gap-2 md:col-span-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Notes</span>
                          <textarea
                            value={bookingForm.notes}
                            onChange={(event) => handleBookingField('notes', event.target.value)}
                            placeholder="Arrival notes, privacy requests, or special instructions"
                            className="modelsfind-field min-h-[110px] rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                          />
                        </label>
                      </div>
                    </section>
                  </div>

                  <aside className="rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(12,10,16,0.94)] p-5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">Reservation Summary</p>
                    <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-3">
                      <img src={previewPortrait.image} alt={displayName} className="h-16 w-16 rounded-[0.9rem] object-cover grayscale" />
                      <div>
                        <p className="[font-family:var(--modelsfind-display)] text-[1.5rem] leading-none text-white">{displayName}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                          {previewPortrait.cities || previewPortrait.region}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-4 text-[var(--modelsfind-copy)]">
                        <span>Service</span>
                        <span className="text-white">{serviceLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-[var(--modelsfind-copy)]">
                        <span>Scheduling</span>
                        <span className="text-right text-white">
                          {bookingForm.scheduledAt ? new Date(bookingForm.scheduledAt).toLocaleDateString('en-US') : 'Select date'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-[var(--modelsfind-copy)]">
                        <span>Deposit required</span>
                        <span className="text-[var(--modelsfind-primary)]">{formatPrice(depositValue)}</span>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Estimated Total</p>
                      <p className="mt-3 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none text-white">
                        {formatPrice(estimatedTotal)}
                      </p>
                      <p className="mt-4 text-xs leading-6 text-[var(--modelsfind-copy)]">{editorialFallback.logisticsNote}</p>
                    </div>

                    {bookingState.errorMessage ? (
                      <div className="mt-4 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                        {bookingState.errorMessage}
                      </div>
                    ) : null}

                    {bookingState.successMessage ? (
                      <div className="mt-4 rounded-[1rem] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                        {bookingState.successMessage}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          void handleSubmitBooking();
                        }}
                        disabled={bookingState.submitting}
                        className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60"
                      >
                        {bookingState.submitting ? 'Sending request...' : 'Request Booking'}
                      </button>
                      <p className="text-xs leading-6 text-[var(--modelsfind-copy-soft)]">
                        Telegram concierge flow: verify inside the bot, send the request to the manager chat, and return a confirmation message to the requester.
                      </p>
                    </div>
                  </aside>
                </div>
              </section>
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-[6rem] rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(12,10,16,0.94)] p-5 shadow-[var(--modelsfind-card-shadow)]">
                <div className="flex items-center gap-3">
                  <img src={previewPortrait.image} alt={displayName} className="h-16 w-16 rounded-[1rem] object-cover grayscale" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">Model profile</p>
                    <p className="[font-family:var(--modelsfind-display)] text-[1.7rem] leading-none text-white">{displayName}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {mobileStats.map((metric) => (
                    <div
                      key={metric.label}
                      className="flex items-center justify-between rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
                    >
                      <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{metric.label}</span>
                      <span className="[font-family:var(--modelsfind-display)] text-[1.35rem] text-white">{metric.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
                    <CalendarDays className="h-4 w-4" />
                    Reservation
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">{previewPortrait.mood}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-[var(--modelsfind-copy)]">
                    <span>Rate</span>
                    <span className="text-white">{formatPrice(currentVariant?.price || product.price)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[var(--modelsfind-copy)]">
                    <span>Location</span>
                    <span className="text-right text-white">{previewPortrait.cities || previewPortrait.region}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={scrollToBookingForm}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
                >
                  Reserve for booking
                </button>
              </div>
            </aside>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[linear-gradient(180deg,rgba(8,8,12,0),rgba(8,8,12,0.94)_42%,rgba(8,8,12,1)_100%)] px-4 pb-8 pt-8 md:hidden hidden">
        <button
          type="button"
          onClick={scrollToBookingForm}
          className="w-full rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#140d16] shadow-[0_0_28px_var(--modelsfind-glow)]"
        >
          Reserve for booking
        </button>
      </div>
    </div>
  );
});
