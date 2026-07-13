import React from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import type { HeaderProps } from '../types/theme';
import { resolveVaultSiteConfig } from '../site';

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
  const site = resolveVaultSiteConfig(config);

  const navItems = [
    { label: 'Home', onClick: onNavigateToHome },
    { label: 'Products', onClick: onNavigateToProducts },
    { label: 'Categories', onClick: onNavigateToCategories },
    { label: 'Track order', onClick: () => onNavigate?.('/guest/orders') },
    { label: 'Deals', onClick: onNavigateToDeals },
    { label: 'Help', onClick: () => onNavigate?.('/help') },
  ];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--vault-line)] bg-[var(--vault-panel-soft)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button onClick={onNavigateToHome} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--vault-ink)] text-white shadow-[var(--vault-shadow-soft)]">
            <span className="text-xs font-black tracking-[0.18em]">{site.brandName.slice(0, 1).toUpperCase()}</span>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--vault-ink)]">
              {site.brandName}
            </div>
            <div className="text-[11px] text-[var(--vault-copy-soft)]">
              Digital goods, delivered inside the order center
            </div>
          </div>
        </button>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="hidden flex-1 items-center justify-end xl:flex">
          <div className="flex w-full max-w-[20rem] items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--vault-copy-soft)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search card codes, accounts, downloads..."
              className="w-full bg-transparent text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onNavigate?.('/search')}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-copy)] transition-colors hover:text-[var(--vault-ink)] lg:flex xl:hidden"
            aria-label="Open search"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            onClick={onNavigateToCart}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-copy)] transition-colors hover:text-[var(--vault-ink)]"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-[var(--vault-primary)] px-1 text-[10px] font-bold text-white">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            ) : null}
          </button>

          {isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={onNavigateToProfile}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
              >
                <User className="h-4 w-4" />
                {user?.firstName || 'Account'}
              </button>
              <button
                onClick={onLogout}
                className="hidden rounded-xl px-3 py-2 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)] md:inline-flex"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={onNavigateToLogin}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
              >
                Login
              </button>
              <button
                onClick={onNavigateToRegister}
                className="rounded-xl bg-[var(--vault-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
              >
                Create account
              </button>
            </div>
          )}

          <button
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-copy)] lg:hidden"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-4 lg:hidden">
          <form onSubmit={submitSearch} className="mb-4">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--vault-copy-soft)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search card codes, accounts, downloads..."
                className="w-full bg-transparent text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
              />
            </div>
          </form>

          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--vault-ink)]"
              >
                {item.label}
              </button>
            ))}

            {isAuthenticated ? (
              <div className="grid gap-2">
                <button
                  onClick={() => {
                    onNavigateToProfile();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--vault-ink)]"
                >
                  Account center
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--vault-copy)]"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                <button
                  onClick={() => {
                    onNavigateToLogin();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--vault-ink)]"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    onNavigateToRegister();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-xl bg-[var(--vault-primary)] px-4 py-3 text-left text-sm font-semibold text-white"
                >
                  Create account
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});
