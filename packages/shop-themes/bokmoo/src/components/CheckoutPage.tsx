import React from 'react';
import { ArrowLeft, CreditCard, Mail, ShieldCheck, Wallet } from 'lucide-react';
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
    setFormData((prev) => ({ ...prev, email: prev.email || currentUserEmail }));
  }, [currentUserEmail]);

  React.useEffect(() => {
    if (!paymentMethods.length) return;
    if (paymentMethods.some((item) => item.name === formData.paymentMethod)) return;
    setFormData((prev) => ({ ...prev, paymentMethod: paymentMethods[0].name }));
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
      'h-12 w-full rounded-[0.95rem] border bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]',
      errors[field] ? 'border-[var(--bokmoo-danger)]' : 'border-[var(--bokmoo-line)]'
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
      if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required';
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
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
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
          Back
        </button>

        <div className="mt-5 rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-3 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.55rem] sm:p-5">
          <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
              <p className="text-lg font-medium text-[var(--bokmoo-ink)]">Order Summary</p>
              <div className="mt-4 space-y-3">
                {cart.items.map((item) => (
                  <div key={item.id} className="rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_84%,black)] p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-16 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{item.productName}</p>
                        <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">
                          Qty {item.quantity}{item.variantName ? ` · ${item.variantName}` : ''}
                        </p>
                      </div>
                      <span className="text-sm text-[var(--bokmoo-copy)]">${Number(item.subtotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3 border-t border-[var(--bokmoo-line)] pt-4 text-sm">
                <div className="flex items-center justify-between text-[var(--bokmoo-copy)]">
                  <span>Subtotal</span>
                  <span>${Number(cart.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--bokmoo-copy)]">
                  <span>Total</span>
                  <span className="font-semibold text-[var(--bokmoo-ink)]">${Number(cart.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </aside>

            <form id="bokmoo-checkout-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-medium text-[var(--bokmoo-ink)]">Contact Information</p>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClassName('email')}
                    placeholder="Enter your email"
                  />
                  {errors.email ? <p className="text-xs text-[var(--bokmoo-danger)]">{errors.email}</p> : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <input
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className={inputClassName('firstName')}
                        placeholder="First name"
                      />
                      {errors.firstName ? <p className="mt-2 text-xs text-[var(--bokmoo-danger)]">{errors.firstName}</p> : null}
                    </div>
                    <div>
                      <input
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className={inputClassName('lastName')}
                        placeholder="Last name"
                      />
                      {errors.lastName ? <p className="mt-2 text-xs text-[var(--bokmoo-danger)]">{errors.lastName}</p> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                <p className="text-lg font-medium text-[var(--bokmoo-ink)]">Payment Method</p>
                <div className="mt-4 grid gap-3">
                  {paymentMethods.map((method) => {
                    const Icon = paymentIcon(method.name);
                    const isSelected = formData.paymentMethod === method.name;
                    return (
                      <label
                        key={method.name}
                        className={cn(
                          'flex cursor-pointer items-center justify-between rounded-[0.95rem] border px-4 py-4 transition-colors',
                          isSelected
                            ? 'border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)]'
                            : 'border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)]'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm text-[var(--bokmoo-ink)]">{method.displayName}</p>
                            <p className="text-xs text-[var(--bokmoo-copy-soft)]">{method.name}</p>
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
              </div>

              {shouldCollectShipping ? (
                <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                  <p className="text-lg font-medium text-[var(--bokmoo-ink)]">Billing Details</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <input
                        name="addressLine1"
                        value={formData.addressLine1}
                        onChange={handleChange}
                        className={inputClassName('addressLine1')}
                        placeholder="Address"
                      />
                    </div>
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={inputClassName('city')}
                      placeholder="City"
                    />
                    <input
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className={inputClassName('country')}
                      placeholder="Country"
                    />
                    <input
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className={inputClassName('state')}
                      placeholder="State / Province"
                    />
                    <input
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      className={inputClassName('postalCode')}
                      placeholder="Postal code"
                    />
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                form="bokmoo-checkout-form"
                disabled={isProcessing}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {isProcessing ? 'Processing...' : 'Continue to Payment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});
