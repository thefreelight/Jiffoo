import React from 'react';
import { ChevronDown, Globe2, Menu, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { pickCopy } from '../site';
import { OPEN_MOBILE_MENU_EVENT } from '../lib/mobile-menu';

/* Official BOKMOO logomark (750x82 full lockup, gold #e2c26a) — keep inline so
   the storefront has zero remote brand dependencies. */
function BokmooLogoLockup({ className }: { className?: string }) {
  return (
    <svg
      aria-label="BOKMOO"
      className={className}
      role="img"
      viewBox="0 0 750 82"
      xmlns="http://www.w3.org/2000/svg"
    >
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

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

export const Header = React.memo(function Header({
  locale,
  isAuthenticated,
  user,
  cartItemCount,
  onNavigate,
  onLogout,
  onNavigateToCart,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToHome,
  onNavigateToProducts,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const mobileMenuId = 'bokmoo-mobile-menu';
  // The footer's mobile "Menu" tab asks the header to open this same panel.
  React.useEffect(() => {
    const openMenu = () => setIsMenuOpen(true);
    window.addEventListener(OPEN_MOBILE_MENU_EVENT, openMenu);
    return () => window.removeEventListener(OPEN_MOBILE_MENU_EVENT, openMenu);
  }, []);
  const accountInitial = ((user?.firstName || user?.email || 'B').trim().charAt(0) || 'B').toUpperCase();
  // Desktop account menu (My Account / Log Out)
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const accountMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHrefSafe(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      onNavigate?.(href);
    },
    [onNavigate]
  );

  const LOCALE_OPTIONS: Array<{ value: 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'fr' | 'de'; label: string; short: string }> = [
    { value: 'en', label: 'English (US)', short: 'EN' },
    { value: 'zh-Hans', label: '简体中文', short: '简' },
    { value: 'zh-Hant', label: '繁體中文', short: '繁' },
    { value: 'ja', label: '日本語', short: '日本語' },
    { value: 'ko', label: '한국어', short: '한국어' },
    { value: 'fr', label: 'Français', short: 'FR' },
    { value: 'de', label: 'Deutsch', short: 'DE' },
  ];
  const [isLocaleOpen, setIsLocaleOpen] = React.useState(false);
  const currentLocale = LOCALE_OPTIONS.find((option) => option.value === locale) ?? LOCALE_OPTIONS[0];
  const switchLocale = (next: 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'fr' | 'de') => {
    if (next === locale) {
      setIsLocaleOpen(false);
      return;
    }
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    const path = window.location.pathname;
    const rest = path.replace(/^\/(en|zh-Hans|zh-Hant|ja|ko|fr|de)(?=\/|$)/, '');
    setIsLocaleOpen(false);
    window.location.href = `/${next}${rest === '/' ? '' : rest}`;
  };

  const navItems = [
    { label: pickCopy(locale, { en: 'Products', hans: '产品', hant: '產品', ja: '製品', ko: '제품', fr: 'Produits', de: 'Produkte' }), onClick: onNavigateToProducts },
    { label: pickCopy(locale, { en: 'eSIM', hans: 'eSIM', hant: 'eSIM', ja: 'eSIM', ko: 'eSIM', fr: 'eSIM', de: 'eSIM' }), onClick: () => openHref('https://esim.bokmoo.com') },
    { label: pickCopy(locale, { en: 'Download App', hans: '下载 App', hant: '下載 App', ja: 'アプリをダウンロード', ko: '앱 다운로드', fr: 'Télécharger l’app', de: 'App herunterladen' }), onClick: () => openHref('/download/app') },
    { label: pickCopy(locale, { en: 'Support', hans: '支持', hant: '支援', ja: 'サポート', ko: '지원', fr: 'Assistance', de: 'Support' }), onClick: () => openHref('/help') },
    { label: pickCopy(locale, { en: 'Affiliate Program', hans: '联盟计划', hant: '聯盟計劃', ja: 'アフィリエイト', ko: '제휴 프로그램', fr: 'Affiliation', de: 'Partnerprogramm' }), onClick: () => openHref('/affiliate') },
  ];

  return (
    <header className="w-full border-b border-white/5 backdrop-blur-md sticky top-0 z-50 bg-[#0B0B0D]/80">
      <div className="bokmoo-header-bar w-full max-w-7xl mx-auto h-20 flex items-center justify-between flex-nowrap overflow-visible">
        <a
          className={`flex items-center gap-3 shrink-0 group py-1 select-none ${FOCUS_VISIBLE_RING}`}
          data-purpose="brand-logo"
          href="#read"
          onClick={(event) => {
            event.preventDefault();
            onNavigateToHome();
          }}
        >
          <BokmooLogoLockup className="bokmoo-header-logo w-auto fill-[#e2c26a] drop-shadow-[0_1px_4px_rgba(212,175,55,0.35)] shrink-0" />
        </a>

        <nav className="bokmoo-header-nav items-center flex-nowrap shrink-0 text-sm tracking-wide text-neutral-300 font-medium whitespace-nowrap">
          {navItems.map((item) => (
            <a
              key={item.label}
              className={`hover:text-[#E5C365] transition-colors whitespace-nowrap ${FOCUS_VISIBLE_RING}`}
              href="#"
              onClick={(event) => {
                event.preventDefault();
                item.onClick();
                setIsMenuOpen(false);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="bokmoo-header-actions flex items-center shrink-0 flex-nowrap">
          <div className="relative group" data-purpose="language-selector">
            <button
              aria-expanded={isLocaleOpen}
              aria-haspopup="true"
              aria-label={pickCopy(locale, { en: 'Language', hans: '语言', hant: '語言', ja: '言語', ko: '언어', fr: 'Langue', de: 'Sprache' })}
              className={`text-xs md:text-sm font-medium text-neutral-300 hover:text-[#E5C365] transition-all px-2.5 md:px-3 py-1.5 flex items-center gap-1.5 rounded-full border border-white/10 hover:border-[#E5C365]/40 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md cursor-pointer select-none whitespace-nowrap ${FOCUS_VISIBLE_RING}`}
              onClick={() => setIsLocaleOpen((open) => !open)}
              type="button"
            >
              <Globe2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#E5C365] shrink-0" />
              <span className="bokmoo-header-locale-label tracking-wide">{currentLocale.short}</span>
              <ChevronDown className={`bokmoo-header-locale-chevron w-3 h-3 text-neutral-400 group-hover:text-[#E5C365] transition-transform duration-200 ${isLocaleOpen ? 'rotate-180' : ''}`} />
            </button>
            {isLocaleOpen ? (
              <div className="absolute right-0 top-full mt-2 w-36 py-1.5 rounded-xl bg-[#17171c]/95 border border-neutral-700/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 flex flex-col">
                {LOCALE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${option.value === locale ? 'text-[#E5C365] bg-[#E5C365]/10 hover:bg-[#E5C365]/15' : 'text-neutral-300 hover:text-[#E5C365] hover:bg-white/[0.04]'}`}
                    onClick={() => switchLocale(option.value)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    {option.value === locale ? (
                      <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {isAuthenticated ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                onClick={() => setAccountMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label={pickCopy(locale, { en: 'My Account', hans: '我的帐户', hant: '我的帳戶', ja: 'マイアカウント', ko: '내 계정', fr: 'Mon compte', de: 'Mein Konto' })}
                className={`bokmoo-header-signin items-center gap-2 rounded-full border border-[rgba(212,175,55,0.3)] bg-white/[0.03] pl-1 pr-3 py-1 text-sm font-medium text-[var(--bokmoo-ink)] transition-colors hover:border-[#E5C365]/50 ${FOCUS_VISIBLE_RING}`}
                type="button"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5C365] text-[0.72rem] font-bold text-[#0d0d0d]">
                  {accountInitial}
                </span>
                <span className="bokmoo-header-signin-label">
                  {pickCopy(locale, { en: 'My Account', hans: '我的帐户', hant: '我的帳戶', ja: 'マイアカウント', ko: '내 계정', fr: 'Mon compte', de: 'Mein Konto' })}
                </span>
                <ChevronDown className={`bokmoo-header-account-chevron h-3.5 w-3.5 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {accountMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-48 overflow-hidden rounded-[0.9rem] border border-white/10 bg-[#141414] shadow-[0_18px_42px_rgba(0,0,0,0.55)]"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      onNavigateToProfile();
                      setAccountMenuOpen(false);
                    }}
                    className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-[var(--bokmoo-ink)] hover:bg-white/[0.05]"
                    type="button"
                  >
                    {pickCopy(locale, { en: 'My Account', hans: '我的帐户', hant: '我的帳戶', ja: 'マイアカウント', ko: '내 계정', fr: 'Mon compte', de: 'Mein Konto' })}
                  </button>
                  <div className="h-px bg-white/10" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      onLogout();
                      setAccountMenuOpen(false);
                    }}
                    className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--bokmoo-copy)] hover:bg-white/[0.05]"
                    type="button"
                  >
                    {pickCopy(locale, { en: 'Log Out', hans: '登出', hant: '登出', ja: 'ログアウト', ko: '로그아웃', fr: 'Se déconnecter', de: 'Abmelden' })}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <a
              className={`bokmoo-header-signin text-xs md:text-sm font-medium text-neutral-300 hover:text-[#E5C365] transition-colors px-2 md:px-3 py-1.5 items-center gap-1.5 rounded-full hover:bg-white/[0.04] whitespace-nowrap ${FOCUS_VISIBLE_RING}`}
              href="#login"
              onClick={(event) => {
                event.preventDefault();
                onNavigateToLogin();
              }}
              title={pickCopy(locale, { en: 'Sign In / Manage My Cards', hans: '登入 / 管理我的卡片', hant: '登入 / 管理我的卡片', ja: 'サインイン・カード管理', ko: '로그인 · 카드 관리', fr: 'Connexion / Gérer mes cartes', de: 'Anmelden / Karten verwalten' })}
            >
              <svg className="w-4 h-4 text-neutral-400 transition-colors shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="bokmoo-header-signin-label">{pickCopy(locale, { en: 'Sign In', hans: '登入', hant: '登入', ja: 'サインイン', ko: '로그인', fr: 'Connexion', de: 'Anmelden' })}</span>
            </a>
          )}

          <button
            aria-label={pickCopy(locale, { en: 'Shopping Cart', hans: '购物车', hant: '購物車', ja: 'カートを開く', ko: '장바구니 열기', fr: 'Ouvrir le panier', de: 'Warenkorb öffnen' })}
            className={`relative p-2 text-neutral-300 hover:text-[#E5C365] hover:bg-white/[0.04] rounded-full transition-all flex items-center justify-center shrink-0 ${FOCUS_VISIBLE_RING}`}
            onClick={onNavigateToCart}
            type="button"
          >
            <svg className="w-4 h-4 stroke-[1.8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {cartItemCount > 0 ? (
              <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-[#E5C365] shadow-[0_0_6px_rgba(229,195,101,0.6)] text-[9px] font-bold leading-4 text-[#0B0B0D] text-center cart-pulse">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            ) : (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E5C365] shadow-[0_0_6px_rgba(229,195,101,0.6)]" />
            )}
          </button>

          <a
            className={`px-4 md:px-5 py-2 rounded-full bg-[#E5C365] hover:bg-[#F3D482] text-[#111113] text-xs md:text-sm font-semibold transition-all shadow-[0_2px_12px_rgba(229,195,101,0.25)] hover:shadow-[0_4px_16px_rgba(229,195,101,0.4)] bokmoo-header-cta items-center gap-1.5 shrink-0 whitespace-nowrap ${FOCUS_VISIBLE_RING}`}
            href="https://bokmoo.com/products"
            onClick={(event) => {
              if (!window.location.host.includes('bokmoo.com')) {
                event.preventDefault();
                onNavigate?.('/products');
              }
            }}
          >
            <span>{pickCopy(locale, { en: 'Get BOKMOO', hans: '获取 BOKMOO', hant: '獲取 BOKMOO', ja: 'BOKMOOを入手', ko: 'BOKMOO 받기', fr: 'Obtenir BOKMOO', de: 'BOKMOO holen' })}</span>
            <svg className="w-3.5 h-3.5 stroke-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <button
          onClick={() => setIsMenuOpen((value) => !value)}
          className={`bokmoo-header-burger h-11 items-center justify-center rounded-[0.8rem] border border-white/10 text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
          aria-controls={mobileMenuId}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? pickCopy(locale, { en: 'Close menu', hans: '关闭选单', hant: '關閉選單', ja: 'メニューを閉じる', ko: '메뉴 닫기', fr: 'Fermer le menu', de: 'Menü schließen' }) : pickCopy(locale, { en: 'Open menu', hans: '开启选单', hant: '開啟選單', ja: 'メニューを開く', ko: '메뉴 열기', fr: 'Ouvrir le menu', de: 'Menü öffnen' })}
          type="button"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen ? (
        <div id={mobileMenuId} className="bokmoo-header-menu border-t border-white/5 bg-[#0B0B0D]/95 backdrop-blur-md px-4 py-4">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className={`rounded-[0.9rem] border border-white/10 bg-[#141414] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
                type="button"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                onNavigateToCart();
                setIsMenuOpen(false);
              }}
              className={`rounded-[0.9rem] border border-white/10 bg-[#141414] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
              type="button"
            >
              {pickCopy(locale, { en: 'Cart', hans: '购物车', hant: '購物車', ja: 'カート', ko: '장바구니', fr: 'Panier', de: 'Warenkorb' })}
            </button>
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    onNavigateToProfile();
                    setIsMenuOpen(false);
                  }}
                  className={`rounded-[0.9rem] border border-white/10 bg-[#141414] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {pickCopy(locale, { en: 'My Account', hans: '我的帐户', hant: '我的帳戶', ja: 'マイアカウント', ko: '내 계정', fr: 'Mon compte', de: 'Mein Konto' })}
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className={`rounded-[0.9rem] border border-white/10 bg-[#141414] px-4 py-3 text-left text-sm text-[var(--bokmoo-copy)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {pickCopy(locale, { en: 'Log Out', hans: '登出', hant: '登出', ja: 'ログアウト', ko: '로그아웃', fr: 'Se déconnecter', de: 'Abmelden' })}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onNavigateToLogin();
                    setIsMenuOpen(false);
                  }}
                  className={`rounded-[0.9rem] border border-white/10 bg-[#141414] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {pickCopy(locale, { en: 'Sign In', hans: '登入', hant: '登入', ja: 'サインイン', ko: '로그인', fr: 'Connexion', de: 'Anmelden' })}
                </button>
                <button
                  onClick={() => {
                    onNavigateToRegister();
                    setIsMenuOpen(false);
                  }}
                  className={`rounded-[0.9rem] bg-[#E5C365] px-4 py-3 text-left text-sm font-semibold text-[#0d0d0d] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {pickCopy(locale, { en: 'Get Started', hans: '立即开始', hant: '立即開始', ja: 'はじめる', ko: '시작하기', fr: 'Commencer', de: 'Los geht es' })}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});

function isExternalHrefSafe(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
