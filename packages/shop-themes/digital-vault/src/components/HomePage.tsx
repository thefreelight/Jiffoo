import React from 'react';
import {
  ArrowRight,
  Download,
  Gift,
  KeyRound,
  ShieldCheck,
  Sparkles,
  UserSquare2,
} from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { isExternalHref, resolveVaultSiteConfig } from '../site';

export const HomePage = React.memo(function HomePage({ config, onNavigate }: HomePageProps) {
  const site = resolveVaultSiteConfig(config);

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      onNavigate?.(href);
    },
    [onNavigate]
  );

  const lanes = [
    {
      icon: Gift,
      label: 'Gift cards',
      detail: 'Stored-value cards, game balance, prepaid vouchers, top-up packs.',
      href: '/search?q=gift%20card',
    },
    {
      icon: KeyRound,
      label: 'Codes & keys',
      detail: 'Redemption codes, serials, activation keys, one-time claim credentials.',
      href: '/search?q=code',
    },
    {
      icon: UserSquare2,
      label: 'Access packs',
      detail: 'Account usernames, passwords, environment credentials, starter kits.',
      href: '/search?q=account',
    },
    {
      icon: Download,
      label: 'Download assets',
      detail: 'Files, templates, installers, resource bundles, private docs.',
      href: '/search?q=download',
    },
  ];

  const timeline = [
    'Payment clears and fulfillment starts.',
    'Codes, credentials, or files are attached to the order.',
    'Buyer opens the access locker and copies or downloads immediately.',
  ];

  const trustPoints = [
    'Delivery rules stay visible before checkout.',
    'Every purchase resolves inside the order locker.',
    'Ops can still intervene manually without breaking the flow.',
  ];

  const controlCards = [
    {
      title: 'Buyer promise',
      detail: 'Show exactly what arrives, how fast it arrives, and where it lives afterward.',
    },
    {
      title: 'Operator control',
      detail: 'Keep a manual fallback ready for codes, accounts, or links that need review.',
    },
  ];

  return (
    <div className="bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--vault-primary-soft)_88%,white),transparent_28%),linear-gradient(180deg,var(--vault-bg),color-mix(in_oklab,var(--vault-bg)_94%,white))] text-[var(--vault-ink)]">
      <section className="relative overflow-hidden border-b border-[var(--vault-line)] px-4 pb-14 pt-16 sm:px-6 sm:pb-18 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:var(--vault-grid)] [background-size:72px_72px]" />
        <div className="mx-auto grid max-w-[1280px] gap-8 xl:grid-cols-[minmax(0,0.98fr)_minmax(25rem,0.82fr)] xl:items-start xl:gap-12">
          <div className="relative max-w-[42rem]">
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--vault-copy)] shadow-[var(--vault-shadow)]">
              <Sparkles className="h-4 w-4 text-[var(--vault-primary)]" />
              {site.eyebrow}
            </div>

            <h1 className="mt-6 max-w-[11ch] text-[clamp(3.2rem,7vw,5.8rem)] font-black leading-[0.94] tracking-[-0.06em] text-[var(--vault-ink)]">
              {site.headline}
            </h1>
            <p className="mt-5 max-w-[38rem] text-[clamp(1rem,1.8vw,1.22rem)] leading-8 text-[var(--vault-copy)]">
              {site.subheadline}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => openHref(site.primaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[var(--vault-primary)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-white transition-transform duration-300 hover:-translate-y-0.5"
              >
                {site.primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => openHref(site.secondaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--vault-ink)]"
              >
                {site.secondaryCtaLabel}
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[color:color-mix(in_oklab,var(--vault-surface)_92%,white)] px-4 py-4 shadow-[var(--vault-shadow)]"
                >
                  <p className="text-sm leading-6 text-[var(--vault-copy)]">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:pt-8">
            <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[color:color-mix(in_oklab,var(--vault-surface)_92%,white)] p-6 shadow-[var(--vault-shadow)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--vault-copy-soft)]">
                    Fulfillment flow
                  </p>
                  <h2 className="mt-2 max-w-[16ch] text-[clamp(1.8rem,3vw,2.6rem)] font-black leading-[1.02] tracking-[-0.045em] text-[var(--vault-ink)]">
                    Delivery stays visible from checkout to order archive.
                  </h2>
                  <p className="mt-3 max-w-[32rem] text-sm leading-6 text-[var(--vault-copy)]">
                    The storefront explains the handoff before purchase, then keeps the result inside the order instead of pushing buyers into email or support chat.
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {timeline.map((step, index) => (
                  <div
                    key={step}
                    className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-bg)] p-4"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--vault-ink)] text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-[var(--vault-copy)]">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {controlCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[var(--vault-radius-md)] border border-[var(--vault-line)] bg-[var(--vault-surface)] px-5 py-5 shadow-[var(--vault-shadow)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vault-copy-soft)]">
                    {card.title}
                  </p>
                  <p className="mt-3 text-base font-semibold leading-7 text-[var(--vault-ink)]">
                    {card.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--vault-copy-soft)]">
              Sell what ships instantly
            </p>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,4rem)] font-black leading-[0.96] tracking-[-0.05em] text-[var(--vault-ink)]">
              Built for digital items that should arrive in seconds and remain easy to manage afterward.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {lanes.map(({ icon: Icon, label, detail, href }) => (
              <button
                key={label}
                onClick={() => onNavigate?.(href)}
                className="group rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 text-left shadow-[var(--vault-shadow)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-black tracking-[-0.03em] text-[var(--vault-ink)]">
                  {label}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">{detail}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vault-primary)]">
                  Open collection
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
});
