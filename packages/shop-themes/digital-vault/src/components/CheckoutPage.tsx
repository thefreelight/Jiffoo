import React from 'react';
import { ArrowLeft, CreditCard, Mail, PackageCheck, ShieldCheck, Wallet } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { CheckoutPageProps } from 'shared/src/types/theme';

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

  React.useEffect(() => {
    if (!currentUserEmail) return;
    setFormData((prev: typeof formData) => ({ ...prev, email: prev.email || currentUserEmail }));
  }, [currentUserEmail]);

  React.useEffect(() => {
    if (!paymentMethods.length) return;
    if (paymentMethods.some((item: { name: string }) => item.name === formData.paymentMethod)) return;
    setFormData((prev: typeof formData) => ({ ...prev, paymentMethod: paymentMethods[0].name }));
  }, [formData.paymentMethod, paymentMethods]);

  const hasShippingInput = React.useMemo(
    () => [
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
  const normalizedCountry = formData.country.trim().toUpperCase() === 'UK'
    ? 'GB'
    : formData.country.trim().toUpperCase();
  const statePostalRequired = shouldCollectShipping && countriesRequireStatePostalSet.has(normalizedCountry);

  const inputClassName = (field: string) =>
    cn(
      'h-12 w-full rounded-[1rem] border bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]',
      errors[field] ? 'border-[var(--vault-danger)]' : 'border-[var(--vault-line)]'
    );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev: typeof formData) => ({ ...prev, [name]: value }));
    setErrors((prev: Record<string, string>) => {
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
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to cart
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.72fr)]">
          <form id="digital-vault-checkout-form" onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)] sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Delivery destination
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                    Where should the access package land?
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">
                    Most digital goods are attached to the order archive immediately and mirrored to the buyer email.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
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
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    First name{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="firstName" value={formData.firstName} onChange={handleChange} className={inputClassName('firstName')} />
                  {errors.firstName ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.firstName}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Last name{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="lastName" value={formData.lastName} onChange={handleChange} className={inputClassName('lastName')} />
                  {errors.lastName ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.lastName}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Phone{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="phone" value={formData.phone} onChange={handleChange} className={inputClassName('phone')} placeholder="+1 555 010 1234" />
                  {errors.phone ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.phone}</p> : null}
                </div>
              </div>
            </section>

            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)] sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <PackageCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Optional fallback details
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                    Only fill the shipping block when this order contains a physical or hybrid item.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Address{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="addressLine1" value={formData.addressLine1} onChange={handleChange} className={inputClassName('addressLine1')} />
                  {errors.addressLine1 ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.addressLine1}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    City{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="city" value={formData.city} onChange={handleChange} className={inputClassName('city')} />
                  {errors.city ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.city}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Country{shouldCollectShipping ? ' *' : ''}
                  </label>
                  <input name="country" value={formData.country} onChange={handleChange} className={inputClassName('country')} />
                  {errors.country ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.country}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    State{statePostalRequired ? ' *' : ''}
                  </label>
                  <input name="state" value={formData.state} onChange={handleChange} className={inputClassName('state')} />
                  {errors.state ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.state}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Postal code{statePostalRequired ? ' *' : ''}
                  </label>
                  <input name="postalCode" value={formData.postalCode} onChange={handleChange} className={inputClassName('postalCode')} />
                  {errors.postalCode ? <p className="mt-2 text-xs text-[var(--vault-danger)]">{errors.postalCode}</p> : null}
                </div>
              </div>
            </section>

            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)] sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Payment method
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                    Choose the payment rail that should unlock fulfillment after authorization.
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
                        'flex cursor-pointer items-center justify-between rounded-[var(--vault-radius-md)] border px-4 py-4 transition-colors',
                        isSelected
                          ? 'border-[var(--vault-primary)] bg-[var(--vault-primary-soft)]'
                          : 'border-[var(--vault-line)] bg-[var(--vault-bg)]'
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
            <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                Order summary
              </p>
              <div className="mt-4 space-y-3">
                {cart.items.map((item: any) => (
                  <div key={item.id} className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--vault-ink)]">{item.productName}</p>
                        <p className="mt-1 text-xs text-[var(--vault-copy)]">
                          Qty {item.quantity}{item.variantName ? ` · ${item.variantName}` : ''}
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

              <button
                type="submit"
                form="digital-vault-checkout-form"
                disabled={isProcessing}
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--vault-primary)] px-5 text-sm font-semibold uppercase tracking-[0.2em] text-white disabled:cursor-not-allowed disabled:opacity-50"
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
