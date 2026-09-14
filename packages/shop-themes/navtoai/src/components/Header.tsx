import React from 'react';
import { ArrowLeft, Heart, Menu, Search, Share2, User2, X } from 'lucide-react';
import type { HeaderProps } from 'shared/src/types/theme';
import { getNavCopy } from '../i18n';
import { NavtoAiLogo } from './design-primitives';

export const Header = React.memo(function Header({
  isAuthenticated,
  user,
  locale,
  onSearch,
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
  const [query, setQuery] = React.useState('');
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
    { label: copy.sidebar.home, onClick: onNavigateToHome },
    { label: copy.sidebar.tools, onClick: onNavigateToProducts },
    { label: copy.sidebar.models, onClick: onNavigateToCategories },
    { label: copy.sidebar.collections, onClick: onNavigateToDeals },
    { label: copy.sidebar.resources, onClick: () => navigateTo('/help') },
  ];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setIsMenuOpen(false);
  };

  const handleMobileAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  const mobileLabels =
    copy.locale === 'en'
      ? { categories: 'Categories', account: 'Account', submissions: 'Submit Project', resources: 'Guide', cart: 'Cart' }
      : copy.locale === 'zh-Hant'
        ? { categories: '分類', account: '我的', submissions: '提交項目', resources: '指南', cart: '購物車' }
        : { categories: '分类', account: '我的', submissions: '提交项目', resources: '指南', cart: '购物车' };

  const mobileMeta = React.useMemo(() => {
    if (currentPath === '/' || currentPath.endsWith('/home')) return { mode: 'home' as const };
    if (/\/(product-detail|order-detail)/.test(currentPath)) return { mode: 'detail' as const };
    if (/\/products/.test(currentPath) || /\/categories/.test(currentPath)) {
      return { mode: 'title' as const, title: mobileLabels.categories, searchHref: '/search' };
    }
    if (/\/search/.test(currentPath)) return { mode: 'title' as const, title: copy.sidebar.apps, searchHref: '/search' };
    if (/\/contact/.test(currentPath)) return { mode: 'title' as const, title: mobileLabels.submissions };
    if (/\/help/.test(currentPath)) return { mode: 'title' as const, title: mobileLabels.resources };
    if (/\/profile/.test(currentPath) || /\/login/.test(currentPath) || /\/register/.test(currentPath)) {
      return { mode: 'title' as const, title: mobileLabels.account };
    }
    return { mode: 'home' as const };
  }, [copy.sidebar.apps, currentPath, mobileLabels.account, mobileLabels.categories, mobileLabels.resources, mobileLabels.submissions]);

  const handleMobileBack = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    onNavigateToProducts();
  }, [onNavigateToProducts]);

  const handleMobileShare = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    const payload = { title: document.title, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        return;
      }
    }
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(window.location.href);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[#edf0f8] bg-white/94 backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-5">
        <div className="hidden items-center gap-5 lg:grid lg:grid-cols-[13.25rem_minmax(26rem,39.5rem)_1fr]">
          <button type="button" onClick={onNavigateToHome} className="text-left">
            <NavtoAiLogo tagline={copy.brandTagline} />
          </button>

          <form onSubmit={submitSearch}>
            <div className="flex h-11 items-center gap-3 rounded-[0.75rem] border border-[#edf0f8] bg-[#fbfcff] px-4 shadow-[0_12px_28px_-24px_rgba(25,31,68,0.34)]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.common.searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#202842] outline-none placeholder:text-[#a4acbf]"
              />
              <span className="h-5 w-px bg-[#edf0f8]" />
              <button type="submit" className="flex h-8 w-8 items-center justify-center text-[#11162b]" aria-label={copy.common.search}>
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-6">
            <button type="button" onClick={() => navigateTo('/contact')} className="text-sm font-semibold text-[#11162b]">
              {copy.header.submit}
            </button>
            <button
              type="button"
              onClick={() => (isAuthenticated ? onNavigateToProfile() : onNavigateToLogin())}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#11162b]"
            >
              <Heart className="h-4 w-4" />
              {copy.header.favorites}
            </button>
            <button
              type="button"
              onClick={() => (isAuthenticated ? onNavigateToProfile() : onNavigateToLogin())}
              className="text-sm font-semibold text-[#11162b]"
            >
              {isAuthenticated ? user?.firstName || copy.header.account : copy.header.auth}
            </button>
            <button
              type="button"
              onClick={onNavigateToProfile}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef0ff] text-[#6257ff]"
              aria-label={copy.header.account}
            >
              {user?.firstName?.slice(0, 1) || <User2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:hidden">
          {mobileMeta.mode === 'home' ? (
            <>
              <button
                type="button"
                onClick={() => setIsMenuOpen((value) => !value)}
                className="flex h-10 w-10 items-center justify-center text-[#11162b]"
                aria-label={copy.header.menu}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <button type="button" onClick={onNavigateToHome} className="min-w-0">
                <NavtoAiLogo tagline={copy.locale === 'en' ? 'Discover · Explore · Build' : '发现 · 探索 · 选择 AI 世界'} />
              </button>
              <button type="button" onClick={() => navigateTo('/search')} className="flex h-10 w-10 items-center justify-center text-[#11162b]" aria-label={copy.common.search}>
                <Search className="h-5 w-5" />
              </button>
            </>
          ) : mobileMeta.mode === 'detail' ? (
            <>
              <button type="button" onClick={handleMobileBack} className="flex h-10 w-10 items-center justify-center text-[#11162b]" aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1" />
              <button type="button" onClick={() => void handleMobileShare()} className="flex h-10 w-10 items-center justify-center text-[#11162b]" aria-label="Share">
                <Share2 className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <div className="h-10 w-10" />
              <div className="truncate text-[1.2rem] font-black text-[#11162b]">{mobileMeta.title}</div>
              {mobileMeta.searchHref ? (
                <button type="button" onClick={() => navigateTo(mobileMeta.searchHref)} className="flex h-10 w-10 items-center justify-center text-[#11162b]" aria-label={copy.common.search}>
                  <Search className="h-5 w-5" />
                </button>
              ) : (
                <div className="h-10 w-10" />
              )}
            </>
          )}
        </div>

        {isMenuOpen ? (
          <div className="mt-3 grid gap-2 rounded-[1rem] border border-[#edf0f8] bg-white p-3 shadow-[var(--navtoai-shadow-sm)] lg:hidden">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleMobileAction(item.onClick)}
                className="rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#11162b]"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleMobileAction(() => navigateTo('/contact'))}
              className="rounded-[0.8rem] bg-[#eeeaff] px-4 py-3 text-left text-sm font-bold text-[#6257ff]"
            >
              {copy.header.submit}
            </button>
            {isAuthenticated ? (
              <>
                <button type="button" onClick={() => handleMobileAction(onNavigateToProfile)} className="rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#11162b]">
                  {copy.header.account}
                </button>
                <button type="button" onClick={() => handleMobileAction(onLogout)} className="rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#657086]">
                  {copy.header.logout}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => handleMobileAction(onNavigateToLogin)} className="rounded-[0.8rem] bg-[#f6f7fb] px-4 py-3 text-left text-sm font-semibold text-[#11162b]">
                  {copy.header.auth}
                </button>
                <button type="button" onClick={() => handleMobileAction(onNavigateToRegister)} className="rounded-[0.8rem] bg-[#6257ff] px-4 py-3 text-left text-sm font-bold text-white">
                  {copy.header.register}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
});
