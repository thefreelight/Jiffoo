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
    <header className="sticky top-0 z-50 border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] bg-[color:oklch(0.055_0.006_75_/_0.94)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1760px] items-center gap-5 px-5 py-3.5 sm:px-8 xl:px-10">
        <button
          onClick={onNavigateToHome}
          className="flex items-center gap-4 text-left"
          type="button"
          aria-label={`${site.brandName} home`}
        >
          <div className="grid h-12 w-12 grid-cols-2 gap-1 rounded-[0.68rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_44%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_11%,transparent)] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_18px_46px_rgba(0,0,0,0.4)] sm:h-14 sm:w-14">
            <span className="rounded-tl-[999px] rounded-tr-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
            <span className="rounded-tl-[999px] rounded-tr-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
            <span className="rounded-bl-[999px] rounded-br-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
            <span className="rounded-bl-[999px] rounded-br-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
          </div>
          <span className="text-[1.35rem] font-semibold tracking-[0.16em] text-[var(--bokmoo-ink)] sm:text-[1.55rem]">
            {site.brandName.toUpperCase()}
          </span>
        </button>

        <nav className="ml-10 hidden items-center gap-8 xl:flex 2xl:ml-16 2xl:gap-12">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                setIsMenuOpen(false);
              }}
              className="rounded-[0.8rem] px-1 py-2 text-[0.98rem] font-medium text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-gold)]"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 xl:flex">
          <button
            className="inline-flex min-h-12 items-center gap-2 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[rgba(3,3,3,0.24)] px-5 text-base text-[var(--bokmoo-copy)]"
            type="button"
          >
            <Globe2 className="h-[1.125rem] w-[1.125rem] text-[var(--bokmoo-gold)]" />
            English
            <ChevronDown className="h-[1.125rem] w-[1.125rem]" />
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToLogin}
            className="inline-flex min-h-12 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line-strong)] bg-[rgba(3,3,3,0.22)] px-6 text-base font-medium text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]"
            type="button"
          >
            {isAuthenticated ? user?.firstName || 'Account' : 'Log In'}
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToRegister}
            className="inline-flex min-h-12 items-center justify-center rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-8 text-base font-bold text-[var(--bokmoo-bg)] shadow-[0_16px_44px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)]"
            type="button"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
          </button>

          <button
            onClick={onNavigateToCart}
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[rgba(3,3,3,0.22)] text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]"
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
