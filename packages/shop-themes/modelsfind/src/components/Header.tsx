import React from 'react';
import { Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { desktopNavItems, resolveModelsfindSiteConfig } from '../site';

export const Header = React.memo(function Header({
  isAuthenticated,
  user,
  cartItemCount,
  config,
  onSearch,
  onLogout,
  onNavigateToCart,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToHome,
  onNavigateToProducts,
  onNavigateToDeals,
}: HeaderProps) {
  const site = resolveModelsfindSiteConfig(config);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pathname, setPathname] = React.useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : ''
  );
  const normalizedPathname = pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/|$)/, '') || '/';

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextPath = window.location.pathname;
    setPathname(nextPath);
  }, []);

  const navItems = [
    { label: desktopNavItems[0], action: onNavigateToProducts },
    { label: desktopNavItems[1], action: onNavigateToDeals },
    { label: 'Access', action: isAuthenticated ? onNavigateToProfile : onNavigateToRegister },
  ];

  const shouldHideOnLandingMobile =
    pathname !== '' &&
    /^\/(?:[a-z]{2}(?:-[A-Z]{2})?)?$/.test(pathname);
  const shouldHideOnAuth =
    pathname !== '' &&
    /^\/auth(?:\/.*)?$/.test(normalizedPathname);
  const shouldHideOnMobile =
    pathname !== '' &&
    [
      /^\/products(?:\/.*)?$/,
      /^\/cart(?:\/.*)?$/,
      /^\/checkout(?:\/.*)?$/,
    ].some((pattern) => pattern.test(normalizedPathname));

  if (shouldHideOnAuth) {
    return null;
  }

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(query.trim());
  };

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 border-b border-[var(--modelsfind-line)] bg-[rgba(9,8,12,0.88)] backdrop-blur-xl [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]',
        shouldHideOnMobile || shouldHideOnLandingMobile ? 'hidden md:block' : '',
      ].join(' ')}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-[1240px] items-center gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={onNavigateToHome}
          className="[font-family:var(--modelsfind-display)] text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--modelsfind-primary)]"
        >
          {site.brandName}
        </button>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden flex-1 justify-end md:flex">
          <div className="relative w-full max-w-[28rem]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models"
              className="h-11 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
            />
          </div>
        </form>

        <button
          type="button"
          onClick={isAuthenticated ? onNavigateToProfile : onNavigateToRegister}
          className="hidden min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white md:inline-flex"
        >
          Request Access
        </button>

        <button
          type="button"
          onClick={onNavigateToCart}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)] md:hidden"
          aria-label="Open cart"
        >
          <ShoppingBag className="h-4 w-4" />
          {cartItemCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--modelsfind-primary)] px-1 text-[9px] font-semibold text-black">
              {cartItemCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-ink)] md:hidden"
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-[var(--modelsfind-line)] bg-[rgba(10,8,12,0.96)] px-4 py-4 md:hidden">
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models"
              className="h-11 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
            />
          </form>

          <div className="mt-4 grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
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
                    setMenuOpen(false);
                    onNavigateToProfile();
                  }}
                  className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)]"
                >
                  <span className="inline-flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                    {user?.firstName || user?.lastName || 'Profile'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
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
                    setMenuOpen(false);
                    onNavigateToLogin();
                  }}
                  className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)]"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigateToRegister();
                  }}
                  className="rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.16em] text-white"
                >
                  Request Access
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});
