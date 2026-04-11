import React from 'react';
import { Menu, Search, User, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { resolveModelsfindSiteConfig } from '../site';

export const Header = React.memo(function Header({
  isAuthenticated,
  user,
  config,
  onSearch,
  onLogout,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToHome,
  onNavigateToProducts,
  onNavigateToDeals,
}: HeaderProps) {
  const site = resolveModelsfindSiteConfig(config);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  const navItems = [
    { label: 'Models', action: onNavigateToProducts },
    { label: 'Services', action: onNavigateToDeals },
    { label: 'Access', action: isAuthenticated ? onNavigateToProfile : onNavigateToRegister },
  ];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    onSearch(searchQuery.trim());
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--modelsfind-line)] bg-[rgba(8,7,10,0.92)] backdrop-blur-xl [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto flex h-[3.6rem] max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onNavigateToHome} className="text-left">
          <div className="[font-family:var(--modelsfind-display)] text-[1.2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--modelsfind-primary)]">
            {site.brandName}
          </div>
        </button>

        <nav className="hidden items-center gap-5 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="text-[11px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden flex-1 justify-end px-6 lg:flex">
          <form onSubmit={submitSearch} className="relative w-full max-w-[18rem] xl:max-w-[22rem]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search models"
              className="h-9 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-xs text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)] focus:border-[var(--modelsfind-primary)]"
            />
          </form>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-xs uppercase tracking-[0.16em] text-[var(--modelsfind-copy)] transition-colors hover:border-[var(--modelsfind-line-strong)] hover:text-[var(--modelsfind-ink)]"
              >
                <User className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                {user?.firstName || 'Profile'}
              </button>

              {userMenuOpen ? (
                <div className="absolute right-0 top-full mt-2 min-w-[13rem] rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.98)] p-2 shadow-[var(--modelsfind-card-shadow)]">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onNavigateToProfile();
                    }}
                    className="w-full rounded-[0.9rem] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    Profile settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="mt-1 w-full rounded-[0.9rem] px-4 py-3 text-left text-sm text-[var(--modelsfind-copy)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--modelsfind-ink)]"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_78%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition-transform duration-300 hover:-translate-y-0.5"
              >
                Request access
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-ink)] lg:hidden"
            aria-label="Menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[var(--modelsfind-line)] bg-[rgba(12,9,14,0.96)] px-4 py-4 lg:hidden">
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search models"
              className="h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
            />
          </form>

          <div className="mt-4 grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  item.action();
                }}
                className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)]"
              >
                {item.label}
              </button>
            ))}

            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigateToProfile();
                  }}
                  className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)]"
                >
                  Profile settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                  className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-copy)]"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigateToRegister();
                  }}
                  className="rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_78%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-4 py-3 text-left text-sm font-semibold text-white"
                >
                  Request access
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});
