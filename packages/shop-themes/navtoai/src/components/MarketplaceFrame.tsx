import React from 'react';
import { Heart, Home, LayoutGrid, Search, User2 } from 'lucide-react';
import type { ThemeConfig } from 'shared/src/types/theme';
import { getNavCopy } from '../i18n';

type NavItemId = 'home' | 'tools' | 'apps' | 'models' | 'resources' | 'rankings' | 'news' | 'collections';

interface MarketplaceFrameProps {
  // activeItem is retained for page-call compatibility; the top-nav layout no
  // longer renders a sidebar, so it is intentionally unused here.
  activeItem?: NavItemId | null;
  locale?: string;
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

export function MarketplaceFrame({ locale, onNavigate, children }: MarketplaceFrameProps) {
  const copy = getNavCopy(locale);
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
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

  const bottomNavLabels =
    copy.locale === 'en'
      ? { home: 'Home', categories: 'Browse', discover: 'Search', saved: 'Saved', account: 'Me' }
      : copy.locale === 'zh-Hant'
        ? { home: '首頁', categories: '瀏覽', discover: '搜尋', saved: '收藏', account: '我的' }
        : { home: '首页', categories: '浏览', discover: '搜索', saved: '收藏', account: '我的' };

  const mobileNavItems = [
    { key: 'home', label: bottomNavLabels.home, href: '/', icon: Home },
    { key: 'categories', label: bottomNavLabels.categories, href: '/products', icon: LayoutGrid },
    { key: 'discover', label: bottomNavLabels.discover, href: '/search', icon: Search },
    { key: 'saved', label: bottomNavLabels.saved, href: '/bestsellers', icon: Heart },
    { key: 'account', label: bottomNavLabels.account, href: '/profile', icon: User2 },
  ] as const;

  const activeMobileKey = React.useMemo(() => {
    if (currentPath === '/' || currentPath.endsWith('/home')) return 'home';
    if (/\/(products|product-detail|categories|deals|new-arrivals|bestsellers)/.test(currentPath)) return 'categories';
    if (/\/(search|help|contact)/.test(currentPath)) return 'discover';
    if (/\/(profile|login|register|auth-callback|orders)/.test(currentPath)) return 'account';
    return 'home';
  }, [currentPath]);

  return (
    <div className="min-h-screen bg-[var(--navtoai-bg)]">
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-6 lg:px-8 lg:pb-10">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#edf0f8] bg-white/96 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-18px_40px_-32px_rgba(26,34,74,0.34)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMobileKey === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigateTo(item.href)}
                className="flex flex-col items-center gap-0.5 rounded-[0.8rem] px-2 py-2 text-center"
              >
                <span
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-[0.55rem] transition-colors',
                    isActive ? 'bg-[#2f6bff] text-white' : 'text-[#98a1b5]',
                  ].join(' ')}
                >
                  <Icon className="h-[1rem] w-[1rem]" />
                </span>
                <span className={['text-[0.68rem] font-semibold', isActive ? 'text-[#2f6bff]' : 'text-[#8f98ad]'].join(' ')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
