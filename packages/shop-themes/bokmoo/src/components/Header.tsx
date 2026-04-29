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
    <header className="sticky top-0 z-50 border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[radial-gradient(circle_at_18%_-20%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_34%),linear-gradient(180deg,oklch(0.07_0.009_75_/_0.98),oklch(0.035_0.006_75_/_0.96))] shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1880px] items-center gap-4 px-4 py-3 sm:px-7 xl:min-h-[6rem] xl:gap-6 xl:px-12 xl:py-4 2xl:min-h-[6.35rem] 2xl:px-16">
        <button
          onClick={onNavigateToHome}
          className="group flex shrink-0 items-center gap-3 text-left sm:gap-4 xl:gap-5"
          type="button"
          aria-label={`${site.brandName} home`}
        >
          <div className="grid h-10 w-10 grid-cols-2 gap-1 rounded-[0.62rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_46%,transparent)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent),rgba(255,255,255,0.025))] p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045),0_14px_34px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-12 sm:w-12 sm:p-2 xl:h-16 xl:w-16 xl:gap-1.5 xl:rounded-[0.9rem] xl:p-2.5 2xl:h-[4.35rem] 2xl:w-[4.35rem]">
            <span className="rounded-tl-[999px] rounded-tr-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
            <span className="rounded-tl-[999px] rounded-tr-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
            <span className="rounded-bl-[999px] rounded-br-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
            <span className="rounded-bl-[999px] rounded-br-[999px] bg-[linear-gradient(145deg,var(--bokmoo-gold-strong),var(--bokmoo-gold))]" />
          </div>
          <span className="text-[1.12rem] font-semibold tracking-[0.14em] text-[var(--bokmoo-ink)] drop-shadow-[0_0_18px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] sm:text-[1.35rem] xl:text-[2rem] xl:tracking-[0.19em] 2xl:text-[2.12rem]">
            {site.brandName.toUpperCase()}
          </span>
        </button>

        <nav className="ml-12 hidden items-center gap-10 xl:flex 2xl:ml-24 2xl:gap-[3.65rem]">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                setIsMenuOpen(false);
              }}
              className="rounded-[0.8rem] px-1 py-2 text-[1rem] font-medium tracking-[0.01em] text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-gold)] 2xl:text-[1.08rem]"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 xl:flex 2xl:gap-5">
          <button
            className="inline-flex min-h-[3.1rem] items-center gap-2.5 rounded-[1.08rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] px-5 text-[1rem] text-[var(--bokmoo-copy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_52%,transparent)] hover:text-[var(--bokmoo-ink)] 2xl:min-h-14 2xl:px-6"
            type="button"
          >
            <Globe2 className="h-[1.15rem] w-[1.15rem] text-[var(--bokmoo-gold)]" />
            English
            <ChevronDown className="h-[1.15rem] w-[1.15rem]" />
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToLogin}
            className="inline-flex min-h-[3.1rem] items-center justify-center rounded-[1.08rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_32%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.18))] px-6 text-[1rem] font-medium text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] 2xl:min-h-14 2xl:px-7"
            type="button"
          >
            {isAuthenticated ? user?.firstName || 'Account' : 'Log In'}
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToRegister}
            className="inline-flex min-h-[3.1rem] items-center justify-center rounded-[1.08rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_48%,white)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-8 text-[1rem] font-bold tracking-[0.01em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform duration-300 hover:-translate-y-0.5 2xl:min-h-14 2xl:px-10"
            type="button"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
          </button>

          <button
            onClick={onNavigateToCart}
            className="relative inline-flex h-[3.1rem] w-[3.1rem] items-center justify-center rounded-[1.08rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.2))] text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] 2xl:h-14 2xl:w-14"
            aria-label="Open cart"
            type="button"
          >
            <ShoppingBag className="h-[1.15rem] w-[1.15rem]" />
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
