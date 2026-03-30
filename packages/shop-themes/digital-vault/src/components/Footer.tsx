import React from 'react';
import { ArrowRight, ExternalLink, LifeBuoy, ShieldCheck, WalletCards } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { isExternalHref, resolveVaultSiteConfig } from '../site';

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
  const site = resolveVaultSiteConfig(config);
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
    <footer className="border-t border-[var(--vault-line)] bg-[linear-gradient(180deg,var(--vault-surface),var(--vault-bg))] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vault-copy)]">
            <ShieldCheck className="h-4 w-4 text-[var(--vault-primary)]" />
            Delivery stays visible
          </div>

          <div className="max-w-3xl">
            <h2 className="text-[clamp(2.3rem,5vw,4.5rem)] font-black leading-[0.96] tracking-[-0.05em] text-[var(--vault-ink)]">
              A digital goods storefront should feel like an organized vault, not a guessing game after checkout.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--vault-copy)]">
              Buyers can tell what will be delivered, operators can support it, and every code, credential, or download stays reachable in the order archive.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => openHref(site.primaryCtaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--vault-primary)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-transform duration-300 hover:-translate-y-0.5"
            >
              {site.primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => openHref(site.secondaryCtaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-surface)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vault-ink)]"
            >
              {site.secondaryCtaLabel}
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vault-copy-soft)]">
              <WalletCards className="h-4 w-4 text-[var(--vault-primary)]" />
              Browse
            </div>
            <div className="grid gap-2 text-sm">
              <button onClick={onNavigateToProducts} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">All digital goods</button>
              <button onClick={() => onNavigate?.('/search?q=gift%20card')} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Gift cards</button>
              <button onClick={() => onNavigate?.('/search?q=account')} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Account packs</button>
              <button onClick={() => onNavigate?.('/search?q=download')} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Download assets</button>
              <button onClick={onNavigateToDeals} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Deals</button>
              <button onClick={onNavigateToBestsellers} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Bestsellers</button>
              <button onClick={onNavigateToNewArrivals} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">New arrivals</button>
              <button onClick={onNavigateToCategories} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Categories</button>
            </div>
          </div>

          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vault-copy-soft)]">
              <LifeBuoy className="h-4 w-4 text-[var(--vault-primary)]" />
              Support
            </div>
            <div className="grid gap-2 text-sm">
              <button onClick={onNavigateToHelp} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">How delivery works</button>
              <button onClick={onNavigateToContact} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Contact support</button>
              <button onClick={onNavigateToPrivacy} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Privacy</button>
              <button onClick={onNavigateToTerms} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">Terms</button>
              <a href={`mailto:${site.supportEmail}`} className="text-[var(--vault-ink)] underline decoration-[var(--vault-line)] underline-offset-4">
                {site.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1280px] flex-col gap-3 border-t border-[var(--vault-line)] pt-5 text-sm text-[var(--vault-copy)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} {site.brandName}. Digital fulfillment storefront theme.</p>
        <p>Built for codes, credentials, vouchers, and downloadable assets that should ship immediately.</p>
      </div>
    </footer>
  );
});
