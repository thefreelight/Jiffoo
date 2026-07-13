import React from 'react';
import { ArrowRight, ExternalLink, Globe2, ShieldCheck, Smartphone } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

export const Footer = React.memo(function Footer({
  config,
  onNavigate,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
  onNavigateToNewArrivals,
  onNavigateToBestsellers,
  onNavigateToHelp,
  onNavigateToContact,
  onNavigateToPrivacy,
  onNavigateToTerms,
}: FooterProps) {
  const site = resolveBokmooSiteConfig(config);
  const year = new Date().getFullYear();

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

  return (
    <footer className="border-t border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,var(--bokmoo-bg-elevated),var(--bokmoo-bg))] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy)]">
            <ShieldCheck className="h-4 w-4 text-[var(--bokmoo-gold)]" />
            Travel-ready before boarding
          </div>

          <div className="max-w-3xl">
            <h2 className="text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.96] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
              Connectivity should arrive with the same confidence as the rest of your trip.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--bokmoo-copy)]">
              Browse destination-ready plans, receive your QR code immediately, and leave with setup guidance that feels deliberate instead of improvised.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => openHref(site.primaryCtaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)] transition-transform duration-300 hover:-translate-y-0.5"
              type="button"
            >
              {site.primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => openHref(site.secondaryCtaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-6 py-3 text-sm font-medium uppercase tracking-[0.18em] text-[var(--bokmoo-ink)]"
              type="button"
            >
              {site.secondaryCtaLabel}
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy-soft)]">
              <Globe2 className="h-4 w-4 text-[var(--bokmoo-gold)]" />
              Explore
            </div>
            <div className="grid gap-2 text-sm">
              <button onClick={onNavigateToProducts} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">All eSIM plans</button>
              <button onClick={onNavigateToCategories} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">Destinations</button>
              <button onClick={onNavigateToDeals} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">Travel deals</button>
              <button onClick={onNavigateToBestsellers} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">Popular picks</button>
              <button onClick={onNavigateToNewArrivals} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">New arrivals</button>
            </div>
          </div>

          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy-soft)]">
              <Smartphone className="h-4 w-4 text-[var(--bokmoo-gold)]" />
              Support
            </div>
            <div className="grid gap-2 text-sm">
              <button onClick={onNavigateToHelp} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">Device support</button>
              <button onClick={onNavigateToContact} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">Contact</button>
              <button onClick={onNavigateToPrivacy} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">Privacy</button>
              <button onClick={onNavigateToTerms} className="text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">Terms</button>
              <a href={`mailto:${site.supportEmail}`} className="text-[var(--bokmoo-ink)] underline decoration-[var(--bokmoo-line)] underline-offset-4">
                {site.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1280px] flex-col gap-3 border-t border-[var(--bokmoo-line)] pt-5 text-sm text-[var(--bokmoo-copy)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} {site.brandName}. Official Bokmoo storefront theme.</p>
        <p>Instant QR delivery, destination-ready plans, and calmer pre-trip setup.</p>
      </div>
    </footer>
  );
});
