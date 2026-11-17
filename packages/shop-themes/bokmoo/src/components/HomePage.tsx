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
const PHONE_ICCIDS = ['894502187391048201', '896648729183847291', '890126048193018472'];
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

  const [searchValue, setSearchValue] = React.useState('');
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = searchValue.trim();
    onNavigate?.(value ? `/products?search=${encodeURIComponent(value)}` : '/products');
  };

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
        <div aria-hidden="true" className="absolute top-0 h-px w-full bg-[rgba(255,255,255,0.08)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
          <div className="space-y-6 text-left lg:col-span-6">
            <h1 className="text-4xl font-light leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {t({ en: 'One Card,', hans: '一张卡，', hant: '一張卡，' })}
              <br />
              <span className="font-normal">{t({ en: 'One World.', hans: '连世界。', hant: '連世界。' })}</span>
            </h1>
            <p className="max-w-md text-base font-light leading-relaxed text-[var(--bokmoo-copy)] sm:text-lg">
              {t({
                en: 'Physical SIM and eSIM for borderless, reliable mobile connectivity.',
                hans: '实体 SIM 与 eSIM，带来无边界、可靠的移动连接。',
                hant: '實體 SIM 與 eSIM，帶來無邊界、可靠的行動連線。',
              })}
            </p>
            <div className="pt-2">
              <button
                onClick={() => openHref('/products')}
                className="inline-flex items-center gap-3 rounded-full bg-[#E5C365] px-6 py-3.5 text-sm font-semibold text-[#111113] shadow-[0_2px_20px_rgba(229,195,101,0.25)] transition-all duration-200 hover:gap-4 hover:bg-[#F3D482]"
                type="button"
              >
                <span>{t({ en: 'Get BOKMOO', hans: '获取 BOKMOO', hant: '獲取 BOKMOO' })}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Hero Visual Column: CSS Rendered Physical SIM on Stage Pedestal */}
          <div className="relative flex flex-col items-center justify-center select-none lg:col-span-6">
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-amber-600/10 via-[rgba(212,175,55,0.1)] to-transparent blur-[65px]" />
            <div className="relative z-20 flex w-full flex-col items-center pt-4 pb-4">
              <div className="sim-metallic-body relative z-20 flex h-[390px] w-[310px] flex-col justify-between overflow-hidden rounded-[24px] border border-neutral-800/90 bg-[#0e0e0e] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.95)] transition-all duration-300 select-none sm:w-[340px]">
                <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-40" fill="none" viewBox="0 0 340 390" aria-hidden="true">
                  <circle cx="100" cy="200" r="160" stroke="#262420" strokeWidth="46" />
                  <circle cx="240" cy="280" r="130" stroke="#201e1a" strokeWidth="40" />
                  <path d="M-20 180 C40 60, 160 30, 240 160" stroke="#22201b" strokeLinecap="round" strokeWidth="36" />
                </svg>
                <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/[0.09] via-white/[0.015] to-black/85" />
                <div className="pointer-events-none absolute inset-0 z-10 rounded-[23px] border border-white/[0.08]" />
                <div className="relative z-20 flex w-full items-center justify-center px-2 pt-2">
                  <svg aria-label="BOKMOO" className="h-4 w-auto shrink-0 fill-[#e2c26a] drop-shadow-[0_1px_4px_rgba(212,175,55,0.35)] sm:h-[18px]" role="img" viewBox="0 0 750 82">
                    <g fill="#e2c26a">
                      <g transform="translate(0 0) scale(.08) translate(-49.42 -140.06)">
                        <path d="M909.71,140.06c-475.11,0-860.29,385.18-860.29,860.67,0,36.3,2.32,71.8,6.95,106.93h404.86c-8.48-34.36-12.72-70.26-12.72-106.93,0-254.71,206.87-461.2,461.2-461.2,255.13,0,461.6,206.49,461.6,461.2,0,36.67-4.24,72.57-12.74,106.93h405.25c4.64-35.13,6.95-70.63,6.95-106.93,0-475.49-385.56-860.67-861.06-860.67Z" />
                        <path d="M1166.39,1000.73c0,38.22-8.12,74.5-23.56,106.93h-465.84c-15.43-32.43-23.54-68.71-23.54-106.93,0-141.64,114.62-256.66,256.66-256.66,141.64,0,256.28,115.01,256.28,256.66Z" />
                        <path d="M2497.53,1000.73c0,38.22-8.1,74.5-23.54,106.93h-466.23c-15.43-32.43-23.56-68.71-23.56-106.93,0-141.64,115.03-256.66,256.67-256.66,141.64,0,256.66,115.01,256.66,256.66Z" />
                        <path d="M2232,140.06c-231.19,0-441.53,91.48-595.91,240.07,93.77,109.6,162.86,240.45,199.53,384.41,80.66-135.08,227.71-225.01,396.37-225.01,254.73,0,461.2,206.49,461.2,461.2,0,36.67-4.24,72.57-12.74,106.93h405.25c4.64-35.13,6.95-70.63,6.95-106.93,0-475.49-385.18-860.67-860.67-860.67Z" />
                      </g>
                      <g transform="translate(270 15) scale(.9) translate(-42.62 -30)">
                        <path d="M42.62,83.03V31.56h25.19c6.36,0,11.78,1.44,16.27,4.31,4.49,2.9,6.73,6.38,6.73,10.43,0,3.62-1.82,6.8-5.44,9.53,3.1,1.36,5.53,3.12,7.29,5.25,1.87,2.18,2.8,4.52,2.8,7.01,0,4.13-2.28,7.64-6.84,10.54-4.53,2.92-9.99,4.39-16.38,4.39h-29.62ZM54.8,53.25h13.01c2.99,0,5.53-.68,7.63-2.05,2.13-1.35,3.2-2.97,3.2-4.89,0-1.92-1.07-3.55-3.2-4.89-2.1-1.37-4.63-2.05-7.63-2.05h-13.01s0,13.88,0,13.88ZM54.8,75.22h17.45c3.03,0,5.63-.7,7.8-2.09,2.13-1.39,3.19-3.06,3.19-5.03,0-1.94-1.06-3.59-3.19-4.96-2.17-1.39-4.77-2.09-7.8-2.09h-17.45s0,14.17,0,14.17Z" />
                        <path d="M112.91,75.83c-8-5.13-12.01-11.31-12.01-18.56,0-7.24,4-13.42,12.01-18.55,8-5.14,17.65-7.7,28.95-7.7,11.29,0,20.94,2.56,28.95,7.7,8,5.13,12.01,11.31,12.01,18.55,0,7.24-4,13.43-12.01,18.56-8,5.14-17.65,7.7-28.95,7.7-11.3,0-20.95-2.56-28.95-7.7ZM121.56,44.26c-5.61,3.59-8.42,7.93-8.42,13.01,0,5.09,2.8,9.43,8.42,13.02,5.61,3.59,12.38,5.39,20.31,5.39,7.93,0,14.7-1.8,20.3-5.39,5.61-3.59,8.42-7.93,8.42-13.02s-2.8-9.42-8.42-13.01c-5.61-3.59-12.38-5.39-20.3-5.39-7.93,0-14.7,1.8-20.31,5.39Z" />
                        <path d="M248.62,31.56l-32.09,25.6,33.21,25.86h-15.82s-25.19-19.64-25.19-19.64l-3.76,2.99v16.65h-12.17V31.56h12.17v22.33s28.05-22.33,28.05-22.33h15.6Z" />
                        <path d="M342.42,31.56v51.46h-12.18v-32.69s-22.32,32.69-22.32,32.69h-13.75s-21.93-32.48-21.93-32.48v32.48h-12.18V31.56h12.74s28.27,42.01,28.27,42.01l28.61-42.01h12.74Z" />
                        <path d="M363.74,75.83c-8-5.13-12.01-11.31-12.01-18.56,0-7.24,4-13.42,12.01-18.55,8-5.14,17.65-7.7,28.95-7.7,11.29,0,20.94,2.56,28.95,7.7,8,5.13,12.01,11.31,12.01,18.55,0,7.24-4,13.43-12.01,18.56-8,5.14-17.65,7.7-28.95,7.7-11.3,0-20.95-2.56-28.95-7.7ZM372.38,44.26c-5.61,3.59-8.42,7.93-8.42,13.01s2.8,9.43,8.42,13.02c5.61,3.59,12.38,5.39,20.31,5.39,7.93,0,14.7-1.8,20.3-5.39,5.61-3.59,8.42-7.93,8.42-13.02,0-5.08-2.8-9.42-8.42-13.01-5.61-3.59-12.38-5.39-20.3-5.39-7.93,0-14.7,1.8-20.31,5.39Z" />
                        <path d="M450.81,75.83c-8-5.13-12.01-11.31-12.01-18.56,0-7.24,4-13.42,12.01-18.55,8-5.14,17.65-7.7,28.95-7.7,11.29,0,20.94,2.56,28.95,7.7,8,5.13,12.01,11.31,12.01,18.55,0,7.24-4,13.43-12.01,18.56-8,5.14-17.65,7.7-28.95,7.7-11.3,0-20.95-2.56-28.95-7.7ZM459.45,44.26c-5.61,3.59-8.42,7.93-8.42,13.01,0,5.09,2.8,9.43,8.42,13.02,5.61,3.59,12.38,5.39,20.31,5.39,7.93,0,14.7-1.8,20.3-5.39,5.61-3.59,8.42-7.93,8.42-13.02,0-5.08-2.8-9.42-8.42-13.01-5.61-3.59-12.38-5.39-20.3-5.39-7.93,0-14.7,1.8-20.31,5.39Z" />
                      </g>
                    </g>
                  </svg>
                  <div className="absolute right-2 top-2">
                    <svg className="h-5 w-5 stroke-[2.2] text-[#e5c365] drop-shadow-[0_1px_4px_rgba(212,175,55,0.35)]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="relative z-20 my-auto mx-auto flex w-full items-center justify-center py-2">
                  <div className="relative h-[162px] w-[270px]">
                    <svg className="h-full w-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]" fill="none" viewBox="0 0 270 162" aria-hidden="true">
                      <path d="M 28 8 H 118" stroke="#f5f5f5" strokeLinecap="round" strokeWidth="4.5" />
                      <path d="M 134 8 H 236 A 16 16 0 0 1 252 24 V 68" stroke="#f5f5f5" strokeLinecap="round" strokeWidth="4.5" />
                      <path d="M 252 84 V 110 L 224 146 H 134" stroke="#f5f5f5" strokeLinecap="round" strokeWidth="4.5" />
                      <path d="M 118 146 H 28 A 16 16 0 0 1 12 130 V 84" stroke="#f5f5f5" strokeLinecap="round" strokeWidth="4.5" />
                      <path d="M 12 68 V 24 A 16 16 0 0 1 28 8" stroke="#f5f5f5" strokeLinecap="round" strokeWidth="4.5" />
                      <path d="M 46 22 H 178 A 10 10 0 0 1 188 32 V 96 L 168 126 H 46 A 10 10 0 0 1 36 116 V 32 A 10 10 0 0 1 46 22 Z" stroke="#b5b5b5" strokeDasharray="6 4" strokeLinecap="round" strokeWidth="1.4" />
                      <path d="M 50 26 H 158 A 8 8 0 0 1 166 34 V 86 L 150 110 H 50 A 8 8 0 0 1 42 102 V 34 A 8 8 0 0 1 50 26 Z" stroke="#b5b5b5" strokeDasharray="5 3.5" strokeLinecap="round" strokeWidth="1.4" />
                      <g transform="translate(54, 34)">
                        <rect fill="url(#goldChipGradHero)" height="44" rx="7" stroke="#7c5e15" strokeWidth="1" width="50" x="0" y="0" />
                        <rect fill="none" height="42" opacity="0.6" rx="6" stroke="#ffe89c" strokeWidth="0.6" width="48" x="1" y="1" />
                        <path d="M 0 15 H 18 M 0 29 H 18" stroke="#694e0e" strokeWidth="1.1" />
                        <path d="M 32 15 H 50 M 32 29 H 50" stroke="#694e0e" strokeWidth="1.1" />
                        <path d="M 18 15 C 18 8 32 8 32 15 V 29 C 32 36 18 36 18 29 Z" fill="none" stroke="#694e0e" strokeWidth="1.1" />
                        <path d="M 25 0 V 10 M 25 34 V 44" stroke="#694e0e" strokeWidth="1.1" />
                        <path d="M 21 19 L 29 25 M 29 19 L 21 25" opacity="0.5" stroke="#694e0e" strokeWidth="0.8" />
                      </g>
                      <defs>
                        <linearGradient id="goldChipGradHero" x1="0%" x2="100%" y1="0%">
                          <stop offset="0%" stopColor="#f7dd88" />
                          <stop offset="30%" stopColor="#e4bf5b" />
                          <stop offset="65%" stopColor="#c89b2f" />
                          <stop offset="100%" stopColor="#e9c669" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div className="relative z-20 flex flex-col items-center justify-center space-y-2 pb-2 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#e5c365] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] sm:text-[13px]">
                    YOUR GLOBAL PARTNER.
                  </p>
                  <p className="text-[10px] font-light uppercase tracking-[0.24em] text-[#e5c365]/90">BOKMOO.COM</p>
                </div>
              </div>
              <div className="relative z-10 -mt-6 flex w-full max-w-[420px] flex-col items-center select-none sm:w-[500px]">
                <div className="z-30 -mb-2 h-3.5 w-[320px] rounded-full bg-black opacity-95 blur-[3px] sm:w-[350px]" />
                <div className="relative z-20 h-[62px] w-full">
                  <div
                    className="absolute inset-0 rounded-[50%] p-[3px] shadow-[0_6px_20px_rgba(0,0,0,0.9)]"
                    style={{ background: 'linear-gradient(90deg, #44320e 0%, #997828 15%, #f6e29a 45%, #ffd978 52%, #b58d34 78%, #3e2e0c 100%)' }}
                  >
                    <div
                      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[50%] border border-white/10"
                      style={{ background: 'radial-gradient(ellipse at 50% 32%, #222226 0%, #131316 60%, #0a0a0c 100%)' }}
                    >
                      <div className="absolute inset-x-12 top-1 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent blur-[1px]" />
                      <div className="h-[84%] w-[96%] rounded-[50%] border border-white/5" />
                      <div className="mt-1 h-2 w-[280px] rounded-full bg-black/80 opacity-90 blur-[2px] sm:w-[310px]" />
                    </div>
                  </div>
                </div>
                <div
                  className="relative z-10 flex h-[50px] w-[99.6%] justify-between overflow-hidden shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
                  style={{
                    background: 'linear-gradient(90deg, #101013 0%, #1c1c20 16%, #28282e 38%, #1a1a1f 65%, #0e0e11 90%, #08080a 100%)',
                    borderLeft: '1px solid rgba(229,195,101,0.35)',
                    borderRight: '1px solid rgba(229,195,101,0.25)',
                  }}
                >
                  <div className="h-full w-24 bg-gradient-to-r from-white/[0.14] via-white/[0.04] to-transparent" />
                  <div className="h-full w-20 bg-gradient-to-l from-black/70 to-transparent" />
                </div>
                <div
                  className="relative z-20 -mt-[31px] h-[62px] w-full rounded-[50%] p-[3px] shadow-[0_20px_40px_rgba(0,0,0,0.95)]"
                  style={{ background: 'linear-gradient(90deg, #3d2c0b 0%, #8c6c22 18%, #f3da88 48%, #ffdf8d 55%, #a8832d 80%, #36260a 100%)' }}
                >
                  <div
                    className="relative flex h-full w-full items-center justify-center"
                    style={{ background: 'linear-gradient(180deg, #19150d 0%, #0c0a06 100%)' }}
                  >
                    <div className="h-full w-full rounded-[50%] border border-white/10" />
                  </div>
                </div>
                <div aria-hidden="true" className="-mt-8 h-14 w-full bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85),transparent_70%)] opacity-95 blur-xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App */}
      <section
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20"
        id="products"
      >
        {/* Phone App Mockup (Left) */}
        <div className="order-2 flex justify-center lg:order-1 lg:col-span-6" data-purpose="app-phone-mockup">
          <div className="w-[310px] rounded-[48px] border border-neutral-700/80 bg-[#17171c] p-3.5 shadow-2xl sm:w-[340px] relative">
            <div className="phone-glass relative space-y-3.5 overflow-hidden rounded-[38px] border border-white/10 p-4 sm:p-5">
              {/* Dynamic Island / Notch Simulation */}
              <div className="absolute left-1/2 top-2 z-20 flex h-4 w-24 -translate-x-1/2 items-center justify-end rounded-full bg-black px-2">
                <div className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-900" />
              </div>
              {/* Smartphone Top Status Bar */}
              <div className="relative z-30 flex select-none items-center justify-between px-2 pt-0.5 text-[11px] font-semibold tracking-tight text-white/90">
                <span className="font-sans tracking-tight text-white">9:41</span>
                <div className="flex items-center gap-1.5">
                  <svg className="h-3 w-4 fill-current text-white" fill="none" viewBox="0 0 17 12" aria-hidden="true">
                    <rect height="3.5" rx="0.75" width="2.5" x="0.5" y="8.5" />
                    <rect height="6" rx="0.75" width="2.5" x="4.5" y="6" />
                    <rect height="8.5" rx="0.75" width="2.5" x="8.5" y="3.5" />
                    <rect height="11.5" rx="0.75" width="2.5" x="12.5" y="0.5" />
                  </svg>
                  <svg className="h-3.5 w-3.5 fill-current text-white" fill="none" viewBox="0 0 16 12" aria-hidden="true">
                    <path clipRule="evenodd" d="M8 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-3.626-2.54a5.13 5.13 0 017.252 0 .8.8 0 001.132-1.13 6.73 6.73 0 00-9.516 0 .8.8 0 001.132 1.13zm-2.83-2.83a9.13 9.13 0 0112.912 0 .8.8 0 001.132-1.132A10.73 10.73 0 00.412 2.998a.8.8 0 101.132 1.132z" fillRule="evenodd" />
                  </svg>
                  <div className="flex items-center gap-0.5">
                    <div className="flex h-2.5 w-5 items-center rounded-[4px] border border-white/80 p-0.5">
                      <div className="h-full w-3 rounded-[1.5px] bg-white" />
                    </div>
                    <div className="h-1 w-0.5 rounded-r-[1px] bg-white/60" />
                  </div>
                </div>
              </div>
              {/* In-App Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 cursor-pointer text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-semibold tracking-tight text-white">
                    {t({ en: 'My eSIM Card', hans: '我的 eSIM 卡片', hant: '我的 eSIM 卡片' })}
                  </span>
                </div>
                <span className="text-xs font-medium text-[#e5c365]">
                  {t({ en: 'Close', hans: '关闭', hant: '關閉' })}
                </span>
              </div>
              {/* Bluetooth Reader Card Component */}
              <div className="group relative w-full select-none overflow-hidden rounded-[18px] border border-[#e5c365]/35 bg-gradient-to-br from-[#1d1b17] via-[#131211] to-[#0c0c0d] p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.85)]">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#e5c365]/15 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-xl" />
                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-medium tracking-wide text-neutral-400">
                        {t({ en: 'Bluetooth card', hans: '蓝牙卡片', hant: '藍牙卡片' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold tracking-[0.16em] text-[#e5c365] drop-shadow-[0_1px_3px_rgba(212,175,55,0.4)]">BOKMOO</span>
                    </div>
                    <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap pt-0.5">
                      <span className="select-all truncate font-mono text-[8px] tracking-tight text-[#d0c5af]/80 sm:text-[9px]">EID {PHONE_EID}</span>
                      <button
                        className="shrink-0 text-neutral-500 transition-colors hover:text-[#E5C365]"
                        title={t({ en: 'Copy EID', hans: '复制 EID', hant: '複製 EID' })}
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(PHONE_EID)}
                      >
                        <svg className="h-2.5 w-2.5 fill-none stroke-[2] stroke-current" viewBox="0 0 24 24" aria-hidden="true">
                          <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                    <div className="pt-1.5">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2d6a3f]/70 bg-[#1b3323] px-2 py-0.5 text-[10px] font-medium text-[#4ade80]">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                        </span>
                        <span>{t({ en: 'Connected', hans: '已连接', hant: '已連線' })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative flex h-20 w-16 shrink-0 flex-col items-center justify-between rounded-xl border border-[#e5c365]/30 bg-gradient-to-b from-[#24211a] via-[#1a1815] to-[#121110] p-1.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.6)]">
                    <div className="flex w-full items-center justify-between px-1">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#38bdf8] shadow-[0_0_6px_#38bdf8]" title="BLE Active" />
                      <svg className="h-3 w-3 fill-none stroke-[2] stroke-current text-[#e5c365]" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="my-auto flex flex-col items-center">
                      <svg className="h-3 w-auto fill-[#e2c26a]" viewBox="0 0 750 82" aria-hidden="true">
                        <path d="M909.71,140.06c-475.11,0-860.29,385.18-860.29,860.67,0,36.3,2.32,71.8,6.95,106.93h404.86c-8.48-34.36-12.72-70.26-12.72-106.93,0-254.71,206.87-461.2,461.2-461.2,255.13,0,461.6,206.49,461.6,461.2,0,36.67-4.24,72.57-12.74,106.93h405.25c4.64-35.13,6.95-70.63,6.95-106.93,0-475.49-385.56-860.67-861.06-860.67Z" />
                        <path d="M1166.39,1000.73c0,38.22-8.12,74.5-23.56,106.93h-465.84c-15.43-32.43-23.54-68.71-23.54-106.93,0-141.64,114.62-256.66,256.66-256.66,141.64,0,256.28,115.01,256.28,256.66Z" />
                      </svg>
                      <span className="mt-0.5 text-[7px] font-bold tracking-widest text-[#e5c365]">BOKMOO</span>
                    </div>
                    <div className="h-0.5 w-8 rounded-full bg-neutral-700/80" />
                  </div>
                </div>
                <div className="relative z-10 mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-neutral-400">
                        {t({ en: 'Reader', hans: '读卡器', hant: '讀卡器' })}
                      </span>
                      <span className="font-mono font-medium text-neutral-200">eSIM-BLE-BF4FDA5A</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-neutral-400">
                      {t({ en: 'Card plans', hans: '卡内套餐', hant: '卡內套餐' })}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs font-semibold leading-none text-[#e5c365]">5</span>
                      <span className="text-[9px] text-neutral-400">
                        {t({ en: 'plans', hans: '个', hant: '個' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* In-App Card Listing Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tracking-tight text-neutral-100">
                    {t({ en: 'eSIM list (5)', hans: 'eSIM 列表（5）', hant: 'eSIM 列表（5）' })}
                  </span>
                  <svg className="h-3.5 w-3.5 cursor-pointer text-neutral-400 transition-colors hover:text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <button className="flex items-center gap-1 rounded-full border border-[#E5C365]/60 bg-[#242119] px-2.5 py-1 text-[11px] font-medium text-[#E5C365] shadow-sm transition-all hover:border-[#E5C365] hover:bg-[#E5C365]/15" type="button">
                  <span>+</span> {t({ en: 'Add eSIM', hans: '添加 eSIM', hant: '添加 eSIM' })}
                </button>
              </div>
              <div className="space-y-2">
                {[
                  {
                    badge: 'T', badgeClass: 'bg-blue-950/80 border-blue-500/40 text-blue-300',
                    name: { en: 'Tigo', hans: 'Tigo', hant: 'Tigo' },
                    iccid: PHONE_ICCIDS[0], active: true,
                  },
                  {
                    badge: '★', badgeClass: 'bg-red-600 text-yellow-300',
                    name: { en: 'China Mobile', hans: 'China Mobile', hant: 'China Mobile' },
                    state: { en: 'In use', hans: '使用中', hant: '使用中' },
                    iccid: PHONE_ICCIDS[1], active: true,
                  },
                  {
                    badge: '5G', badgeClass: 'bg-amber-950/60 border-[#E5C365]/40 text-[#E5C365]',
                    name: { en: 'Global Roam 5G', hans: 'Global Roam 5G', hant: 'Global Roam 5G' },
                    iccid: PHONE_ICCIDS[2], active: false,
                  },
                ].map((row) => (
                  <div key={row.iccid} className="flex items-center justify-between rounded-xl border border-neutral-700/60 bg-[#202025] px-3 py-2.5 transition-colors hover:bg-[#25252b]">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold ${row.badgeClass}`}>
                        {row.badge}
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-200">
                          {t(row.name)}
                          {row.state ? (
                            <span className="rounded border border-[#E5C365]/30 bg-[#E5C365]/20 px-1 py-0.2 font-sans text-[9px] text-[#E5C365]">{t(row.state)}</span>
                          ) : null}
                        </p>
                        <p className="font-mono text-[9px] tracking-tight text-neutral-400">ICCID: {row.iccid}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex h-5 w-9 items-center rounded-full p-0.5 shadow-[0_0_8px_rgba(52,199,89,0.4)] ${row.active ? 'justify-end bg-[#34C759]' : 'justify-start bg-neutral-600'}`}>
                        <div className="h-4 w-4 rounded-full bg-white shadow-md" />
                      </div>
                      <svg className="h-3 w-3 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
          {/* App Description & CTA (Right) */}
          <div className="order-1 space-y-6 text-left lg:order-2 lg:col-span-6">
            <h2 className="text-3xl font-light leading-tight tracking-tight text-white sm:text-4xl">
              {t({
                en: 'Manage Your Connectivity with the BOKMOO App',
                hans: '用 BOKMOO App 管理你的连接',
                hant: '用 BOKMOO App 管理你的連線',
              })}
            </h2>
            <p className="text-sm font-light leading-relaxed text-neutral-400 sm:text-base">
              {t({
                en: 'Switch profiles instantly, monitor data usage in real-time, and purchase destination packages directly inside the official BOKMOO application. Designed for effortless international control.',
                hans: '在官方 BOKMOO App 内即时切换配置、实时监控流量，并直接购买目的地套餐，为轻松掌控全球连接而设计。',
                hant: '在官方 BOKMOO App 內即時切換設定檔、即時監控流量，並直接購買目的地套餐，為輕鬆掌控全球連線而設計。',
              })}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {[
                { icon: <AppleIcon />, label: 'App Store', href: '#ios' },
                { icon: <PlayIcon />, label: 'Google Play', href: '#android' },
                {
                  icon: (
                    <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  label: 'Direct APK',
                  href: '#download-apk',
                },
              ].map((store) => (
                <a
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:border-[#E5C365] hover:text-white"
                  href={store.href}
                  key={store.label}
                  onClick={(event) => {
                    event.preventDefault();
                    openHref('/download/app');
                  }}
                >
                  {store.icon}
                  <span>{store.label}</span>
                </a>
              ))}
            </div>
          </div>
      </section>

      {/* Feature strip */}
      <section className="mx-auto border-t border-neutral-800/60 px-6 py-12" data-purpose="features-summary">
        <div className="grid grid-cols-1 divide-y divide-neutral-800/80 gap-8 md:grid-cols-3 md:gap-6 md:divide-y-0 md:divide-x">
          {[
            {
              icon: (
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              title: { en: 'Fast Activation', hans: '极速激活', hant: '極速激活' },
              copy: { en: 'Get online in minutes', hans: '几分钟即可上网', hant: '幾分鐘即可上網' },
            },
            {
              icon: (
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" x2="22" y1="12" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ),
              title: { en: 'Global Coverage', hans: '全球覆盖', hant: '全球覆蓋' },
              copy: { en: 'Stay connected abroad', hans: '海外保持在线', hant: '海外保持在線' },
            },
            {
              icon: (
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              title: { en: 'Flexible Options', hans: '灵活选择', hant: '靈活選擇' },
              copy: { en: 'SIM and eSIM, your choice', hans: 'SIM 与 eSIM，随你选择', hant: 'SIM 與 eSIM，隨你選擇' },
            },
          ].map((feature) => (
            <div className="flex items-start gap-4 pt-4 md:pt-0 md:px-4 first:pl-0" key={feature.title.en}>
              <div className="mt-1 shrink-0 text-[#E5C365]">{feature.icon}</div>
              <div>
                <h3 className="text-base font-medium text-white">{t(feature.title)}</h3>
                <p className="mt-1 text-sm text-neutral-400">{t(feature.copy)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Destinations */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center" data-purpose="destination-search">
        <h2 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
          {t({ en: 'Find Your Destination', hans: '找到你的目的地', hant: '找到你的目的地' })}
        </h2>
        <p className="mt-2 mb-8 text-sm text-neutral-400 sm:text-base">
          {t({
            en: 'Search for a country or region to explore connectivity options.',
            hans: '搜索国家或地区，探索可用的连接方案。',
            hant: '搜索國家或地區，探索可用的連線方案。',
          })}
        </p>
        <form className="relative mx-auto max-w-xl" onSubmit={submitSearch}>
          <div className="flex items-center rounded-full border border-neutral-700/80 bg-[#1d1d21] py-1.5 pl-5 pr-2 shadow-lg transition-colors focus-within:border-[#E5C365]">
            <svg className="mr-3 h-5 w-5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <input
              aria-label={t({ en: 'Search a country or region', hans: '搜索国家或地区', hant: '搜尋國家或地區' })}
              className="w-full border-none bg-transparent py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:ring-0"
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t({ en: 'Search a country or region', hans: '搜索国家或地区', hant: '搜尋國家或地區' })}
              type="text"
              value={searchValue}
            />
            <button
              aria-label={t({ en: 'Search', hans: '搜索', hant: '搜索' })}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5C365] text-black transition-transform active:scale-95 hover:bg-[#F3D482]"
              type="submit"
            >
              <svg className="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      </section>

      {/* How it works */}
      <section className="mx-auto border-t border-neutral-800/60 px-6 py-16" data-purpose="three-steps" id="how-it-works">
        <h2 className="mb-12 text-center text-3xl font-light tracking-tight text-white sm:text-4xl">
          {t({ en: 'Get Connected in 3 Steps', hans: '三步完成连接', hant: '三步完成連線' })}
        </h2>
        <div className="relative grid grid-cols-1 items-start gap-8 md:grid-cols-3">
          {[
            {
              step: '1',
              title: { en: 'Get BOKMOO', hans: '获取 BOKMOO', hant: '獲取 BOKMOO' },
              copy: { en: 'Use the physical SIM or eSIM.', hans: '使用实体 SIM 或 eSIM。', hant: '使用實體 SIM 或 eSIM。' },
            },
            {
              step: '2',
              title: { en: 'Add & Activate', hans: '添加并激活', hant: '添加並激活' },
              copy: { en: 'Set up in the BOKMOO app.', hans: '在 BOKMOO App 中完成设置。', hant: '在 BOKMOO App 中完成設定。' },
            },
            {
              step: '3',
              title: { en: 'Stay Online', hans: '保持在线', hant: '保持在線' },
              copy: { en: 'Enjoy reliable connectivity around the world.', hans: '在全球享受可靠的连接。', hant: '在全球享受可靠的連線。' },
            },
          ].map((step, index) => (
            <div className="flex items-start gap-4" key={step.step}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E5C365]/60 text-sm font-medium text-[#E5C365]">
                {step.step}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{t(step.title)}</h3>
                <p className="mt-1 text-xs text-neutral-400 sm:text-sm">{t(step.copy)}</p>
              </div>
              {index < 2 ? (
                <div aria-hidden="true" className="ml-auto hidden pt-2 text-neutral-600 md:flex">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                  </svg>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto border-t border-neutral-800/60 px-6 py-16" data-purpose="faq-section" id="support">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-light tracking-tight text-white sm:text-3xl">
            {t({ en: 'FAQ', hans: '常见问题', hant: '常見問題' })}
          </h2>
          <button
            className="inline-flex items-center gap-1.5 text-xs text-[#E5C365] hover:underline sm:text-sm"
            onClick={() => openHref('/help')}
            type="button"
          >
            <span>{t({ en: 'View All Questions', hans: '查看全部问题', hant: '查看全部問題' })}</span>
            <svg className="h-3.5 w-3.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="divide-y divide-neutral-800 border-y border-neutral-800">
          {[
            {
              q: { en: 'What is BOKMOO?', hans: 'BOKMOO 是什么？', hant: 'BOKMOO 是什麼？' },
              a: {
                en: 'BOKMOO is a premier global connectivity solution offering physical SIM cards and instant digital eSIM profiles designed to keep travelers and global professionals smoothly connected across hundreds of worldwide destinations without expensive roaming fees.',
                hans: 'BOKMOO 是全球领先的连接解决方案：实体 SIM 卡与即时数字 eSIM 配置文件，让旅行者与全球专业人士在数百个目的地之间顺畅保持连接，无需支付昂贵的漫游费。',
                hant: 'BOKMOO 是全球領先的連線解決方案：實體 SIM 卡與即時數位 eSIM 設定檔，讓旅行者與全球專業人士在數百個目的地之間順暢保持連線，無需支付昂貴的漫遊費。',
              },
            },
            {
              q: { en: "What's the difference between the physical SIM and eSIM?", hans: '实体 SIM 和 eSIM 有什么区别？', hant: '實體 SIM 和 eSIM 有什麼區別？' },
              a: {
                en: 'Our physical SIM is delivered directly to your door and works seamlessly with all unlocked mobile phones and mobile Wi-Fi routers. The eSIM is completely digital and can be instantly downloaded, scanned, and activated on modern eSIM-compatible devices via our mobile application.',
                hans: '实体 SIM 卡直送到家，兼容所有无锁手机与随身 Wi-Fi；eSIM 完全数字化，可通过移动 App 即时下载、扫码并激活于支持 eSIM 的现代设备。',
                hant: '實體 SIM 卡直送到家，相容所有無鎖手機與行動 Wi-Fi；eSIM 完全數位化，可透過行動 App 即時下載、掃描並啟用於支援 eSIM 的現代裝置。',
              },
            },
            {
              q: { en: 'Where can I use BOKMOO?', hans: 'BOKMOO 可以在哪些地方使用？', hant: 'BOKMOO 可以在哪些地方使用？' },
              a: {
                en: 'BOKMOO operates in over 190+ countries and territories worldwide, collaborating with top-tier telecommunications carriers to ensure high-speed 4G LTE and 5G connectivity wherever your journeys take you.',
                hans: 'BOKMOO 覆盖全球 190+ 个国家和地区，与顶级运营商合作，无论旅程走到哪里都确保高速 4G LTE 与 5G 连接。',
                hant: 'BOKMOO 覆蓋全球 190+ 個國家和地區，與頂級電信運營商合作，無論旅程走到哪裡都確保高速 4G LTE 與 5G 連線。',
              },
            },
          ].map((item) => (
            <details className="group py-5 transition-colors" key={item.q.en}>
              <summary className="flex cursor-pointer list-none items-center justify-between text-neutral-200 transition-colors group-hover:text-white">
                <span className="text-sm font-medium sm:text-base">{t(item.q)}</span>
                <span className="faq-icon text-neutral-400 transition-transform duration-200">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm font-light leading-relaxed text-neutral-400">{t(item.a)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
});
