import React from 'react';
import { Menu, Search, User2, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { getNavCopy } from '../i18n';
import { NavtoAiLogo } from './design-primitives';

export const Header = React.memo(function Header({
  isAuthenticated,
  user,
  locale,
  onNavigate,
  onLogout,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToHome,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const copy = getNavCopy(locale);
  const landing = copy.landing;
  const navigateTo = React.useCallback(
    (href: string) => {
      if (onNavigate) {
        onNavigate(href);
        return;
      }

      if (typeof window !== 'undefined') {
        window.location.assign(href);
      }
    },
    [onNavigate],
  );

  const navItems = [
    { label: landing.nav.explore, onClick: onNavigateToProducts },
    { label: landing.nav.categories, onClick: onNavigateToCategories },
    { label: landing.nav.trending, onClick: () => navigateTo('/bestsellers') },
    { label: landing.nav.blog, onClick: onNavigateToDeals },
    { label: landing.nav.submit, onClick: () => navigateTo('/contact') },
  ];

  const handleMenuAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#edf0f8] bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onNavigateToHome} className="shrink-0" aria-label="NavtoAI">
          <NavtoAiLogo />
        </button>

        <nav className="ml-4 hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleMenuAction(item.onClick)}
              className="text-sm font-semibold text-[#3d455d] transition-colors hover:text-[#11162b]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 lg:flex">
          <button
            type="button"
            onClick={() => navigateTo('/search')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#3d455d] transition-colors hover:bg-[#f2f5fb] hover:text-[#11162b]"
            aria-label={copy.common.search}
          >
            <Search className="h-[1.15rem] w-[1.15rem]" />
          </button>
          <button
            type="button"
            onClick={() => (isAuthenticated ? onNavigateToProfile() : onNavigateToLogin())}
            className="text-sm font-semibold text-[#11162b] hover:text-[#2f6bff]"
          >
            {isAuthenticated ? user?.firstName || copy.header.account : landing.nav.signIn}
          </button>
          <button
            type="button"
            onClick={() => (isAuthenticated ? onNavigateToProfile() : onNavigateToRegister())}
            className="inline-flex h-10 items-center rounded-full bg-[#2f6bff] px-5 text-sm font-bold text-white shadow-[0_12px_26px_-14px_rgba(47,107,255,0.85)] transition-colors hover:bg-[#1f57e8]"
          >
            {landing.nav.getStarted}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => navigateTo('/search')}
            className="flex h-10 w-10 items-center justify-center text-[#11162b]"
            aria-label={copy.common.search}
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center text-[#11162b]"
            aria-label={copy.header.menu}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[#edf0f8] bg-white px-4 pb-4 pt-3 lg:hidden">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleMenuAction(item.onClick)}
                className="rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#11162b]"
              >
                {item.label}
              </button>
            ))}
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => handleMenuAction(onNavigateToProfile)}
                  className="flex items-center gap-2 rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#11162b]"
                >
                  <User2 className="h-4 w-4" />
                  {copy.header.account}
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(onLogout)}
                  className="rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#657086]"
                >
                  {copy.header.logout}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleMenuAction(onNavigateToLogin)}
                  className="rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#11162b]"
                >
                  {landing.nav.signIn}
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(onNavigateToRegister)}
                  className="rounded-[0.8rem] bg-[#2f6bff] px-4 py-3 text-left text-sm font-bold text-white"
                >
                  {landing.nav.getStarted}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
});
