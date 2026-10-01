/**
 * My Account Page Component — BOKMOO black & gold personal center
 * Layout: sidebar navigation + hero banner + information cards + quick links
 */

import React from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Globe2,
  Headphones,
  Mail,
  PencilLine,
  Phone,
  Plane,
  Settings,
  ShoppingBag,
  UserRound,
  Users,
} from 'lucide-react';
import type { ProfilePageProps } from 'shared/src/types/theme';
import { resolveBokmooSiteConfig } from '../site';

const SCRIPT_FONT =
  '"Snell Roundhand", "Savoye LET", "Segoe Script", "Brush Script MT", cursive';

function svgBackgroundUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const CLUBS_SCENE = svgBackgroundUri(
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='380' viewBox='0 0 640 380'>` +
    `<defs>` +
    `<linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='#0f1824'/>` +
    `<stop offset='0.42' stop-color='#1e2d3d'/>` +
    `<stop offset='0.68' stop-color='#5a4530'/>` +
    `<stop offset='1' stop-color='#0a0805'/>` +
    `</linearGradient>` +
    `<radialGradient id='glow' cx='0.64' cy='0.62' r='0.55'>` +
    `<stop offset='0' stop-color='#f2b552' stop-opacity='0.5'/>` +
    `<stop offset='1' stop-color='#f2b552' stop-opacity='0'/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width='640' height='380' fill='url(#sky)'/>` +
    `<rect width='640' height='380' fill='url(#glow)'/>` +
    `<g fill='#f4c169'><circle cx='446' cy='232' r='2.4'/><circle cx='468' cy='240' r='1.6'/><circle cx='428' cy='243' r='1.4'/><circle cx='488' cy='230' r='1.2'/></g>` +
    `<g stroke='#060503' stroke-linecap='round' fill='none'>` +
    `<path d='M84 380C90 312 86 268 96 218' stroke-width='9'/>` +
    `<path d='M96 218C64 200 34 202 12 218M96 218C112 188 142 176 176 180M96 218C84 184 60 166 28 162M96 218C126 204 158 208 184 226M96 218C100 186 116 162 144 152' stroke-width='7'/>` +
    `<path d='M560 380C556 336 560 306 552 270' stroke-width='8'/>` +
    `<path d='M552 270C526 256 500 258 482 270M552 270C566 244 590 234 618 238M552 270C542 242 522 226 494 224M552 270C578 258 606 262 626 278M552 270C556 242 570 222 594 214' stroke-width='6'/>` +
    `</g>` +
    `<g fill='#f0b45c'><rect x='376' y='252' width='128' height='3' rx='1.5' opacity='0.4'/><rect x='296' y='274' width='208' height='3' rx='1.5' opacity='0.26'/><rect x='336' y='296' width='168' height='3' rx='1.5' opacity='0.18'/><rect x='260' y='318' width='230' height='3' rx='1.5' opacity='0.12'/></g>` +
    `</svg>`,
);

const PROMO_SCENE = svgBackgroundUri(
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='320' viewBox='0 0 420 320'>` +
    `<defs>` +
    `<linearGradient id='dusk' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='#181231'/>` +
    `<stop offset='0.44' stop-color='#2c2044'/>` +
    `<stop offset='0.7' stop-color='#4b2d3d'/>` +
    `<stop offset='1' stop-color='#0d0a12'/>` +
    `</linearGradient>` +
    `<radialGradient id='duskglow' cx='0.72' cy='0.58' r='0.5'>` +
    `<stop offset='0' stop-color='#e8a45c' stop-opacity='0.34'/>` +
    `<stop offset='1' stop-color='#e8a45c' stop-opacity='0'/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width='420' height='320' fill='url(#dusk)'/>` +
    `<rect width='420' height='320' fill='url(#duskglow)'/>` +
    `<g fill='#ffffff' opacity='0.55'><circle cx='60' cy='52' r='1.1'/><circle cx='150' cy='34' r='0.9'/><circle cx='236' cy='60' r='1.2'/><circle cx='318' cy='40' r='1'/><circle cx='374' cy='84' r='0.9'/><circle cx='104' cy='96' r='0.8'/><circle cx='286' cy='104' r='0.8'/></g>` +
    `<g stroke='#070509' stroke-linecap='round' fill='none'>` +
    `<path d='M64 320C70 264 66 228 76 184' stroke-width='9'/>` +
    `<path d='M76 184C46 168 20 170 2 184M76 184C90 156 118 146 148 150M76 184C66 154 44 138 16 136M76 184C104 170 132 174 156 190M76 184C80 156 94 134 120 126' stroke-width='7'/>` +
    `</g>` +
    `<g fill='#e8a45c'><rect x='150' y='212' width='150' height='2.6' rx='1.3' opacity='0.3'/><rect x='196' y='236' width='170' height='2.6' rx='1.3' opacity='0.2'/><rect x='120' y='262' width='210' height='2.6' rx='1.3' opacity='0.13'/></g>` +
    `</svg>`,
);

const GOLD_GRADIENT_BG =
  'bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))]';

function formatDate(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale === 'zh-Hant' ? 'zh-TW' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function timezoneLabel(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes < 0 ? '-' : '+';
    const abs = Math.abs(offsetMinutes);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;
    return `(UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}) ${zone}`;
  } catch {
    return 'UTC';
  }
}

export const ProfilePage = React.memo(function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  config,
  locale,
  onNavigate,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
}: ProfilePageProps) {
  const isZhHant = locale === 'zh-Hant';
  const site = resolveBokmooSiteConfig(config);

  const go = React.useCallback(
    (path: string) => {
      if (onNavigate) {
        onNavigate(path);
        return;
      }
      const prefix = isZhHant ? '/zh-Hant' : '/en';
      window.location.assign(`${prefix}${path}`);
    },
    [onNavigate, isZhHant]
  );

  const [copied, setCopied] = React.useState(false);
  const copyEmail = React.useCallback(async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [user?.email]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4">
        <div className="w-full max-w-md">
          <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
              <UserRound className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
              {isZhHant ? '登入以查看您的個人檔案' : 'Sign in to view your profile'}
            </h2>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
              {isZhHant ? '請登入以查看您的 BOKMOO 帳戶' : 'Please log in to check your BOKMOO account'}
            </p>
            <button
              onClick={onNavigateToLogin}
              className={`mt-8 h-12 w-full rounded-full px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)] ${GOLD_GRADIENT_BG}`}
              type="button"
            >
              {isZhHant ? '登入' : 'Log In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--bokmoo-line)] border-t-[var(--bokmoo-gold)]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]">
            {isZhHant ? '正在載入個人資料…' : 'Loading profile...'}
          </p>
        </div>
      </div>
    );
  }

  const displayName = (user.name || '').trim();
  // The mockup greets with the full account name (an email address in
  // practice), so do not trim name-like values to a first word.
  const firstName = displayName ? displayName.split(/\s+/)[0] : '';
  const greeting = firstName
    ? isZhHant
      ? `你好，${firstName}！`
      : `Hi ${firstName}!`
    : isZhHant
      ? '你好！'
      : 'Hi there!';
  const accountInitial = (displayName || user.email).trim().charAt(0).toUpperCase();
  const memberSince = user.createdAt ? formatDate(user.createdAt, locale) : '—';

  const navItems = [
    {
      label: isZhHant ? '我的帳戶' : 'My Account',
      icon: UserRound,
      active: true,
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    { label: isZhHant ? '訂單紀錄' : 'Order History', icon: ShoppingBag, onClick: onNavigateToOrders },
    { label: isZhHant ? '我的行程' : 'My Trips', icon: Plane, onClick: onNavigateToOrders },
    { label: isZhHant ? '旅遊點數' : 'Travel Credits', icon: Mail, onClick: () => go('/affiliate') },
    { label: isZhHant ? '推廣計劃' : 'Affiliate Program', icon: Users, onClick: () => go('/affiliate') },
    { label: isZhHant ? '設定' : 'Settings', icon: Settings, onClick: onNavigateToSettings },
  ];

  const renderNavButton = (
    item: (typeof navItems)[number],
    layout: 'sidebar' | 'chip'
  ) => {
    const Icon = item.icon;
    const base =
      layout === 'sidebar'
        ? 'flex w-full shrink-0 items-center gap-3 rounded-[0.9rem] px-4 py-3 text-[0.92rem] font-medium transition-colors'
        : 'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[0.85rem] font-medium transition-colors';
    const tone = item.active
      ? layout === 'sidebar'
        ? 'bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_13%,transparent)] text-[var(--bokmoo-ink)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)]'
        : 'border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_13%,transparent)] text-[var(--bokmoo-ink)]'
      : 'border-transparent text-[var(--bokmoo-copy-soft)] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent)] hover:text-[var(--bokmoo-ink)]';
    return (
      <button key={item.label} onClick={item.onClick} className={`${base} ${tone}`} type="button">
        <Icon
          className={`h-[1.05rem] w-[1.05rem] ${item.active ? 'text-[var(--bokmoo-gold)]' : 'text-[color:color-mix(in_oklab,var(--bokmoo-copy-soft)_80%,var(--bokmoo-gold))]'}`}
        />
        {item.label}
      </button>
    );
  };

  const infoRowIcon = 'h-4 w-4 shrink-0 text-[var(--bokmoo-copy-soft)]';
  const editButtonClass =
    'inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-soft)_60%,transparent)] px-4 text-[0.8rem] font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]';

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_94%,black)] px-4 pb-10 pt-6 lg:flex">
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => renderNavButton(item, 'sidebar'))}
        </nav>

        <div className="mt-auto pt-10">
          <div
            onClick={() => go('/products')}
            className="group relative min-h-[13.5rem] cursor-pointer overflow-hidden rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] shadow-[var(--bokmoo-shadow)]"
            style={{ backgroundImage: PROMO_SCENE, backgroundSize: 'cover', backgroundPosition: 'center' }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,7,14,0.1),rgba(9,7,14,0.78))]" />
            <div className="relative flex min-h-[13.5rem] flex-col p-5">
              <h3 className="max-w-[9.5rem] text-xl font-bold leading-snug text-white">
                {isZhHant ? '探索更美好的夜晚' : 'Explore a Better Night'}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                {isZhHant ? '全球高級會所體驗，盡在掌握。' : 'Premium club experiences around the world.'}
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_86%,white),color-mix(in_oklab,var(--bokmoo-gold)_70%,black))] px-4 py-2 text-xs font-bold text-[var(--bokmoo-bg)] transition-transform duration-300 group-hover:-translate-y-0.5">
                {isZhHant ? '瀏覽目的地' : 'Browse Destinations'}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        {/* Mobile nav chips */}
        <div className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 lg:hidden">
          <div className="flex w-max gap-2">
            {navItems.map((item) => renderNavButton(item, 'chip'))}
          </div>
        </div>

        <div className="mx-auto max-w-[1200px] space-y-6">
          {/* Hero banner */}
          <section className="relative overflow-hidden rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[linear-gradient(115deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,black),color-mix(in_oklab,var(--bokmoo-bg-soft)_70%,var(--bokmoo-bg-elevated)))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] sm:block"
              style={{
                backgroundImage:
                  'radial-gradient(color-mix(in oklab, var(--bokmoo-gold) 26%, transparent) 1.2px, transparent 1.4px)',
                backgroundSize: '13px 13px',
                maskImage: 'radial-gradient(ellipse 85% 90% at 76% 48%, black 0%, transparent 74%)',
                WebkitMaskImage: 'radial-gradient(ellipse 85% 90% at 76% 48%, black 0%, transparent 74%)',
              }}
            />
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 hidden h-[150%] w-[44%] opacity-35 sm:block"
              viewBox="0 0 400 280"
              fill="none"
            >
              <defs>
                <linearGradient id="bokmoo-hero-arc" x1="0" y1="280" x2="400" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--bokmoo-gold)" stopOpacity="0" />
                  <stop offset="0.55" stopColor="var(--bokmoo-gold)" stopOpacity="0.8" />
                  <stop offset="1" stopColor="#f6d78a" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path d="M12 262C86 138 252 66 400 84" stroke="url(#bokmoo-hero-arc)" strokeWidth="1.5" />
              <path d="M52 280C124 168 276 100 400 116" stroke="url(#bokmoo-hero-arc)" strokeWidth="1" opacity="0.65" />
            </svg>

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative shrink-0 self-center sm:self-start">
                <div
                  className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-4xl font-bold text-[var(--bokmoo-bg)] shadow-[0_18px_44px_color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] ${GOLD_GRADIENT_BG}`}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    accountInitial
                  )}
                </div>
                <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[0.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_34%,transparent)] bg-[color:oklch(0.09_0.01_75_/_0.96)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-gold)]">
                  {isZhHant ? '會員' : 'Member'}
                </span>
              </div>

              <div className="min-w-0 text-center sm:text-left">
                <h1 className="text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-[var(--bokmoo-ink)]">
                  {greeting}
                </h1>
                <div className="mt-2.5 flex items-center justify-center gap-2 sm:justify-start">
                  <p className="truncate text-[0.95rem] text-[var(--bokmoo-copy)]">{user.email}</p>
                  <button
                    onClick={copyEmail}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.5rem] text-[var(--bokmoo-copy-soft)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] hover:text-[var(--bokmoo-gold)]"
                    type="button"
                    aria-label={isZhHant ? '複製電子郵件' : 'Copy email'}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-[var(--bokmoo-success)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[0.82rem] text-[var(--bokmoo-copy-soft)]">
                  {isZhHant ? '註冊於' : 'Member since'} {memberSince}
                </p>
              </div>

              <div aria-hidden="true" className="relative ml-auto hidden select-none flex-col items-end pr-2 lg:flex">
                <span
                  className="bg-[linear-gradient(120deg,#f6d78a,var(--bokmoo-gold-strong)_55%,#c99b3e)] bg-clip-text text-right text-[1.65rem] italic leading-[1.2] text-transparent"
                  style={{ fontFamily: SCRIPT_FONT }}
                >
                  Better Nights
                  <br />
                  Brighter Journeys
                </span>
                <Plane className="mt-1 h-5 w-5 -rotate-6 text-[color:color-mix(in_oklab,var(--bokmoo-gold)_78%,white)]" />
              </div>
            </div>
          </section>

          {/* Account information + preferences */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <UserRound className="h-[1.1rem] w-[1.1rem] text-[var(--bokmoo-gold)]" />
                  <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]">
                    {isZhHant ? '帳戶資料' : 'Account Information'}
                  </h3>
                </div>
                <button onClick={onNavigateToSettings} className={editButtonClass} type="button">
                  <PencilLine className="h-3.5 w-3.5" />
                  {isZhHant ? '編輯' : 'Edit'}
                </button>
              </div>
              <div className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--bokmoo-line)_55%,transparent)]">
                <div className="flex items-center gap-3 py-3.5">
                  <Mail className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32">
                    {isZhHant ? '電子郵件' : 'Email Address'}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-[var(--bokmoo-ink)] sm:text-left"
                    title={user.email}
                  >
                    {user.email}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <CalendarDays className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32">
                    {isZhHant ? '註冊日期' : 'Member Since'}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--bokmoo-ink)]">{memberSince}</span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <UserRound className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32">
                    {isZhHant ? '帳戶狀態' : 'Account Status'}
                  </span>
                  <span className="inline-flex items-center rounded-[0.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-success)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-success)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--bokmoo-success)]">
                    {isZhHant ? '有效會員' : 'Active Member'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Settings className="h-[1.1rem] w-[1.1rem] text-[var(--bokmoo-gold)]" />
                  <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]">
                    {isZhHant ? '偏好設定' : 'Account Preferences'}
                  </h3>
                </div>
                <button onClick={onNavigateToSettings} className={editButtonClass} type="button">
                  <PencilLine className="h-3.5 w-3.5" />
                  {isZhHant ? '編輯' : 'Edit'}
                </button>
              </div>
              <div className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--bokmoo-line)_55%,transparent)]">
                <div className="flex items-center gap-3 py-3.5">
                  <Globe2 className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32">
                    {isZhHant ? '語言' : 'Language'}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--bokmoo-ink)]">
                    {isZhHant ? '繁體中文' : 'English'}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <Clock3 className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32">
                    {isZhHant ? '時區' : 'Timezone'}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--bokmoo-ink)]">{timezoneLabel()}</span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <CalendarDays className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32">
                    {isZhHant ? '出生日期' : 'Date of Birth'}
                  </span>
                  <span className="flex-1 text-sm text-[var(--bokmoo-copy-soft)]">
                    {isZhHant ? '未設定' : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <Phone className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32">
                    {isZhHant ? '電話號碼' : 'Phone Number'}
                  </span>
                  <span className="flex-1 text-sm text-[var(--bokmoo-copy-soft)]">
                    {isZhHant ? '未設定' : 'Not set'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick links */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div
              onClick={onNavigateToOrders}
              className="group flex cursor-pointer items-center justify-between gap-4 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] sm:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_15%,transparent)] text-[var(--bokmoo-gold)]">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-[var(--bokmoo-ink)]">
                    {isZhHant ? '訂單紀錄' : 'Order History'}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--bokmoo-copy-soft)]">
                    {isZhHant ? '查看及管理您的訂單' : 'View and manage your orders'}
                  </p>
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--bokmoo-line-strong)] text-[var(--bokmoo-copy)] transition-colors group-hover:border-[var(--bokmoo-gold)] group-hover:text-[var(--bokmoo-gold)]">
                <ChevronRight className="h-[1.1rem] w-[1.1rem]" />
              </span>
            </div>

            <div
              onClick={onNavigateToOrders}
              className="group flex cursor-pointer items-center justify-between gap-4 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] sm:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_15%,transparent)] text-[var(--bokmoo-gold)]">
                  <Plane className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-[var(--bokmoo-ink)]">
                    {isZhHant ? '即將到來的行程' : 'Upcoming Trips'}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--bokmoo-copy-soft)]">
                    {isZhHant ? '您已預訂的體驗' : 'Your booked experiences'}
                  </p>
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--bokmoo-line-strong)] text-[var(--bokmoo-copy)] transition-colors group-hover:border-[var(--bokmoo-gold)] group-hover:text-[var(--bokmoo-gold)]">
                <ChevronRight className="h-[1.1rem] w-[1.1rem]" />
              </span>
            </div>
          </section>

          {/* Clubs / benefits / support */}
          <section className="grid gap-6 lg:grid-cols-3">
            <div
              onClick={() => go(site.primaryCtaHref || '/products')}
              className="group relative min-h-[15rem] cursor-pointer overflow-hidden rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] shadow-[var(--bokmoo-shadow)]"
              style={{ backgroundImage: CLUBS_SCENE, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(92deg,rgba(8,6,4,0.86)_8%,rgba(8,6,4,0.42)_58%,rgba(8,6,4,0.12))]" />
              <div className="relative flex h-full flex-col p-6">
                <h3 className="text-[1.55rem] font-bold leading-tight text-white">
                  {isZhHant ? '探索尊貴會所' : (
                    <>
                      Discover
                      <br />
                      Exclusive Clubs
                    </>
                  )}
                </h3>
                <p className="mt-2.5 max-w-[15rem] text-sm leading-relaxed text-white/75">
                  {isZhHant ? '與 BOKMOO 通行全球頂級場所。' : "Access the world's best venues with BOKMOO."}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_86%,white),color-mix(in_oklab,var(--bokmoo-gold)_70%,black))] px-5 py-2.5 text-[0.8rem] font-bold text-[var(--bokmoo-bg)] transition-transform duration-300 group-hover:-translate-y-0.5">
                  {isZhHant ? '立即探索' : 'Explore Now'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="flex items-center gap-2.5">
                <Crown className="h-5 w-5 text-[var(--bokmoo-gold)]" />
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]">
                  {isZhHant ? 'BOKMOO 會員權益' : 'BOKMOO Member Benefits'}
                </h3>
              </div>
              <ul className="mt-5 space-y-3.5">
                {(
                  isZhHant
                    ? ['全球頂級會所通行', '會員專屬優惠', '輕鬆預訂，即時確認', '專屬支援']
                    : [
                        'Access to premier clubs worldwide',
                        'Exclusive member-only offers',
                        'Easy booking and instant confirmation',
                        'Dedicated support',
                      ]
                ).map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bokmoo-gold)]" />
                    <span className="text-sm leading-relaxed text-[var(--bokmoo-copy)]">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]">
              <div className="flex items-center gap-2.5">
                <Headphones className="h-5 w-5 text-[var(--bokmoo-gold)]" />
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]">
                  {isZhHant ? '需要協助？' : 'Need Help?'}
                </h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--bokmoo-copy-soft)]">
                {isZhHant ? '我們的支援團隊隨時為您服務。' : 'Our support team is here for you.'}
              </p>
              <button
                onClick={() => go('/contact')}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_46%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-sm font-semibold text-[var(--bokmoo-gold)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)]"
                type="button"
              >
                {isZhHant ? '聯絡客服' : 'Contact Support'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => go('/help')}
                className="mt-5 inline-flex items-center justify-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] transition-colors hover:text-[var(--bokmoo-ink)]"
                type="button"
              >
                <BookOpen className="h-4 w-4" />
                {isZhHant ? '前往幫助中心' : 'Visit Help Center'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

export default ProfilePage;
