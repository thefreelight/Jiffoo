import React from 'react';
import { ArrowRight, Globe2, Home, LayoutGrid, LifeBuoy, ReceiptText, ShieldCheck, Smartphone } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { isExternalHref,pickCopy, resolveBokmooSiteConfig } from '../site';

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

  return (
    <footer className="border-t border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_72%,black),var(--bokmoo-bg))] px-4 pb-28 pt-14 sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-9 rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_84%,black)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
              <ShieldCheck className="h-4 w-4" />
              {pickCopy(locale, { en: 'Global eSIM Infrastructure', hans: '全球 eSIM 基础设施', hant: '全球 eSIM 基礎設施' })}
            </div>

            <h2 className="mt-6 text-[clamp(2.4rem,4vw,4.4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-[var(--bokmoo-ink)]">
              {pickCopy(locale, { en: 'Build your travel setup before departure, not after landing.', hans: '出发前完成旅游连线设定，落地即可使用。', hant: '出發前完成旅遊連線設定，落地即可使用。' })}
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]">
              {pickCopy(locale, { en: 'Explore destination-ready eSIM plans, activate profiles instantly, and manage your next trip from one premium control surface.', hans: '探索适用于各目的地的 eSIM 方案、即时启用设定档，并集中管理下一趟旅程。', hant: '探索適用於各目的地的 eSIM 方案、即時啟用設定檔，並集中管理下一趟旅程。' })}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => openHref(site.primaryCtaHref)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]"
                type="button"
              >
                {site.primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => openHref(site.secondaryCtaHref)}
                className="inline-flex min-h-12 items-center justify-center rounded-[0.9rem] border border-[var(--bokmoo-line)] px-6 text-sm font-medium text-[var(--bokmoo-ink)]"
                type="button"
              >
                {site.secondaryCtaLabel}
              </button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                <Globe2 className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                {pickCopy(locale, { en: 'Product', hans: '产品', hant: '產品' })}
              </div>
              <div className="grid gap-2 text-sm">
                <button onClick={onNavigateToProducts} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {pickCopy(locale, { en: 'eSIM Plans', hans: 'eSIM 方案', hant: 'eSIM 方案' })}
                </button>
                <button onClick={onNavigateToCategories} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {pickCopy(locale, { en: 'eUICC Cards', hans: 'eUICC 卡', hant: 'eUICC 卡' })}
                </button>
                <button onClick={onNavigateToHelp} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {pickCopy(locale, { en: 'How It Works', hans: '使用方式', hant: '使用方式' })}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                <Smartphone className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                {pickCopy(locale, { en: 'Company', hans: '公司', hant: '公司' })}
              </div>
              <div className="grid gap-2 text-sm">
                <button onClick={onNavigateToContact} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {pickCopy(locale, { en: 'Support', hans: '支援', hant: '支援' })}
                </button>
                <button onClick={onNavigateToPrivacy} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {pickCopy(locale, { en: 'Privacy', hans: '隐私权', hant: '隱私權' })}
                </button>
                <button onClick={onNavigateToTerms} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {pickCopy(locale, { en: 'Terms', hans: '服务条款', hant: '服務條款' })}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                {pickCopy(locale, { en: 'Contact', hans: '联络我们', hant: '聯絡我們' })}
              </p>
              <a
                href={`mailto:${site.supportEmail}`}
                className="text-sm text-[var(--bokmoo-ink)] underline decoration-[var(--bokmoo-line)] underline-offset-4"
              >
                {site.supportEmail}
              </a>
              <p className="mt-4 text-sm leading-7 text-[var(--bokmoo-copy)]">
                {pickCopy(locale, { en: '24/7 global support for activation, compatibility, and travel profile management.', hans: '全天候提供启用、相容性与旅游设定档管理支援。', hant: '全天候提供啟用、相容性與旅遊設定檔管理支援。' })}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--bokmoo-line)] pt-6 text-sm text-[var(--bokmoo-copy)] sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {site.brandName.toUpperCase()}. {pickCopy(locale, { en: 'Official global eSIM storefront.', hans: '官方全球 eSIM 商店。', hant: '官方全球 eSIM 商店。' })}</p>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p>{pickCopy(locale, { en: 'Boundless connectivity, secure activation, and premium travel data management.', hans: '无界连线、安全启用与优质旅游数据管理。', hant: '無界連線、安全啟用與優質旅遊數據管理。' })}</p>
            {showPoweredByJiffoo ? (
              <a
                href={poweredByHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)] transition-colors hover:text-[var(--bokmoo-gold)]"
              >
                Powered by {poweredByLabel}
                <ArrowRight className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:oklch(0.07_0.01_75_/_0.96)] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:hidden">
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
              className="flex flex-col items-center justify-center gap-1 rounded-[0.85rem] border border-transparent px-2 py-2 text-[11px] text-[var(--bokmoo-copy-soft)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent)] hover:text-[var(--bokmoo-gold)]"
              type="button"
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
});
