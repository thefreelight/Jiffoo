import React from 'react';
import { ArrowLeft, CreditCard, Mail, ShieldCheck, Wallet } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import { pickCopy } from '../site';
import type { CheckoutPageProps, SavedAddress } from 'shared/src/types/theme';

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
  savedAddress,
  savedAddresses,
  onPickSavedAddress,
  locale,
}: CheckoutPageProps) {
  const countriesRequireStatePostalSet = React.useMemo(() => {
    const source = countriesRequireStatePostal && countriesRequireStatePostal.length > 0
      ? countriesRequireStatePostal
      : ['US', 'CA', 'AU', 'CN', 'GB'];
    return new Set(source.map((item) => item.trim().toUpperCase()));
  }, [countriesRequireStatePostal]);

  const paymentMethods = React.useMemo(() => availablePaymentMethods || [], [availablePaymentMethods]);
  const [formData, setFormData] = React.useState({
    email: savedAddress?.email || currentUserEmail || '',
    firstName: savedAddress?.firstName || '',
    lastName: savedAddress?.lastName || '',
    addressLine1: savedAddress?.addressLine1 || '',
    city: savedAddress?.city || '',
    state: savedAddress?.state || '',
    postalCode: savedAddress?.postalCode || '',
    country: savedAddress?.country || '',
    phone: savedAddress?.phone || '',
    paymentMethod: paymentMethods[0]?.name || '',
    promoCode: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [selectedSavedAddressId, setSelectedSavedAddressId] = React.useState<string | null>(
    savedAddresses?.find((address) => address.isDefault)?.id ?? savedAddresses?.[0]?.id ?? null,
  );

  // The parent fetches savedAddress asynchronously (address book, then last
  // order); merge it into the form once it arrives without clobbering
  // anything the shopper already typed.
  React.useEffect(() => {
    if (!savedAddress) return;
    setFormData((prev) => ({
      ...prev,
      email: prev.email || savedAddress.email || '',
      firstName: prev.firstName || savedAddress.firstName || '',
      lastName: prev.lastName || savedAddress.lastName || '',
      phone: prev.phone || savedAddress.phone || '',
      addressLine1: prev.addressLine1 || savedAddress.addressLine1 || '',
      city: prev.city || savedAddress.city || '',
      state: prev.state || savedAddress.state || '',
      postalCode: prev.postalCode || savedAddress.postalCode || '',
      country: prev.country || savedAddress.country || '',
    }));
  }, [savedAddress]);

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

    if (!formData.email.trim()) nextErrors.email = pickCopy(locale, { en: 'Email is required', hans: '请输入邮箱', hant: '請輸入郵箱' });
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = pickCopy(locale, { en: 'Invalid email address', hans: '邮箱格式不正确', hant: '郵箱格式不正確' });

    if (shouldCollectShipping) {
      if (!formData.firstName.trim()) nextErrors.firstName = pickCopy(locale, { en: 'First name is required', hans: '请输入名字', hant: '請輸入名字' });
      // Last name is optional: many shoppers (and the address book) use a
      // single-field name; the native order composes whatever is given.
      if (!formData.addressLine1.trim()) nextErrors.addressLine1 = pickCopy(locale, { en: 'Address is required', hans: '请输入地址', hant: '請輸入地址' });
      if (!formData.city.trim()) nextErrors.city = pickCopy(locale, { en: 'City is required', hans: '请输入城市', hant: '請輸入城市' });
      if (!formData.country.trim()) nextErrors.country = pickCopy(locale, { en: 'Country is required', hans: '请选择国家/地区', hant: '請選擇國家/地區' });
      if (!formData.phone.trim()) nextErrors.phone = pickCopy(locale, { en: 'Phone number is required', hans: '请输入电话号码', hant: '請輸入電話號碼' });
      if (statePostalRequired) {
        if (!formData.state.trim()) nextErrors.state = pickCopy(locale, { en: 'State is required', hans: '请输入省/州', hant: '請輸入省/州' });
        if (!formData.postalCode.trim()) nextErrors.postalCode = pickCopy(locale, { en: 'Postal code is required', hans: '请输入邮编', hant: '請輸入郵遞區號' });
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
          {pickCopy(locale, { en: 'Back', hans: '返回', hant: '返回' })}
        </button>

        <div className="mt-5 rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-3 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.55rem] sm:p-5">
          <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
              <p className="text-lg font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Order Summary', hans: '订单摘要', hant: '訂單摘要' })}</p>
              <div className="mt-4 space-y-3">
                {cart.items.map((item) => (
                  <div key={item.id} className="rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_84%,black)] p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-16 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{item.productName}</p>
                        <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">
                          {pickCopy(locale, { en: 'Qty', hans: '数量', hant: '數量' })} {item.quantity}{item.variantName ? ` · ${item.variantName}` : ''}
                        </p>
                      </div>
                      <span className="text-sm text-[var(--bokmoo-copy)]">${Number(item.subtotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3 border-t border-[var(--bokmoo-line)] pt-4 text-sm">
                <div className="flex items-center justify-between text-[var(--bokmoo-copy)]">
                  <span>{pickCopy(locale, { en: 'Subtotal', hans: '小计', hant: '小計' })}</span>
                  <span>${Number(cart.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--bokmoo-copy)]">
                  <span>{pickCopy(locale, { en: 'Total', hans: '总计', hant: '總計' })}</span>
                  <span className="font-semibold text-[var(--bokmoo-ink)]">${Number(cart.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </aside>

            <form id="bokmoo-checkout-form" onSubmit={handleSubmit} className="space-y-4">

          <div className="rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[var(--bokmoo-bg)] p-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]" htmlFor="bokmoo-promo-code">
              {pickCopy(locale, { en: 'Promo / referral code', hans: '优惠码 / 推荐码', hant: '優惠碼 / 推薦碼' })}
            </label>
            <input
              id="bokmoo-promo-code"
              value={formData.promoCode}
              onChange={(event) => setFormData((prev) => ({ ...prev, promoCode: event.target.value.toUpperCase() }))}
              placeholder={pickCopy(locale, { en: 'e.g. BOKMOO10', hans: '如 BOKMOO10', hant: '如 BOKMOO10' })}
              className="mt-2 h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm font-semibold tracking-[0.08em] text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]"
            />
            <p className="mt-2 text-xs leading-5 text-[var(--bokmoo-copy-soft)]">
              {pickCopy(locale, { en: 'Have a referral code from a creator? Enter it — your discount is applied to the order total at payment.', hans: '有创作者的推荐码？输入后优惠会在支付时计入订单总额。', hant: '有創作者的推薦碼？輸入後優惠會在付款時計入訂單總額。' })}
            </p>
          </div>
              <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Contact Information', hans: '联系信息', hant: '聯絡資訊' })}</p>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClassName('email')}
                    placeholder={pickCopy(locale, { en: 'Enter your email', hans: '请输入邮箱', hant: '請輸入郵箱' })}
                  />
                  {errors.email ? <p className="text-xs text-[var(--bokmoo-danger)]">{errors.email}</p> : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <input
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className={inputClassName('firstName')}
                        placeholder={pickCopy(locale, { en: 'First name', hans: '名字', hant: '名字' })}
                      />
                      {errors.firstName ? <p className="mt-2 text-xs text-[var(--bokmoo-danger)]">{errors.firstName}</p> : null}
                    </div>
                    <div>
                      <input
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className={inputClassName('lastName')}
                        placeholder={pickCopy(locale, { en: 'Last name', hans: '姓氏', hant: '姓氏' })}
                      />
                      {errors.lastName ? <p className="mt-2 text-xs text-[var(--bokmoo-danger)]">{errors.lastName}</p> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4">
                <p className="text-lg font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Payment Method', hans: '支付方式', hant: '付款方式' })}</p>
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
                  {(savedAddresses?.length ?? 0) > 0 && onPickSavedAddress ? (
              <div className="mb-8">
                <p className="text-lg font-medium text-[var(--bokmoo-ink)]">
                  {pickCopy(locale, { en: 'Saved addresses', hans: '已保存地址', hant: '已保存地址' })}
                </p>
                <div className="mt-4 grid gap-3">
                  {(savedAddresses ?? []).map((address) => {
                    const active = selectedSavedAddressId === address.id;
                    return (
                      <button
                        key={address.id}
                        onClick={() => {
                          setSelectedSavedAddressId(address.id);
                          onPickSavedAddress(address);
                        }}
                        className={`rounded-[1rem] border p-4 text-left transition-colors ${
                          active
                            ? 'border-[var(--bokmoo-gold)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)]'
                            : 'border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_40%,transparent)]'
                        }`}
                        type="button"
                      >
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--bokmoo-ink)]">
                          {address.name}
                          {address.isDefault ? (
                            <span className="rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--bokmoo-gold)]">
                              {pickCopy(locale, { en: 'Default', hans: '默认', hant: '預設' })}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--bokmoo-copy)]">
                          {address.phone} · {address.line1}
                          {address.city ? `, ${address.city}` : ''}
                          {address.country ? ` · ${address.country}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <p className="text-lg font-medium text-[var(--bokmoo-ink)]">{pickCopy(locale, { en: 'Billing Details', hans: '账单信息', hant: '帳單資訊' })}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <input
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className={inputClassName('phone')}
                        placeholder={pickCopy(locale, { en: 'Phone number', hans: '电话号码', hant: '電話號碼' })}
                      />
                      {errors.phone ? <p className="mt-2 text-xs text-[var(--bokmoo-danger)]">{errors.phone}</p> : null}
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        name="addressLine1"
                        value={formData.addressLine1}
                        onChange={handleChange}
                        className={inputClassName('addressLine1')}
                        placeholder={pickCopy(locale, { en: 'Address', hans: '详细地址', hant: '詳細地址' })}
                      />
                    </div>
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={inputClassName('city')}
                      placeholder={pickCopy(locale, { en: 'City', hans: '城市', hant: '城市' })}
                    />
                    <input
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className={inputClassName('country')}
                      placeholder={pickCopy(locale, { en: 'Country', hans: '国家/地区', hant: '國家/地區' })}
                    />
                    <input
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className={inputClassName('state')}
                      placeholder={pickCopy(locale, { en: 'State / Province', hans: '省/州', hant: '省/州' })}
                    />
                    <input
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      className={inputClassName('postalCode')}
                      placeholder={pickCopy(locale, { en: 'Postal code', hans: '邮编', hant: '郵遞區號' })}
                    />
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                form="bokmoo-checkout-form"
                disabled={isProcessing}
                className="btn-shimmer flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {isProcessing ? pickCopy(locale, { en: 'Processing…', hans: '处理中…', hant: '處理中…' }) : pickCopy(locale, { en: 'Continue to Payment', hans: '继续前往支付', hant: '繼續前往付款' })}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});
