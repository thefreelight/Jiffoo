import React from 'react';
import { Compass, Mail, ShieldCheck, Sparkles, User, WandSparkles } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { isExternalHref, resolveModelsfindSiteConfig } from '../site';

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
  const site = resolveModelsfindSiteConfig(config);
  const year = new Date().getFullYear();
  const showPoweredBy = platformBranding?.showPoweredByJiffoo !== false;

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
    <footer className="relative border-t border-[var(--modelsfind-line)] bg-[rgba(8,7,10,0.96)] px-4 py-8 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 lg:px-8">
      <div className="mx-auto hidden max-w-[1040px] items-center justify-between gap-6 text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] md:flex">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
          <span>{year} {site.brandName}. Private model directory.</span>
        </div>

        <div className="flex items-center gap-5">
          <button type="button" onClick={onNavigateToHelp} className="transition-colors hover:text-[var(--modelsfind-ink)]">Help</button>
          <button type="button" onClick={onNavigateToPrivacy} className="transition-colors hover:text-[var(--modelsfind-ink)]">Privacy</button>
          <button type="button" onClick={onNavigateToTerms} className="transition-colors hover:text-[var(--modelsfind-ink)]">Terms</button>
          <button type="button" onClick={onNavigateToContact} className="transition-colors hover:text-[var(--modelsfind-ink)]">Contact</button>
          {showPoweredBy ? (
            <a
              href={platformBranding?.poweredByHref || 'https://jiffoo.com'}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[var(--modelsfind-ink)]"
            >
              {platformBranding?.poweredByLabel || 'Powered by Jiffoo'}
            </a>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.href = `mailto:${site.supportEmail}`;
          }}
          className="inline-flex items-center gap-2 transition-colors hover:text-[var(--modelsfind-ink)]"
        >
          <Mail className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
          {site.supportEmail}
        </button>
      </div>

      <div className="fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-[24rem] -translate-x-1/2 items-center justify-between rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(14,11,16,0.96)] px-4 py-3 shadow-[var(--modelsfind-card-shadow)] md:hidden">
        <button type="button" onClick={onNavigateToProducts} className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
          <Sparkles className="h-4 w-4" />
          Explore
        </button>
        <button type="button" onClick={onNavigateToCategories} className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
          <Compass className="h-4 w-4" />
          Regions
        </button>
        <button
          type="button"
          onClick={() => openHref(site.docsHref)}
          className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]"
        >
          <WandSparkles className="h-4 w-4" />
          Concierge
        </button>
        <button type="button" onClick={onNavigateToDeals} className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
          <ShieldCheck className="h-4 w-4" />
          Boards
        </button>
        <button type="button" onClick={onNavigateToProducts} className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
          <User className="h-4 w-4" />
          Profile
        </button>
      </div>
    </footer>
  );
});
