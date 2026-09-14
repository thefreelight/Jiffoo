import React from 'react';
import { LogIn, Settings2, ShoppingBag, UserRound } from 'lucide-react';
import type { ProfilePageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getProfileCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      privateTitle: '登入後查看你的個人中心。',
      privateBody: '收藏、訂單與提交流程都在帳戶裡集中管理。',
      signIn: '立即登入',
      orders: '訂單紀錄',
      ordersBody: '查看你購買的訂閱方案、提交狀態與歷史紀錄。',
      settings: '設定',
      settingsBody: '更新語言、時區與帳戶相關資訊。',
      memberSince: '加入時間',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      privateTitle: '登录后查看你的个人中心。',
      privateBody: '收藏、订单和提交流程都在账户里集中管理。',
      signIn: '立即登录',
      orders: '订单记录',
      ordersBody: '查看你购买的订阅方案、提交状态和历史记录。',
      settings: '设置',
      settingsBody: '更新语言、时区和账户相关信息。',
      memberSince: '加入时间',
    };
  }

  return {
    privateTitle: 'Sign in to view your workspace.',
    privateBody: 'Favorites, orders, and submissions all stay organized inside your account.',
    signIn: 'Sign in',
    orders: 'Order history',
    ordersBody: 'Review plans, submissions, and past billing-related activity.',
    settings: 'Settings',
    settingsBody: 'Update language, timezone, and account details.',
    memberSince: 'Member since',
  };
}

export const ProfilePage = React.memo(function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  locale,
  config,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
}: ProfilePageProps) {
  const content = getProfileCopy(locale);

  if (isLoading) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {getNavCopy(locale).common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="max-w-xl rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
              <UserRound className="h-10 w-10" />
            </div>
            <h1 className="mt-6 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
              {content.privateTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--navtoai-copy)]">{content.privateBody}</p>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white"
            >
              <LogIn className="h-4 w-4" />
              {content.signIn}
            </button>
          </div>
        </div>
      </MarketplaceFrame>
    );
  }

  const joinedDate = new Date(user.createdAt).toLocaleDateString(getNavCopy(locale).locale === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="space-y-6">
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,#0a1030_0%,#11163c_44%,#17103a_100%)] p-8 text-white shadow-[var(--navtoai-shadow-hero)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/72">{content.memberSince}</p>
              <h1 className="mt-3 text-[clamp(2.6rem,5vw,4.6rem)] font-black tracking-[-0.06em]">{user.name}</h1>
              <p className="mt-4 text-base leading-8 text-white/76">{user.email}</p>
            </div>
            <div className="rounded-[var(--navtoai-radius-lg)] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1rem] bg-white text-[var(--navtoai-primary)]">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="h-full w-full rounded-[1rem] object-cover" />
                  ) : (
                    <UserRound className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <div className="text-sm text-white/68">{content.memberSince}</div>
                  <div className="text-lg font-semibold text-white">{joinedDate}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={onNavigateToOrders}
            className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 text-left shadow-[var(--navtoai-shadow-sm)] transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">{content.orders}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--navtoai-copy)]">{content.ordersBody}</p>
          </button>

          <button
            type="button"
            onClick={onNavigateToSettings}
            className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 text-left shadow-[var(--navtoai-shadow-sm)] transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
              <Settings2 className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">{content.settings}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--navtoai-copy)]">{content.settingsBody}</p>
          </button>
        </div>
      </div>
    </MarketplaceFrame>
  );
});
