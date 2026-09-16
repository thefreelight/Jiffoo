import React from 'react';
import { Github, Linkedin, Twitter, Youtube } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { getNavCopy } from '../i18n';
import { isExternalHref, resolveNavToAiSiteConfig } from '../site';
import { NavtoAiLogo } from './design-primitives';

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

  const linkClass = 'text-left text-sm font-medium text-[#5a6580] transition-colors hover:text-[#2f6bff]';
  const colHeadClass = 'text-sm font-black text-[#0f1730]';

  return (
    <footer className="border-t border-[#eaeff8] bg-white">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
        <div>
          <NavtoAiLogo />
          <p className="mt-4 max-w-[16rem] text-sm leading-6 text-[#6b768e]">{copy.footer.tagline}</p>
          <div className="mt-5 flex items-center gap-3 text-[#8a93a8]">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="transition-colors hover:text-[#2f6bff]">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="transition-colors hover:text-[#2f6bff]">
              <Github className="h-4 w-4" />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="transition-colors hover:text-[#2f6bff]">
              <Youtube className="h-4 w-4" />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="transition-colors hover:text-[#2f6bff]">
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-3">
          <p className={colHeadClass}>{copy.footer.productCol}</p>
          <button type="button" onClick={onNavigateToProducts} className={linkClass}>
            {copy.landing.nav.explore}
          </button>
          <button type="button" onClick={onNavigateToCategories} className={linkClass}>
            {copy.landing.nav.categories}
          </button>
          <button type="button" onClick={onNavigateToContact} className={linkClass}>
            {copy.footer.submitTool}
          </button>
          <span className="text-sm font-medium text-[#b3bdce]">{copy.footer.apiSoon}</span>
        </div>

        <div className="grid gap-3">
          <p className={colHeadClass}>{copy.footer.resourcesCol}</p>
          <button type="button" onClick={onNavigateToDeals} className={linkClass}>
            {copy.footer.blog}
          </button>
          <button type="button" onClick={onNavigateToHelp} className={linkClass}>
            {copy.footer.guides}
          </button>
          <button type="button" onClick={onNavigateToNewArrivals} className={linkClass}>
            {copy.footer.aiNews}
          </button>
          <button type="button" onClick={() => openHref(`mailto:${site.supportEmail}`)} className={linkClass}>
            {copy.footer.newsletter}
          </button>
        </div>

        <div className="grid gap-3">
          <p className={colHeadClass}>{copy.footer.companyCol}</p>
          <button type="button" onClick={onNavigateToContact} className={linkClass}>
            {copy.footer.about}
          </button>
          <button type="button" onClick={onNavigateToContact} className={linkClass}>
            {copy.footer.contact}
          </button>
          <button type="button" onClick={onNavigateToPrivacy} className={linkClass}>
            {copy.footer.privacy}
          </button>
          <button type="button" onClick={onNavigateToTerms} className={linkClass}>
            {copy.footer.terms}
          </button>
        </div>
      </div>

      <div className="border-t border-[#eef2f8]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm text-[#8a93a8]">
            © {year} {site.brandName}. {copy.footer.copyright}
          </p>
          <p className="text-sm font-semibold text-[#2f6bff]">{copy.footer.brandLine}</p>
        </div>
      </div>
    </footer>
  );
});
