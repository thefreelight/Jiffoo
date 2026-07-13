import React from 'react';
import type { FooterProps } from '../types/theme';
import { isExternalHref, resolveVaultSiteConfig } from '../site';

export const Footer = React.memo(function Footer({
  config,
  platformBranding,
  onNavigate,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
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

  const showPoweredBy = platformBranding?.showPoweredByJiffoo !== false;

  return (
    <footer className="border-t border-[var(--vault-line)] bg-[var(--vault-surface)]">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:px-8">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--vault-primary)] text-sm font-black text-white">
              {site.brandName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--vault-ink)]">{site.brandName}</h2>
              <p className="text-sm text-[var(--vault-copy-soft)]">Digital storefront for cards, accounts, and downloads</p>
            </div>
          </div>

          <p className="max-w-[34rem] text-sm leading-7 text-[var(--vault-copy)]">
            Run a storefront that makes digital delivery obvious before checkout and keeps fulfillment accessible after payment. Shoppers can browse by category, confirm stock, and return to their order center any time.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => openHref(site.primaryCtaHref)}
              className="rounded-xl bg-[var(--vault-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
            >
              {site.primaryCtaLabel}
            </button>
            <button
              onClick={() => openHref(site.secondaryCtaHref)}
              className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-2.5 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
            >
              {site.secondaryCtaLabel}
            </button>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Browse</h3>
            <div className="grid gap-2 text-sm">
              <button onClick={onNavigateToProducts} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                All products
              </button>
              <button onClick={onNavigateToCategories} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Categories
              </button>
              <button onClick={() => onNavigate?.('/search?q=gift%20card')} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Gift cards
              </button>
              <button onClick={() => onNavigate?.('/search?q=account')} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Accounts
              </button>
              <button onClick={() => onNavigate?.('/search?q=download')} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Downloads
              </button>
              <button onClick={onNavigateToDeals} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Deals
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Support</h3>
            <div className="grid gap-2 text-sm">
              <button onClick={onNavigateToHelp} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Help center
              </button>
              <button onClick={() => onNavigate?.('/guest/orders')} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Track guest order
              </button>
              <button onClick={onNavigateToContact} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Contact support
              </button>
              <button onClick={onNavigateToPrivacy} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Privacy
              </button>
              <button onClick={onNavigateToTerms} className="text-left text-[var(--vault-copy)] hover:text-[var(--vault-ink)]">
                Terms
              </button>
              <a href={`mailto:${site.supportEmail}`} className="text-[var(--vault-ink)] underline decoration-[var(--vault-line)] underline-offset-4">
                {site.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--vault-line)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-5 text-xs text-[var(--vault-copy-soft)] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© {year} {site.brandName}. Digital goods storefront.</p>
          {showPoweredBy ? (
            <a
              href={platformBranding?.poweredByHref || 'https://jiffoo.com'}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--vault-ink)]"
            >
              {platformBranding?.poweredByLabel || 'Powered by Jiffoo'}
            </a>
          ) : (
            <p>Guest checkout and order-center delivery supported.</p>
          )}
        </div>
      </div>
    </footer>
  );
});
