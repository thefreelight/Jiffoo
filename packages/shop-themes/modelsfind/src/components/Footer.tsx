import React from 'react';
import { Compass, Mail, ShieldCheck, Sparkles, UserRound, WandSparkles } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { isExternalHref, resolveModelsfindSiteConfig } from '../site';

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
  const site = resolveModelsfindSiteConfig(config);
  const year = new Date().getFullYear();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const normalizedPathname = pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/|$)/, '') || '/';
  const hideAllFooterChrome =
    pathname !== '' &&
    /^\/auth(?:\/.*)?$/.test(normalizedPathname);
  const hideMobileChrome =
    pathname !== '' &&
    [
      /^\/checkout(?:\/.*)?$/,
      /^\/products\/[^/]+$/,
    ].some((pattern) => pattern.test(normalizedPathname));

  const openHref = React.useCallback(
    (href: string) => {
      if (href.startsWith('mailto:')) {
        window.open(href, '_self');
        return;
      }

      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }

      onNavigate?.(href);
    },
    [onNavigate]
  );

  if (hideAllFooterChrome) {
    return null;
  }

  if (hideMobileChrome) {
    return (
      <footer className="hidden border-t border-[var(--modelsfind-line)] bg-[rgba(4,4,8,0.96)] px-4 pb-28 pt-10 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 md:block lg:px-8">
        <div className="mx-auto max-w-[1560px]">
          <div className="flex flex-col gap-8 border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-8 md:rounded-[2rem] lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[26rem]">
              <p className="[font-family:var(--modelsfind-display)] text-[2rem] italic tracking-[-0.04em] text-[var(--modelsfind-primary)]">
                {site.brandName}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                Curated model discovery with private booking cues, AI-assisted filtering, and an editorial shell designed for premium operators.
              </p>
            </div>

            <div className="grid gap-6 text-[11px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] sm:grid-cols-2 lg:text-right">
              <div className="grid gap-3">
                <button type="button" onClick={onNavigateToProducts} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                  Explore
                </button>
                <button type="button" onClick={onNavigateToCategories} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                  Regions
                </button>
                <button type="button" onClick={onNavigateToDeals} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                  Services
                </button>
              </div>

              <div className="grid gap-3">
                <button type="button" onClick={onNavigateToHelp} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                  Help
                </button>
                <button type="button" onClick={onNavigateToPrivacy} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                  Privacy
                </button>
                <button type="button" onClick={onNavigateToTerms} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                  Terms
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--modelsfind-line)] bg-[rgba(4,4,8,0.96)] px-4 pb-28 pt-10 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 lg:px-8">
      <div className="mx-auto hidden max-w-[1560px] md:block">
        <div className="flex flex-col gap-8 border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-8 md:rounded-[2rem] lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[26rem]">
            <p className="[font-family:var(--modelsfind-display)] text-[2rem] italic tracking-[-0.04em] text-[var(--modelsfind-primary)]">
              {site.brandName}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
              Curated model discovery with private booking cues, AI-assisted filtering, and an editorial shell designed for premium operators.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-3 py-2">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                Private access
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-3 py-2">
                <WandSparkles className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                AI concierge
              </span>
            </div>
          </div>

          <div className="grid gap-6 text-[11px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] sm:grid-cols-2 lg:text-right">
            <div className="grid gap-3">
              <button type="button" onClick={onNavigateToProducts} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Explore
              </button>
              <button type="button" onClick={onNavigateToCategories} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Regions
              </button>
              <button type="button" onClick={onNavigateToDeals} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Services
              </button>
              <button type="button" onClick={onNavigateToNewArrivals} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                New arrivals
              </button>
              <button type="button" onClick={onNavigateToBestsellers} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Editor picks
              </button>
            </div>

            <div className="grid gap-3">
              <button type="button" onClick={onNavigateToHelp} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Help
              </button>
              <button type="button" onClick={onNavigateToPrivacy} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Privacy
              </button>
              <button type="button" onClick={onNavigateToTerms} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Terms
              </button>
              <button type="button" onClick={onNavigateToContact} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                Contact
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {year} {site.brandName}. Private booking archive.
            </span>
            <button
              type="button"
              onClick={() => openHref(`mailto:${site.supportEmail}`)}
              className="inline-flex items-center gap-2 transition-colors hover:text-[var(--modelsfind-ink)]"
            >
              <Mail className="h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
              {site.supportEmail}
            </button>
          </div>

          <span>Private operator surface</span>
        </div>
      </div>

      <nav className="modelsfind-mobile-nav fixed bottom-0 left-0 right-0 z-[120] grid grid-cols-4 gap-1 rounded-t-[1.9rem] border-t border-[var(--modelsfind-line)] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] pt-3 md:hidden">
        {[
          {
            label: 'Explore',
            mobileLabel: 'Explore',
            icon: Sparkles,
            action: onNavigateToProducts,
            active: normalizedPathname === '/' || normalizedPathname.startsWith('/products') || normalizedPathname.startsWith('/checkout'),
          },
          {
            label: 'Regions',
            mobileLabel: 'Regions',
            icon: Compass,
            action: onNavigateToCategories,
            active: normalizedPathname.startsWith('/categories'),
          },
          {
            label: 'AI Concierge',
            mobileLabel: 'Concierge',
            icon: WandSparkles,
            action: () => openHref(site.docsHref),
            active: normalizedPathname.startsWith('/help') || normalizedPathname.startsWith('/contact'),
          },
          {
            label: 'Profile',
            mobileLabel: 'Profile',
            icon: UserRound,
            action: () => onNavigate?.('/profile'),
            active: normalizedPathname.startsWith('/profile'),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className={[
                'flex min-w-0 flex-col items-center gap-1 px-1 text-center transition-all duration-300',
                item.active
                  ? 'scale-[1.02] text-[var(--modelsfind-primary)] drop-shadow-[0_0_10px_rgba(255,122,251,0.45)]'
                  : 'text-[var(--modelsfind-copy-soft)]',
              ].join(' ')}
            >
              <Icon className={item.active ? 'h-4 w-4' : 'h-4 w-4 opacity-80'} />
              <span className="block max-w-full truncate text-[8px] uppercase tracking-[0.08em]">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </footer>
  );
});
