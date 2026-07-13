import React from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FolderHeart,
  Minus,
  Plus,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { Product } from 'shared/src/types/product';
import type { ProductDetailPageProps } from 'shared/src/types/theme';

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

function getProductImages(product: Product | null): string[] {
  if (!product?.images?.length) {
    return ['/placeholder-product.svg'];
  }

  return product.images.map((image) => image.url || '/placeholder-product.svg');
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export const ProductDetailPage = React.memo(function ProductDetailPage({
  product,
  isLoading,
  selectedVariant,
  quantity,
  onVariantChange,
  onQuantityChange,
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
  const [bookingState, setBookingState] = React.useState<{
    submitting: boolean;
    successMessage: string;
    errorMessage: string;
  }>({
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
        <div className="rounded-[2rem] border border-[var(--modelsfind-line)] bg-[rgba(18,14,20,0.92)] p-10 text-center shadow-[var(--modelsfind-card-shadow)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Missing profile</p>
          <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-5xl tracking-[-0.05em]">Profile not found</h1>
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

  const specifications = product.specifications?.length
    ? product.specifications
    : [
        { name: 'Region', value: product.category?.name || 'Model directory' },
        { name: 'Access', value: currentVariant?.name || 'Private release' },
        { name: 'Tags', value: product.tags?.slice(0, 3).join(', ') || 'Editorial, monochrome, beauty' },
        { name: 'Updated', value: new Date(product.updatedAt).toLocaleDateString('en-US') },
      ];

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
          productName: product.name,
          packageName: currentVariant?.name || currentVariant?.value || 'Standard session',
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

  const telegramUserLabel = telegramSession?.user
    ? [telegramSession.user.first_name, telegramSession.user.last_name]
        .filter(Boolean)
        .join(' ') || telegramSession.user.username || `User #${telegramSession.user.id}`
    : null;

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1040px]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profiles
        </button>

        <div className="mt-4 modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(22rem,1.08fr)]">
            <div className="border-b border-[var(--modelsfind-line)] p-4 lg:border-b-0 lg:border-r lg:p-5">
              <div className="overflow-hidden rounded-[1.35rem] border border-[var(--modelsfind-line)] bg-[rgba(14,11,16,0.96)]">
                <div className="relative aspect-[0.9] overflow-hidden">
                  <img src={activeImage} alt={product.name} className="h-full w-full object-cover grayscale" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.03),rgba(8,7,10,0.58))]" />
                  <div className="absolute left-4 top-4 rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(17,14,20,0.8)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
                    Featured profile
                  </div>
                </div>
              </div>

              {images.length > 1 ? (
                <div className="mt-3 grid grid-cols-4 gap-3">
                  {images.slice(0, 4).map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setActiveImage(image)}
                      className={[
                        'overflow-hidden rounded-[0.9rem] border bg-[rgba(16,12,18,0.9)]',
                        activeImage === image ? 'border-[var(--modelsfind-primary)]' : 'border-[var(--modelsfind-line)]',
                      ].join(' ')}
                    >
                      <div className="aspect-square">
                        <img src={image} alt={product.name} className="h-full w-full object-cover grayscale" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="p-4 lg:p-5">
              <div className="rounded-[1.35rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {(product.tags || []).slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]">Featured model profile</p>
                <h1 className="mt-2 [font-family:var(--modelsfind-display)] text-[clamp(2.7rem,5vw,4.8rem)] leading-[0.9] tracking-[-0.05em] text-[var(--modelsfind-ink)]">
                  {product.name}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--modelsfind-copy)]">{product.description}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Region', value: product.category?.name || 'Model directory' },
                    { label: 'Available slots', value: `${product.inventory?.available ?? 0}` },
                    { label: 'Reviews', value: `${product.reviewCount || 0}` },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4"
                    >
                      <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{metric.label}</p>
                      <p className="mt-2 [font-family:var(--modelsfind-display)] text-[1.85rem] leading-none text-[var(--modelsfind-ink)]">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(19rem,1.08fr)]">
                <div className="rounded-[1.35rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Metadata</p>
                  <div className="mt-4 grid gap-3">
                    {specifications.slice(0, 6).map((spec) => (
                      <div
                        key={`${spec.name}-${spec.value}`}
                        className="flex items-start justify-between gap-4 rounded-[0.95rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
                      >
                        <span className="text-sm text-[var(--modelsfind-copy)]">{spec.name}</span>
                        <span className="text-right text-sm font-medium text-[var(--modelsfind-ink)]">{spec.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
                      <Shield className="h-3.5 w-3.5" />
                      Curator note
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--modelsfind-copy)]">
                      This profile keeps editorial presentation on the surface and structured booking data underneath, so operators can shortlist quickly without flattening the visual mood.
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5">
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                    <FolderHeart className="h-4 w-4" />
                    Private release
                  </div>

                  <div className="mt-4 flex items-end gap-3">
                    <p className="[font-family:var(--modelsfind-display)] text-5xl leading-none tracking-[-0.05em] text-[var(--modelsfind-ink)]">
                      {formatPrice(currentVariant?.price || product.price)}
                    </p>
                    {product.originalPrice && product.originalPrice > product.price ? (
                      <p className="pb-2 text-lg text-[var(--modelsfind-copy-soft)] line-through">
                        {formatPrice(product.originalPrice)}
                      </p>
                    ) : null}
                  </div>

                  {product.variants?.length ? (
                    <div className="mt-5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Access tier</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.variants.map((variant) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => onVariantChange(variant.id)}
                            className={[
                              'rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors',
                              currentVariant?.id === variant.id
                                ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-ink)]'
                                : 'border-[var(--modelsfind-line)] text-[var(--modelsfind-copy)] hover:border-[var(--modelsfind-line-strong)] hover:text-[var(--modelsfind-ink)]',
                            ].join(' ')}
                          >
                            {variant.name || variant.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Request quantity</p>
                    <div className="mt-3 inline-flex items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-1">
                      <button
                        type="button"
                        onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--modelsfind-copy)]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[3rem] text-center text-lg font-semibold text-[var(--modelsfind-ink)]">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--modelsfind-copy)]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[var(--modelsfind-copy-soft)]">{stockValue} booking slots available in this tier.</p>
                  </div>

                <div className="mt-5 grid gap-3">
                  {[
                    'Protected release links for member-only boards.',
                    'Fast operator review with structured metadata.',
                    'Luxury presentation across desktop and mobile.',
                    ].map((item) => (
                      <div
                        key={item}
                        className="grid grid-cols-[1.25rem_minmax(0,1fr)_1rem] items-start gap-3 rounded-[0.95rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
                      >
                        <Check className="mt-0.5 h-4 w-4 text-[var(--modelsfind-primary)]" />
                        <p className="text-sm leading-6 text-[var(--modelsfind-copy)]">{item}</p>
                        <ChevronRight className="mt-0.5 h-4 w-4 text-[var(--modelsfind-copy-soft)]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <section className="rounded-[1.35rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5">
              <div className="flex flex-col gap-3 border-b border-[var(--modelsfind-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Telegram appointment request</p>
                  <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)]">
                    Send the booking to manager chat
                  </h2>
                </div>
                <div className="text-xs text-[var(--modelsfind-copy-soft)]">
                  {telegramUserLabel ? `Connected as ${telegramUserLabel}` : 'Open inside Telegram to verify your session'}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Appointment time</span>
                  <input
                    type="datetime-local"
                    value={bookingForm.scheduledAt}
                    onChange={(event) => handleBookingField('scheduledAt', event.target.value)}
                    className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Package</span>
                  <input
                    type="text"
                    value={currentVariant?.name || currentVariant?.value || 'Standard session'}
                    readOnly
                    className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-copy)] outline-none"
                  />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Location</span>
                  <input
                    type="text"
                    value={bookingForm.location}
                    onChange={(event) => handleBookingField('location', event.target.value)}
                    placeholder="Hotel, studio, apartment, or meeting address"
                    className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Room / Unit</span>
                  <input
                    type="text"
                    value={bookingForm.roomOrUnit}
                    onChange={(event) => handleBookingField('roomOrUnit', event.target.value)}
                    placeholder="Optional"
                    className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Contact name</span>
                  <input
                    type="text"
                    value={bookingForm.contactName}
                    onChange={(event) => handleBookingField('contactName', event.target.value)}
                    placeholder="Your name"
                    className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Contact phone</span>
                  <input
                    type="text"
                    value={bookingForm.contactPhone}
                    onChange={(event) => handleBookingField('contactPhone', event.target.value)}
                    placeholder="Optional"
                    className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                  />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Notes</span>
                  <textarea
                    value={bookingForm.notes}
                    onChange={(event) => handleBookingField('notes', event.target.value)}
                    placeholder="Arrival notes, lobby instructions, or other request details"
                    className="min-h-[110px] rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                  />
                </label>
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

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-xs leading-6 text-[var(--modelsfind-copy-soft)]">
                  Telegram MVP flow: verify Telegram WebApp session, send this appointment request to the configured manager chat, and send the requester a Telegram confirmation message.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void handleSubmitBooking();
                  }}
                  disabled={bookingState.submitting}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_78%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white disabled:opacity-60"
                >
                  {bookingState.submitting ? 'Sending request...' : 'Send appointment request'}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
});
