import React from 'react';
import {
  BookOpenText,
  Bot,
  FolderKanban,
  Github,
  Heart,
  Home,
  LayoutGrid,
  Newspaper,
  Orbit,
  Search,
  Trophy,
  User2,
  WandSparkles,
} from 'lucide-react';
import type { ThemeConfig } from 'shared/src/types/theme';
import { getNavCopy } from '../i18n';

type NavItemId = 'home' | 'tools' | 'apps' | 'models' | 'resources' | 'rankings' | 'news' | 'collections';

interface MarketplaceFrameProps {
  activeItem?: NavItemId | null;
  locale?: string;
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

const itemIconMap: Record<NavItemId, React.ComponentType<{ className?: string }>> = {
  home: Home,
  tools: Bot,
  apps: LayoutGrid,
  models: Orbit,
  resources: BookOpenText,
  rankings: Trophy,
  news: Newspaper,
  collections: FolderKanban,
};

export function MarketplaceFrame({
  activeItem = null,
  locale,
  onNavigate,
  children,
}: MarketplaceFrameProps) {
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

  const navItems = [
    { id: 'home', label: copy.sidebar.home, href: '/' },
    { id: 'tools', label: copy.sidebar.tools, href: '/products' },
    { id: 'apps', label: copy.sidebar.apps, href: '/search?q=app' },
    { id: 'models', label: copy.sidebar.models, href: '/categories' },
    { id: 'resources', label: copy.sidebar.resources, href: '/help' },
    { id: 'rankings', label: copy.sidebar.rankings, href: '/bestsellers' },
    { id: 'news', label: copy.sidebar.news, href: '/new-arrivals' },
    { id: 'collections', label: copy.sidebar.collections, href: '/deals' },
  ] as const;

  const bottomNavLabels =
    copy.locale === 'en'
      ? { categories: 'Categories', discover: 'Discover', favorites: 'Saved', account: 'Me' }
      : copy.locale === 'zh-Hant'
        ? { categories: '分類', discover: '發現', favorites: '收藏', account: '我的' }
        : { categories: '分类', discover: '发现', favorites: '收藏', account: '我的' };

  const mobileNavItems = [
    { key: 'home', label: copy.sidebar.home, href: '/', icon: Home },
    { key: 'categories', label: bottomNavLabels.categories, href: '/products', icon: LayoutGrid },
    { key: 'discover', label: bottomNavLabels.discover, href: '/search?q=chat', icon: Search },
    { key: 'favorites', label: bottomNavLabels.favorites, href: '/bestsellers', icon: Heart },
    { key: 'account', label: bottomNavLabels.account, href: '/profile', icon: User2 },
  ] as const;

  const activeMobileKey = React.useMemo(() => {
    if (!currentPath) {
      if (activeItem === 'home') return 'home';
      if (activeItem === 'rankings') return 'favorites';
      if (activeItem === 'resources') return 'discover';
      if (activeItem === 'tools' || activeItem === 'models' || activeItem === 'collections' || activeItem === 'news') {
        return 'categories';
      }
      return 'account';
    }

    if (currentPath === '/' || currentPath.endsWith('/home')) return 'home';
    if (/\/(products|product-detail|categories|deals|new-arrivals)/.test(currentPath)) return 'categories';
    if (/\/(search|help|contact)/.test(currentPath)) return 'discover';
    if (/\/(bestsellers|orders|order-detail|order-success|order-cancelled)/.test(currentPath)) return 'favorites';
    if (/\/(profile|login|register|auth-callback)/.test(currentPath)) return 'account';

    return 'home';
  }, [activeItem, currentPath]);

  return (
    <div className="min-h-screen bg-[var(--navtoai-bg)]">
      <div className="mx-auto grid max-w-[1440px] gap-5 px-4 pb-24 pt-4 sm:px-6 lg:grid-cols-[13.25rem_minmax(0,1fr)] lg:px-5 lg:pb-8">
        <aside className="hidden lg:block">
          <div className="sticky top-[5.75rem] flex min-h-[calc(100vh-6.5rem)] flex-col">
            <nav className="grid gap-1.5">
              {navItems.map((item) => {
                const Icon = itemIconMap[item.id];
                const isActive = item.id === activeItem;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.href)}
                    className={[
                      'group flex w-full items-center gap-3 rounded-[0.72rem] px-3.5 py-2.5 text-left transition-all duration-200',
                      isActive ? 'bg-[#edeaff] text-[#5d55f6]' : 'text-[#3d455d] hover:bg-white hover:text-[#202842]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-7 w-7 items-center justify-center rounded-[0.55rem] transition-colors',
                        isActive ? 'bg-white text-[#5d55f6]' : 'text-[#5d657b] group-hover:text-[#5d55f6]',
                      ].join(' ')}
                    >
                      <Icon className="h-[1.05rem] w-[1.05rem]" />
                    </span>
                    <span className="text-[0.93rem] font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-16 overflow-hidden rounded-[1rem] bg-[linear-gradient(135deg,#5870ff,#8a7dff)] p-4 text-white shadow-[0_18px_34px_-22px_rgba(82,79,255,0.74)]">
              <p className="text-[0.72rem] font-semibold text-white/82">{copy.sidebar.promoEyebrow}</p>
              <h2 className="mt-2 text-[1.05rem] font-black leading-6">{copy.sidebar.promoTitle}</h2>
              <p className="mt-2 text-xs leading-5 text-white/84">{copy.sidebar.promoBody}</p>
              <button
                type="button"
                onClick={() => navigateTo('/products')}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#5d55f6]"
              >
                {copy.sidebar.promoCta}
                <WandSparkles className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-auto px-1 pb-2">
              <div className="text-base font-black text-[#11162b]">
                Navto<span className="text-[#5d55f6]">AI</span>
              </div>
              <p className="mt-3 max-w-[9rem] text-xs leading-5 text-[#7b8498]">{copy.footer.summary}</p>
              <div className="mt-4 flex items-center gap-3 text-[#8891a6]">
                <Search className="h-4 w-4" />
                <LayoutGrid className="h-4 w-4" />
                <Github className="h-4 w-4" />
                <Heart className="h-4 w-4" />
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

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
                    isActive ? 'bg-[#6257ff] text-white' : 'text-[#98a1b5]',
                  ].join(' ')}
                >
                  <Icon className="h-[1rem] w-[1rem]" />
                </span>
                <span className={['text-[0.68rem] font-semibold', isActive ? 'text-[#6257ff]' : 'text-[#8f98ad]'].join(' ')}>
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
