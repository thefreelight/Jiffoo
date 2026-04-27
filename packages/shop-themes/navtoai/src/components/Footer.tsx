import React from 'react';
import { ArrowRight, BookOpenText, Compass, Mail, Sparkles } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { getNavCopy } from '../i18n';
import { isExternalHref, resolveNavToAiSiteConfig } from '../site';

export const Footer = React.memo(function Footer({
  config,
  locale,
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
  const copy = getNavCopy(locale);
  const site = resolveNavToAiSiteConfig(config, locale);
  const year = new Date().getFullYear();

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }

      if (onNavigate) {
        onNavigate(href);
        return;
      }

      if (typeof window !== 'undefined') {
        window.location.assign(href);
      }
    },
    [onNavigate],
  );

  return (
    <footer className="border-t border-[var(--navtoai-line)] bg-[linear-gradient(180deg,var(--navtoai-surface),var(--navtoai-bg))] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[color:color-mix(in_oklab,var(--navtoai-surface)_94%,white)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
            <Compass className="h-4 w-4" />
            {copy.footer.title}
          </div>
          <h2 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-black leading-[0.98] tracking-[-0.05em] text-[var(--navtoai-ink)]">
            {site.brandName}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--navtoai-copy)]">
            {copy.footer.body}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onNavigateToProducts}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white shadow-[var(--navtoai-glow)]"
            >
              {copy.common.browseAll}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openHref(site.docsHref)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-5 py-3 text-sm font-semibold text-[var(--navtoai-ink)]"
            >
              <BookOpenText className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {copy.footer.docs}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-xs)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
              <Sparkles className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {copy.footer.explore}
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <button type="button" onClick={onNavigateToProducts} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.sidebar.tools}
              </button>
              <button type="button" onClick={onNavigateToCategories} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.sidebar.models}
              </button>
              <button type="button" onClick={onNavigateToDeals} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.sidebar.collections}
              </button>
              <button type="button" onClick={onNavigateToBestsellers} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.sidebar.rankings}
              </button>
              <button type="button" onClick={onNavigateToNewArrivals} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.sidebar.news}
              </button>
            </div>
          </div>

          <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-xs)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-copy-soft)]">
              <Mail className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {copy.footer.support}
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <button type="button" onClick={onNavigateToHelp} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.sidebar.resources}
              </button>
              <button type="button" onClick={onNavigateToContact} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.footer.contact}
              </button>
              <button type="button" onClick={onNavigateToPrivacy} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.footer.privacy}
              </button>
              <button type="button" onClick={onNavigateToTerms} className="text-left text-[var(--navtoai-copy)] hover:text-[var(--navtoai-ink)]">
                {copy.footer.terms}
              </button>
              <a href={`mailto:${site.supportEmail}`} className="pt-2 font-semibold text-[var(--navtoai-ink)]">
                {site.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1440px] flex-col gap-2 border-t border-[var(--navtoai-line)] pt-5 text-sm text-[var(--navtoai-copy)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {site.brandName}. {copy.footer.copyright}
        </p>
        <p>{copy.footer.summary}</p>
      </div>
    </footer>
  );
});
