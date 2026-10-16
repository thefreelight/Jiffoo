import React from 'react';
import { ChevronDown, Globe2, Menu, ShoppingBag, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { isExternalHref,pickCopy, resolveBokmooSiteConfig } from '../site';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

function BokmooLogoMark() {
  return (
    <svg
      className="h-7 w-[4.7rem] shrink-0 drop-shadow-[0_10px_22px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-8 sm:w-[5.35rem] xl:h-9 xl:w-24"
      viewBox="0 38 134 50"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bokmoo-mark-gold" x1="4" y1="43" x2="126" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F4CD63" />
          <stop offset="0.52" stopColor="var(--bokmoo-gold)" />
          <stop offset="1" stopColor="#C99B3E" />
        </linearGradient>
      </defs>
      <path
        d="M1 85C1 61.25 17.65 42 38.2 42C58.75 42 75.4 61.25 75.4 85H57.3C57.3 72.85 48.75 63 38.2 63C27.65 63 19.1 72.85 19.1 85H1Z"
        fill="url(#bokmoo-mark-gold)"
      />
      <path
        d="M56.2 85C56.2 61.25 73.35 42 94.5 42C115.65 42 132.8 61.25 132.8 85H114.2C114.2 72.85 105.38 63 94.5 63C83.62 63 74.8 72.85 74.8 85H56.2Z"
        fill="url(#bokmoo-mark-gold)"
      />
      <path
        d="M27.3 85C27.3 78.08 32.18 72.48 38.2 72.48C44.22 72.48 49.1 78.08 49.1 85H27.3Z"
        fill="url(#bokmoo-mark-gold)"
      />
      <path
        d="M83.25 85C83.25 78.08 88.29 72.48 94.5 72.48C100.71 72.48 105.75 78.08 105.75 85H83.25Z"
        fill="url(#bokmoo-mark-gold)"
      />
    </svg>
  );
}

export const Header = React.memo(function Header({
  locale,
  isAuthenticated,
  user,
  cartItemCount,
  config,
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

  const LOCALE_OPTIONS: Array<{ value: 'en' | 'zh-Hans' | 'zh-Hant'; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'zh-Hans', label: '简体中文' },
    { value: 'zh-Hant', label: '繁體中文' },
  ];
  const [isLocaleOpen, setIsLocaleOpen] = React.useState(false);
  const currentLocaleLabel = LOCALE_OPTIONS.find((option) => option.value === locale)?.label ?? 'English';
  const switchLocale = (next: 'en' | 'zh-Hans' | 'zh-Hant') => {
    if (next === locale) {
      setIsLocaleOpen(false);
      return;
    }
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    const path = window.location.pathname;
    const rest = path.replace(/^\/(en|zh-Hans|zh-Hant)(?=\/|$)/, '');
    setIsLocaleOpen(false);
    window.location.href = `/${next}${rest === '/' ? '' : rest}`;
  };
  const site = resolveBokmooSiteConfig(config);
  const mobileMenuId = 'bokmoo-mobile-menu';
  const accountInitial = ((user?.firstName || user?.email || 'B').trim().charAt(0) || 'B').toUpperCase();

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

  const navItems = [
    { label: pickCopy(locale, { en: 'Store', hans: '商店', hant: '商店' }), onClick: onNavigateToProducts },
    { label: pickCopy(locale, { en: 'Coverage', hans: '服务范围', hant: '服務範圍' }), onClick: onNavigateToProducts },
    { label: pickCopy(locale, { en: 'How It Works', hans: '使用方式', hant: '使用方式' }), onClick: () => openHref('/#how-it-works') },
    { label: pickCopy(locale, { en: 'About Us', hans: '关于我们', hant: '關於我們' }), onClick: () => openHref('/contact') },
    { label: pickCopy(locale, { en: 'Support', hans: '支援', hant: '支援' }), onClick: () => openHref('/help') },
    { label: pickCopy(locale, { en: 'Affiliate', hans: '推广', hant: '推廣' }), onClick: () => openHref('/affiliate') },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[radial-gradient(circle_at_8%_-24%,color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent),transparent_34%),linear-gradient(180deg,oklch(0.055_0.007_75_/_0.98),oklch(0.028_0.004_75_/_0.96))] shadow-[0_18px_52px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[107rem] items-center gap-3 px-4 py-2.5 sm:px-6 xl:min-h-[4.35rem] xl:gap-5 xl:px-0">
        <button
          onClick={onNavigateToHome}
          className={`group flex shrink-0 items-center gap-2.5 rounded-[0.95rem] text-left sm:gap-3 ${FOCUS_VISIBLE_RING}`}
          type="button"
          aria-label={`${site.brandName} home`}
        >
          <BokmooLogoMark />
          <span className="text-[0.98rem] font-bold tracking-[0.16em] text-[var(--bokmoo-ink)] drop-shadow-[0_0_14px_color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] sm:text-[1.08rem] xl:text-[1.18rem] xl:tracking-[0.18em]">
            {site.brandName.toUpperCase()}
          </span>
        </button>

        <nav className="ml-8 hidden items-center gap-8 xl:flex 2xl:ml-14 2xl:gap-10">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                setIsMenuOpen(false);
              }}
              className={`group relative rounded-[0.75rem] px-1 py-2.5 text-[0.95rem] font-medium tracking-[-0.01em] text-[color:color-mix(in_oklab,var(--bokmoo-copy)_88%,white)] transition-colors duration-300 hover:text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
              type="button"
            >
              <span className="absolute inset-x-0 bottom-1 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,var(--bokmoo-gold),transparent)] transition-transform duration-300 group-hover:scale-x-100" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 xl:flex">
          <div className="relative">
            <button
              onClick={() => setIsLocaleOpen((open) => !open)}
              className={`inline-flex min-h-[2.75rem] items-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.012))] px-4 text-sm text-[var(--bokmoo-copy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent)] hover:text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
              type="button"
            >
              <Globe2 className="h-4 w-4 text-[var(--bokmoo-gold)]" />
              {currentLocaleLabel}
              <ChevronDown className="h-4 w-4" />
            </button>
            {isLocaleOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,black)] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
                {LOCALE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => switchLocale(option.value)}
                    className={`flex w-full items-center justify-between rounded-[0.6rem] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] ${option.value === locale ? 'font-semibold text-[var(--bokmoo-gold)]' : 'text-[var(--bokmoo-copy)]'}`}
                    type="button"
                  >
                    {option.label}
                    {option.value === locale && <span className="text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAuthenticated ? (
            <button
              onClick={onNavigateToProfile}
              className={`inline-flex min-h-[2.75rem] items-center gap-2.5 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.16))] pl-1.5 pr-4 text-sm font-semibold text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_54%,transparent)] ${FOCUS_VISIBLE_RING}`}
              type="button"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_86%,white),color-mix(in_oklab,var(--bokmoo-gold)_66%,black))] text-[0.8rem] font-bold text-[var(--bokmoo-bg)]">
                {accountInitial}
              </span>
              {pickCopy(locale, { en: 'My Account', hans: '我的帐户', hant: '我的帳戶' })}
              <ChevronDown className="h-4 w-4 text-[var(--bokmoo-copy-soft)]" />
            </button>
          ) : (
            <>
              <button
                onClick={onNavigateToLogin}
                className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] px-5 text-sm font-medium text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
                type="button"
              >
                {pickCopy(locale, { en: 'Log In', hans: '登入', hant: '登入' })}
              </button>
              <button
                onClick={onNavigateToRegister}
                className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_46%,white)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-6 text-sm font-bold tracking-[0.01em] text-[var(--bokmoo-bg)] shadow-[0_14px_30px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),inset_0_1px_0_rgba(255,255,255,0.34)] transition-transform duration-300 hover:-translate-y-0.5 ${FOCUS_VISIBLE_RING}`}
                type="button"
              >
                {pickCopy(locale, { en: 'Get Started', hans: '立即开始', hant: '立即開始' })}
              </button>
            </>
          )}

          <button
            onClick={onNavigateToCart}
            className={`relative inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.18))] text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
            aria-label={pickCopy(locale, { en: 'Open cart', hans: '开启购物车', hant: '開啟購物車' })}
            type="button"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--bokmoo-gold)] px-1 text-[10px] font-bold text-[var(--bokmoo-bg)]">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            ) : null}
          </button>
        </div>

        <button
          onClick={() => setIsMenuOpen((value) => !value)}
          className={`ml-auto flex h-11 w-11 items-center justify-center rounded-[0.8rem] border border-[var(--bokmoo-line)] text-[var(--bokmoo-ink)] xl:hidden ${FOCUS_VISIBLE_RING}`}
          aria-controls={mobileMenuId}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? (pickCopy(locale, { en: 'Close menu', hans: '关闭选单', hant: '關閉選單' })) : pickCopy(locale, { en: 'Open menu', hans: '开启选单', hant: '開啟選單' })}
          type="button"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen ? (
        <div id={mobileMenuId} className="border-t border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-4 xl:hidden">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className={`rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
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
              className={`rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
              type="button"
            >
              {pickCopy(locale, { en: 'Cart', hans: '购物车', hant: '購物車' })}
            </button>

            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    onNavigateToProfile();
                    setIsMenuOpen(false);
                  }}
                  className={`rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                    {pickCopy(locale, { en: 'My Account', hans: '我的帐户', hant: '我的帳戶' })}
                  </button>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsMenuOpen(false);
                    }}
                  className={`rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-copy)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {pickCopy(locale, { en: 'Log Out', hans: '登出', hant: '登出' })}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onNavigateToLogin();
                    setIsMenuOpen(false);
                  }}
                  className={`rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {pickCopy(locale, { en: 'Log In', hans: '登入', hant: '登入' })}
                </button>
                <button
                  onClick={() => {
                    onNavigateToRegister();
                    setIsMenuOpen(false);
                  }}
                  className={`rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-4 py-3 text-left text-sm font-semibold text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {pickCopy(locale, { en: 'Get Started', hans: '立即开始', hant: '立即開始' })}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});
