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
  Gift,
  Globe2,
  Headphones,
  Mail,
  PencilLine,
  Phone,
  Plane,
  Settings,
  ShoppingBag,
  UserRound,
  Users, MapPin } from 'lucide-react';
import type { ProfilePageProps } from 'shared/src/types/theme';
import { pickCopy, resolveEsimSiteConfig } from '../site';
import { getEsimAssets, redeemEsimCode, EsimApiError, type EsimAsset } from '../lib/api';

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
  'bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_82%,white),color-mix(in_oklab,var(--esim-gold)_65%,black))]';

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


/**
 * 我的 eSIM — the buyer's provisioned eSIM assets (BOSS registry keyed by
 * the account email). Renders nothing while unauthenticated or when the
 * library is empty, so it never bothers guest visitors.
 */
function MyEsimAssets({ apiBaseUrl, email, locale }: { apiBaseUrl: string; email?: string; locale?: string }) {
  const [assets, setAssets] = React.useState<EsimAsset[] | null>(null);

  React.useEffect(() => {
    if (!email) return;
    let mounted = true;
    (async () => {
      const list = await getEsimAssets({ baseUrl: apiBaseUrl });
      if (mounted) setAssets(list);
    })();
    return () => { mounted = false; };
  }, [apiBaseUrl, email]);

  if (!email || !assets || assets.length === 0) return null;

  return (
    <section className="rounded-[var(--esim-radius-lg)] border border-[color:color-mix(in_oklab,var(--esim-gold)_18%,var(--esim-line))] bg-[color:color-mix(in_oklab,var(--esim-bg-elevated)_92%,black)] p-5 shadow-[var(--esim-shadow)] sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-[var(--esim-ink)]">
          {pickCopy(locale, { en: 'My eSIMs', hans: '我的 eSIM', hant: '我的 eSIM' })}
        </h2>
        <span className="text-xs text-[var(--esim-copy-soft)]">{assets.length}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--esim-copy-soft)]">
        {pickCopy(locale, {
          en: 'Plans you buy are added to these profiles — no new QR code, no reinstall.',
          hans: '新购套餐会直接加进这些 profile——不发新二维码、无需重装。',
          hant: '新購套餐會直接加進這些 profile——不發新二維碼、無需重裝。',
        })}
      </p>
      <div className="mt-4 grid gap-3">
        {assets.map((asset) => (
          <div key={asset.iccid} className="rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_86%,black)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--esim-ink)]">
                {asset.label || pickCopy(locale, { en: 'Bokmoo eSIM', hans: 'Bokmoo eSIM', hant: 'Bokmoo eSIM' })}
              </p>
              <span className="rounded-full border border-[color:color-mix(in_oklab,var(--esim-gold)_34%,transparent)] px-2 py-0.5 text-[10px] tracking-[0.14em] text-[var(--esim-gold)]">
                {(asset.status || 'ACTIVE').toUpperCase()}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-xs text-[var(--esim-copy-soft)]">ICCID ····{asset.iccid.slice(-6)}</p>
            {asset.packages && asset.packages.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--esim-copy)]">
                {asset.packages.map((pkg) => pkg.name).filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
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
  addresses,
  isLoadingAddresses,
  onAddAddress,
  onDeleteAddress,
  onSetDefaultAddress,
}: ProfilePageProps) {
  const isZhHant = locale === 'zh-Hant';
  const [showAddressForm, setShowAddressForm] = React.useState(false);
  const site = resolveEsimSiteConfig(config);

  const go = React.useCallback(
    (path: string) => {
      if (onNavigate) {
        onNavigate(path);
        return;
      }
      const prefix = locale === 'zh-Hant' ? '/zh-Hant' : locale === 'zh-Hans' ? '/zh-Hans' : '/en';
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

  // Redemption code panel (coupon plugin: product grants → comped PAID order,
  // or subscription periods).
  const [redeemOpen, setRedeemOpen] = React.useState(false);
  const [redeemValue, setRedeemValue] = React.useState('');
  const [redeemBusy, setRedeemBusy] = React.useState(false);
  const [redeemError, setRedeemError] = React.useState<string | null>(null);
  const redeemInputId = 'esim-redeem-code-input';

  const redeemErrorCopy = React.useCallback((code: string | undefined): string => {
    switch (code) {
      case 'REDEMPTION_CODE_INVALID':
        return pickCopy(locale, {
          en: 'This code is invalid or expired. Please double-check and try again.',
          hans: '兑换码无效或已过期，请核对后重试。',
          hant: '兌換碼無效或已過期，請核對後重試。',
        });
      case 'REDEMPTION_CODE_ALREADY_CLAIMED':
        return pickCopy(locale, {
          en: 'This code has already been redeemed.',
          hans: '该兑换码已被使用。',
          hant: '該兌換碼已被使用。',
        });
      case 'REDEMPTION_CODE_EXHAUSTED':
        return pickCopy(locale, {
          en: 'This code has reached its redemption limit.',
          hans: '该兑换码已达兑换上限。',
          hant: '該兌換碼已達兌換上限。',
        });
      case 'REDEMPTION_CODE_ASSIGNED':
        return pickCopy(locale, {
          en: 'This code is assigned to a different account.',
          hans: '该兑换码绑定在其他帐户。',
          hant: '該兌換碼綁定在其他帳戶。',
        });
      case 'REDEMPTION_PRODUCT_NOT_FOUND':
      case 'REDEMPTION_PRODUCT_NOT_CONFIGURED':
        return pickCopy(locale, {
          en: 'The product tied to this code is currently unavailable. Please contact support.',
          hans: '兑换码对应的套餐暂时不可用，请联系客服。',
          hant: '兌換碼對應的套餐暫時不可用，請聯絡客服。',
        });
      case 'REDEMPTION_CORE_UNSUPPORTED':
        return pickCopy(locale, {
          en: 'Redemption is temporarily unavailable. Please try again later.',
          hans: '兑换功能暂时不可用，请稍后重试。',
          hant: '兌換功能暫時不可用，請稍後重試。',
        });
      default:
        return pickCopy(locale, {
          en: 'Redemption failed. Please try again later.',
          hans: '兑换失败，请稍后重试。',
          hant: '兌換失敗，請稍後重試。',
        });
    }
  }, [locale]);

  const handleRedeem = React.useCallback(async () => {
    const trimmed = redeemValue.trim();
    if (!trimmed || redeemBusy) return;
    setRedeemBusy(true);
    setRedeemError(null);
    try {
      const result = await redeemEsimCode({ baseUrl: '' }, trimmed, `profile:${Date.now()}`);
      if (result.orderId) {
        go(`/orders/${encodeURIComponent(result.orderId)}`);
        return;
      }
      window.location.reload();
    } catch (error) {
      setRedeemError(redeemErrorCopy(error instanceof EsimApiError ? error.code : undefined));
    } finally {
      setRedeemBusy(false);
    }
  }, [redeemValue, redeemBusy, redeemErrorCopy, go]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--esim-bg)] px-4">
        <div className="w-full max-w-md">
          <div className="rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-10 text-center shadow-[var(--esim-shadow)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--esim-gold)_14%,transparent)] text-[var(--esim-gold)]">
              <UserRound className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-3xl leading-[1] tracking-[-0.04em] text-[var(--esim-ink)]">
              {pickCopy(locale, { en: 'Sign in to view your profile', hans: '登入以查看您的个人档案', hant: '登入以查看您的個人檔案' })}
            </h2>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
              {pickCopy(locale, { en: 'Please log in to check your BOKMOO account', hans: '请登入以查看您的 BOKMOO 帐户', hant: '請登入以查看您的 BOKMOO 帳戶' })}
            </p>
            <button
              onClick={onNavigateToLogin}
              className={`mt-8 h-12 w-full rounded-full px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--esim-bg)] ${GOLD_GRADIENT_BG}`}
              type="button"
            >
              {pickCopy(locale, { en: 'Log In', hans: '登入', hant: '登入' })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--esim-bg)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--esim-line)] border-t-[var(--esim-gold)]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--esim-copy-soft)]">
            {pickCopy(locale, { en: 'Loading profile...', hans: '正在载入个人资料…', hant: '正在載入個人資料…' })}
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
    ? locale === 'zh-Hant'
      ? `你好，${firstName}！`
      : locale === 'zh-Hans'
        ? `你好，${firstName}！`
        : `Hi ${firstName}!`
    : locale === 'zh-Hant'
      ? '你好！'
      : locale === 'zh-Hans'
        ? '你好！'
        : 'Hi there!';
  const accountInitial = (displayName || user.email).trim().charAt(0).toUpperCase();
  const memberSince = user.createdAt ? formatDate(user.createdAt, locale) : '—';

  const navItems = [
    {
      label: pickCopy(locale, { en: 'My Account', hans: '我的帐户', hant: '我的帳戶' }),
      icon: UserRound,
      active: true,
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    { label: pickCopy(locale, { en: 'Order History', hans: '订单纪录', hant: '訂單紀錄' }), icon: ShoppingBag, onClick: onNavigateToOrders },
    { label: pickCopy(locale, { en: 'My Trips', hans: '我的行程', hant: '我的行程' }), icon: Plane, onClick: onNavigateToOrders },
    { label: pickCopy(locale, { en: 'Travel Credits', hans: '旅游点数', hant: '旅遊點數' }), icon: Mail, onClick: () => go('/affiliate') },
    { label: pickCopy(locale, { en: 'Affiliate Program', hans: '推广计划', hant: '推廣計劃' }), icon: Users, onClick: () => go('/affiliate') },
    { label: pickCopy(locale, { en: 'Settings', hans: '设定', hant: '設定' }), icon: Settings, onClick: onNavigateToSettings },
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
        ? 'bg-[color:color-mix(in_oklab,var(--esim-gold)_13%,transparent)] text-[var(--esim-ink)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--esim-gold)_22%,transparent)]'
        : 'border-[color:color-mix(in_oklab,var(--esim-gold)_36%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-gold)_13%,transparent)] text-[var(--esim-ink)]'
      : 'border-transparent text-[var(--esim-copy-soft)] hover:bg-[color:color-mix(in_oklab,var(--esim-gold)_8%,transparent)] hover:text-[var(--esim-ink)]';
    return (
      <button key={item.label} onClick={item.onClick} className={`${base} ${tone}`} type="button">
        <Icon
          className={`h-[1.05rem] w-[1.05rem] ${item.active ? 'text-[var(--esim-gold)]' : 'text-[color:color-mix(in_oklab,var(--esim-copy-soft)_80%,var(--esim-gold))]'}`}
        />
        {item.label}
      </button>
    );
  };

  const infoRowIcon = 'h-4 w-4 shrink-0 text-[var(--esim-copy-soft)]';
  const editButtonClass =
    'inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--esim-line-strong)] bg-[color:color-mix(in_oklab,var(--esim-bg-soft)_60%,transparent)] px-4 text-[0.8rem] font-semibold text-[var(--esim-ink)] transition-colors hover:border-[var(--esim-gold)] hover:text-[var(--esim-gold)]';

  return (
    <div className="min-h-screen bg-[var(--esim-bg)] lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_94%,black)] px-4 pb-10 pt-6 lg:flex">
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => renderNavButton(item, 'sidebar'))}
        </nav>

        <div className="mt-auto pt-10">
          <div
            onClick={() => go('/products')}
            className="group relative min-h-[13.5rem] cursor-pointer overflow-hidden rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] shadow-[var(--esim-shadow)]"
            style={{ backgroundImage: PROMO_SCENE, backgroundSize: 'cover', backgroundPosition: 'center' }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,7,14,0.1),rgba(9,7,14,0.78))]" />
            <div className="relative flex min-h-[13.5rem] flex-col p-5">
              <h3 className="max-w-[9.5rem] text-xl font-bold leading-snug text-white">
                {pickCopy(locale, { en: 'Explore a Better Night', hans: '探索更美好的夜晚', hant: '探索更美好的夜晚' })}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                {pickCopy(locale, { en: 'Premium club experiences around the world.', hans: '全球高级会所体验，尽在掌握。', hant: '全球高級會所體驗，盡在掌握。' })}
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_86%,white),color-mix(in_oklab,var(--esim-gold)_70%,black))] px-4 py-2 text-xs font-bold text-[var(--esim-bg)] transition-transform duration-300 group-hover:-translate-y-0.5">
                {pickCopy(locale, { en: 'Browse Destinations', hans: '浏览目的地', hant: '瀏覽目的地' })}
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
          <section className="relative overflow-hidden rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[linear-gradient(115deg,color-mix(in_oklab,var(--esim-bg-elevated)_96%,black),color-mix(in_oklab,var(--esim-bg-soft)_70%,var(--esim-bg-elevated)))] p-6 shadow-[var(--esim-shadow)] sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] sm:block"
              style={{
                backgroundImage:
                  'radial-gradient(color-mix(in oklab, var(--esim-gold) 26%, transparent) 1.2px, transparent 1.4px)',
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
                <linearGradient id="esim-hero-arc" x1="0" y1="280" x2="400" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--esim-gold)" stopOpacity="0" />
                  <stop offset="0.55" stopColor="var(--esim-gold)" stopOpacity="0.8" />
                  <stop offset="1" stopColor="#f6d78a" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path d="M12 262C86 138 252 66 400 84" stroke="url(#esim-hero-arc)" strokeWidth="1.5" />
              <path d="M52 280C124 168 276 100 400 116" stroke="url(#esim-hero-arc)" strokeWidth="1" opacity="0.65" />
            </svg>

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative shrink-0 self-center sm:self-start">
                <div
                  className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-4xl font-bold text-[var(--esim-bg)] shadow-[0_18px_44px_color-mix(in_oklab,var(--esim-gold)_24%,transparent)] ${GOLD_GRADIENT_BG}`}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    accountInitial
                  )}
                </div>
                <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[0.45rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_34%,transparent)] bg-[color:oklch(0.09_0.01_75_/_0.96)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--esim-gold)]">
                  {pickCopy(locale, { en: 'Member', hans: '会员', hant: '會員' })}
                </span>
              </div>

              <div className="min-w-0 text-center sm:text-left">
                <h1 className="text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-[var(--esim-ink)]">
                  {greeting}
                </h1>
                <div className="mt-2.5 flex items-center justify-center gap-2 sm:justify-start">
                  <p className="truncate text-[0.95rem] text-[var(--esim-copy)]">{user.email}</p>
                  <button
                    onClick={copyEmail}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.5rem] text-[var(--esim-copy-soft)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--esim-gold)_10%,transparent)] hover:text-[var(--esim-gold)]"
                    type="button"
                    aria-label={pickCopy(locale, { en: 'Copy email', hans: '复制电子邮件', hant: '複製電子郵件' })}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-[var(--esim-success)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[0.82rem] text-[var(--esim-copy-soft)]">
                  {pickCopy(locale, { en: 'Member since', hans: '注册于', hant: '註冊於' })} {memberSince}
                </p>
              </div>

              <div aria-hidden="true" className="relative ml-auto hidden select-none flex-col items-end pr-2 lg:flex">
                <span
                  className="bg-[linear-gradient(120deg,#f6d78a,var(--esim-gold-strong)_55%,#c99b3e)] bg-clip-text text-right text-[1.65rem] italic leading-[1.2] text-transparent"
                  style={{ fontFamily: SCRIPT_FONT }}
                >
                  Better Nights
                  <br />
                  Brighter Journeys
                </span>
                <Plane className="mt-1 h-5 w-5 -rotate-6 text-[color:color-mix(in_oklab,var(--esim-gold)_78%,white)]" />
              </div>
            </div>
          </section>

          <MyEsimAssets apiBaseUrl={site.apiBaseUrl} email={user?.email} locale={locale} />
          {/* Redemption code (coupon plugin) */}
          <section className="rounded-[var(--esim-radius-lg)] border border-[color:color-mix(in_oklab,var(--esim-gold)_32%,var(--esim-line))] bg-[color:color-mix(in_oklab,var(--esim-gold)_6%,var(--esim-bg-elevated))] p-6 shadow-[var(--esim-shadow)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gift className="h-[1.1rem] w-[1.1rem] text-[var(--esim-gold)]" />
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--esim-ink)]">
                  {pickCopy(locale, { en: 'Redeem a Code', hans: '兑换码', hant: '兌換碼' })}
                </h3>
              </div>
              <button
                onClick={() => setRedeemOpen((open) => !open)}
                className={editButtonClass}
                type="button"
                aria-expanded={redeemOpen}
                aria-controls={redeemInputId}
              >
                {redeemOpen
                  ? pickCopy(locale, { en: 'Close', hans: '收起', hant: '收起' })
                  : pickCopy(locale, { en: 'Enter Code', hans: '输入兑换码', hant: '輸入兌換碼' })}
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--esim-copy-soft)]">
              {pickCopy(locale, {
                en: 'Have a redemption code? Enter it to add an eSIM plan or subscription to your account.',
                hans: '持有兑换码？输入即可将 eSIM 套餐或订阅加入您的帐户。',
                hant: '持有兌換碼？輸入即可將 eSIM 套餐或訂閱加入您的帳戶。',
              })}
            </p>
            {redeemOpen && (
              <div className="mt-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id={redeemInputId}
                    type="text"
                    value={redeemValue}
                    onChange={(event) => setRedeemValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleRedeem();
                    }}
                    placeholder={pickCopy(locale, {
                      en: 'e.g. ESIM-JP-7D',
                      hans: '例如 ESIM-JP-7D',
                      hant: '例如 ESIM-JP-7D',
                    })}
                    disabled={redeemBusy}
                    className="flex-1 rounded-[var(--esim-radius-md,0.75rem)] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 py-2.5 uppercase tracking-wide text-[var(--esim-ink)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--esim-gold)_55%,transparent)] disabled:opacity-60"
                  />
                  <button
                    onClick={() => void handleRedeem()}
                    disabled={redeemBusy || !redeemValue.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--esim-radius-md,0.75rem)] bg-[var(--esim-gold)] px-6 py-2.5 font-semibold text-[color:color-mix(in_oklab,var(--esim-gold)_18%,black)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                  >
                    {redeemBusy
                      ? pickCopy(locale, { en: 'Redeeming…', hans: '兑换中…', hant: '兌換中…' })
                      : pickCopy(locale, { en: 'Redeem', hans: '兑换', hant: '兌換' })}
                  </button>
                </div>
                {redeemError && (
                  <p className="mt-3 text-sm text-red-500">{redeemError}</p>
                )}
              </div>
            )}
          </section>

          {/* Account information + preferences */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 shadow-[var(--esim-shadow)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <UserRound className="h-[1.1rem] w-[1.1rem] text-[var(--esim-gold)]" />
                  <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--esim-ink)]">
                    {pickCopy(locale, { en: 'Account Information', hans: '帐户资料', hant: '帳戶資料' })}
                  </h3>
                </div>
                <button onClick={onNavigateToSettings} className={editButtonClass} type="button">
                  <PencilLine className="h-3.5 w-3.5" />
                  {pickCopy(locale, { en: 'Edit', hans: '编辑', hant: '編輯' })}
                </button>
              </div>
              <div className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--esim-line)_55%,transparent)]">
                <div className="flex items-center gap-3 py-3.5">
                  <Mail className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--esim-copy-soft)] sm:w-32">
                    {pickCopy(locale, { en: 'Email Address', hans: '电子邮件', hant: '電子郵件' })}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-[var(--esim-ink)] sm:text-left"
                    title={user.email}
                  >
                    {user.email}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <CalendarDays className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--esim-copy-soft)] sm:w-32">
                    {pickCopy(locale, { en: 'Member Since', hans: '注册日期', hant: '註冊日期' })}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--esim-ink)]">{memberSince}</span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <UserRound className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--esim-copy-soft)] sm:w-32">
                    {pickCopy(locale, { en: 'Account Status', hans: '帐户状态', hant: '帳戶狀態' })}
                  </span>
                  <span className="inline-flex items-center rounded-[0.45rem] border border-[color:color-mix(in_oklab,var(--esim-success)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-success)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--esim-success)]">
                    {pickCopy(locale, { en: 'Active Member', hans: '有效会员', hant: '有效會員' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 shadow-[var(--esim-shadow)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Settings className="h-[1.1rem] w-[1.1rem] text-[var(--esim-gold)]" />
                  <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--esim-ink)]">
                    {pickCopy(locale, { en: 'Account Preferences', hans: '偏好设定', hant: '偏好設定' })}
                  </h3>
                </div>
                <button onClick={onNavigateToSettings} className={editButtonClass} type="button">
                  <PencilLine className="h-3.5 w-3.5" />
                  {pickCopy(locale, { en: 'Edit', hans: '编辑', hant: '編輯' })}
                </button>
              </div>
              <div className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--esim-line)_55%,transparent)]">
                <div className="flex items-center gap-3 py-3.5">
                  <Globe2 className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--esim-copy-soft)] sm:w-32">
                    {pickCopy(locale, { en: 'Language', hans: '语言', hant: '語言' })}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--esim-ink)]">
                    {pickCopy(locale, { en: 'English', hans: '繁体中文', hant: '繁體中文' })}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <Clock3 className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--esim-copy-soft)] sm:w-32">
                    {pickCopy(locale, { en: 'Timezone', hans: '时区', hant: '時區' })}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--esim-ink)]">{timezoneLabel()}</span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <CalendarDays className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--esim-copy-soft)] sm:w-32">
                    {pickCopy(locale, { en: 'Date of Birth', hans: '出生日期', hant: '出生日期' })}
                  </span>
                  <span className="flex-1 text-sm text-[var(--esim-copy-soft)]">
                    {pickCopy(locale, { en: 'Not set', hans: '未设定', hant: '未設定' })}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3.5">
                  <Phone className={infoRowIcon} />
                  <span className="w-28 shrink-0 text-sm text-[var(--esim-copy-soft)] sm:w-32">
                    {pickCopy(locale, { en: 'Phone Number', hans: '电话号码', hant: '電話號碼' })}
                  </span>
                  <span className="flex-1 text-sm text-[var(--esim-copy-soft)]">
                    {pickCopy(locale, { en: 'Not set', hans: '未设定', hant: '未設定' })}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* My addresses */}
          {onAddAddress ? (
            <section className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-5 shadow-[var(--esim-shadow)] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_15%,transparent)] text-[var(--esim-gold)]">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-[var(--esim-ink)]">
                      {pickCopy(locale, { en: 'My Addresses', hans: '我的地址', hant: '我的地址' })}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--esim-copy-soft)]">
                      {pickCopy(locale, { en: 'Saved shipping addresses for checkout', hans: '结算时使用的收货地址', hant: '結帳時使用的收貨地址' })}
                    </p>
                  </div>
                </div>
              </div>

              {isLoadingAddresses ? (
                <p className="mt-5 text-sm text-[var(--esim-copy-soft)]">
                  {pickCopy(locale, { en: 'Loading…', hans: '加载中…', hant: '載入中…' })}
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {(addresses ?? []).length === 0 ? (
                    <p className="text-sm text-[var(--esim-copy-soft)]">
                      {pickCopy(locale, { en: 'No saved addresses yet.', hans: '还没有保存的地址。', hant: '還沒有保存的地址。' })}
                    </p>
                  ) : (
                    (addresses ?? []).map((address: NonNullable<ProfilePageProps['addresses']>[number]) => (
                      <div
                        key={address.id}
                        className="flex flex-col gap-3 rounded-[1rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-sm">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-[var(--esim-ink)]">
                            {address.name}
                            {address.isDefault ? (
                              <span className="rounded-full bg-[color:color-mix(in_oklab,var(--esim-gold)_20%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--esim-gold)]">
                                {pickCopy(locale, { en: 'Default', hans: '默认', hant: '預設' })}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1 text-[var(--esim-copy)]">
                            {address.phone} · {address.line1}
                            {address.city ? `, ${address.city}` : ''}
                            {address.state ? `, ${address.state}` : ''}
                            {address.country ? ` · ${address.country}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!address.isDefault && onSetDefaultAddress ? (
                            <button
                              onClick={() => void onSetDefaultAddress(address.id)}
                              className="rounded-full border border-[var(--esim-line)] px-3 py-1.5 text-xs text-[var(--esim-copy)] transition-colors hover:border-[var(--esim-gold)] hover:text-[var(--esim-gold)]"
                              type="button"
                            >
                              {pickCopy(locale, { en: 'Set default', hans: '设为默认', hant: '設為預設' })}
                            </button>
                          ) : null}
                          {onDeleteAddress ? (
                            <button
                              onClick={() => void onDeleteAddress(address.id)}
                              className="rounded-full border border-[var(--esim-line)] px-3 py-1.5 text-xs text-[var(--esim-copy)] transition-colors hover:border-[var(--esim-danger)] hover:text-[var(--esim-danger)]"
                              type="button"
                            >
                              {pickCopy(locale, { en: 'Delete', hans: '删除', hant: '刪除' })}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}

                  {showAddressForm ? (
                    <form
                      className="grid gap-3 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_18%,var(--esim-line))] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] p-4 sm:grid-cols-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        const input = {
                          name: String(data.get('name') || '').trim(),
                          phone: String(data.get('phone') || '').trim(),
                          line1: String(data.get('line1') || '').trim(),
                          city: String(data.get('city') || '').trim(),
                          state: String(data.get('state') || '').trim(),
                          postalCode: String(data.get('postalCode') || '').trim(),
                          country: String(data.get('country') || '').trim(),
                        };
                        if (!input.name || !input.phone || !input.line1 || !input.city || !input.country) return;
                        void onAddAddress(input).then(() => setShowAddressForm(false));
                      }}
                    >
                      <input name="name" required placeholder={pickCopy(locale, { en: 'Full name', hans: '姓名', hant: '姓名' })} className="rounded-[0.7rem] border border-[var(--esim-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--esim-ink)] outline-none focus:border-[var(--esim-gold)]" />
                      <input name="phone" required placeholder={pickCopy(locale, { en: 'Phone', hans: '手机号', hant: '手機號' })} className="rounded-[0.7rem] border border-[var(--esim-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--esim-ink)] outline-none focus:border-[var(--esim-gold)]" />
                      <input name="line1" required placeholder={pickCopy(locale, { en: 'Address', hans: '详细地址', hant: '詳細地址' })} className="sm:col-span-2 rounded-[0.7rem] border border-[var(--esim-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--esim-ink)] outline-none focus:border-[var(--esim-gold)]" />
                      <input name="city" required placeholder={pickCopy(locale, { en: 'City', hans: '城市', hant: '城市' })} className="rounded-[0.7rem] border border-[var(--esim-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--esim-ink)] outline-none focus:border-[var(--esim-gold)]" />
                      <input name="state" placeholder={pickCopy(locale, { en: 'State / Province', hans: '省/州', hant: '省/州' })} className="rounded-[0.7rem] border border-[var(--esim-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--esim-ink)] outline-none focus:border-[var(--esim-gold)]" />
                      <input name="postalCode" placeholder={pickCopy(locale, { en: 'Postal code', hans: '邮编', hant: '郵遞區號' })} className="rounded-[0.7rem] border border-[var(--esim-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--esim-ink)] outline-none focus:border-[var(--esim-gold)]" />
                      <input name="country" required placeholder={pickCopy(locale, { en: 'Country (e.g. CN)', hans: '国家（如 CN）', hant: '國家（如 CN）' })} className="rounded-[0.7rem] border border-[var(--esim-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--esim-ink)] outline-none focus:border-[var(--esim-gold)]" />
                      <div className="flex items-center justify-end gap-2 sm:col-span-2">
                        <button onClick={() => setShowAddressForm(false)} className="rounded-full px-4 py-2 text-xs text-[var(--esim-copy)]" type="button">
                          {pickCopy(locale, { en: 'Cancel', hans: '取消', hant: '取消' })}
                        </button>
                        <button className="rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_82%,white),color-mix(in_oklab,var(--esim-gold)_68%,black))] px-5 py-2 text-xs font-semibold text-[var(--esim-bg)]" type="submit">
                          {pickCopy(locale, { en: 'Save address', hans: '保存地址', hant: '保存地址' })}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-dashed border-[color:color-mix(in_oklab,var(--esim-gold)_38%,transparent)] px-4 text-xs font-medium text-[var(--esim-gold)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--esim-gold)_10%,transparent)]"
                      type="button"
                    >
                      + {pickCopy(locale, { en: 'Add a new address', hans: '添加新地址', hant: '添加新地址' })}
                    </button>
                  )}
                </div>
              )}
            </section>
          ) : null}

          {/* Quick links */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div
              onClick={onNavigateToOrders}
              className="group flex cursor-pointer items-center justify-between gap-4 rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-5 shadow-[var(--esim-shadow)] transition-colors hover:border-[color:color-mix(in_oklab,var(--esim-gold)_38%,transparent)] sm:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_15%,transparent)] text-[var(--esim-gold)]">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-[var(--esim-ink)]">
                    {pickCopy(locale, { en: 'Order History', hans: '订单纪录', hant: '訂單紀錄' })}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--esim-copy-soft)]">
                    {pickCopy(locale, { en: 'View and manage your orders', hans: '查看及管理您的订单', hant: '查看及管理您的訂單' })}
                  </p>
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--esim-line-strong)] text-[var(--esim-copy)] transition-colors group-hover:border-[var(--esim-gold)] group-hover:text-[var(--esim-gold)]">
                <ChevronRight className="h-[1.1rem] w-[1.1rem]" />
              </span>
            </div>

            <div
              onClick={onNavigateToOrders}
              className="group flex cursor-pointer items-center justify-between gap-4 rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-5 shadow-[var(--esim-shadow)] transition-colors hover:border-[color:color-mix(in_oklab,var(--esim-gold)_38%,transparent)] sm:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_15%,transparent)] text-[var(--esim-gold)]">
                  <Plane className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-[var(--esim-ink)]">
                    {pickCopy(locale, { en: 'Upcoming Trips', hans: '即将到来的行程', hant: '即將到來的行程' })}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--esim-copy-soft)]">
                    {pickCopy(locale, { en: 'Your booked experiences', hans: '您已预订的体验', hant: '您已預訂的體驗' })}
                  </p>
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--esim-line-strong)] text-[var(--esim-copy)] transition-colors group-hover:border-[var(--esim-gold)] group-hover:text-[var(--esim-gold)]">
                <ChevronRight className="h-[1.1rem] w-[1.1rem]" />
              </span>
            </div>
          </section>

          {/* Clubs / benefits / support */}
          <section className="grid gap-6 lg:grid-cols-3">
            <div
              onClick={() => go(site.primaryCtaHref || '/products')}
              className="group relative min-h-[15rem] cursor-pointer overflow-hidden rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] shadow-[var(--esim-shadow)]"
              style={{ backgroundImage: CLUBS_SCENE, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(92deg,rgba(8,6,4,0.86)_8%,rgba(8,6,4,0.42)_58%,rgba(8,6,4,0.12))]" />
              <div className="relative flex h-full flex-col p-6">
                <h3 className="text-[1.55rem] font-bold leading-tight text-white">
                  {locale === 'zh-Hant' ? '探索尊貴會所' : locale === 'zh-Hans' ? '探索尊贵会所' : (
                    <>
                      Discover
                      <br />
                      Exclusive Clubs
                    </>
                  )}
                </h3>
                <p className="mt-2.5 max-w-[15rem] text-sm leading-relaxed text-white/75">
                  {pickCopy(locale, { en: "Access the world's best venues with BOKMOO.", hans: '与 BOKMOO 通行全球顶级场所。', hant: '與 BOKMOO 通行全球頂級場所。' })}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_86%,white),color-mix(in_oklab,var(--esim-gold)_70%,black))] px-5 py-2.5 text-[0.8rem] font-bold text-[var(--esim-bg)] transition-transform duration-300 group-hover:-translate-y-0.5">
                  {pickCopy(locale, { en: 'Explore Now', hans: '立即探索', hant: '立即探索' })}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 shadow-[var(--esim-shadow)]">
              <div className="flex items-center gap-2.5">
                <Crown className="h-5 w-5 text-[var(--esim-gold)]" />
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--esim-ink)]">
                  {pickCopy(locale, { en: 'BOKMOO Member Benefits', hans: 'BOKMOO 会员权益', hant: 'BOKMOO 會員權益' })}
                </h3>
              </div>
              <ul className="mt-5 space-y-3.5">
                {(
                  locale === 'zh-Hant'
                    ? ['全球頂級會所通行', '會員專屬優惠', '輕鬆預訂，即時確認', '專屬支援']
                    : locale === 'zh-Hans'
                    ? ['全球顶级会所通行', '会员专属优惠', '轻松预订，即时确认', '专属支援']
                    : [
                        'Access to premier clubs worldwide',
                        'Exclusive member-only offers',
                        'Easy booking and instant confirmation',
                        'Dedicated support',
                      ]
                ).map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--esim-gold)]" />
                    <span className="text-sm leading-relaxed text-[var(--esim-copy)]">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 shadow-[var(--esim-shadow)]">
              <div className="flex items-center gap-2.5">
                <Headphones className="h-5 w-5 text-[var(--esim-gold)]" />
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--esim-ink)]">
                  {pickCopy(locale, { en: 'Need Help?', hans: '需要协助？', hant: '需要協助？' })}
                </h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--esim-copy-soft)]">
                {pickCopy(locale, { en: 'Our support team is here for you.', hans: '我们的支援团队随时为您服务。', hant: '我們的支援團隊隨時為您服務。' })}
              </p>
              <button
                onClick={() => go('/contact')}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--esim-gold)_46%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-gold)_10%,transparent)] text-sm font-semibold text-[var(--esim-gold)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--esim-gold)_18%,transparent)]"
                type="button"
              >
                {pickCopy(locale, { en: 'Contact Support', hans: '联络客服', hant: '聯絡客服' })}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => go('/help')}
                className="mt-5 inline-flex items-center justify-center gap-2 text-sm text-[var(--esim-copy-soft)] transition-colors hover:text-[var(--esim-ink)]"
                type="button"
              >
                <BookOpen className="h-4 w-4" />
                {pickCopy(locale, { en: 'Visit Help Center', hans: '前往帮助中心', hant: '前往幫助中心' })}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

export default ProfilePage;
