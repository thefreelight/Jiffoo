import React from 'react';
import { Menu, Moon, ShoppingCart, Sun, User, X } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import { useTheme } from 'next-themes';
import type { HeaderProps } from '../../../../shared/src/types/theme';
import { isExternalHref, resolveSiteConfig } from '../site';

export const Header = React.memo(function Header({
  cartItemCount = 0,
  isAuthenticated = false,
  config,
  t,
  onNavigate,
  onNavigateToCart,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onLogout,
  onNavigateToHome,
  onNavigateToProducts,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const site = resolveSiteConfig(config);
  const showCart = site.archetype !== 'product-site' || cartItemCount > 0;

  React.useEffect(() => {
    setMounted(true);
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const navItems = [
    {
      label: getText('shop.nav.install', 'Install'),
      onClick: () => openHref(site.primaryCtaHref),
    },
    {
      label: getText('shop.nav.docs', 'Docs'),
      onClick: () => openHref(site.docsHref),
    },
    {
      label: getText('shop.nav.products', 'Products'),
      onClick: onNavigateToProducts,
    },
    {
      label: getText('shop.nav.help', 'Guide'),
      onClick: () => onNavigate?.('/help'),
    },
  ];

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-[1000] transition-all duration-300',
        'border-b border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)]',
        'bg-[color:color-mix(in_oklab,oklch(0.985_0.012_84)_84%,white)] backdrop-blur-xl',
        isScrolled && 'shadow-[0_12px_40px_-28px_rgba(28,32,48,0.35)]'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[4.6rem] sm:px-6 lg:px-10">
        <button
          onClick={onNavigateToHome}
          className="flex items-center gap-3 text-left"
          aria-label={getText('shop.header.home', 'Go home')}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_14%,transparent)] bg-[oklch(0.24_0.03_255)] text-[oklch(0.97_0.01_84)]">
            <span className="text-sm font-black tracking-[0.26em]">J</span>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="text-base font-black tracking-[-0.04em] text-[oklch(0.22_0.03_255)]">
              {site.brandName}
            </div>
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[oklch(0.47_0.04_245)]">
              {site.archetype.replace('-', ' ')}
            </div>
          </div>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="rounded-full px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[oklch(0.37_0.03_248)] transition-colors hover:bg-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_4%,transparent)] hover:text-[oklch(0.22_0.03_255)]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[color:color-mix(in_oklab,oklch(0.985_0.012_84)_76%,white)] p-1 sm:flex">
            {mounted ? (
              <button
                onClick={toggleTheme}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[oklch(0.34_0.03_250)] transition-colors hover:bg-[oklch(0.22_0.03_255)] hover:text-[oklch(0.97_0.01_84)]"
                aria-label={getText('shop.header.toggleTheme', 'Toggle theme')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            ) : null}

            {showCart ? (
              <button
                onClick={onNavigateToCart}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[oklch(0.34_0.03_250)] transition-colors hover:bg-[oklch(0.22_0.03_255)] hover:text-[oklch(0.97_0.01_84)]"
                aria-label={getText('shop.header.cart', 'Cart')}
              >
                <ShoppingCart className="h-4 w-4" />
                {cartItemCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[oklch(0.6_0.17_37)] px-1 text-[0.62rem] font-bold text-white">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                ) : null}
              </button>
            ) : null}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen((value) => !value)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    isUserMenuOpen
                      ? 'bg-[oklch(0.22_0.03_255)] text-[oklch(0.97_0.01_84)]'
                      : 'text-[oklch(0.34_0.03_250)] hover:bg-[oklch(0.22_0.03_255)] hover:text-[oklch(0.97_0.01_84)]'
                  )}
                >
                  <User className="h-4 w-4" />
                </button>
                {isUserMenuOpen ? (
                  <div className="absolute right-0 top-full mt-2 min-w-[14rem] border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[oklch(0.985_0.012_84)] p-2 shadow-[0_16px_40px_-24px_rgba(28,32,48,0.35)]">
                    <button
                      onClick={() => {
                        onNavigateToProfile();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full rounded-full px-4 py-2 text-left text-sm font-semibold text-[oklch(0.3_0.03_250)] transition-colors hover:bg-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_4%,transparent)]"
                    >
                      {getText('shop.header.profile', 'Profile')}
                    </button>
                    <button
                      onClick={() => {
                        onLogout();
                        setIsUserMenuOpen(false);
                      }}
                      className="mt-1 w-full rounded-full px-4 py-2 text-left text-sm font-semibold text-[oklch(0.3_0.03_250)] transition-colors hover:bg-[color:color-mix(in_oklab,oklch(0.6_0.17_37)_10%,transparent)]"
                    >
                      {getText('shop.header.logout', 'Logout')}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  onClick={onNavigateToLogin}
                  className="rounded-full px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[oklch(0.34_0.03_250)] transition-colors hover:bg-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_4%,transparent)]"
                >
                  {getText('shop.header.login', 'Login')}
                </button>
                <button
                  onClick={onNavigateToRegister}
                  className="rounded-full bg-[oklch(0.22_0.03_255)] px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[oklch(0.97_0.01_84)] transition-transform duration-300 hover:-translate-y-0.5"
                >
                  {getText('shop.header.signUp', 'Create account')}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] text-[oklch(0.34_0.03_250)] lg:hidden"
            aria-label={getText('shop.header.menu', 'Menu')}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[oklch(0.985_0.012_84)] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className="rounded-full px-4 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[oklch(0.32_0.03_250)] transition-colors hover:bg-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_4%,transparent)]"
              >
                {item.label}
              </button>
            ))}

            {!isAuthenticated ? (
              <div className="mt-2 grid gap-2">
                <button
                  onClick={onNavigateToLogin}
                  className="rounded-full border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[oklch(0.32_0.03_250)]"
                >
                  {getText('shop.header.login', 'Login')}
                </button>
                <button
                  onClick={onNavigateToRegister}
                  className="rounded-full bg-[oklch(0.22_0.03_255)] px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[oklch(0.97_0.01_84)]"
                >
                  {getText('shop.header.signUp', 'Create account')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
});
