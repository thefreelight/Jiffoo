import React from 'react';
import { ChevronDown, Globe2, Menu, ShoppingBag, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

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
  onNavigateToProducts,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
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
    { label: 'Store', onClick: onNavigateToProducts },
    { label: 'Coverage', onClick: onNavigateToProducts },
    { label: 'How It Works', onClick: () => openHref('/#how-it-works') },
    { label: 'About Us', onClick: () => openHref('/contact') },
    { label: 'Support', onClick: () => openHref('/help') },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--bokmoo-line)] bg-[color:oklch(0.08_0.008_75_/_0.9)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={onNavigateToHome}
          className="flex items-center gap-3 text-left"
          type="button"
          aria-label={`${site.brandName} home`}
        >
          <div className="grid grid-cols-2 gap-0.5 rounded-[0.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] p-1.5">
            <span className="h-3.5 w-3.5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)]" />
            <span className="h-3.5 w-3.5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)]" />
            <span className="h-3.5 w-3.5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)]" />
            <span className="h-3.5 w-3.5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)]" />
          </div>
          <span className="text-xl font-semibold tracking-[0.08em] text-[var(--bokmoo-ink)]">
            {site.brandName.toUpperCase()}
          </span>
        </button>

        <nav className="ml-4 hidden items-center gap-3 xl:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                setIsMenuOpen(false);
              }}
              className="rounded-[0.8rem] px-4 py-2 text-sm font-medium text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-gold)]"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 xl:flex">
          <button
            className="inline-flex items-center gap-2 rounded-[0.8rem] border border-[var(--bokmoo-line)] px-3 py-2 text-sm text-[var(--bokmoo-copy)]"
            type="button"
          >
            <Globe2 className="h-4 w-4 text-[var(--bokmoo-gold)]" />
            English
            <ChevronDown className="h-4 w-4" />
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToLogin}
            className="inline-flex min-h-11 items-center justify-center rounded-[0.8rem] border border-[var(--bokmoo-line-strong)] px-5 text-sm font-medium text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]"
            type="button"
          >
            {isAuthenticated ? user?.firstName || 'Account' : 'Log In'}
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToRegister}
            className="inline-flex min-h-11 items-center justify-center rounded-[0.8rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]"
            type="button"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
          </button>

          <button
            onClick={onNavigateToCart}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-[0.8rem] border border-[var(--bokmoo-line)] text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]"
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
        </div>

        <button
          onClick={() => setIsMenuOpen((value) => !value)}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-[0.8rem] border border-[var(--bokmoo-line)] text-[var(--bokmoo-ink)] xl:hidden"
          aria-label="Toggle menu"
          type="button"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-4 xl:hidden">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setIsMenuOpen(false);
                }}
                className="rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
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
              className="rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
              type="button"
            >
              Cart
            </button>

            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    onNavigateToProfile();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
                  type="button"
                >
                  Account
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-copy)]"
                  type="button"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onNavigateToLogin();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)]"
                  type="button"
                >
                  Log In
                </button>
                <button
                  onClick={() => {
                    onNavigateToRegister();
                    setIsMenuOpen(false);
                  }}
                  className="rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-4 py-3 text-left text-sm font-semibold text-[var(--bokmoo-bg)]"
                  type="button"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});
