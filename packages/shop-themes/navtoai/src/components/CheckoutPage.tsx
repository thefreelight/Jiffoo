import React from 'react';
import { ArrowLeft, CreditCard, Loader2, Mail, ShieldCheck } from 'lucide-react';
import type { CheckoutPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getCheckoutCopy(locale?: string) {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return {
      back: '返回購物車',
      title: '確認你的訂單與付款資訊。',
      eyebrow: '結帳',
      email: '電子郵件',
      firstName: '名字',
      lastName: '姓氏',
      phone: '電話',
      address: '地址',
      city: '城市',
      state: '州 / 省',
      postal: '郵遞區號',
      country: '國家',
      payment: '付款方式',
      submit: '提交訂單',
      submitting: '處理中...',
      subtotal: '小計',
      total: '總計',
      shippingRequired: '這筆訂單需要填寫配送資訊。',
      pluginNote: '這裡只顯示已安裝的支付插件，主題本身不直接處理付款。',
    };
  }
  if (resolved === 'zh-Hans') {
    return {
      back: '返回购物车',
      title: '确认你的订单和付款信息。',
      eyebrow: '结账',
      email: '邮箱',
      firstName: '名字',
      lastName: '姓氏',
      phone: '电话',
      address: '地址',
      city: '城市',
      state: '州 / 省',
      postal: '邮编',
      country: '国家',
      payment: '支付方式',
      submit: '提交订单',
      submitting: '处理中...',
      subtotal: '小计',
      total: '合计',
      shippingRequired: '这笔订单需要填写收货信息。',
      pluginNote: '这里只显示已安装的支付插件，主题本身不直接处理付款。',
    };
  }
  return {
    back: 'Back to cart',
    title: 'Confirm your order and payment details.',
    eyebrow: 'Checkout',
    email: 'Email',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    address: 'Address',
    city: 'City',
    state: 'State / Region',
    postal: 'Postal code',
    country: 'Country',
    payment: 'Payment method',
    submit: 'Place order',
    submitting: 'Processing...',
    subtotal: 'Subtotal',
    total: 'Total',
    shippingRequired: 'Shipping details are required for this order.',
    pluginNote: 'Only installed payment plugins are shown here. The theme does not process payments directly.',
  };
}

function formatCurrency(value: number, locale?: string): string {
  const resolved = getNavCopy(locale).locale;
  return new Intl.NumberFormat(resolved === 'en' ? 'en-US' : 'zh-CN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export const CheckoutPage = React.memo(function CheckoutPage({
  cart,
  isLoading,
  isProcessing,
  locale,
  config,
  requireShippingAddress,
  currentUserEmail,
  availablePaymentMethods,
  onSubmit,
  onBack,
}: CheckoutPageProps) {
  const copy = getCheckoutCopy(locale);
  const methods = availablePaymentMethods || [];
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
    paymentMethod: methods[0]?.name || '',
  });

  React.useEffect(() => {
    if (!currentUserEmail) return;
    setFormData((prev) => ({ ...prev, email: prev.email || currentUserEmail }));
  }, [currentUserEmail]);

  React.useEffect(() => {
    if (!methods.length) return;
    if (methods.some((item) => item.name === formData.paymentMethod)) return;
    setFormData((prev) => ({ ...prev, paymentMethod: methods[0].name }));
  }, [formData.paymentMethod, methods]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(formData);
  };

  if (isLoading) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {getNavCopy(locale).common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navtoai-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.96fr)_20rem]">
          <form id="navtoai-checkout-form" onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                <Mail className="h-4 w-4 text-[var(--navtoai-primary)]" />
                {copy.eyebrow}
              </div>
              <h1 className="mt-4 text-[clamp(2rem,4vw,3.4rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
                {copy.title}
              </h1>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  ['email', copy.email],
                  ['firstName', copy.firstName],
                  ['lastName', copy.lastName],
                  ['phone', copy.phone],
                  ['addressLine1', copy.address],
                  ['city', copy.city],
                  ['state', copy.state],
                  ['postalCode', copy.postal],
                  ['country', copy.country],
                ].map(([key, label]) => (
                  <label key={key} className={key === 'email' || key === 'addressLine1' ? 'grid gap-2 sm:col-span-2' : 'grid gap-2'}>
                    <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{label}</span>
                    <input
                      value={formData[key as keyof typeof formData] as string}
                      onChange={(event) => setFormData((prev) => ({ ...prev, [key]: event.target.value }))}
                      className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                <CreditCard className="h-4 w-4 text-[var(--navtoai-primary)]" />
                {copy.payment}
              </div>
              <div className="mt-5 grid gap-3">
                {(methods.length ? methods : [{ name: 'card', displayName: 'Card' }]).map((method) => (
                  <label
                    key={method.name}
                    className={[
                      'flex cursor-pointer items-center justify-between rounded-[1rem] border px-4 py-4',
                      formData.paymentMethod === method.name
                        ? 'border-[var(--navtoai-primary)] bg-[var(--navtoai-primary-soft)]'
                        : 'border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)]',
                    ].join(' ')}
                  >
                    <span className="text-sm font-semibold text-[var(--navtoai-ink)]">{method.displayName}</span>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.name}
                      checked={formData.paymentMethod === method.name}
                      onChange={(event) => setFormData((prev) => ({ ...prev, paymentMethod: event.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--navtoai-copy)]">{copy.pluginNote}</p>
            </section>
          </form>

          <aside className="space-y-4">
            <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-5 shadow-[var(--navtoai-shadow-sm)]">
              <div className="grid gap-3 text-sm text-[var(--navtoai-copy)]">
                {cart.items.map((item) => (
                  <div key={item.id} className="rounded-[1rem] bg-[var(--navtoai-bg-alt)] p-4">
                    <div className="font-semibold text-[var(--navtoai-ink)]">{item.productName}</div>
                    <div className="mt-1 text-xs">{item.quantity} x {formatCurrency(item.price, locale)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-[var(--navtoai-line)] pt-4">
                <div className="flex items-center justify-between text-sm text-[var(--navtoai-copy)]">
                  <span>{copy.subtotal}</span>
                  <span>{formatCurrency(cart.subtotal, locale)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-[var(--navtoai-copy)]">
                  <span>{copy.total}</span>
                  <span className="text-lg font-black text-[var(--navtoai-ink)]">{formatCurrency(cart.total, locale)}</span>
                </div>
              </div>
              <button
                type="submit"
                form="navtoai-checkout-form"
                disabled={isProcessing}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white shadow-[var(--navtoai-glow)] disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {copy.submitting}
                  </>
                ) : (
                  copy.submit
                )}
              </button>
              {requireShippingAddress ? (
                <div className="mt-4 flex items-start gap-3 rounded-[1rem] bg-[var(--navtoai-bg-alt)] p-4 text-sm text-[var(--navtoai-copy)]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--navtoai-primary)]" />
                  {copy.shippingRequired}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </MarketplaceFrame>
  );
});
