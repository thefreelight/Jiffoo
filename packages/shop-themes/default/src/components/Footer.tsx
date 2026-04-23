import React from 'react';
import { ArrowRight, Command, LifeBuoy, Mail, Orbit, ShoppingBag } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { FooterProps } from '../../../../shared/src/types/theme';
import { isExternalHref, resolveSiteConfig } from '../site';

export const Footer = React.memo(function Footer({
  config,
  platformBranding,
  t,
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
  const site = resolveSiteConfig(config);
  const currentYear = new Date().getFullYear();
  const showPoweredBy = platformBranding?.showPoweredByJiffoo !== false;

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

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

  const launchLinks = [
    {
      label: getText('shop.footer.launch.install', 'Install'),
      value: site.primaryCtaLabel,
      onClick: () => openHref(site.primaryCtaHref),
    },
    {
      label: getText('shop.footer.launch.docs', 'Docs'),
      value: getText('shop.footer.launch.docsValue', 'Read the setup guide'),
      onClick: () => openHref(site.docsHref),
    },
    {
      label: getText('shop.footer.launch.demo', 'Demo'),
      value: getText('shop.footer.launch.demoValue', 'Explore the live storefront'),
      onClick: () => openHref(site.demoHref),
    },
  ];

  const commerceLinks = [
    {
      label: getText('shop.footer.commerce.products', 'Products'),
      onClick: onNavigateToProducts,
    },
    {
      label: getText('shop.footer.commerce.categories', 'Categories'),
      onClick: onNavigateToCategories,
    },
    {
      label: getText('shop.footer.commerce.newArrivals', 'New arrivals'),
      onClick: onNavigateToNewArrivals,
    },
    {
      label: getText('shop.footer.commerce.bestsellers', 'Bestsellers'),
      onClick: onNavigateToBestsellers,
    },
    {
      label: getText('shop.footer.commerce.deals', 'Deals'),
      onClick: onNavigateToDeals,
    },
  ];

  const supportLinks = [
    {
      label: getText('shop.footer.support.help', 'Help'),
      onClick: onNavigateToHelp,
    },
    {
      label: getText('shop.footer.support.contact', 'Contact'),
      onClick: onNavigateToContact,
    },
    {
      label: getText('shop.footer.support.privacy', 'Privacy'),
      onClick: onNavigateToPrivacy,
    },
    {
      label: getText('shop.footer.support.terms', 'Terms'),
      onClick: onNavigateToTerms,
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[linear-gradient(180deg,oklch(0.975_0.012_84),oklch(0.948_0.015_84))] px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.93_0.04_65),transparent_24%),radial-gradient(circle_at_bottom_right,oklch(0.93_0.05_190),transparent_24%)] opacity-80" />

      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-3 border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[color:color-mix(in_oklab,oklch(0.985_0.012_84)_90%,white)] px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[oklch(0.46_0.04_245)]">
            <Orbit className="h-3.5 w-3.5 text-[oklch(0.56_0.09_170)]" />
            {site.archetype.replace('-', ' ')}
          </div>

          <h2 className="mt-6 max-w-4xl text-[clamp(2.5rem,4vw,4.8rem)] font-black leading-[0.94] tracking-[-0.06em] text-[oklch(0.22_0.03_255)]">
            {getText(
              'shop.footer.title',
              `${site.brandName} now ships as a launch-ready SaaS, product-site, and commerce starter.`
            )}
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[oklch(0.35_0.03_248)]">
            {getText(
              'shop.footer.body',
              'Use the same base theme to explain the product, install the stack, open docs, and route buyers into the catalog. The template is intentionally useful beyond one storefront.'
            )}
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => openHref(site.primaryCtaHref)}
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[oklch(0.24_0.03_255)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-[oklch(0.98_0.01_84)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              {site.primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openHref(site.docsHref)}
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_16%,transparent)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-[oklch(0.3_0.03_248)] transition-colors duration-300 hover:bg-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_4%,transparent)]"
            >
              {getText('shop.footer.cta.docs', 'Open docs')}
            </button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
            <div className="border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[oklch(0.25_0.03_255)] p-5 text-[oklch(0.95_0.01_84)]">
              <div className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[oklch(0.78_0.02_235)]">
                <Command className="h-4 w-4" />
                {getText('shop.footer.command.label', 'Installer command')}
              </div>
              <div className="mt-4 overflow-x-auto text-sm leading-7">
                <code>{site.installCommand}</code>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.href = `mailto:${site.supportEmail}`}
              className="group border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[color:color-mix(in_oklab,oklch(0.985_0.012_84)_90%,white)] p-5 text-left transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[oklch(0.47_0.04_245)]">
                <Mail className="h-4 w-4 text-[oklch(0.56_0.09_170)]" />
                {getText('shop.footer.contact.label', 'Need a rollout hand?')}
              </div>
              <p className="mt-4 text-lg font-bold tracking-[-0.03em] text-[oklch(0.23_0.03_255)]">
                {site.supportEmail}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[oklch(0.33_0.04_245)]">
                {getText('shop.footer.contact.action', 'Email the team')}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[oklch(0.47_0.04_245)]">
              <Command className="h-4 w-4 text-[oklch(0.56_0.09_170)]" />
              {getText('shop.footer.columns.launch', 'Launch')}
            </div>
            <div className="grid gap-3">
              {launchLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="group text-left"
                >
                  <p className="text-sm font-semibold text-[oklch(0.23_0.03_255)] transition-colors group-hover:text-[oklch(0.56_0.09_170)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[oklch(0.37_0.03_248)]">{item.value}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[oklch(0.47_0.04_245)]">
              <ShoppingBag className="h-4 w-4 text-[oklch(0.56_0.09_170)]" />
              {getText('shop.footer.columns.commerce', 'Commerce')}
            </div>
            <div className="grid gap-2">
              {commerceLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'text-left text-sm leading-6 text-[oklch(0.37_0.03_248)] transition-colors',
                    'hover:text-[oklch(0.23_0.03_255)]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[oklch(0.47_0.04_245)]">
              <LifeBuoy className="h-4 w-4 text-[oklch(0.56_0.09_170)]" />
              {getText('shop.footer.columns.support', 'Support')}
            </div>
            <div className="grid gap-2">
              {supportLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'text-left text-sm leading-6 text-[oklch(0.37_0.03_248)] transition-colors',
                    'hover:text-[oklch(0.23_0.03_255)]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-12 max-w-7xl border-t border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] pt-6">
        <div className="flex flex-col gap-3 text-sm text-[oklch(0.39_0.03_248)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t
              ? t('shop.footer.copyright', { year: String(currentYear), brand: site.brandName })
              : `© ${currentYear} ${site.brandName}. All rights reserved.`
            }
          </p>
          {showPoweredBy ? (
            <a
              href={platformBranding?.poweredByHref || 'https://jiffoo.com'}
              target="_blank"
              rel="noreferrer"
              className="font-semibold transition-colors hover:text-[oklch(0.23_0.03_255)]"
            >
              {platformBranding?.poweredByLabel || 'Powered by Jiffoo'}
            </a>
          ) : (
            <p className="max-w-2xl">
              {getText(
                'shop.footer.note',
                'Built as a reusable default for storefronts, launch pages, and SaaS sites that need commerce close by.'
              )}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
});
