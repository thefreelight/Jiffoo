import React from 'react';
import { ArrowLeft, CreditCard, Mail, MapPin, ShieldCheck, Wallet } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { CheckoutPageProps } from '../types/theme';

function stepClass(active: boolean) {
  return active
    ? 'border-transparent bg-[var(--vault-primary)] text-white'
    : 'border-[var(--vault-line)] bg-[var(--vault-surface-alt)] text-[var(--vault-copy)]';
}

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
  const countriesRequireStatePostalSet = React.useMemo(() => {
    const source = countriesRequireStatePostal && countriesRequireStatePostal.length > 0
      ? countriesRequireStatePostal
      : ['US', 'CA', 'AU', 'CN', 'GB'];
    return new Set(source.map((item) => item.trim().toUpperCase()));
  }, [countriesRequireStatePostal]);

  const paymentMethods = React.useMemo(() => availablePaymentMethods || [], [availablePaymentMethods]);
  const [formData, setFormData] = React.useState({
    email: currentUserEmail || '',
    firstName: '',
    lastName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    paymentMethod: paymentMethods[0]?.name || '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const isGuestMode = !currentUserEmail;

  React.useEffect(() => {
    if (!currentUserEmail) return;
    setFormData((prev) => ({ ...prev, email: prev.email || currentUserEmail }));
  }, [currentUserEmail]);

  React.useEffect(() => {
    if (!paymentMethods.length) return;
    if (paymentMethods.some((item) => item.name === formData.paymentMethod)) return;
    setFormData((prev) => ({ ...prev, paymentMethod: paymentMethods[0].name }));
  }, [formData.paymentMethod, paymentMethods]);

  const hasShippingInput = React.useMemo(
    () =>
      [
        formData.firstName,
        formData.lastName,
        formData.phone,
        formData.addressLine1,
        formData.city,
        formData.state,
        formData.postalCode,
        formData.country,
      ].some((value) => value.trim()),
    [formData]
  );

  const shouldCollectShipping = Boolean(requireShippingAddress || hasShippingInput);
  const normalizedCountry =
    formData.country.trim().toUpperCase() === 'UK'
      ? 'GB'
      : formData.country.trim().toUpperCase();
  const statePostalRequired = shouldCollectShipping && countriesRequireStatePostalSet.has(normalizedCountry);

  const inputClassName = (field: string) =>
    cn(
      'h-12 w-full rounded-xl border bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]',
      errors[field] ? 'border-[var(--vault-danger)]' : 'border-[var(--vault-line)]'
    );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.email.trim()) nextErrors.email = 'Email is required';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = 'Invalid email address';

    if (shouldCollectShipping) {
      if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required';
      if (!formData.addressLine1.trim()) nextErrors.addressLine1 = 'Address is required';
      if (!formData.city.trim()) nextErrors.city = 'City is required';
      if (!formData.country.trim()) nextErrors.country = 'Country is required';
      if (!formData.phone.trim()) nextErrors.phone = 'Phone is required';
      if (statePostalRequired) {
        if (!formData.state.trim()) nextErrors.state = 'State is required';
        if (!formData.postalCode.trim()) nextErrors.postalCode = 'Postal code is required';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const paymentIcon = (name: string) => {
    const normalized = name.toLowerCase();
    return normalized.includes('card') || normalized.includes('stripe') ? CreditCard : Wallet;
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2.5 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to cart
        </button>

        <div className="mt-6 rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow-soft)]">
          <div className="flex flex-wrap items-center gap-3">
            {['Review cart', 'Delivery', 'Payment'].map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold', stepClass(index <= 2))}>
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-[var(--vault-copy)]">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.72fr)]">
          <form id="digital-vault-checkout-form" onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Checkout mode
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                    {isGuestMode ? 'Guest purchase is active.' : 'Signed-in checkout is active.'}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">
                    {isGuestMode
                      ? 'Guest buyers can reopen delivery later with the checkout email and order reference.'
                      : 'Signed-in buyers keep payment history and delivery access tied to the account center.'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                      Purchase mode
                    </p>
                    <p className="mt-2 text-sm font-medium text-[var(--vault-ink)]">
                      {isGuestMode ? 'Guest checkout' : 'Member checkout'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                      Items in this order
                    </p>
                    <p className="mt-2 text-sm font-medium text-[var(--vault-ink)]">
                      {cart.items.length} item{cart.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Buyer contact
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                    Send order access to the right inbox.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">
                    Digital delivery is mirrored to the order center and the buyer email. Keep this address accurate to reduce support tickets.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClassName('email')}
                    placeholder="buyer@example.com"
                  />
                  {errors.email ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.email}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    First name{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="firstName" value={formData.firstName} onChange={handleChange} className={inputClassName('firstName')} />
                  {errors.firstName ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.firstName}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Last name{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="lastName" value={formData.lastName} onChange={handleChange} className={inputClassName('lastName')} />
                  {errors.lastName ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.lastName}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Phone{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="phone" value={formData.phone} onChange={handleChange} className={inputClassName('phone')} placeholder="+1 555 010 1234" />
                  {errors.phone ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.phone}</p> : null}
                </div>
              </div>
            </section>

            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Shipping fallback
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                    Leave this empty for digital-only orders. Fill it only when this cart includes a physical or hybrid item.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Address{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="addressLine1" value={formData.addressLine1} onChange={handleChange} className={inputClassName('addressLine1')} />
                  {errors.addressLine1 ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.addressLine1}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    City{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="city" value={formData.city} onChange={handleChange} className={inputClassName('city')} />
                  {errors.city ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.city}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Country{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="country" value={formData.country} onChange={handleChange} className={inputClassName('country')} />
                  {errors.country ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.country}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    State{statePostalRequired ? ' *' : ''}
                  </label>
                  <input name="state" value={formData.state} onChange={handleChange} className={inputClassName('state')} />
                  {errors.state ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.state}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Postal code{statePostalRequired ? ' *' : ''}
                  </label>
                  <input name="postalCode" value={formData.postalCode} onChange={handleChange} className={inputClassName('postalCode')} />
                  {errors.postalCode ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.postalCode}</p> : null}
                </div>
              </div>
            </section>

            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Payment method
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                    Pick the payment channel that should unlock delivery. The order remains the source of truth once payment is confirmed.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {paymentMethods.map((method) => {
                  const Icon = paymentIcon(method.name);
                  const isSelected = formData.paymentMethod === method.name;
                  return (
                    <label
                      key={method.name}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-xl border px-4 py-4 transition-colors',
                        isSelected
                          ? 'border-[var(--vault-primary)] bg-[var(--vault-primary-soft)]'
                          : 'border-[var(--vault-line)] bg-[var(--vault-surface-alt)]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-[var(--vault-primary)]" />
                        <div>
                          <div className="text-sm font-semibold text-[var(--vault-ink)]">
                            {method.displayName}
                          </div>
                          <div className="text-xs text-[var(--vault-copy)]">{method.name}</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.name}
                        checked={isSelected}
                        onChange={handleChange}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          </form>

          <aside className="space-y-4">
            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Order summary
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                    Review the items that will be attached to this order after payment.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {cart.items.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--vault-ink)]">{item.productName}</p>
                        <p className="mt-1 text-xs text-[var(--vault-copy)]">
                          Qty {item.quantity}
                          {item.variantName ? ` · ${item.variantName}` : ''}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                          {item.requiresShipping ? 'Hybrid delivery' : 'Instant digital delivery'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--vault-ink)]">
                        ${Number(item.subtotal || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t border-[var(--vault-line)] pt-4 text-sm">
                <div className="flex items-center justify-between text-[var(--vault-copy)]">
                  <span>Subtotal</span>
                  <span>${Number(cart.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--vault-copy)]">
                  <span>Shipping</span>
                  <span>{Number(cart.shipping || 0) > 0 ? `$${Number(cart.shipping).toFixed(2)}` : 'No physical shipment'}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--vault-copy)]">
                  <span>Discount</span>
                  <span>{Number(cart.discount || 0) > 0 ? `-$${Number(cart.discount).toFixed(2)}` : '$0.00'}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-black tracking-[-0.03em] text-[var(--vault-ink)]">
                  <span>Total</span>
                  <span>${Number(cart.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                  Checkout reminder
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                  This checkout is designed so the order becomes the single delivery archive after payment, instead of pushing shoppers into manual support for every code or credential.
                </p>
              </div>

              <button
                type="submit"
                form="digital-vault-checkout-form"
                disabled={isProcessing}
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {isProcessing ? 'Processing...' : 'Authorize payment'}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
});
