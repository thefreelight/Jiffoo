import React, { useEffect, useState } from 'react';
import { ChevronDown, Menu, ShoppingBag, UserRound, X } from 'lucide-react';
import type { HeaderProps } from '../types';
import { cn } from '../lib/utils';
import { themeText } from '../lib/i18n';

interface EsimMallHeaderProps extends HeaderProps {
  variant?: 'transparent' | 'solid';
}

const storefrontNavItems = [
  { label: 'Destinations', path: '/products' },
  { label: 'eSIM Plans', path: '/products' },
  { label: 'How it works', path: '/help' },
  { label: 'For business', path: '/contact' },
  { label: 'Help', path: '/help' },
];
const appDownloadNavItems = [
  { label: 'Features', path: '#features' },
  { label: 'Security', path: '#security' },
  { label: 'Download', path: '#download' },
];
const defaultEasyEuiccDownloadUrl = 'https://easyeuicc.cc/downloads/EasyEUICC-v1.6.2.apk';

export const Header = React.memo(function Header({
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
  locale,
  t,
  variant = 'solid',
}: EsimMallHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const brandName = config?.brand?.name?.trim() || 'Yevbi';
  const isAppDownload = config?.site?.archetype === 'app-download' || brandName.toLowerCase() === 'easyeuicc';
  const navItems = isAppDownload ? appDownloadNavItems : storefrontNavItems;
  const localizedNavItems = navItems.map((item) => ({
    ...item,
    label: themeText(t, locale, ({ Features: 'nav.features', Security: 'nav.security', Download: 'nav.download', Destinations: 'nav.destinations', 'eSIM Plans': 'nav.esimPlans', 'How it works': 'nav.howItWorks', 'For business': 'nav.forBusiness', Help: 'nav.help' } as Record<string, string>)[item.label] || item.label, item.label),
  }));
  const downloadUrl = config?.site?.androidDownloadUrl || config?.site?.primaryCtaHref || defaultEasyEuiccDownloadUrl;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 18);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const go = (path: string) => {
    if (path.startsWith('#')) {
      document.querySelector(path)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMenuOpen(false);
      return;
    }
    onNavigate?.(path);
    setIsMenuOpen(false);
  };

  const closeAndRun = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  const transparent = variant === 'transparent' && !isScrolled;

  return (
    <header className="fixed inset-x-0 top-0 z-50 hidden px-4 py-4 transition duration-300 md:block sm:px-6 lg:px-8">
      <div
        className={cn(
          'mx-auto flex max-w-[var(--esim-container)] items-center justify-between rounded-full border px-4 py-3 transition duration-300 lg:px-5',
          transparent
            ? 'border-white/80 bg-white/74 shadow-[0_10px_34px_rgb(15_55_110_/_0.06)] backdrop-blur-2xl'
            : 'border-[var(--esim-line)] bg-white/94 shadow-[0_14px_44px_rgb(15_55_110_/_0.10)] backdrop-blur-2xl',
        )}
      >
        <button type="button" onClick={() => closeAndRun(onNavigateToHome)} className="flex items-center gap-3" aria-label={themeText(t, locale, 'nav.home', `${brandName} home`)}>
          {config?.brand?.logoUrl ? (
            <img src={config.brand.logoUrl} alt={brandName} className="h-10 w-10 rounded-2xl object-cover" />
          ) : (
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[var(--esim-primary)] text-sm font-black text-white shadow-[0_12px_24px_rgb(21_107_255_/_0.24)]">
              <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white/22" />
              <span className="relative">{isAppDownload ? 'E' : 'Y'}</span>
            </span>
          )}
          <span className="text-xl font-black tracking-[-0.055em] text-[var(--esim-primary)]">{brandName}</span>
        </button>

        <nav className="hidden items-center gap-8 text-sm font-extrabold text-[var(--esim-ink-soft)] lg:flex">
          {localizedNavItems.map((item) => (
            <button key={item.label} type="button" onClick={() => go(item.path)} className="transition hover:text-[var(--esim-primary)]">
              {item.label}
            </button>
          ))}
        </nav>

        {isAppDownload ? (
          <div className="hidden items-center gap-3 lg:flex">
            <LanguageLinks currentLocale={locale} />
            <a href={downloadUrl} className="esim-button-primary px-5 py-2">
              {themeText(t, locale, 'common.downloadApk', 'Download APK')}
            </a>
          </div>
        ) : (
        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1 rounded-full border border-[var(--esim-line)] bg-[var(--esim-surface-cool)] px-4 text-sm font-extrabold text-[var(--esim-ink)]"
            aria-label={themeText(t, locale, 'header.currencyUsd', 'Currency USD')}
          >
            USD
            <ChevronDown className="h-4 w-4 text-[var(--esim-muted)]" />
          </button>

          {cartItemCount > 0 ? (
            <button
              type="button"
              onClick={() => closeAndRun(onNavigateToCart)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--esim-line)] text-[var(--esim-ink)] transition hover:border-[var(--esim-primary)] hover:text-[var(--esim-primary)]"
              aria-label={themeText(t, locale, 'travelpass.cart.title', 'Cart')}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--esim-primary)] px-1 text-[10px] font-black text-white">
                {cartItemCount}
              </span>
            </button>
          ) : null}

          {isAuthenticated ? (
            <>
              <button type="button" onClick={() => closeAndRun(onNavigateToProfile)} className="esim-button-secondary px-4 py-2">
                <UserRound className="h-4 w-4" />
                {user?.firstName || themeText(t, locale, 'account.title', 'Account')}
              </button>
              <button type="button" onClick={() => closeAndRun(onLogout)} className="esim-button-primary px-5 py-2">
                {themeText(t, locale, 'account.logout', 'Sign out')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => closeAndRun(onNavigateToLogin)} className="px-2 text-sm font-extrabold text-[var(--esim-ink-soft)] transition hover:text-[var(--esim-primary)]">
                {themeText(t, locale, 'auth.signIn', 'Login')}
              </button>
              <button type="button" onClick={() => closeAndRun(onNavigateToRegister)} className="esim-button-primary px-5 py-2">
                {themeText(t, locale, 'auth.signUp', 'Sign up')}
              </button>
            </>
          )}
        </div>
        )}

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--esim-line)] text-[var(--esim-ink)] lg:hidden"
          aria-label={themeText(t, locale, 'nav.menu', 'Menu')}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className="mx-auto mt-3 max-w-[var(--esim-container)] rounded-[2rem] border border-[var(--esim-line)] bg-white p-4 text-[var(--esim-ink)] shadow-[var(--esim-shadow-tight)] lg:hidden">
          {isAppDownload ? null : (
          <div className="mb-2 flex items-center justify-between rounded-2xl bg-[var(--esim-surface-cool)] px-4 py-3 text-sm font-extrabold">
            <span>{themeText(t, locale, 'header.currency', 'Currency')}</span>
            <span className="text-[var(--esim-primary)]">{themeText(t, locale, 'header.usd', 'USD')}</span>
          </div>
          )}
          {localizedNavItems.map((item) => (
            <button key={item.label} type="button" onClick={() => go(item.path)} className="block w-full rounded-2xl px-4 py-3 text-left font-extrabold hover:bg-[var(--esim-surface-cool)]">
              {item.label}
            </button>
          ))}
          {cartItemCount > 0 ? (
            <button type="button" onClick={() => closeAndRun(onNavigateToCart)} className="block w-full rounded-2xl px-4 py-3 text-left font-extrabold hover:bg-[var(--esim-surface-cool)]">
              Cart ({cartItemCount})
            </button>
          ) : null}
          {isAppDownload ? (
            <div className="mt-3 grid gap-2">
              <LanguageLinks currentLocale={locale} />
              <a href={downloadUrl} className="esim-button-primary w-full px-5 py-3">
                {themeText(t, locale, 'common.downloadApk', 'Download APK')}
              </a>
            </div>
          ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {isAuthenticated ? (
              <>
                <button type="button" onClick={() => closeAndRun(onNavigateToProfile)} className="esim-button-secondary w-full px-5 py-3">
                  Account
                </button>
                <button type="button" onClick={() => closeAndRun(onLogout)} className="esim-button-primary w-full px-5 py-3">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => closeAndRun(onNavigateToLogin)} className="esim-button-secondary w-full px-5 py-3">
                  Login
                </button>
                <button type="button" onClick={() => closeAndRun(onNavigateToRegister)} className="esim-button-primary w-full px-5 py-3">
                  Sign up
                </button>
              </>
            )}
          </div>
          )}
        </div>
      ) : null}
    </header>
  );
});

function LanguageLinks({ currentLocale }: { currentLocale?: HeaderProps['locale'] }) {
  const locales = [
    { code: 'en', label: 'EN' },
    { code: 'zh-Hans', label: '简' },
    { code: 'zh-Hant', label: '繁' },
  ] as const;
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  const query = typeof window === 'undefined' ? '' : window.location.search;
  const pathWithoutLocale = pathname.replace(/^\/(?:en|zh-Hans|zh-Hant)(?=\/|$)/, '') || '/';

  return (
    <nav aria-label="Language" className="flex items-center gap-1 text-xs font-black text-[var(--esim-ink-soft)]">
      {locales.map((item) => (
        <a key={item.code} href={`/${item.code}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}${query}`} aria-current={item.code === currentLocale ? 'page' : undefined} className={item.code === currentLocale ? 'text-[var(--esim-primary)]' : 'hover:text-[var(--esim-primary)]'}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export default Header;
