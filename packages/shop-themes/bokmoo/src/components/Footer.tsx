import React from 'react';
import { Home, LayoutGrid, LifeBuoy, ReceiptText, Smartphone } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { pickCopy, resolveBokmooSiteConfig } from '../site';
import { SupportChat } from './SupportChat';

/* Official BOKMOO logomark (750x82 full lockup, gold #e2c26a). */
function BokmooLogoLockup({ className }: { className?: string }) {
  return (
    <svg aria-label="BOKMOO" className={className} role="img" viewBox="0 0 750 82" xmlns="http://www.w3.org/2000/svg">
      <g fill="#e2c26a">
        <g transform="translate(0 0) scale(.08) translate(-49.42 -140.06)">
          <path d="M909.71,140.06c-475.11,0-860.29,385.18-860.29,860.67,0,36.3,2.32,71.8,6.95,106.93h404.86c-8.48-34.36-12.72-70.26-12.72-106.93,0-254.71,206.87-461.2,461.2-461.2,255.13,0,461.6,206.49,461.6,461.2,0,36.67-4.24,72.57-12.74,106.93h405.25c4.64-35.13,6.95-70.63,6.95-106.93,0-475.49-385.56-860.67-861.06-860.67Z" />
          <path d="M1166.39,1000.73c0,38.22-8.12,74.5-23.56,106.93h-465.84c-15.43-32.43-23.54-68.71-23.54-106.93,0-141.64,114.62-256.66,256.66-256.66,141.64,0,256.28,115.01,256.28,256.66Z" />
          <path d="M2497.53,1000.73c0,38.22-8.1,74.5-23.54,106.93h-466.23c-15.43-32.43-23.56-68.71-23.56-106.93,0-141.64,115.03-256.66,256.67-256.66,141.64,0,256.66,115.01,256.66,256.66Z" />
          <path d="M2232,140.06c-231.19,0-441.53,91.48-595.91,240.07,93.77,109.6,162.86,240.45,199.53,384.41,80.66-135.08,227.71-225.01,396.37-225.01,254.73,0,461.2,206.49,461.2,461.2,0,36.67-4.24,72.57-12.74,106.93h405.25c4.64-35.13,6.95-70.63,6.95-106.93,0-475.49-385.18-860.67-860.67-860.67Z" />
        </g>
        <g transform="translate(270 15) scale(.9) translate(-42.62 -30)">
          <path d="M42.62,83.03V31.56h25.19c6.36,0,11.78,1.44,16.27,4.31,4.49,2.9,6.73,6.38,6.73,10.43,0,3.62-1.82,6.8-5.44,9.53,3.1,1.36,5.53,3.12,7.29,5.25,1.87,2.18,2.8,4.52,2.8,7.01,0,4.13-2.28,7.64-6.84,10.54-4.53,2.92-9.99,4.39-16.38,4.39h-29.62ZM54.8,53.25h13.01c2.99,0,5.53-.68,7.63-2.05,2.13-1.35,3.2-2.97,3.2-4.89,0-1.92-1.07-3.55-3.2-4.89-2.1-1.37-4.63-2.05-7.63-2.05h-13.01s0,13.88,0,13.88ZM54.8,75.22h17.45c3.03,0,5.63-.7,7.8-2.09,2.13-1.39,3.19-3.06,3.19-5.03,0-1.94-1.06-3.59-3.19-4.96-2.17-1.39-4.77-2.09-7.8-2.09h-17.45s0,14.17,0,14.17Z" />
          <path d="M112.91,75.83c-8-5.13-12.01-11.31-12.01-18.56,0-7.24,4-13.42,12.01-18.55,8-5.14,17.65-7.7,28.95-7.7,11.29,0,20.94,2.56,28.95,7.7,8,5.13,12.01,11.31,12.01,18.55,0,7.24-4,13.43-12.01,18.56-8,5.14-17.65,7.7-28.95,7.7-11.3,0-20.95-2.56-28.95-7.7ZM121.56,44.26c-5.61,3.59-8.42,7.93-8.42,13.01,0,5.09,2.8,9.43,8.42,13.02,5.61,3.59,12.38,5.39,20.31,5.39,7.93,0,14.7-1.8,20.3-5.39,5.61-3.59,8.42-7.93,8.42-13.02s-2.8-9.42-8.42-13.01c-5.61-3.59-12.38-5.39-20.3-5.39-7.93,0-14.7,1.8-20.31,5.39Z" />
          <path d="M248.62,31.56l-32.09,25.6,33.21,25.86h-15.82s-25.19-19.64-25.19-19.64l-3.76,2.99v16.65h-12.17V31.56h12.17v22.33s28.05-22.33,28.05-22.33h15.6Z" />
          <path d="M342.42,31.56v51.46h-12.18v-32.69s-22.32,32.69-22.32,32.69h-13.75s-21.93-32.48-21.93-32.48v32.48h-12.18V31.56h12.74s28.27,42.01,28.27,42.01l28.61-42.01h12.74Z" />
          <path d="M363.74,75.83c-8-5.13-12.01-11.31-12.01-18.56,0-7.24,4-13.42,12.01-18.55,8-5.14,17.65-7.7,28.95-7.7,11.29,0,20.94,2.56,28.95,7.7,8,5.13,12.01,11.31,12.01,18.55,0,7.24-4,13.43-12.01,18.56-8,5.14-17.65,7.7-28.95,7.7-11.3,0-20.95-2.56-28.95-7.7ZM372.38,44.26c-5.61,3.59-8.42,7.93-8.42,13.01s2.8,9.43,8.42,13.02c5.61,3.59,12.38,5.39,20.31,5.39,7.93,0,14.7-1.8,20.3-5.39,5.61-3.59,8.42-7.93,8.42-13.02,0-5.08-2.8-9.42-8.42-13.01-5.61-3.59-12.38-5.39-20.3-5.39-7.93,0-14.7,1.8-20.31,5.39Z" />
          <path d="M450.81,75.83c-8-5.13-12.01-11.31-12.01-18.56,0-7.24,4-13.42,12.01-18.55,8-5.14,17.65-7.7,28.95-7.7,11.29,0,20.94,2.56,28.95,7.7,8,5.13,12.01,11.31,12.01,18.55,0,7.24-4,13.43-12.01,18.56-8,5.14-17.65,7.7-28.95,7.7-11.3,0-20.95-2.56-28.95-7.7ZM459.45,44.26c-5.61,3.59-8.42,7.93-8.42,13.01,0,5.09,2.8,9.43,8.42,13.02,5.61,3.59,12.38,5.39,20.31,5.39,7.93,0,14.7-1.8,20.3-5.39,5.61-3.59,8.42-7.93,8.42-13.02,0-5.08-2.8-9.42-8.42-13.01-5.61-3.59-12.38-5.39-20.3-5.39-7.93,0-14.7,1.8-20.31,5.39Z" />
        </g>
      </g>
    </svg>
  );
}

export const Footer = React.memo(function Footer({
  locale,
  config,
  platformBranding,
  onNavigate,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToHelp,
  onNavigateToContact,
  onNavigateToPrivacy,
  onNavigateToTerms,
}: FooterProps) {
  const site = resolveBokmooSiteConfig(config);
  const year = new Date().getFullYear();
  const showPoweredByJiffoo = platformBranding?.showPoweredByJiffoo !== false;
  const poweredByHref = platformBranding?.poweredByHref || 'https://jiffoo.com';
  const poweredByLabel = platformBranding?.poweredByLabel || 'Jiffoo';

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

  const footerLinks = [
    { label: pickCopy(locale, { en: 'Products', hans: '产品', hant: '產品', ja: '製品', ko: '제품', fr: 'Produits', de: 'Produkte' }), onClick: onNavigateToProducts },
    { label: pickCopy(locale, { en: 'Support', hans: '支持', hant: '支援', ja: 'サポート', ko: '지원', fr: 'Assistance', de: 'Support' }), onClick: onNavigateToHelp },
    { label: pickCopy(locale, { en: 'Terms', hans: '条款', hant: '條款', ja: '利用規約', ko: '이용약관', fr: 'Conditions d’utilisation', de: 'AGB' }), onClick: onNavigateToTerms },
    { label: pickCopy(locale, { en: 'Privacy', hans: '隐私', hant: '隱私', ja: 'プライバシー', ko: '개인정보', fr: 'Confidentialité', de: 'Datenschutz' }), onClick: onNavigateToPrivacy },
  ];

  return (
    <footer className="border-t border-neutral-900 bg-[#08080A] py-12 mt-12" data-purpose="site-footer">
      <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <BokmooLogoLockup className="h-6 w-auto fill-[#e2c26a] drop-shadow-[0_1px_4px_rgba(212,175,55,0.35)] shrink-0" />
          </div>
        </div>
        {/* Footer Navigation Links */}
        <div className="flex items-center gap-8 text-xs sm:text-sm text-neutral-400">
          <nav className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <a
                className="hover:text-[#E5C365] transition-colors cursor-pointer"
                onClick={(event) => {
                  event.preventDefault();
                  link.onClick?.();
                }}
                href="#"
                key={link.label}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <span className="text-neutral-500">
            © {year} {site.brandName.toUpperCase()}. All rights reserved.
          </span>
        </div>
      </div>

      {/* Powered by (platform branding contract) */}
      {showPoweredByJiffoo ? (
        <div className="mx-auto mt-4 max-w-6xl px-6 text-center md:text-left">
          <a
            href={poweredByHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)] transition-colors hover:text-[#E5C365]"
          >
            Powered by {poweredByLabel}
          </a>
        </div>
      ) : null}

      {/* Mobile bottom navigation (theme feature) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(255,255,255,0.08)] bg-[#0B0B0D]/95 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-[420px] grid-cols-5 gap-1">
          {[
            { label: pickCopy(locale, { en: 'Home', hans: '首页', hant: '首頁' }), icon: Home, onClick: () => onNavigate?.('/') },
            { label: pickCopy(locale, { en: 'Store', hans: '商店', hant: '商店' }), icon: LayoutGrid, onClick: onNavigateToProducts },
            { label: pickCopy(locale, { en: 'Orders', hans: '订单', hant: '訂單' }), icon: ReceiptText, onClick: () => onNavigate?.('/orders') },
            { label: pickCopy(locale, { en: 'Support', hans: '支援', hant: '支援' }), icon: LifeBuoy, onClick: onNavigateToHelp },
            { label: pickCopy(locale, { en: 'Menu', hans: '选单', hant: '選單' }), icon: Smartphone, onClick: onNavigateToCategories },
          ].map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center justify-center gap-1 rounded-[0.85rem] border border-transparent px-2 py-2 text-[11px] text-[var(--bokmoo-copy-soft)] transition-colors hover:border-[rgba(212,175,55,0.18)] hover:bg-[rgba(212,175,55,0.08)] hover:text-[#E5C365]"
              type="button"
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <SupportChat locale={locale} />
    </footer>
  );
});

function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
