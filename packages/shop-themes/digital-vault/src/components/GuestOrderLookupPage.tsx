import React from 'react';
import { ArrowRight, Mail, Search, ShieldCheck } from 'lucide-react';
import type { GuestOrderLookupPageProps } from '../types/theme';
import { resolveVaultSiteConfig } from '../site';

export const GuestOrderLookupPage = React.memo(function GuestOrderLookupPage({
  orderId,
  email,
  isLoading,
  error,
  config,
  onOrderIdChange,
  onEmailChange,
  onLookup,
  onContinueShopping,
}: GuestOrderLookupPageProps) {
  const site = resolveVaultSiteConfig(config);

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(21rem,0.74fr)]">
          <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy)]">
              <ShieldCheck className="h-4 w-4 text-[var(--vault-primary)]" />
              Guest order center
            </div>
            <h1 className="mt-5 max-w-[13ch] text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[0.98] tracking-[-0.05em] text-[var(--vault-ink)]">
              Reopen delivery with your order reference.
            </h1>
            <p className="mt-4 max-w-[42rem] text-sm leading-7 text-[var(--vault-copy)] sm:text-base">
              {site.brandName} keeps codes, accounts, and download links attached to the order center. Enter the order reference
              and checkout email to reopen your delivery locker without creating an account first.
            </p>

            <div className="mt-8 grid gap-4">
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Order reference
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                  <Search className="h-4 w-4 text-[var(--vault-copy-soft)]" />
                  <input
                    value={orderId}
                    onChange={(event) => onOrderIdChange(event.target.value)}
                    placeholder="cma1abc123xyz"
                    className="w-full bg-transparent text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
                  />
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Checkout email
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                  <Mail className="h-4 w-4 text-[var(--vault-copy-soft)]" />
                  <input
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-transparent text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
                  />
                </div>
              </label>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-[color:color-mix(in_oklab,var(--vault-danger)_20%,white)] bg-[color:color-mix(in_oklab,var(--vault-danger)_10%,white)] px-4 py-3 text-sm text-[var(--vault-danger)]">
                {error}
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                Lookup policy
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                This storefront uses the order reference plus checkout email as the approved guest access path. If the order is still pending payment, the buyer should reopen payment before expecting delivery.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => void onLookup()}
                disabled={isLoading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--vault-primary)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowRight className="h-4 w-4" />
                {isLoading ? 'Opening order center...' : 'Open guest order'}
              </button>
              {onContinueShopping ? (
                <button
                  onClick={onContinueShopping}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-6 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
                >
                  Continue shopping
                </button>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                What you can access
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  'Redeem codes and one-time activation keys',
                  'Account credentials and bundled access packs',
                  'Download links and digital file deliveries',
                ].map((item, index) => (
                  <div key={item} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--vault-primary-soft)] text-xs font-black text-[var(--vault-primary)]">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-[var(--vault-copy)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                Typical recovery flow
              </p>
              <div className="mt-4 space-y-3">
                {[
                  'Enter the order reference from your checkout or payment receipt.',
                  'Use the exact same email that was provided during checkout.',
                  'Open the order again to view payment state, delivery notes, and attached artifacts.',
                ].map((item, index) => (
                  <div key={item} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--vault-primary-soft)] text-xs font-black text-[var(--vault-primary)]">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-[var(--vault-copy)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                Support fallback
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--vault-copy)]">
                If the lookup fails, confirm the same email used at checkout or contact support with the order reference so the merchant can review the delivery log.
              </p>
              <a
                href={`mailto:${site.supportEmail}`}
                className="mt-4 inline-flex text-sm font-semibold text-[var(--vault-primary)] underline decoration-[var(--vault-line)] underline-offset-4"
              >
                {site.supportEmail}
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});
