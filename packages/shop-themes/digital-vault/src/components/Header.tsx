import React from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
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
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const site = resolveVaultSiteConfig(config);

  const navItems = [
    { label: 'Catalog', onClick: onNavigateToProducts },
    { label: 'Gift Cards', onClick: () => onNavigate?.('/search?q=gift%20card') },
    { label: 'Access Packs', onClick: () => onNavigate?.('/search?q=account') },
    { label: 'Downloads', onClick: () => onNavigate?.('/search?q=download') },
    { label: 'Help', onClick: () => onNavigate?.('/help') },
  ];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--vault-line)] bg-[color:color-mix(in_oklab,var(--vault-surface)_90%,white)]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button onClick={onNavigateToHome} className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--vault-ink)] text-white shadow-[var(--vault-shadow)] transition-transform duration-300 group-hover:-translate-y-0.5">
            <span className="text-sm font-black tracking-[0.24em]">DV</span>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-[var(--vault-ink)]">
              {site.brandName}
            </div>
            <div className="text-[11px] font-medium text-[var(--vault-copy-soft)]">
              Instant codes, credentials, and downloads
            </div>
          </div>
        </button>

        <nav className="hidden items-center gap-1 xl:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="hidden flex-1 items-center justify-end 2xl:flex">
          <div className="flex w-full max-w-[22rem] items-center gap-2 rounded-full border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-2">
            <Search className="h-4 w-4 text-[var(--vault-copy-soft)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search keys, vouchers, accounts..."
              className="w-full bg-transparent text-sm text-[var(--vault-ink)] outline-none placeholder:text-[var(--vault-copy-soft)]"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onNavigate?.('/search')}
            className="hidden h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-ink)] transition-colors hover:border-[var(--vault-primary)] hover:text-[var(--vault-primary)] xl:flex 2xl:hidden"
            aria-label="Open search"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            onClick={onNavigateToCart}
            className="relative flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-ink)] transition-colors hover:border-[var(--vault-primary)] hover:text-[var(--vault-primary)]"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--vault-primary)] px-1 text-[10px] font-bold text-white">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            ) : null}
          </button>

          {isAuthenticated ? (
            <button
              onClick={onNavigateToProfile}
              className="hidden h-11 items-center gap-2 rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm font-semibold text-[var(--vault-ink)] transition-colors hover:border-[var(--vault-primary)] hover:text-[var(--vault-primary)] sm:inline-flex"
            >
              <User className="h-4 w-4" />
              {user?.firstName || 'Vault'}
            </button>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={onNavigateToLogin}
                className="hidden rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)] md:inline-flex"
              >
                Login
              </button>
              <button
                onClick={onNavigateToRegister}
                className="rounded-full bg-[var(--vault-primary)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-transform duration-300 hover:-translate-y-0.5"
              >
                Create account
              </button>
            </div>
          )}

          <button
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-surface)] text-[var(--vault-ink)] xl:hidden"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-4 xl:hidden">
          <form onSubmit={submitSearch} className="mb-4">
            <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--vault-copy-soft)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search keys, vouchers, accounts..."
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
                className="rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--vault-ink)]"
              >
                {item.label}
              </button>
            ))}

            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    onNavigateToProfile();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--vault-ink)]"
                >
                  Account locker
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--vault-copy)]"
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
                  className="rounded-[1rem] border border-[var(--vault-line)] bg-[var(--vault-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--vault-ink)]"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    onNavigateToRegister();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] bg-[var(--vault-primary)] px-4 py-3 text-left text-sm font-semibold text-white"
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
