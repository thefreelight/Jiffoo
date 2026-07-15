import React from 'react';
import { ArrowRight, Globe2, Home, LayoutGrid, LifeBuoy, ReceiptText, ShieldCheck, Smartphone } from 'lucide-react';
import type { FooterProps } from 'shared/src/types/theme';
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

export const Footer = React.memo(function Footer({
  locale,
  config,
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
  const isZhHant = locale === 'zh-Hant';

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
              {isZhHant ? '全球 eSIM 基礎設施' : 'Global eSIM Infrastructure'}
            </div>

            <h2 className="mt-6 text-[clamp(2.4rem,4vw,4.4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-[var(--bokmoo-ink)]">
              {isZhHant ? '出發前完成旅遊連線設定，落地即可使用。' : 'Build your travel setup before departure, not after landing.'}
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]">
              {isZhHant ? '探索適用於各目的地的 eSIM 方案、即時啟用設定檔，並集中管理下一趟旅程。' : 'Explore destination-ready eSIM plans, activate profiles instantly, and manage your next trip from one premium control surface.'}
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
                {isZhHant ? '產品' : 'Product'}
              </div>
              <div className="grid gap-2 text-sm">
                <button onClick={onNavigateToProducts} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {isZhHant ? 'eSIM 方案' : 'eSIM Plans'}
                </button>
                <button onClick={onNavigateToCategories} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {isZhHant ? 'eUICC 卡' : 'eUICC Cards'}
                </button>
                <button onClick={onNavigateToHelp} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {isZhHant ? '使用方式' : 'How It Works'}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                <Smartphone className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                {isZhHant ? '公司' : 'Company'}
              </div>
              <div className="grid gap-2 text-sm">
                <button onClick={onNavigateToContact} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {isZhHant ? '支援' : 'Support'}
                </button>
                <button onClick={onNavigateToPrivacy} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {isZhHant ? '隱私權' : 'Privacy'}
                </button>
                <button onClick={onNavigateToTerms} className="rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]" type="button">
                  {isZhHant ? '服務條款' : 'Terms'}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                {isZhHant ? '聯絡我們' : 'Contact'}
              </p>
              <a
                href={`mailto:${site.supportEmail}`}
                className="text-sm text-[var(--bokmoo-ink)] underline decoration-[var(--bokmoo-line)] underline-offset-4"
              >
                {site.supportEmail}
              </a>
              <p className="mt-4 text-sm leading-7 text-[var(--bokmoo-copy)]">
                {isZhHant ? '全天候提供啟用、相容性與旅遊設定檔管理支援。' : '24/7 global support for activation, compatibility, and travel profile management.'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--bokmoo-line)] pt-6 text-sm text-[var(--bokmoo-copy)] sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {site.brandName.toUpperCase()}. {isZhHant ? '官方全球 eSIM 商店。' : 'Official global eSIM storefront.'}</p>
          <p>{isZhHant ? '無界連線、安全啟用與優質旅遊數據管理。' : 'Boundless connectivity, secure activation, and premium travel data management.'}</p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:oklch(0.07_0.01_75_/_0.96)] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-[420px] grid-cols-5 gap-1">
          {[
            { label: isZhHant ? '首頁' : 'Home', icon: Home, onClick: () => onNavigate?.('/') },
            { label: isZhHant ? '商店' : 'Store', icon: LayoutGrid, onClick: onNavigateToProducts },
            { label: isZhHant ? '訂單' : 'Orders', icon: ReceiptText, onClick: () => onNavigate?.('/orders') },
            { label: isZhHant ? '支援' : 'Support', icon: LifeBuoy, onClick: onNavigateToHelp },
            { label: isZhHant ? '選單' : 'Menu', icon: Smartphone, onClick: onNavigateToCategories },
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
