import React from 'react';
import { ArrowRight, Compass, ExternalLink, LifeBuoy, Sparkles } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { isExternalHref, resolveNavToAiSiteConfig } from '../site';

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
  const site = resolveNavToAiSiteConfig(config);
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
    <footer className="border-t border-[var(--navtoai-line)] bg-[linear-gradient(180deg,var(--navtoai-surface),var(--navtoai-bg))] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy)]">
            <Compass className="h-4 w-4 text-[var(--navtoai-primary)]" />
            Direction over noise
          </div>

          <div className="max-w-3xl">
            <h2 className="text-[clamp(2.3rem,5vw,4.4rem)] font-black leading-[0.96] tracking-[-0.05em] text-[var(--navtoai-ink)]">
              AI discovery works better when the storefront behaves like a map, not a maze.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--navtoai-copy)]">
              NavToAI is for operators who want a calmer directory surface, buyers who need sharper category cues, and teams who still need the underlying commerce rails to stay dependable.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => openHref(site.primaryCtaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--navtoai-primary)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-transform duration-300 hover:-translate-y-0.5"
            >
              {site.primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openHref(site.docsHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-ink)]"
            >
              Documentation
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
              <Sparkles className="h-4 w-4 text-[var(--navtoai-primary)]" />
              Explore
            </div>
            <div className="grid gap-2 text-sm">
              <button type="button" onClick={onNavigateToProducts} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">All tools</button>
              <button type="button" onClick={onNavigateToCategories} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Categories</button>
              <button type="button" onClick={() => onNavigate?.('/search?q=chat')} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Chat & search</button>
              <button type="button" onClick={() => onNavigate?.('/search?q=image')} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Image & design</button>
              <button type="button" onClick={() => onNavigate?.('/search?q=agent')} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Coding & agents</button>
              <button type="button" onClick={onNavigateToDeals} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Deals</button>
              <button type="button" onClick={onNavigateToBestsellers} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Bestsellers</button>
              <button type="button" onClick={onNavigateToNewArrivals} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">New arrivals</button>
            </div>
          </div>

          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
              <LifeBuoy className="h-4 w-4 text-[var(--navtoai-primary)]" />
              Support
            </div>
            <div className="grid gap-2 text-sm">
              <button type="button" onClick={onNavigateToHelp} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Buyer guide</button>
              <button type="button" onClick={onNavigateToContact} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Contact</button>
              <button type="button" onClick={onNavigateToPrivacy} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Privacy</button>
              <button type="button" onClick={onNavigateToTerms} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">Terms</button>
              <a href={`mailto:${site.supportEmail}`} className="text-[var(--navtoai-ink)] underline decoration-[var(--navtoai-line)] underline-offset-4">
                {site.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1280px] flex-col gap-3 border-t border-[var(--navtoai-line)] pt-5 text-sm text-[var(--navtoai-copy)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} {site.brandName}. AI navigation storefront theme.</p>
        <p>Built for editorial tool directories, clearer category signals, and commerce-ready evaluation flows.</p>
      </div>
    </footer>
  );
});
