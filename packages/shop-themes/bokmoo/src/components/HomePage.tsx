import React from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Globe,
  Layers,
  Search,
  Zap,
} from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { PromoBanner } from './PromoBanner';
import { isExternalHref, pickCopy, resolveBokmooSiteConfig } from '../site';

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

const HAIRLINE = 'border-[color:rgba(255,255,255,0.08)]';

/* Placeholder device identifiers shown inside the phone UI. Randomised on
   purpose — never ship real card identifiers on the storefront. */
const PHONE_ICCIDS = ['897823828746375807', '891296012124251779', '894643707593644071'];
const PHONE_EID = '88888888888888888888888888888888';

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

  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  const faqItems = [
    {
      q: { en: 'What is BOKMOO?', hans: 'BOKMOO 是什么？', hant: 'BOKMOO 是什麼？' },
      a: {
        en: 'BOKMOO is a mobile connectivity product: a physical SIM card and an eSIM that work as one account, so your phone stays connected as you travel — no local shop visits, no swapping trays at the border.',
        hans: 'BOKMOO 是一个移动连接产品：实体 SIM 卡与 eSIM 共用一个帐户，出境旅行时手机保持在线，无需在当地门店办卡，也无需在过境时换卡。',
        hant: 'BOKMOO 是一個行動連線產品：實體 SIM 卡與 eSIM 共用同一個帳戶，出境旅行時手機保持在線，無需在當地門市辦卡，也無需在過境時換卡。',
      },
    },
    {
      q: { en: "What's the difference between the physical SIM and the eSIM?", hans: '实体 SIM 和 eSIM 有什么区别？', hant: '實體 SIM 和 eSIM 有什麼區別？' },
      a: {
        en: 'The physical SIM ships to you and slots into any unlocked phone. The eSIM installs digitally in minutes, with no shipping and no tray. Both live in the same account and switch from the BOKMOO app.',
        hans: '实体 SIM 卡邮寄到手，插入任意无锁手机即可使用；eSIM 数分钟内完成安装，无需邮寄、无需取卡针。两者共用同一帐户，在 BOKMOO App 内即可切换。',
        hant: '實體 SIM 卡郵寄到手，插入任意無鎖手機即可使用；eSIM 數分鐘內完成安裝，無需郵寄、無需取卡針。兩者共用同一帳戶，在 BOKMOO App 內即可切換。',
      },
    },
    {
      q: { en: 'Where can I use BOKMOO?', hans: 'BOKMOO 可以在哪些地方使用？', hant: 'BOKMOO 可以在哪些地方使用？' },
      a: {
        en: 'BOKMOO covers the destinations listed in the app and in the destination search above; search your destination to see its coverage and plans before you fly.',
        hans: 'BOKMOO 覆盖 App 内与上方目的地搜索中列出的国家和地区；出发前搜索你的目的地，即可查看对应的套餐与覆盖范围。',
        hant: 'BOKMOO 覆蓋 App 內與上方目的地搜索中列出的國家和地區；出發前搜索你的目的地，即可查看對應的套餐與覆蓋範圍。',
      },
    },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[var(--bokmoo-ink)]">
      <PromoBanner locale={locale} config={config} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_30%,rgba(212,175,55,0.1),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[rgba(255,255,255,0.08)]" />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-[clamp(2.9rem,6vw,4.6rem)] font-light leading-[1.04] tracking-[-0.015em] text-white">
              {t({ en: 'One Card,', hans: '一张卡，', hant: '一張卡，' })}
              <br />
              {t({ en: 'One World.', hans: '连世界。', hant: '連世界。' })}
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[var(--bokmoo-copy)]">
              {t({
                en: 'Physical SIM and eSIM for borderless, reliable mobile connectivity.',
                hans: '实体 SIM 与 eSIM，带来无边界、可靠的移动连接。',
                hant: '實體 SIM 與 eSIM，帶來無邊界、可靠的行動連線。',
              })}
            </p>
            <div className="mt-9">
              <button
                onClick={() => openHref('/products')}
                className="btn-shimmer inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--bokmoo-gold)] px-7 text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-[var(--bokmoo-gold-strong)]"
                type="button"
              >
                {t({ en: 'Get BOKMOO', hans: '获取 BOKMOO', hant: '獲取 BOKMOO' })}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_62%_42%,rgba(212,175,55,0.16),transparent_62%)]" />
            <div className="relative mx-auto w-full max-w-[24rem]">
              <img
                src="/theme-assets/bokmoo/bokmoo-hero-card-pair.jpg"
                alt={t({ en: 'BOKMOO physical SIM card and eSIM', hans: 'BOKMOO 实体 SIM 卡与 eSIM', hant: 'BOKMOO 實體 SIM 卡與 eSIM' })}
                className="relative w-full rounded-[1.1rem] border border-[rgba(212,175,55,0.22)] object-cover shadow-[0_44px_120px_rgba(0,0,0,0.8)]"
                loading="eager"
              />
              {/* Pedestal ring */}
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-9 left-1/2 h-10 w-[86%] -translate-x-1/2 rounded-[50%] border border-[rgba(212,175,55,0.42)] bg-[linear-gradient(180deg,rgba(20,18,14,0.9),rgba(10,10,10,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(229,195,120,0.35)]" />
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="h-px w-full bg-[rgba(255,255,255,0.08)]" />
      </section>

      {/* App */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_22%_45%,rgba(212,175,55,0.07),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:py-24">
          <div className="relative mx-auto w-full max-w-[18.5rem]">
            <div className="rounded-[2.4rem] border border-[rgba(255,255,255,0.1)] bg-[#0b0b0c] p-2 shadow-[0_36px_110px_rgba(0,0,0,0.75)]">
              <div className="rounded-[1.9rem] bg-[#101012] px-4 pb-5 pt-3">
                <div className="flex items-center justify-between text-[0.66rem] text-[var(--bokmoo-copy-soft)]">
                  <span>9:41</span>
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 10" className="h-2.5 w-3.5" fill="currentColor" aria-hidden="true"><rect x="0" y="6" width="3" height="4" rx="0.6" /><rect x="4.4" y="4" width="3" height="6" rx="0.6" /><rect x="8.8" y="2" width="3" height="8" rx="0.6" /><rect x="13.2" y="0" width="2.6" height="10" rx="0.6" /></svg>
                    <svg viewBox="0 0 24 12" className="h-2.5 w-5" fill="none" stroke="currentColor" aria-hidden="true"><rect x="0.6" y="0.6" width="19" height="10.8" rx="3" /><rect x="2.4" y="2.4" width="14" height="7.2" rx="1.6" fill="currentColor" stroke="none" /><path d="M22 4v4" stroke-linecap="round" /></svg>
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <ChevronDown className="h-4 w-4 -rotate-90 text-[var(--bokmoo-copy-soft)]" aria-hidden="true" />
                  <span className="text-[0.82rem] font-semibold text-[var(--bokmoo-ink)]">
                    {t({ en: 'My eSIM Card', hans: '我的 eSIM 卡片', hant: '我的 eSIM 卡片' })}
                  </span>
                  <span className="text-[0.72rem] text-[var(--bokmoo-gold)]">
                    {t({ en: 'Close', hans: '关闭', hant: '關閉' })}
                  </span>
                </div>
                {/* Bluetooth card panel */}
                <div className="mt-3 rounded-[1rem] border border-[rgba(212,175,55,0.28)] bg-[linear-gradient(150deg,#181512,#0e0d10_70%)] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.62rem] uppercase tracking-[0.14em] text-[var(--bokmoo-gold)]">
                        {t({ en: 'Bluetooth card', hans: '蓝牙卡片', hant: '藍牙卡片' })}
                      </p>
                      <p className="mt-1 text-base font-bold tracking-[0.06em] text-white">BOKMOO</p>
                    </div>
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.55rem] border border-[rgba(212,175,55,0.3)] bg-[#141210]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--bokmoo-gold)]" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6.5 6.5l11 11M6.5 17.5l11-11M12 2v20a3.5 3.5 0 002.4-1.2L17 17M12 22V2a3.5 3.5 0 012.4 1.2L17 7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    title={t({ en: 'Copy EID', hans: '复制 EID', hant: '複製 EID' })}
                    className="mt-2.5 flex w-full items-center gap-1.5 text-left"
                  >
                    <span className="text-[0.62rem] text-[var(--bokmoo-copy-soft)]">EID</span>
                    <span className="truncate font-mono text-[0.62rem] tracking-wide text-[var(--bokmoo-gold)]">{PHONE_EID}</span>
                    <Copy className="h-3 w-3 shrink-0 text-[var(--bokmoo-copy-soft)]" aria-hidden="true" />
                  </button>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[rgba(110,200,120,0.35)] bg-[rgba(110,200,120,0.08)] px-2.5 py-1 text-[0.66rem] text-[#8fdc8f]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8fdc8f]" />
                    {t({ en: 'Connected', hans: '已连接', hant: '已連線' })}
                  </span>
                </div>
                {/* Bottom diagnostics */}
                <div className="mt-2 grid grid-cols-2 divide-x divide-[rgba(255,255,255,0.06)] rounded-[0.9rem] border border-[rgba(255,255,255,0.07)] bg-[#131315]">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <Globe className="h-3.5 w-3.5 text-[var(--bokmoo-copy-soft)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[0.58rem] text-[var(--bokmoo-copy-soft)]">
                        {t({ en: 'Reader', hans: '读卡器', hant: '讀卡器' })}
                      </p>
                      <p className="truncate text-[0.66rem] text-[var(--bokmoo-ink)]">eSIM-BLE-BF4FDA5A</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <Layers className="h-3.5 w-3.5 text-[var(--bokmoo-copy-soft)]" aria-hidden="true" />
                    <div>
                      <p className="text-[0.58rem] text-[var(--bokmoo-copy-soft)]">
                        {t({ en: 'Card plans', hans: '卡内套餐', hant: '卡內套餐' })}
                      </p>
                      <p className="text-[0.66rem] text-[var(--bokmoo-ink)]">5 ↑</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-[var(--bokmoo-ink)]">
                    {t({ en: 'eSIM list (5)', hans: 'eSIM 列表（5）', hant: 'eSIM 列表（5）' })}
                  </p>
                  <span className="rounded-full border border-[rgba(212,175,55,0.3)] px-2.5 py-1 text-[0.62rem] text-[var(--bokmoo-gold)]">
                    + {t({ en: 'Add eSIM', hans: '添加 eSIM', hant: '添加 eSIM' })}
                  </span>
                </div>
                <div className="mt-2.5 space-y-2">
                  {[
                    { icon: 'T', name: { en: 'Tigo', hans: 'Tigo', hant: 'Tigo' }, iccid: PHONE_ICCIDS[0], on: true },
                    { icon: '🇨🇳', name: { en: 'China Mobile', hans: 'China Mobile', hant: 'China Mobile' }, state: { en: 'In use', hans: '使用中', hant: '使用中' }, iccid: PHONE_ICCIDS[1], on: true },
                    { icon: '5G', name: { en: 'Global Roam 5G', hans: 'Global Roam 5G', hant: 'Global Roam 5G' }, iccid: PHONE_ICCIDS[2], on: false },
                  ].map((row) => (
                    <div key={row.iccid} className="flex items-center justify-between rounded-[0.8rem] border border-[rgba(255,255,255,0.06)] bg-[#161618] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--bokmoo-ink)]">
                          {!row.icon.startsWith('🇨🇳') && (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-[0.3rem] bg-[#2a2a2e] text-[0.5rem] font-bold text-neutral-300">
                              {row.icon}
                            </span>
                          )}
                          <span className="truncate">{t(row.name)}</span>
                          {row.state ? (
                            <span className="rounded bg-[rgba(212,175,55,0.12)] px-1 py-0.5 text-[0.55rem] text-[var(--bokmoo-gold)]">{t(row.state)}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[0.58rem] text-[var(--bokmoo-copy-soft)]">ICCID: {row.iccid}</p>
                      </div>
                      <span className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 ${row.on ? 'bg-[#4ade80]' : 'bg-[#2c2c30]'}`}>
                        <span className={`h-3 w-3 rounded-full bg-white transition-transform ${row.on ? 'translate-x-3' : ''}`} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-[clamp(1.9rem,3.2vw,2.7rem)] font-medium leading-[1.15] tracking-[-0.015em] text-white">
              {t({
                en: 'Manage Your Connectivity with the BOKMOO App',
                hans: '用 BOKMOO App 管理你的连接',
                hant: '用 BOKMOO App 管理你的連線',
              })}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[var(--bokmoo-copy)]">
              {t({
                en: 'Switch profiles instantly, monitor data usage in real-time, and purchase destination packages directly inside the official BOKMOO application. Designed for effortless international control.',
                hans: '在官方 BOKMOO App 内即时切换配置、实时监控流量，并直接购买目的地套餐，为轻松掌控全球连接而设计。',
                hant: '在官方 BOKMOO App 內即時切換設定檔、即時監控流量，並直接購買目的地套餐，為輕鬆掌控全球連線而設計。',
              })}
            </p>
            <div className="mt-8 flex flex-wrap gap-3.5">
              {[
                { icon: <AppleIcon />, top: { en: 'Download on the', hans: '下载到', hant: '下載到' }, label: 'App Store' },
                { icon: <PlayIcon />, top: { en: 'Download on', hans: '下载于', hant: '下載於' }, label: 'Google Play' },
                { icon: <Download className="h-5 w-5" />, top: { en: 'Direct install', hans: '直接安装', hant: '直接安裝' }, label: 'Direct APK' },
              ].map((store) => (
                <button
                  key={store.label}
                  onClick={() => openHref('/download/app')}
                  className={`inline-flex min-h-13 items-center gap-3 rounded-full border border-[rgba(255,255,255,0.12)] px-6 py-3 text-left transition-colors hover:border-[rgba(212,175,55,0.3)] hover:bg-[rgba(255,255,255,0.04)]`}
                  type="button"
                >
                  {store.icon}
                  <span>
                    <span className="block text-[0.62rem] uppercase tracking-wide text-[var(--bokmoo-copy-soft)]">{t(store.top)}</span>
                    <span className="block text-sm font-semibold text-[var(--bokmoo-ink)]">{store.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-y border-[rgba(255,255,255,0.08)]">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
          {[
            {
              icon: <Zap className="h-6 w-6" />,
              title: { en: 'Fast Activation', hans: '极速激活', hant: '極速激活' },
              copy: { en: 'Get online in minutes', hans: '几分钟即可上网', hant: '幾分鐘即可上網' },
            },
            {
              icon: <Globe className="h-6 w-6" />,
              title: { en: 'Global Coverage', hans: '全球覆盖', hant: '全球覆蓋' },
              copy: { en: 'Stay connected abroad', hans: '海外保持在线', hant: '海外保持在線' },
            },
            {
              icon: <Layers className="h-6 w-6" />,
              title: { en: 'Flexible Options', hans: '灵活选择', hant: '靈活選擇' },
              copy: { en: 'SIM and eSIM, your choice', hans: 'SIM 与 eSIM，随你选择', hant: 'SIM 與 eSIM，隨你選擇' },
            },
          ].map((feature, index) => (
            <div key={feature.title.en} className={`flex items-start gap-4 ${index > 0 ? 'md:border-l md:border-[rgba(255,255,255,0.08)] md:pl-10' : ''}`}>
              <span className="text-[var(--bokmoo-gold)]">{feature.icon}</span>
              <div>
                <p className="text-sm font-semibold text-[var(--bokmoo-ink)]">{t(feature.title)}</p>
                <p className="mt-1 text-sm text-[var(--bokmoo-copy)]">{t(feature.copy)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Destinations */}
      <section id="destinations" className="scroll-mt-24">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.9rem,3.2vw,2.7rem)] font-medium tracking-[-0.015em] text-white">
              {t({ en: 'Find Your Destination', hans: '找到你的目的地', hant: '找到你的目的地' })}
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--bokmoo-copy)]">
              {t({
                en: 'Search for a country or region to explore connectivity options.',
                hans: '搜索国家或地区，探索可用的连接方案。',
                hant: '搜索國家或地區，探索可用的連線方案。',
              })}
            </p>
          </div>
          <div className="mx-auto mt-9 flex max-w-xl items-center gap-3 rounded-full border border-[rgba(255,255,255,0.1)] bg-[#141414] px-5 py-1.5 transition-colors focus-within:border-[rgba(212,175,55,0.55)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--bokmoo-copy-soft)]" aria-hidden="true" />
            <input
              aria-label={t({ en: 'Search a country or region', hans: '搜索国家或地区', hant: '搜尋國家或地區' })}
              placeholder={t({ en: 'Search a country or region', hans: '搜索国家或地区', hant: '搜尋國家或地區' })}
              className="min-h-10 w-full border-0 bg-transparent p-0 text-sm text-[var(--bokmoo-ink)] outline-none ring-0 placeholder:text-[var(--bokmoo-copy-soft)] focus:ring-0"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const value = (event.target as HTMLInputElement).value.trim();
                  openHref(value ? `/products?search=${encodeURIComponent(value)}` : '/products');
                }
              }}
            />
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bokmoo-gold)] text-[#0d0d0d]" aria-hidden="true">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-[rgba(255,255,255,0.08)]">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.9rem,3.2vw,2.7rem)] font-medium tracking-[-0.015em] text-white">
              {t({ en: 'Get Connected in 3 Steps', hans: '三步完成连接', hant: '三步完成連線' })}
            </h2>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                step: '1',
                icon: <Check className="h-4 w-4" />,
                title: { en: 'Get BOKMOO', hans: '获取 BOKMOO', hant: '獲取 BOKMOO' },
                copy: { en: 'Use the physical SIM or eSIM.', hans: '使用实体 SIM 或 eSIM。', hant: '使用實體 SIM 或 eSIM。' },
              },
              {
                step: '2',
                icon: <Download className="h-4 w-4" />,
                title: { en: 'Add & Activate', hans: '添加并激活', hant: '添加並激活' },
                copy: { en: 'Set up in the BOKMOO app.', hans: '在 BOKMOO App 中完成设置。', hant: '在 BOKMOO App 中完成設定。' },
              },
              {
                step: '3',
                icon: <ArrowRight className="h-4 w-4" />,
                title: { en: 'Stay Online', hans: '保持在线', hant: '保持在線' },
                copy: { en: 'Enjoy reliable connectivity around the world.', hans: '在全球享受可靠的连接。', hant: '在全球享受可靠的連線。' },
              },
            ].map((step, index) => (
              <div key={step.step} className="relative text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(212,175,55,0.45)] text-base font-semibold text-[var(--bokmoo-gold)]">
                  {step.step}
                </span>
                {index < 2 ? (
                  <span aria-hidden="true" className="pointer-events-none absolute right-[-30%] top-6 hidden h-px w-[60%] bg-[rgba(255,255,255,0.08)] md:block" />
                ) : null}
                <p className="mt-5 text-base font-semibold text-[var(--bokmoo-ink)]">{t(step.title)}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--bokmoo-copy)]">{t(step.copy)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[rgba(255,255,255,0.08)]">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[clamp(1.9rem,3.2vw,2.7rem)] font-medium tracking-[-0.015em] text-white">
              {t({ en: 'FAQ', hans: '常见问题', hant: '常見問題' })}
            </h2>
            <button
              onClick={() => openHref('/help')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--bokmoo-gold)] hover:underline"
              type="button"
            >
              {t({ en: 'View All Questions', hans: '查看全部问题', hant: '查看全部問題' })}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-8 border-t border-[rgba(255,255,255,0.08)]">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.q.en} className="border-b border-[rgba(255,255,255,0.08)]">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center justify-between gap-6 py-5 text-left text-base font-medium text-[var(--bokmoo-ink)] transition-colors hover:text-[var(--bokmoo-gold)]`}
                    type="button"
                  >
                    {t(item.q)}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--bokmoo-copy-soft)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {isOpen ? (
                    <p className="max-w-3xl pb-5 text-sm leading-7 text-[var(--bokmoo-copy)]">{t(item.a)}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
});
