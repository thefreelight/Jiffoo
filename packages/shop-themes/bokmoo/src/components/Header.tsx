import React from 'react';
import { Globe2, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

export const Header = React.memo(function Header({
  isAuthenticated,
  user,
  cartItemCount,
  config,
  onSearch,
  onNavigate,
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
  const [query, setQuery] = React.useState('');
  const site = resolveBokmooSiteConfig(config);

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
    { label: 'All Plans', onClick: onNavigateToProducts },
    { label: 'Destinations', onClick: onNavigateToCategories },
    { label: 'Travel Deals', onClick: onNavigateToDeals },
    { label: 'How It Works', onClick: () => onNavigate?.('/help') },
  ];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--bokmoo-line)] bg-[color:oklch(0.18_0.008_90_/_0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button onClick={onNavigateToHome} className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line-strong)] bg-[linear-gradient(145deg,var(--bokmoo-bg-soft),var(--bokmoo-bg))] text-[var(--bokmoo-gold)] shadow-[var(--bokmoo-shadow)] transition-transform duration-300 group-hover:-translate-y-0.5">
            <span className="text-sm font-black tracking-[0.18em]">BM</span>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--bokmoo-ink)]">
              {site.brandName}
            </div>
            <div className="text-[11px] text-[var(--bokmoo-copy-soft)]">
              Premium travel connectivity
            </div>
          </div>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="rounded-full px-4 py-2 text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--bokmoo-copy)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] hover:text-[var(--bokmoo-ink)]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="hidden flex-1 items-center justify-end lg:flex">
          <div className="flex w-full max-w-[24rem] items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[color:oklch(0.22_0.009_90_/_0.88)] px-4 py-2">
            <Search className="h-4 w-4 text-[var(--bokmoo-copy-soft)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search countries or regional passes..."
              className="w-full bg-transparent text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onNavigateToCart}
            className="relative flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.22_0.009_90_/_0.88)] text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-line-strong)] hover:text-[var(--bokmoo-gold)]"
            aria-label="Open cart"
            type="button"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--bokmoo-gold)] px-1 text-[10px] font-bold text-[var(--bokmoo-bg)]">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            ) : null}
          </button>

          {isAuthenticated ? (
            <button
              onClick={onNavigateToProfile}
              className="hidden h-11 items-center gap-2 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.22_0.009_90_/_0.88)] px-4 text-sm font-medium text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-line-strong)] sm:inline-flex"
              type="button"
            >
              <User className="h-4 w-4 text-[var(--bokmoo-gold)]" />
              {user?.firstName || 'Traveler'}
            </button>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={onNavigateToLogin}
                className="rounded-full px-4 py-2 text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-ink)]"
                type="button"
              >
                Sign in
              </button>
              <button
                onClick={onNavigateToRegister}
                className="rounded-full border border-[var(--bokmoo-line-strong)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--bokmoo-bg)] transition-transform duration-300 hover:-translate-y-0.5"
                type="button"
              >
                Create account
              </button>
            </div>
          )}

          <button
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.22_0.009_90_/_0.88)] text-[var(--bokmoo-ink)] lg:hidden"
            aria-label="Toggle menu"
            type="button"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-4 lg:hidden">
          <form onSubmit={submitSearch} className="mb-4">
            <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--bokmoo-copy-soft)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search countries or regional passes..."
                className="w-full bg-transparent text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]"
              />
            </div>
          </form>

          <div className="mb-4 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-sm text-[var(--bokmoo-copy)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
              <Globe2 className="h-4 w-4" />
              {site.eyebrow}
            </div>
          </div>

          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
                type="button"
              >
                {item.label}
              </button>
            ))}

            <button
              onClick={() => {
                openHref(site.secondaryCtaHref);
                setIsMenuOpen(false);
              }}
              className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
              type="button"
            >
              {site.secondaryCtaLabel}
            </button>

            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    onNavigateToProfile();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
                  type="button"
                >
                  Account
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-copy)]"
                  type="button"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onNavigateToLogin();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
                  type="button"
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    onNavigateToRegister();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-4 py-3 text-left text-sm font-semibold text-[var(--bokmoo-bg)]"
                  type="button"
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});
