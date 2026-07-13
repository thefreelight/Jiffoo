import React from 'react';
import { ArrowRight, Mail, ShieldCheck, ShoppingBag } from 'lucide-react';
import type { FooterProps } from '../../../../shared/src/types/theme';
import { isExternalHref, resolveSiteConfig } from '../site';
import { ProductSiteFooter } from './ProductSiteFooter';

function StorefrontFooter({
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
  const showPoweredByJiffoo = platformBranding?.showPoweredByJiffoo !== false;

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const openHref = React.useCallback(
    (href?: string | null) => {
      if (!href) return;
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      onNavigate?.(href);
    },
    [onNavigate]
  );

  const shopLinks = [
    { label: getText('shop.nav.products', 'Products'), onClick: onNavigateToProducts },
    { label: getText('shop.nav.categories', 'Categories'), onClick: onNavigateToCategories },
    { label: getText('shop.nav.newArrivals', 'New Arrivals'), onClick: onNavigateToNewArrivals },
    { label: getText('shop.nav.bestsellers', 'Bestsellers'), onClick: onNavigateToBestsellers },
  ];

  const companyLinks = [
    { label: getText('shop.nav.contact', 'Contact'), onClick: onNavigateToContact },
    { label: getText('shop.nav.help', 'Help'), onClick: onNavigateToHelp },
    { label: getText('shop.footer.commerce.deals', 'Deals'), onClick: onNavigateToDeals },
  ];

  const supportLinks = [
    { label: getText('shop.footer.support.privacy', 'Privacy'), onClick: onNavigateToPrivacy },
    { label: getText('shop.footer.support.terms', 'Terms'), onClick: onNavigateToTerms },
    { label: getText('shop.footer.support.help', 'Help Center'), onClick: onNavigateToHelp },
  ];

  return (
    <footer className="border-t border-slate-100 bg-white px-4 py-12 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1.4fr] lg:items-start">
          <div>
            <button
              type="button"
              onClick={onNavigateToProducts}
              className="inline-flex items-center gap-4 text-left"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/25">
                {(site.brandName || 'J').charAt(0).toUpperCase()}
              </span>
              <span>
                <span className="block text-2xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {site.brandName}
                </span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">
                  {getText('shop.footer.storefrontTagline', 'Quality products for a better lifestyle.')}
                </span>
              </span>
            </button>

            <div className="mt-7 grid max-w-lg gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl bg-blue-50/70 p-4 dark:bg-blue-950/30">
                <ShoppingBag className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-slate-950 dark:text-white">
                    {getText('shop.home.features.shipping.title', 'Free Shipping')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {getText('shop.home.features.shipping.subtitle', 'On orders over $100')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-slate-950 dark:text-white">
                    {getText('shop.home.features.secure.title', 'Secure Payment')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {getText('shop.home.features.secure.subtitle', '100% secure checkout')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {[
              { title: getText('shop.footer.columns.commerce', 'Shop'), links: shopLinks },
              { title: getText('shop.footer.columns.company', 'Company'), links: companyLinks },
              { title: getText('shop.footer.columns.support', 'Support'), links: supportLinks },
            ].map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">{group.title}</h3>
                <div className="mt-4 grid gap-2">
                  {group.links.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className="text-left text-sm text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-100 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t
              ? t('shop.footer.copyright', { year: String(currentYear), brand: site.brandName })
              : `© ${currentYear} ${site.brandName}. All rights reserved.`
            }
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.href = `mailto:${site.supportEmail}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:text-slate-200 dark:hover:text-blue-400"
            >
              <Mail className="h-4 w-4" />
              {site.supportEmail}
            </button>
            {showPoweredByJiffoo ? (
              <button
                type="button"
                onClick={() => openHref(platformBranding?.poweredByHref || 'https://jiffoo.com')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              >
                {getText('shop.footer.poweredBy', 'Powered by')} {platformBranding?.poweredByLabel || 'Jiffoo'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}

export const Footer = React.memo(function Footer(props: FooterProps) {
  const site = resolveSiteConfig(props.config);

  if (site.archetype !== 'storefront') {
    return <ProductSiteFooter {...props} />;
  }

  return <StorefrontFooter {...props} />;
});
