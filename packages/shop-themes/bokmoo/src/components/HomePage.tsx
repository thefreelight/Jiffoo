import React from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  Layers,
  QrCode,
  Search,
  Smartphone,
} from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { isExternalHref, pickCopy, resolveBokmooSiteConfig } from '../site';

type HeroPillarProps = {
  className: string;
};

function HeroPillar({ className }: HeroPillarProps) {
  return <div className={`pointer-events-none absolute rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] ${className}`} />;
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M3.61 1.81L13.79 12 3.61 22.19a1.5 1.5 0 01-.44-1.06V2.87c0-.41.16-.78.44-1.06zm11.6 11.6l2.52 2.52-9.72 5.47 7.2-7.99zm4.99-4.11c.36.34.58.81.58 1.34v2.72c0 .53-.22 1-.58 1.34l-2.88 2.88-2.76-2.76 2.76-2.77-2.76-2.76 2.76-2.76 2.88 2.77zm-12.19-8.8l9.72 5.46-2.52 2.52-7.2-7.98z" />
    </svg>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-gold)]">
      {children}
    </p>
  );
}

const HERO_STATS: Array<{ value: string; label: { en: string; hans: string; hant: string } }> = [
  { value: '200+', label: { en: 'Countries & regions', hans: '国家和地区', hant: '國家和地區' } },
  { value: '1000+', label: { en: 'Carrier plans', hans: '运营商套餐', hant: '營運商套餐' } },
  { value: '15–20', label: { en: 'Plans per card', hans: '套餐/张卡', hant: '套餐/張卡' } },
];

const DESTINATIONS: Array<{ name: { en: string; hans: string; hant: string }; flag: string; image: string }> = [
  { name: { en: 'Japan', hans: '日本', hant: '日本' }, flag: '🇯🇵', image: '/theme-assets/bokmoo/bokmoo-dest-japan.jpg' },
  { name: { en: 'France', hans: '法国', hant: '法國' }, flag: '🇫🇷', image: '/theme-assets/bokmoo/bokmoo-dest-france.jpg' },
  { name: { en: 'Singapore', hans: '新加坡', hant: '新加坡' }, flag: '🇸🇬', image: '/theme-assets/bokmoo/bokmoo-dest-singapore.jpg' },
  { name: { en: 'United States', hans: '美国', hant: '美國' }, flag: '🇺🇸', image: '/theme-assets/bokmoo/bokmoo-dest-usa.jpg' },
];

export const HomePage = React.memo(function HomePage({ locale, config, onNavigate }: HomePageProps) {
  const site = resolveBokmooSiteConfig(config, locale);
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);

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

  const heroStats = HERO_STATS.map((stat) => ({
    value: stat.value,
    label: t(stat.label),
  }));

  return (
    <div className="min-h-screen bg-[#08070a] text-[var(--bokmoo-ink)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_35%,color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent),transparent_55%)]" />
        <HeroPillar className="left-[58%] top-[-20%] hidden h-[130%] w-[28rem] lg:block" />
        <HeroPillar className="left-[70%] top-[-10%] hidden h-[150%] w-[36rem] lg:block" />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-20">
          <div>
            <h1 className="text-[clamp(3.4rem,8vw,6.4rem)] font-bold leading-[0.92] tracking-[-0.02em] text-white">
              BOKMOO
            </h1>
            <p className="mt-3 text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tracking-[-0.02em] text-[var(--bokmoo-gold)]">
              {t({ en: 'One card, connected to your world.', hans: '一张卡，连接你的世界。', hant: '一張卡，連接你的世界。' })}
            </p>
            <p className="mt-6 max-w-xl text-base leading-8 text-[var(--bokmoo-copy)]">
              {t({
                en: 'A physical eSIM card that makes global connectivity simple. 200+ countries and regions, flexible plans, effortless management.',
                hans: '实体 eSIM 卡，让全球连接更简单。支持 200+ 国家和地区，灵活套餐，轻松管理。',
                hant: '實體 eSIM 卡，讓全球連接更簡單。支援 200+ 國家和地區，靈活套餐，輕鬆管理。',
              })}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => openHref('/products')}
                className="inline-flex min-h-12 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[#141210]"
                type="button"
              >
                {t({ en: 'Explore BOKMOO', hans: '探索 BOKMOO', hant: '探索 BOKMOO' })}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => openHref('/download/app')}
                className="inline-flex min-h-12 items-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] px-6 text-sm font-semibold text-[var(--bokmoo-ink)]"
                type="button"
              >
                {t({ en: 'Download the App', hans: '下载 App', hant: '下載 App' })}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] pt-7">
              {heroStats.map((stat) => (
                <div key={stat.value}>
                  <p className="text-2xl font-bold tracking-[-0.02em] text-white sm:text-3xl">{stat.value}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--bokmoo-copy-soft)]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_50%,color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent),transparent_60%)]" />
            <img
              src="/theme-assets/bokmoo/bokmoo-hero-card-pair.jpg"
              alt="BOKMOO"
              className="relative w-full rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] object-cover"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* Product */}
      <section className="border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] bg-[#0b0a0d]">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20">
          <SectionEyebrow>{t({ en: 'BOKMOO products', hans: 'BOKMOO 产品', hant: 'BOKMOO 產品' })}</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white">
            {t({ en: 'Find the connection that fits you', hans: '找到适合你的连接方式', hant: '找到適合你的連接方式' })}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]">
            {t({
              en: 'One physical card managing multiple eSIM plans — built for different countries and every kind of trip.',
              hans: '一张实体卡，管理多个 eSIM 套餐，满足不同国家、不同场景的出行需求。',
              hant: '一張實體卡，管理多個 eSIM 套餐，滿足不同國家、不同場景的出行需求。',
            })}
          </p>
          <div className="mt-12 grid items-center gap-10 overflow-hidden rounded-[1.4rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[linear-gradient(120deg,#171310_0%,#0c0b0e_55%,#08070a_100%)] p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_50%,color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent),transparent_62%)]" />
              <img
                src="/theme-assets/bokmoo/bokmoo-hero-card-pair.jpg"
                alt={t({ en: 'BOKMOO eSIM Card', hans: 'BOKMOO eSIM 卡', hant: 'BOKMOO eSIM 卡' })}
                className="relative w-full rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] object-cover"
                loading="lazy"
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-[-0.02em] text-white">
                {t({ en: 'BOKMOO eSIM Card', hans: 'BOKMOO eSIM 卡', hant: 'BOKMOO eSIM 卡' })}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]">
                {t({ en: 'One physical card, multiple eSIM plans.', hans: '一张实体卡，管理多个 eSIM 套餐。', hant: '一張實體卡，管理多個 eSIM 套餐。' })}
              </p>
              <ul className="mt-7 grid gap-4 sm:grid-cols-2">
                {[
                  { en: '1.6MB capacity', hans: '1.6MB 大容量', hant: '1.6MB 大容量' },
                  { en: 'SGP.22 / SGP.32', hans: 'SGP.22 / SGP.32', hant: 'SGP.22 / SGP.32' },
                  { en: '15–20 plans per card', hans: '支持 15-20 个套餐', hant: '支援 15-20 個套餐' },
                  { en: 'GSMA certified', hans: 'GSMA 认证', hant: 'GSMA 認證' },
                ].map((feature) => (
                  <li key={feature.en} className="flex items-center gap-3 text-sm text-[var(--bokmoo-ink)]">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] text-[var(--bokmoo-gold)]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {t(feature)}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => openHref('/products')}
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--bokmoo-gold)] hover:underline"
                type="button"
              >
                {t({ en: 'Learn more', hans: '了解产品', hant: '了解產品' })}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* App */}
      <section className="border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)]">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20">
          <SectionEyebrow>{t({ en: 'BOKMOO App', hans: 'BOKMOO App', hant: 'BOKMOO App' })}</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white">
            {t({ en: 'Your plans, in your grasp.', hans: '你的套餐，尽在掌握。', hant: '你的套餐，盡在掌握。' })}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]">
            {t({
              en: 'Scan to add, review cards, switch plans — one app does it all.',
              hans: '扫码添加、查看卡片、切换套餐，一个 App 完成。',
              hant: '掃碼添加、查看卡片、切換套餐，一個 App 完成。',
            })}
          </p>
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div>
              <ul className="grid gap-8">
                {[
                  {
                    icon: <QrCode className="h-5 w-5" />,
                    title: { en: 'Scan to add eSIMs', hans: '扫码添加 eSIM', hant: '掃碼添加 eSIM' },
                    copy: { en: 'Quick scan, effortless plan setup.', hans: '快速扫描，轻松添加套餐。', hant: '快速掃描，輕鬆添加套餐。' },
                  },
                  {
                    icon: <Layers className="h-5 w-5" />,
                    title: { en: 'Manage plans per card', hans: '按卡片管理套餐', hant: '按卡片管理套餐' },
                    copy: { en: 'Multiple cards, clearly organized.', hans: '多张卡片，清晰管理。', hant: '多張卡片，清晰管理。' },
                  },
                  {
                    icon: <ArrowLeftRight className="h-5 w-5" />,
                    title: { en: 'View & switch anytime', hans: '随时查看与切换', hant: '隨時查看與切換' },
                    copy: { en: 'One-tap switching for flexible travel.', hans: '一键切换，出行更灵活。', hant: '一鍵切換，出行更靈活。' },
                  },
                ].map((feature) => (
                  <li key={feature.title.en} className="flex gap-5">
                    <span className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] text-[var(--bokmoo-gold)]">
                      {feature.icon}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-[var(--bokmoo-ink)]">{t(feature.title)}</p>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--bokmoo-copy)]">{t(feature.copy)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap gap-4">
                <button
                  onClick={() => openHref('/download/app')}
                  className="inline-flex min-h-13 items-center gap-3 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_30%,transparent)] bg-[#0d0c0f] px-6 py-3 text-left"
                  type="button"
                >
                  <AppleIcon />
                  <span>
                    <span className="block text-[0.65rem] uppercase tracking-wide text-[var(--bokmoo-copy-soft)]">
                      {t({ en: 'Download on the', hans: '下载到', hant: '下載到' })}
                    </span>
                    <span className="block text-base font-semibold text-[var(--bokmoo-ink)]">App Store</span>
                  </span>
                </button>
                <button
                  onClick={() => openHref('/download/app')}
                  className="inline-flex min-h-13 items-center gap-3 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_30%,transparent)] bg-[#0d0c0f] px-6 py-3 text-left"
                  type="button"
                >
                  <PlayIcon />
                  <span>
                    <span className="block text-[0.65rem] uppercase tracking-wide text-[var(--bokmoo-copy-soft)]">
                      {t({ en: 'Download on', hans: '下载到', hant: '下載到' })}
                    </span>
                    <span className="block text-base font-semibold text-[var(--bokmoo-ink)]">Google Play</span>
                  </span>
                </button>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[20rem]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_65%)]" />
              <img
                src="/theme-assets/bokmoo/bokmoo-app-screen.png"
                alt={t({ en: 'BOKMOO App', hans: 'BOKMOO App', hant: 'BOKMOO App' })}
                className="relative w-full rounded-[2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Destinations */}
      <section className="border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] bg-[#0b0a0d]">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionEyebrow>{t({ en: 'Popular destinations', hans: '热门目的地', hant: '熱門目的地' })}</SectionEyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white">
                {t({ en: 'Where to next?', hans: '下一站，去哪里？', hant: '下一站，去哪裡？' })}
              </h2>
            </div>
            <label className="flex min-h-11 w-full max-w-xs items-center gap-3 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[#0d0c0f] px-4 text-sm text-[var(--bokmoo-copy-soft)]">
              <Search className="h-4 w-4" />
              <input
                placeholder={t({ en: 'Search a country or region', hans: '搜索国家或地区', hant: '搜尋國家或地區' })}
                className="w-full bg-transparent outline-none placeholder:text-[var(--bokmoo-copy-soft)]"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const value = (event.target as HTMLInputElement).value.trim();
                    openHref(value ? `/products?search=${encodeURIComponent(value)}` : '/products');
                  }
                }}
              />
            </label>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DESTINATIONS.map((destination) => (
              <button
                key={destination.name.en}
                onClick={() => openHref('/products')}
                className="group relative overflow-hidden rounded-[1.1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] text-left"
                type="button"
              >
                <img
                  src={destination.image}
                  alt={t(destination.name)}
                  className="aspect-[6/5] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(4,3,6,0.88)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span>{destination.flag}</span>
                    {t(destination.name)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--bokmoo-gold)]">
                    {t({ en: 'View plans', hans: '查看套餐', hant: '查看套餐' })}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20">
          <SectionEyebrow>{t({ en: 'How to start', hans: '如何开始', hant: '如何開始' })}</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white">
            {t({ en: 'From card to connected world.', hans: '从连接卡片，到连接世界。', hant: '從連接卡片，到連接世界。' })}
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                step: '01',
                icon: <Smartphone className="h-5 w-5" />,
                title: { en: 'Connect the card', hans: '连接卡片', hant: '連接卡片' },
                copy: { en: 'Connect the physical eSIM card to the app.', hans: '通过实体 eSIM 卡连接到 App。', hant: '透過實體 eSIM 卡連接到 App。' },
              },
              {
                step: '02',
                icon: <QrCode className="h-5 w-5" />,
                title: { en: 'Add an eSIM', hans: '添加 eSIM', hant: '添加 eSIM' },
                copy: { en: 'Scan or pick a plan and add it to your card.', hans: '扫码或选择套餐，添加到卡片。', hant: '掃碼或選擇套餐，添加到卡片。' },
              },
              {
                step: '03',
                icon: <ArrowLeftRight className="h-5 w-5" />,
                title: { en: 'Switch plans', hans: '切换套餐', hant: '切換套餐' },
                copy: { en: 'Review and switch in the app — one card, many destinations.', hans: '在 App 中随时查看与切换，一张卡轻松管理多个目的地。', hant: '在 App 中隨時查看與切換，一張卡輕鬆管理多個目的地。' },
              },
            ].map((step) => (
              <div key={step.step} className="flex gap-5">
                <span className="text-3xl font-bold text-[var(--bokmoo-gold)]">{step.step}</span>
                <div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] text-[var(--bokmoo-gold)]">
                    {step.icon}
                  </span>
                  <p className="mt-4 text-base font-semibold text-[var(--bokmoo-ink)]">{t(step.title)}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--bokmoo-copy)]">{t(step.copy)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-5 rounded-[1.3rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] bg-[linear-gradient(120deg,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_60%)] px-6 py-8 text-center">
            <p className="text-lg font-semibold text-[var(--bokmoo-ink)]">
              {t({ en: 'Ready to get started?', hans: '准备好开始了吗？', hant: '準備好開始了嗎？' })}
            </p>
            <button
              onClick={() => openHref('/download/app')}
              className="inline-flex min-h-12 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[#141210]"
              type="button"
            >
              {t({ en: 'Download the BOKMOO App', hans: '下载 BOKMOO App', hant: '下載 BOKMOO App' })}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});
