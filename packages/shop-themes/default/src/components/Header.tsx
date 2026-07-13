import React from 'react';
import { Menu, Moon, Search, ShoppingBag, Sun, User, X } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import { useTheme } from 'next-themes';
import type { HeaderProps } from '../../../../shared/src/types/theme';
import { resolveSiteConfig } from '../site';
import { ProductSiteHeader } from './ProductSiteHeader';

function StorefrontHeader({
  cartItemCount = 0,
  isAuthenticated = false,
  user,
  config,
  t,
  onNavigate,
  onSearch,
  onLogout,
  onNavigateToCart,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToHome,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const site = resolveSiteConfig(config);

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

  const navItems = [
    { label: getText('shop.nav.products', 'Products'), onClick: onNavigateToProducts },
    { label: getText('shop.nav.categories', 'Categories'), onClick: onNavigateToCategories },
    { label: getText('shop.nav.deals', 'Deals'), onClick: onNavigateToDeals },
    { label: getText('shop.nav.about', 'About'), onClick: () => onNavigate?.('/help') },
    { label: getText('shop.nav.contact', 'Contact'), onClick: () => onNavigate?.('/contact') },
  ];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    onSearch(query);
    setIsSearchOpen(false);
    setIsMenuOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const userLabel =
    user?.firstName || user?.lastName
      ? [user.firstName, user.lastName].filter(Boolean).join(' ')
      : user?.email || getText('shop.header.account', 'Account');

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-[1000] transition-all duration-300',
        isScrolled
          ? 'border-b border-blue-100/80 bg-white/88 shadow-[0_18px_50px_-36px_rgba(37,99,235,0.45)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88'
          : 'border-b border-transparent bg-white/72 backdrop-blur-md dark:bg-slate-950/72'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onNavigateToHome}
          className="flex min-w-0 items-center gap-3 text-left"
          aria-label={getText('shop.header.home', 'Go home')}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/25">
            {(site.brandName || 'J').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xl font-bold tracking-[-0.03em] text-slate-950 dark:text-white">
              {site.brandName}
            </span>
            <span className="hidden text-[0.66rem] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 sm:block">
              {getText('shop.header.storefront', 'Storefront')}
            </span>
          </span>
        </button>

        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="text-sm font-semibold text-slate-800 transition-colors hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <form
            onSubmit={submitSearch}
            className={cn(
              'hidden h-11 items-center overflow-hidden rounded-full border border-slate-200 bg-white/80 transition-all focus-within:border-blue-300 dark:border-slate-800 dark:bg-slate-900/80 md:flex',
              isSearchOpen ? 'w-56 pl-4 pr-2' : 'w-11 justify-center'
            )}
          >
            {isSearchOpen ? (
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={getText('shop.header.searchPlaceholder', 'Search products')}
                className="min-w-0 flex-1 border-0 p-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-white"
              />
            ) : null}
            <button
              type={isSearchOpen ? 'submit' : 'button'}
              onClick={() => {
                if (!isSearchOpen) setIsSearchOpen(true);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              aria-label={getText('shop.header.search', 'Search')}
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          {mounted ? (
            <button
              type="button"
              onClick={toggleTheme}
              className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/78 text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900/78 dark:text-slate-200 dark:hover:text-blue-400 sm:flex"
              aria-label={getText('shop.header.toggleTheme', 'Toggle theme')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onNavigateToCart}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/78 text-slate-800 transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900/78 dark:text-slate-100 dark:hover:text-blue-400"
            aria-label={getText('shop.header.cart', 'Cart')}
          >
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[0.62rem] font-bold text-white">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            ) : null}
          </button>

          {isAuthenticated ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((value) => !value)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
                aria-label={getText('shop.header.account', 'Account')}
              >
                <User className="h-4 w-4" />
              </button>
              {isUserMenuOpen ? (
                <div className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {userLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToProfile();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {getText('shop.header.profile', 'Profile')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {getText('shop.header.logout', 'Logout')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
              >
                {getText('shop.header.login', 'Login')}
              </button>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
              >
                {getText('shop.header.signUp', 'Sign Up')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/78 text-slate-800 dark:border-slate-800 dark:bg-slate-900/78 dark:text-slate-100 lg:hidden"
            aria-label={getText('shop.header.menu', 'Menu')}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-slate-100 bg-white px-4 py-4 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <form onSubmit={submitSearch} className="mb-4 flex h-11 items-center rounded-full border border-slate-200 px-4 dark:border-slate-800">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={getText('shop.header.searchPlaceholder', 'Search products')}
              className="min-w-0 flex-1 border-0 p-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-white"
            />
            <button type="submit" aria-label={getText('shop.header.search', 'Search')}>
              <Search className="h-4 w-4 text-slate-500" />
            </button>
          </form>

          <div className="grid gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                {item.label}
              </button>
            ))}
          </div>

          {!isAuthenticated ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100"
              >
                {getText('shop.header.login', 'Login')}
              </button>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              >
                {getText('shop.header.signUp', 'Sign Up')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export const Header = React.memo(function Header(props: HeaderProps) {
  const site = resolveSiteConfig(props.config);

  if (site.archetype !== 'storefront') {
    return <ProductSiteHeader {...props} />;
  }

  return <StorefrontHeader {...props} />;
});
