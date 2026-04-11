import React from 'react';
import { ArrowRight, CheckCircle2, Globe2, ScanLine, Smartphone, Sparkles } from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

export const HomePage = React.memo(function HomePage({ config, onNavigate }: HomePageProps) {
  const site = resolveBokmooSiteConfig(config);

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

  const rituals = [
    {
      title: 'Insert or prepare',
      body: 'Keep your existing number, prepare your device, and get ready to install before departure.',
      icon: Smartphone,
    },
    {
      title: 'Scan and install',
      body: 'Receive the QR code immediately after payment and load your travel profile in minutes.',
      icon: ScanLine,
    },
    {
      title: 'Land already connected',
      body: 'Choose a destination or regional plan that feels ready before you board.',
      icon: Globe2,
    },
  ];

  const collections = [
    {
      label: 'Destination eSIM',
      title: 'Single-country plans for focused itineraries.',
      detail: 'Japan, Korea, Singapore, UAE, Europe, and more.',
      href: '/products',
    },
    {
      label: 'Regional pass',
      title: 'Move through multiple borders without changing strategy.',
      detail: 'Built for Europe, Asia-Pacific, and multi-country trips.',
      href: '/categories',
    },
    {
      label: 'Departure guide',
      title: 'Check compatibility, setup timing, and activation advice.',
      detail: 'Made for travelers who prefer to sort connectivity before takeoff.',
      href: '/help',
    },
  ];

  return (
    <div className="bg-[var(--bokmoo-bg)] text-[var(--bokmoo-ink)]">
      <section className="relative overflow-hidden border-b border-[var(--bokmoo-line)] px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8 lg:pb-24">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(201,168,95,0.18),transparent_55%)]" />

        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-center">
          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--bokmoo-copy)]">
              <Sparkles className="h-4 w-4 text-[var(--bokmoo-gold)]" />
              {site.eyebrow}
            </div>

            <h1 className="mt-6 max-w-5xl text-[clamp(3rem,7vw,6.8rem)] leading-[0.94] tracking-[-0.06em] text-[var(--bokmoo-ink)]">
              {site.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-[clamp(1rem,1.8vw,1.2rem)] leading-8 text-[var(--bokmoo-copy)]">
              {site.subheadline}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <button
                onClick={() => openHref(site.primaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-7 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] transition-transform duration-300 hover:-translate-y-0.5"
                type="button"
              >
                {site.primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => openHref(site.secondaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg-elevated)] px-7 text-sm font-medium uppercase tracking-[0.2em] text-[var(--bokmoo-ink)]"
                type="button"
              >
                {site.secondaryCtaLabel}
              </button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ['200+', 'Countries & regions'],
                ['Instant', 'QR delivery after payment'],
                ['Local', 'Carrier-priority access'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[color:oklch(0.22_0.009_90_/_0.9)] p-4"
                >
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-gold)]">{value}</p>
                  <p className="mt-2 text-sm text-[var(--bokmoo-copy)]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem]">
            <div className="rounded-[2.4rem_2.4rem_1.75rem_1.75rem] border border-[var(--bokmoo-line-strong)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-soft)_72%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="rounded-[2rem_2rem_1.2rem_1.2rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,var(--bokmoo-bg-soft),var(--bokmoo-bg))] px-6 pb-8 pt-12">
                <p className="text-center text-lg font-semibold uppercase tracking-[0.28em] text-[var(--bokmoo-ink)]">
                  Welcome
                </p>

                <div className="mt-8 grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-4 rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.18_0.008_90_/_0.94)] p-5">
                  <div className="rounded-[1.4rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(145deg,var(--bokmoo-bg-soft),var(--bokmoo-bg))] p-4">
                    <div className="rounded-[1.1rem] border border-[var(--bokmoo-line-strong)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent)] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-gold)]">Bokmoo</span>
                        <span className="rounded-full border border-[var(--bokmoo-line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy)]">eSIM</span>
                      </div>
                      <div className="mt-6 h-16 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.24_0.01_90_/_0.9)]" />
                      <p className="mt-6 text-sm uppercase tracking-[0.22em] text-[var(--bokmoo-copy)]">
                        Your global partner.
                      </p>
                    </div>
                  </div>

                  <div className="flex h-20 items-center justify-center rounded-[1.25rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-silver)]">
                    <span className="text-xl">⌁</span>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.4rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5">
                  <p className="text-center text-sm font-medium uppercase tracking-[0.22em] text-[var(--bokmoo-ink)]">
                    Setting up your Bokmoo
                  </p>
                  <div className="mt-4 grid gap-3">
                    {rituals.map(({ title, body, icon: Icon }) => (
                      <div key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] text-[var(--bokmoo-gold)]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--bokmoo-copy)]">{body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--bokmoo-copy-soft)]">
              Choose your route
            </p>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,4.4rem)] leading-[0.97] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
              Plans arranged like travel options, not commodity telecom tiles.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {collections.map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigate?.(item.href)}
                className="group rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 text-left transition-transform duration-300 hover:-translate-y-1"
                type="button"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--bokmoo-gold)]">
                  {item.label}
                </p>
                <h3 className="mt-4 text-2xl leading-[1.02] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">{item.detail}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                  Open
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--bokmoo-line)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--bokmoo-copy-soft)]">
              Why Bokmoo
            </p>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,4.2rem)] leading-[0.97] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
              High-end doesn&apos;t mean louder. It means more prepared, more legible, and more reassuring.
            </h2>
          </div>

          <div className="grid gap-4">
            {[
              'The storefront leads with plan clarity before it asks for checkout.',
              'Activation is framed as a three-step ritual that mirrors the physical welcome kit.',
              'Product pages prioritize compatibility, coverage, and setup confidence over discount noise.',
            ].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-4 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--bokmoo-gold)]" />
                <p className="text-sm leading-7 text-[var(--bokmoo-copy)]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
});
