import React from 'react';
import { ArrowLeft, CreditCard, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import type { CheckoutPageProps } from 'shared/src/types/theme';
import { formatMoneyPrecise, getCartSelection } from '../commerce';
import { resolvePreviewPortraitForProduct } from '../site';

export const CheckoutPage = React.memo(function CheckoutPage({
  cart,
  isLoading,
  isProcessing,
  requireShippingAddress,
  countriesRequireStatePostal,
  currentUserEmail,
  availablePaymentMethods,
  onSubmit,
  onBack,
}: CheckoutPageProps) {
  const paymentMethods = React.useMemo(
    () => availablePaymentMethods || [{ name: 'card', displayName: 'Credit or Debit Card' }],
    [availablePaymentMethods]
  );

  const { selectedItems, selectedSubtotal, selectedTax, selectedShipping, selectedDiscount } = getCartSelection(cart);
  const total = Number((selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2));
  const leadItem = selectedItems[0] || cart.items[0];
  const leadPortrait = resolvePreviewPortraitForProduct({
    id: (leadItem as { productId?: string }).productId,
    name: leadItem?.productName,
  }, 1);
  const leadDisplayName = leadPortrait.name;
  const reservationDate = new Date(cart.updatedAt || Date.now()).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  const [formData, setFormData] = React.useState({
    email: currentUserEmail || '',
    firstName: '',
    lastName: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    paymentMethod: paymentMethods[0]?.name || 'card',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!currentUserEmail) {
      return;
    }

    setFormData((prev) => (prev.email ? prev : { ...prev, email: currentUserEmail }));
  }, [currentUserEmail]);

  const needsShipping = Boolean(
    requireShippingAddress ||
      [
        formData.firstName,
        formData.lastName,
        formData.phone,
        formData.addressLine1,
        formData.city,
        formData.state,
        formData.postalCode,
        formData.country,
      ].some((value) => value.trim())
  );

  const postalSet = React.useMemo(() => {
    const source = countriesRequireStatePostal?.length ? countriesRequireStatePostal : ['US', 'CA', 'AU', 'CN', 'GB'];
    return new Set(source.map((item) => item.trim().toUpperCase()).map((item) => (item === 'UK' ? 'GB' : item)));
  }, [countriesRequireStatePostal]);

  const normalizedCountry = formData.country.trim().toUpperCase() === 'UK' ? 'GB' : formData.country.trim().toUpperCase();
  const needsStatePostal = needsShipping && postalSet.has(normalizedCountry);

  const updateField = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.email.trim()) nextErrors.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = 'Invalid email';

    if (!formData.firstName.trim()) nextErrors.firstName = 'Required';
    if (!formData.lastName.trim()) nextErrors.lastName = 'Required';
    if (!formData.phone.trim()) nextErrors.phone = 'Required';

    if (needsShipping) {
      if (!formData.addressLine1.trim()) nextErrors.addressLine1 = 'Required';
      if (!formData.city.trim()) nextErrors.city = 'Required';
      if (!formData.country.trim()) nextErrors.country = 'Required';
      if (needsStatePostal && !formData.state.trim()) nextErrors.state = 'Required';
      if (needsStatePostal && !formData.postalCode.trim()) nextErrors.postalCode = 'Required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    await onSubmit(formData);
  };

  if (isLoading) {
    return (
      <div className="modelsfind-shell flex min-h-screen items-center justify-center [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="text-center">
          <Sparkles className="mx-auto h-12 w-12 animate-pulse text-[var(--modelsfind-primary)]" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]">Preparing checkout</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-20 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[28rem] md:hidden">
        <header className="modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[78] flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="text-[var(--modelsfind-copy-soft)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="[font-family:var(--modelsfind-display)] text-[1.1rem] italic uppercase tracking-[0.16em] text-white">
              modelsfind
            </h1>
          </div>
          <div className="h-10 w-10 overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)]">
            <img src={leadPortrait.image} alt={leadPortrait.name} className="h-full w-full object-cover" />
          </div>
        </header>

        <div className="space-y-8">
          <section className="relative">
            <div className="absolute -left-4 -top-4 h-28 w-28 rounded-full bg-[var(--modelsfind-primary-soft)] blur-3xl" />
            <div className="relative z-10 flex items-end gap-4">
              <div className="h-36 w-24 rotate-[-2deg] overflow-hidden rounded-[1rem] shadow-2xl">
                <img
                  src={leadItem?.productImage || leadPortrait.image}
                  alt={leadDisplayName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 pb-2">
                <span className="block text-[10px] uppercase tracking-[0.2rem] text-[var(--modelsfind-primary)]">Booking selection</span>
                <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] italic leading-none text-white">
                  {leadDisplayName}
                </h2>
                <p className="mt-2 text-sm text-[var(--modelsfind-copy-soft)]">
                  {leadPortrait.cities || leadPortrait.region}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.4rem] border-l-2 border-[var(--modelsfind-primary)]/30 bg-[rgba(18,16,22,0.92)] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="text-[11px] uppercase tracking-[0.16rem] text-[var(--modelsfind-copy-soft)]">Schedule</span>
                <span className="text-sm font-semibold text-white">{reservationDate}</span>
              </div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="text-[11px] uppercase tracking-[0.16rem] text-[var(--modelsfind-copy-soft)]">Experience</span>
                <span className="text-sm font-semibold text-white">{leadItem?.variantName || leadPortrait.mood}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] pt-4">
                <span className="text-[11px] uppercase tracking-[0.16rem] text-[var(--modelsfind-copy-soft)]">Total investment</span>
                <span className="[font-family:var(--modelsfind-display)] text-[2rem] tracking-[-0.04em] text-[var(--modelsfind-primary)]">
                  {formatMoneyPrecise(total)}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <h3 className="[font-family:var(--modelsfind-display)] text-[1.4rem] text-white">Payment Method</h3>
            <div className="grid gap-4">
              {paymentMethods.map((method) => {
                const lowerName = method.name.toLowerCase();
                const isCard = lowerName.includes('card') || lowerName.includes('stripe');
                const Icon = isCard ? CreditCard : Wallet;
                const active = formData.paymentMethod === method.name;
                return (
                  <button
                    key={method.name}
                    type="button"
                    onClick={() => updateField('paymentMethod', method.name)}
                    className={[
                      'rounded-[1.2rem] border px-5 py-5 text-left transition-all duration-300',
                      active
                        ? 'border-[var(--modelsfind-line-strong)] bg-[rgba(31,29,36,0.92)]'
                        : 'border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-[rgba(23,22,26,0.88)]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)]">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{method.displayName}</p>
                          <p className="text-xs text-[var(--modelsfind-copy-soft)]">
                            {isCard ? 'Visa, Mastercard, Amex' : 'BTC, ETH, USDT (ERC20)'}
                          </p>
                        </div>
                      </div>
                      <div className={active ? 'flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--modelsfind-primary)]' : 'flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--modelsfind-copy-soft)]/40'}>
                        <div className={active ? 'h-2.5 w-2.5 rounded-full bg-[var(--modelsfind-primary)]' : 'h-2.5 w-2.5 rounded-full bg-transparent'} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid gap-4">
              {[
                ['email', 'Email', 'email'],
                ['firstName', 'First name', 'text'],
                ['lastName', 'Last name', 'text'],
                ['phone', 'Phone', 'text'],
              ].map(([key, label, type]) => {
                const name = key as keyof typeof formData;
                return (
                  <label key={key} className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12rem] text-[var(--modelsfind-copy-soft)]">{label}</span>
                    <input
                      type={type}
                      value={formData[name]}
                      onChange={(event) => updateField(name, event.target.value)}
                      className="modelsfind-field h-12 border-0 border-b border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-transparent px-0 text-sm text-[var(--modelsfind-ink)]"
                    />
                    {errors[key] ? <span className="text-xs text-red-300">{errors[key]}</span> : null}
                  </label>
                );
              })}
            </div>
          </section>

          {needsShipping ? (
            <section className="space-y-4">
              <h3 className="[font-family:var(--modelsfind-display)] text-[1.25rem] text-white">Reservation venue</h3>
              <div className="grid gap-4">
                {[
                  { key: 'addressLine1', label: 'Address', type: 'text', hidden: false },
                  { key: 'city', label: 'City', type: 'text', hidden: false },
                  { key: 'country', label: 'Country', type: 'text', hidden: false },
                  { key: 'state', label: 'State', type: 'text', hidden: !needsStatePostal },
                  { key: 'postalCode', label: 'Postal code', type: 'text', hidden: !needsStatePostal },
                ].map((field) => {
                  if (field.hidden) {
                    return null;
                  }

                  const name = field.key as keyof typeof formData;
                  return (
                    <label key={field.key} className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-[0.12rem] text-[var(--modelsfind-copy-soft)]">{field.label}</span>
                      <input
                        type={field.type}
                        value={formData[name]}
                        onChange={(event) => updateField(name, event.target.value)}
                        className="modelsfind-field h-12 border-0 border-b border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-transparent px-0 text-sm text-[var(--modelsfind-ink)]"
                      />
                      {errors[field.key] ? <span className="text-xs text-red-300">{errors[field.key]}</span> : null}
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="mb-8 flex items-start gap-3 px-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--modelsfind-primary)]" />
            <p className="text-[11px] uppercase leading-relaxed tracking-[0.12rem] text-[var(--modelsfind-copy-soft)]">
              Encryption protocol active. Your transaction is secured via 256-bit AES vault. Modelsfind does not store primary card data.
            </p>
          </div>
        </div>

        <div className="fixed bottom-8 left-4 right-4 z-[110]">
          <button
            type="button"
            onClick={() => {
              if (!validate()) {
                return;
              }
              void onSubmit(formData);
            }}
            disabled={isProcessing}
            className="modelsfind-mobile-cta inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#210025] disabled:opacity-60"
          >
            {isProcessing ? 'Processing...' : 'Complete secure booking'}
          </button>
        </div>
      </div>

      <div className="mx-auto hidden max-w-[1240px] md:block">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">ModelsFind</p>
            <h1 className="[font-family:var(--modelsfind-display)] text-[2.5rem] italic leading-none tracking-[-0.04em] text-white">
              Confirm Booking
            </h1>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <form
            onSubmit={handleSubmit}
            className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)] p-4 md:p-6 xl:p-8"
          >
            <section className="overflow-hidden rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[linear-gradient(180deg,rgba(18,15,22,0.95),rgba(12,10,16,0.96))]">
              <div className="grid gap-4 p-5 md:grid-cols-[7rem_minmax(0,1fr)] md:p-6">
                <img
                  src={leadItem?.productImage || leadPortrait.image}
                  alt={leadDisplayName}
                  className="h-28 w-full rounded-[1.1rem] object-cover grayscale md:h-full md:min-h-[8rem]"
                />
                <div>
                  <span className="block text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">Booking Selection</span>
                  <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2.2rem] italic leading-none text-white">
                    {leadDisplayName}
                  </h2>
                  <div className="mt-5 grid gap-3 text-sm text-[var(--modelsfind-copy)] sm:grid-cols-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Schedule</p>
                      <p className="mt-2 text-white">{reservationDate}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Experience</p>
                      <p className="mt-2 text-white">{leadItem?.variantName || leadPortrait.mood}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Total investment</p>
                      <p className="mt-2 text-[var(--modelsfind-primary)]">{formatMoneyPrecise(total)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5 md:p-6">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                <Wallet className="h-4 w-4" />
                Payment Method
              </div>

              <div className="mt-5 grid gap-3">
                {paymentMethods.map((method) => {
                  const lowerName = method.name.toLowerCase();
                  const isCard = lowerName.includes('card') || lowerName.includes('stripe');
                  const Icon = isCard ? CreditCard : Wallet;
                  const active = formData.paymentMethod === method.name;

                  return (
                    <button
                      key={method.name}
                      type="button"
                      onClick={() => updateField('paymentMethod', method.name)}
                      className={[
                        'flex items-center gap-4 rounded-[1.2rem] border px-4 py-4 text-left transition-colors',
                        active
                          ? 'border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.08)]'
                          : 'border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]',
                      ].join(' ')}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">{method.displayName}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                          {isCard ? 'Visa · Mastercard · Amex' : 'Discreet settlement'}
                        </p>
                      </div>
                      <div
                        className={[
                          'h-5 w-5 rounded-full border',
                          active ? 'border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary)]' : 'border-[var(--modelsfind-line)]',
                        ].join(' ')}
                      />
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5 md:p-6">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <ShieldCheck className="h-4 w-4" />
                  Client Details
                </div>

                <div className="mt-5 grid gap-4">
                  {[
                    ['email', 'Email', 'email'],
                    ['firstName', 'First name', 'text'],
                    ['lastName', 'Last name', 'text'],
                    ['phone', 'Phone', 'text'],
                  ].map(([key, label, type]) => {
                    const name = key as keyof typeof formData;
                    return (
                      <label key={key} className="grid gap-2">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{label}</span>
                        <input
                          type={type}
                          value={formData[name]}
                          onChange={(event) => updateField(name, event.target.value)}
                          className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                        />
                        {errors[key] ? <span className="text-xs text-red-300">{errors[key]}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5 md:p-6">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <ShieldCheck className="h-4 w-4" />
                  Reservation Venue
                </div>

                <div className="mt-5 grid gap-4">
                  {[
                    { key: 'addressLine1', label: 'Address', type: 'text', hidden: false },
                    { key: 'city', label: 'City', type: 'text', hidden: false },
                    { key: 'country', label: 'Country', type: 'text', hidden: false },
                    { key: 'state', label: 'State', type: 'text', hidden: !needsStatePostal },
                    { key: 'postalCode', label: 'Postal code', type: 'text', hidden: !needsStatePostal },
                  ].map((field) => {
                    if (field.hidden) {
                      return null;
                    }

                    const name = field.key as keyof typeof formData;
                    return (
                      <label key={field.key} className="grid gap-2">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{field.label}</span>
                        <input
                          type={field.type}
                          value={formData[name]}
                          onChange={(event) => updateField(name, event.target.value)}
                          className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                        />
                        {errors[field.key] ? <span className="text-xs text-red-300">{errors[field.key]}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="mt-6 flex flex-col gap-4 border-t border-[var(--modelsfind-line)] pt-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Authorized transaction portal</p>
              <button
                type="submit"
                disabled={isProcessing}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60"
              >
                {isProcessing ? 'Processing...' : 'Complete secure booking'}
              </button>
            </div>
          </form>

          <aside className="modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(12,10,16,0.94)] p-5 xl:sticky xl:top-[6rem]">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
              <ShieldCheck className="h-4 w-4" />
              Booking Summary
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="flex items-center gap-3">
                <img
                  src={leadItem?.productImage || leadPortrait.image}
                  alt={leadDisplayName}
                  className="h-14 w-14 rounded-[0.95rem] object-cover grayscale"
                />
                <div>
                  <p className="[font-family:var(--modelsfind-display)] text-[1.6rem] leading-none text-white">
                    {leadDisplayName}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                    {leadItem?.variantName || leadPortrait.mood}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4 text-[var(--modelsfind-copy)]">
                  <span>Subtotal</span>
                  <span className="text-white">{formatMoneyPrecise(selectedSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-4 text-[var(--modelsfind-copy)]">
                  <span>Tax</span>
                  <span className="text-white">{formatMoneyPrecise(selectedTax)}</span>
                </div>
                <div className="flex justify-between gap-4 text-[var(--modelsfind-copy)]">
                  <span>Shipping</span>
                  <span className="text-white">{selectedShipping === 0 ? 'Included' : formatMoneyPrecise(selectedShipping)}</span>
                </div>
                {selectedDiscount > 0 ? (
                  <div className="flex justify-between gap-4 text-emerald-200">
                    <span>Discount</span>
                    <span>-{formatMoneyPrecise(selectedDiscount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-[var(--modelsfind-line)] pt-3 text-base">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-semibold text-[var(--modelsfind-primary)]">{formatMoneyPrecise(total)}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Private assurance</p>
              <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                Payment and reservation data remain contained in the same discreet booking flow, with operator follow-up after confirmation.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});
