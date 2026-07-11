'use client';

import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { CheckoutPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

export function CheckoutPage({ cart, isLoading, isProcessing, onSubmit, onBack }: CheckoutPageProps) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    paymentMethod: 'card',
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(formData);
  }

  if (isLoading) {
    return (
      <StudioPage activeNav="explore">
        <StudioMain className="space-y-6">
          <div className="h-40 animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="h-[520px] animate-pulse rounded-[1.8rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
            <div className="h-[420px] animate-pulse rounded-[1.8rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          </div>
        </StudioMain>
      </StudioPage>
    );
  }

  return (
    <StudioPage activeNav="explore">
      <StudioMain className="space-y-6">
        <StudioPanel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <StudioSectionIntro
              eyebrow="Checkout"
              title="Finish your purchase without leaving the imagic workspace mood."
              body="This checkout keeps the same darker product language so the transition from browsing and generation into payment still feels consistent."
            />
            <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-2 text-sm text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
              <ArrowLeft className="h-4 w-4" />
              Back to cart
            </button>
          </div>
        </StudioPanel>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <form onSubmit={handleSubmit} className="rounded-[1.8rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/94 p-6 shadow-[var(--imagic-soft-shadow)] sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['firstName', 'First name'],
                ['lastName', 'Last name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['city', 'City'],
                ['state', 'State'],
                ['postalCode', 'Postal code'],
                ['country', 'Country'],
              ].map(([key, label]) => (
                <label key={key} className={`block ${key === 'email' || key === 'addressLine1' ? 'sm:col-span-2' : ''}`}>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">{label}</span>
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    value={(formData as Record<string, string>)[key] || ''}
                    onChange={(event) => setFormData((current) => ({ ...current, [key]: event.target.value }))}
                    className="h-12 w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-[color:var(--imagic-muted)]"
                  />
                </label>
              ))}

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Address</span>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(event) => setFormData((current) => ({ ...current, addressLine1: event.target.value }))}
                  className="h-12 w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-[color:var(--imagic-muted)]"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Payment method</span>
                <select
                  value={formData.paymentMethod}
                  onChange={(event) => setFormData((current) => ({ ...current, paymentMethod: event.target.value }))}
                  className="h-12 w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 text-sm text-[color:var(--imagic-ink)] outline-none"
                >
                  <option value="card">Credit card</option>
                  <option value="paypal">PayPal</option>
                </select>
              </label>
            </div>

            <button type="submit" disabled={isProcessing} className="imagic-button-primary mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)] disabled:opacity-60">
              {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isProcessing ? 'Processing payment...' : 'Complete purchase'}
            </button>
          </form>

          <StudioPanel className="h-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Order summary</p>
            <div className="mt-4 space-y-3">
              {cart.items.map((item) => (
                <div key={item.id} className="rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[color:var(--imagic-ink)]">{item.productName}</span>
                    <span className="text-[color:var(--imagic-ink-soft)]">x{item.quantity}</span>
                  </div>
                  <p className="mt-2 text-[color:var(--imagic-primary)]">${Number(item.subtotal).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              {[
                ['Subtotal', cart.subtotal],
                ['Tax', cart.tax],
                ['Shipping', cart.shipping],
                ['Discount', -cart.discount],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between text-[color:var(--imagic-ink-soft)]">
                  <span>{label}</span>
                  <span className="text-[color:var(--imagic-ink)]">${Number(value).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-[color:var(--imagic-primary-border)] bg-[color:var(--imagic-primary-soft)]/30 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--imagic-muted)]">Total</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">${Number(cart.total).toFixed(2)}</p>
            </div>
          </StudioPanel>
        </div>
      </StudioMain>
    </StudioPage>
  );
}
