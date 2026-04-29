import React from 'react';
import type { ContactPageProps } from 'shared/src/types/theme';
import { resolveBokmooSiteConfig } from '../site';

export const ContactPage = React.memo(function ContactPage({ config }: ContactPageProps) {
  const site = resolveBokmooSiteConfig(config);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] shadow-[var(--bokmoo-shadow)] sm:rounded-[1.6rem]">
          <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                About BOKMOO
              </p>
              <h1 className="mt-4 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                BOKMOO is built for global travelers.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]">
                Our mission is to make connectivity simple, affordable, and reliable anywhere in the world.
              </p>
              <a
                href={`mailto:${site.supportEmail}`}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-5 text-sm font-medium text-[var(--bokmoo-ink)]"
              >
                {site.supportEmail}
              </a>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  ['200+', 'Countries'],
                  ['1M+', 'Happy Users'],
                  ['99.9%', 'Uptime'],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-5"
                  >
                    <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]">{value}</p>
                    <p className="mt-2 text-sm text-[var(--bokmoo-copy-soft)]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[15rem] overflow-hidden rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(160deg,#30261c_0%,#141210_56%,#0a0a0b_100%)] sm:min-h-[19rem] sm:rounded-[1.4rem]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(215,178,61,0.34),transparent_26%)]" />
              <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)]" />
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
