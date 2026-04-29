import React from 'react';
import { ChevronDown, Globe2, Menu, ShoppingBag, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

function BokmooLogoMark() {
  return (
    <svg
      className="h-9 w-9 shrink-0 drop-shadow-[0_12px_26px_color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-10 sm:w-10 xl:h-[3.05rem] xl:w-[3.05rem]"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bokmoo-mark-gold" x1="11" y1="9" x2="54" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE6A0" />
          <stop offset="0.52" stopColor="var(--bokmoo-gold)" />
          <stop offset="1" stopColor="#9F7130" />
        </linearGradient>
        <radialGradient id="bokmoo-mark-bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(18 12) rotate(52) scale(54 64)">
          <stop stopColor="rgba(216,182,83,0.2)" />
          <stop offset="0.58" stopColor="rgba(18,15,10,0.96)" />
          <stop offset="1" stopColor="rgba(5,5,4,1)" />
        </radialGradient>
      </defs>
      <rect
        x="4.5"
        y="4.5"
        width="55"
        height="55"
        rx="12.5"
        fill="url(#bokmoo-mark-bg)"
        stroke="url(#bokmoo-mark-gold)"
        strokeOpacity="0.48"
        strokeWidth="1.5"
      />
      <rect x="14" y="13" width="14.5" height="17.5" rx="6.8" fill="url(#bokmoo-mark-gold)" />
      <rect x="35.5" y="13" width="14.5" height="17.5" rx="6.8" fill="url(#bokmoo-mark-gold)" />
      <rect x="14" y="34" width="14.5" height="17" rx="6.8" fill="url(#bokmoo-mark-gold)" />
      <rect x="35.5" y="34" width="14.5" height="17" rx="6.8" fill="url(#bokmoo-mark-gold)" />
    </svg>
  );
}

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
    <header className="sticky top-0 z-50 border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[radial-gradient(circle_at_8%_-24%,color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent),transparent_34%),linear-gradient(180deg,oklch(0.055_0.007_75_/_0.98),oklch(0.028_0.004_75_/_0.96))] shadow-[0_18px_52px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[107rem] items-center gap-4 px-4 py-2.5 sm:px-6 xl:min-h-[4.85rem] xl:gap-5 xl:px-0">
        <button
          onClick={onNavigateToHome}
          className="group flex shrink-0 items-center gap-3 text-left sm:gap-3.5"
          type="button"
          aria-label={`${site.brandName} home`}
        >
          <BokmooLogoMark />
          <span className="text-[1.05rem] font-bold tracking-[0.19em] text-[var(--bokmoo-ink)] drop-shadow-[0_0_14px_color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] sm:text-[1.16rem] xl:text-[1.42rem] xl:tracking-[0.22em]">
            {site.brandName.toUpperCase()}
          </span>
        </button>

        <nav className="ml-8 hidden items-center gap-8 xl:flex 2xl:ml-14 2xl:gap-10">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                setIsMenuOpen(false);
              }}
              className="group relative px-1 py-2.5 text-[0.95rem] font-medium tracking-[-0.01em] text-[color:color-mix(in_oklab,var(--bokmoo-copy)_88%,white)] transition-colors duration-300 hover:text-[var(--bokmoo-ink)]"
              type="button"
            >
              <span className="absolute inset-x-0 bottom-1 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,var(--bokmoo-gold),transparent)] transition-transform duration-300 group-hover:scale-x-100" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 xl:flex">
          <button
            className="inline-flex min-h-[3rem] items-center gap-2 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.012))] px-4 text-sm text-[var(--bokmoo-copy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent)] hover:text-[var(--bokmoo-ink)]"
            type="button"
          >
            <Globe2 className="h-4 w-4 text-[var(--bokmoo-gold)]" />
            English
            <ChevronDown className="h-4 w-4" />
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToLogin}
            className="inline-flex min-h-[3rem] items-center justify-center rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] px-5 text-sm font-medium text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]"
            type="button"
          >
            {isAuthenticated ? user?.firstName || 'Account' : 'Log In'}
          </button>

          <button
            onClick={isAuthenticated ? onNavigateToProfile : onNavigateToRegister}
            className="inline-flex min-h-[3rem] items-center justify-center rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_46%,white)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-7 text-sm font-bold tracking-[0.01em] text-[var(--bokmoo-bg)] shadow-[0_14px_30px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),inset_0_1px_0_rgba(255,255,255,0.34)] transition-transform duration-300 hover:-translate-y-0.5"
            type="button"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
          </button>

          <button
            onClick={onNavigateToCart}
            className="relative inline-flex h-[3rem] w-[3rem] items-center justify-center rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.18))] text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]"
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
