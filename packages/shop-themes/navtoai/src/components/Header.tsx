import React from 'react';
import { Menu, Search, ShoppingBag, User2, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { resolveNavToAiSiteConfig } from '../site';

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
  const site = resolveNavToAiSiteConfig(config);

  const navItems = [
    { label: 'Directory', onClick: onNavigateToProducts },
    { label: 'Chat', onClick: () => onNavigate?.('/search?q=chat') },
    { label: 'Image', onClick: () => onNavigate?.('/search?q=image') },
    { label: 'Agents', onClick: () => onNavigate?.('/search?q=agent') },
    { label: 'Categories', onClick: onNavigateToCategories },
    { label: 'Deals', onClick: onNavigateToDeals },
  ];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--navtoai-line)] bg-[color:color-mix(in_oklab,var(--navtoai-surface)_90%,white)]/96 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button type="button" onClick={onNavigateToHome} className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--navtoai-ink)] text-white shadow-[var(--navtoai-shadow)] transition-transform duration-300 group-hover:-translate-y-0.5">
            <span className="text-sm font-black tracking-[0.22em]">NA</span>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-[var(--navtoai-ink)]">
              {site.brandName}
            </div>
            <div className="text-[11px] font-medium text-[var(--navtoai-copy-soft)]">
              Curated AI stack directory
            </div>
          </div>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy)] transition-colors hover:bg-[var(--navtoai-primary-soft)] hover:text-[var(--navtoai-ink)]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="hidden flex-1 items-center justify-end lg:flex">
          <div className="flex w-full max-w-[24rem] items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-bg)] px-4 py-2">
            <Search className="h-4 w-4 text-[var(--navtoai-copy-soft)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chat, coding, image, automation..."
              className="w-full bg-transparent text-sm text-[var(--navtoai-ink)] outline-none placeholder:text-[var(--navtoai-copy-soft)]"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToCart}
            className="relative flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] text-[var(--navtoai-ink)] transition-colors hover:border-[var(--navtoai-primary)] hover:text-[var(--navtoai-primary)]"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--navtoai-primary)] px-1 text-[10px] font-bold text-white">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            ) : null}
          </button>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={onNavigateToProfile}
              className="hidden h-11 items-center gap-2 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 text-sm font-semibold text-[var(--navtoai-ink)] transition-colors hover:border-[var(--navtoai-primary)] hover:text-[var(--navtoai-primary)] sm:inline-flex"
            >
              <User2 className="h-4 w-4" />
              {user?.firstName || 'Account'}
            </button>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy)] transition-colors hover:bg-[var(--navtoai-primary-soft)] hover:text-[var(--navtoai-ink)]"
              >
                Login
              </button>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="rounded-full bg-[var(--navtoai-primary)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-transform duration-300 hover:-translate-y-0.5"
              >
                Create account
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] text-[var(--navtoai-ink)] lg:hidden"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-4 py-4 lg:hidden">
          <form onSubmit={submitSearch} className="mb-4">
            <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--navtoai-copy-soft)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chat, image, voice, coding..."
                className="w-full bg-transparent text-sm text-[var(--navtoai-ink)] outline-none placeholder:text-[var(--navtoai-copy-soft)]"
              />
            </div>
          </form>

          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className="rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--navtoai-ink)]"
              >
                {item.label}
              </button>
            ))}

            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToProfile();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--navtoai-ink)]"
                >
                  Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--navtoai-copy)]"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToLogin();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg)] px-4 py-3 text-left text-sm font-semibold text-[var(--navtoai-ink)]"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToRegister();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[1rem] bg-[var(--navtoai-primary)] px-4 py-3 text-left text-sm font-semibold text-white"
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
